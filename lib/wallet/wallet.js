import bn from 'bn.js';
import { KeyWallet, NewMasterKey } from "./hdwallet";
import { MnemonicGenerator } from "./mnemonic";
import CryptoJS from "crypto-js";
import JSON from "circular-json";
import { KeySet } from '../keySet';
import { PaymentAddress, ViewingKey, PaymentInfo } from '../key';
import { RpcClient } from "../rpcclient/rpcclient";
import { RPCHttpService } from "../rpcclient/rpchttpservice";
import { setRandBytesFunc, hashSha3BytesToBytes } from "../privacy/utils";
import {
  FailedTx,
  SuccessTx,
  ConfirmedTx,
  MetaStakingBeacon,
  MetaStakingShard,
  PaymentAddressType,
  ReadonlyKeyType,
  PriKeyType,
  BurningRequestMeta,
  WithDrawRewardRequestMeta,
  PDEContributionMeta,
  PDETradeRequestMeta,
  PDEWithdrawalRequestMeta
} from "./constants";
import { CustomTokenTransfer, MAX_INPUT_PER_TX } from '../tx/constants';
import { checkEncode } from "../base58";
import { getShardIDFromLastByte } from "../common";
import { AccountWallet } from "./accountWallet";
import { TxHistoryInfo } from "./history";
import { getEstimateFee, getEstimateFeeForPToken, getMaxWithdrawAmount } from "../tx/utils";
import { toNanoPRV, toPRV } from "./utils";
import { generateECDSAKeyPair } from "../privacy/ecdsa";
import { generateBLSKeyPair } from "../privacy/bls";
import { ENCODE_VERSION, ED25519_KEY_SIZE } from "../constants";
import { CustomError, ErrorObject } from "../errorhandler";
import { generateBLSPubKeyB58CheckEncodeFromSeed } from "../committeekey";
import { hybridEncryption, hybridDecryption} from "../privacy/hybridEncryption";
import { encryptMessageOutCoin, decryptMessageOutCoin } from "./utils";
import { newWordList } from './wordlist';

const constants = {
  CustomTokenTransfer,
  MAX_INPUT_PER_TX,
};

export const getChildIdFromChildNumberArray = (array) => {
  let value = 0;
  for (let i = 0; i < array.length; i++) {
    value = (value * 256) + array[i];
  }

  return value;
};


class Wallet {
  constructor() {
    this.Seed = [];
    this.Entropy = [];
    this.PassPhrase = "";
    this.Mnemonic = "";
    this.MasterAccount = new AccountWallet();
    this.Name = "";
    this.Storage = null;
  }

  async init(passPhrase, storage, walletName, accountName = 'Anon') {
    // generate mnenomic generator
    let mnemonicGen = new MnemonicGenerator();
    this.Name = walletName;
    try {
      this.Entropy = mnemonicGen.newEntropy(128);
    } catch (e) {
      throw new CustomError(ErrorObject.NewEntropyErr, e.message || "Can not create new entropy when initing wallet");
    }

    // mnemonic
    this.Mnemonic = mnemonicGen.newMnemonic(this.Entropy);

    // seed
    this.Seed = mnemonicGen.newSeed(this.Mnemonic, passPhrase);

    // passphrase
    this.PassPhrase = passPhrase;

    // generate master key from seed
    const masterKey = await NewMasterKey(this.Seed);

    // master account with master key
    this.MasterAccount = new AccountWallet();
    this.MasterAccount.key = masterKey;
    this.MasterAccount.child = [];
    this.MasterAccount.name = "master";

    const childKey = await this.MasterAccount.key.newChildKey(0);
    const account = new AccountWallet();
    account.name = accountName;
    account.child = [];
    account.key = childKey;
    this.MasterAccount.child.push(account);
    this.Storage = storage;
  }

  /**
   *
   * @param {string} mnemonicWords // Ex: "ability able about above absent absorb abstract absurd abuse access accident account"
   * @param {string} passPhrase
   * @param {number} numOfAccount
   * @param {string} name
   * @param {*} storage
   * @param {number} shardID
   */
  async import(mnemonicWords, passPhrase, numOfAccount, name, storage, shardID = null) {
    // check passphrase
    // if (this.PassPhrase !== passPhrase){
    //   throw new CustomError(ErrorObject.WrongPassPhraseErr, "Wrong passphrase when importing wallet");
    // }

    // passphrase
    this.PassPhrase = passPhrase;

    // check mnemonic words
    // if (mnemonicWords.length !== MenmonicWordLen){
    //   throw new CustomError(ErrorObject.MnemonicInvalidErr, "Must be 12 words");
    // }

    // generate mnenomic generator
    let mnemonicGen = new MnemonicGenerator();
    this.Name = name;
    // try {
    //   this.Entropy = mnemonicGen.newEntropy(128);
    // } catch (e) {
    //   throw new CustomError(ErrorObject.NewEntropyErr, e.message || "Can not create new entropy when initing wallet");
    // }

    // mnemonic
    this.Mnemonic = mnemonicWords;

    // seed
    const wordList = newWordList('english');
    const words = this.Mnemonic.split(' ');

    if (words.length === 12 && words.some(word => !wordList.includes(word))) {
      throw new CustomError(ErrorObject.MnemonicInvalidErr, ErrorObject.MnemonicInvalidErr.description);
    }

    this.Seed = mnemonicGen.newSeed(this.Mnemonic, passPhrase);

    // generate master key from seed
    let masterKey = await NewMasterKey(this.Seed);

    // master account with master key
    this.MasterAccount = new AccountWallet();
    this.MasterAccount.key = masterKey;
    this.MasterAccount.child = [];
    this.MasterAccount.name = "master";

    // if (numOfAccount === 0) {
    //   numOfAccount = 1;
    // }

    // generate account(s)
    if (shardID !== null) {
      // only create account for specific Shard
      for (let i = 0; i < numOfAccount; i++) {
        let newIndex = 0;
        for (let j = this.MasterAccount.child.length - 1; j >= 0; j--) {
          let temp = this.MasterAccount.child[j];
          if (!temp.isImport) {
            let childNumber = new bn(temp.key.ChildNumber);
            newIndex = childNumber.toNumber() + 1;
            break;
          }
        }

        let childKey = null;
        while (true) {
          childKey = await this.MasterAccount.key.newChildKey(newIndex);
          let lastByte = childKey.KeySet.PaymentAddress.Pk[childKey.KeySet.PaymentAddress.Pk.length - 1];
          if (getShardIDFromLastByte(lastByte) == shardID) {
            break;
          }
          newIndex += 1
        }

        let account = new AccountWallet();
        account.name = i === 0 ? "Anon" : "Anon " + i;
        account.child = [];
        account.key = childKey;
        this.MasterAccount.child.push(account)
      }
    } else {
      // create account for any shard
      for (let i = 0; i < numOfAccount; i++) {
        let childKey = await this.MasterAccount.key.newChildKey(i);
        let account = new AccountWallet();
        account.name = i === 0 ? "Anon" : "Anon " + i;
        account.child = [];
        account.key = childKey;
        this.MasterAccount.child.push(account)
      }
    }

    this.Storage = storage;
  }

  getAccountByName(accountName) {
    return this.MasterAccount.child.find(item => item.name === accountName)
  }

  getAccountIndexByName(accountName) {
    return this.MasterAccount.child.findIndex(item => item.name === accountName)
  }

  getAccountId(accountName) {
    const account = this.MasterAccount.child.findIndex(item => item.name === accountName);
    return getChildIdFromChildNumberArray(account.key.ChildNumber);
  }

  async getCreatedAccounts(deserialize = true) {
    let createdAccounts = [];

    for (const account of this.MasterAccount.child) {
      const id = getChildIdFromChildNumberArray(account.key.ChildNumber);

      const newAccount = await this.createAccountWithId(id);

      const newPrivateKey = newAccount.key.base58CheckSerialize(PriKeyType);
      const oldPrivateKey = account.key.base58CheckSerialize(PriKeyType);

      if (newPrivateKey === oldPrivateKey) {
        createdAccounts.push(account);
      }
    }

    if (deserialize) {
      const deserializeCreatedAccounts = [];
      for (const account of createdAccounts) {
        const info = await account.getDeserializeInformation();
        deserializeCreatedAccounts.push(info);
      }

      createdAccounts = deserializeCreatedAccounts;
    }

    return createdAccounts;
  }

  async hasCreatedAccount(privateKey) {
    const accountName = 'Test';
    const newAccount = await this.createAccountWithPrivateKey(privateKey, accountName);
    const childId = await getChildIdFromChildNumberArray(newAccount.key.ChildNumber);

    const newAccountWithId = await this.createAccountWithId(childId, accountName);

    return (
      newAccountWithId.key.base58CheckSerialize(PriKeyType) === privateKey &&
      newAccountWithId.key.base58CheckSerialize(PriKeyType) === newAccount.key.base58CheckSerialize(PriKeyType)
    )
  }

  /**
   * Create and add account to wallet
   * @param accountName
   * @param shardID
   * @returns {*}
   */
  async createNewAccount(accountName, shardID = null) {
    const newAccount = await this.createAccount(accountName, shardID);
    this.MasterAccount.child.push(newAccount);
    this.save(this.PassPhrase);

    return newAccount;
  }

  async createAccount(accountName, shardID) {
    let childKey;

    while (true) {
      // Random a integer between [1-2e9]
      const newIndex = Math.floor(Math.random() * (2e9 - 1 + 1)) + 1;
      childKey = await this.MasterAccount.key.newChildKey(newIndex);
      const lastByte = childKey.KeySet.PaymentAddress.Pk[childKey.KeySet.PaymentAddress.Pk.length - 1];
      const existedAccount = this.MasterAccount.child.find(account => childKey === account.key);

      console.debug('NEW INDEX', newIndex, lastByte, existedAccount);

      if (existedAccount || (shardID !== null && getShardIDFromLastByte(lastByte) !== shardID)) {
        continue;
      }

      const accountWallet = new AccountWallet();
      accountWallet.key = childKey;
      accountWallet.child = [];
      accountWallet.name = accountName || newIndex;

      return accountWallet;
    }
  }

  async createAccountWithPrivateKey(privakeyStr, accountName) {
    let keyWallet;
    try {
      keyWallet = KeyWallet.base58CheckDeserialize(privakeyStr)
    } catch (e) {
      throw new CustomError(ErrorObject.B58CheckDeserializedErr, "Can not base58 check deserialized private key of importing account");;
    }

    if (keyWallet.KeySet.PrivateKey.length !== ED25519_KEY_SIZE) {
      throw new CustomError(ErrorObject.PrivateKeyInvalidErr, "Private key is empty");
    }

    await keyWallet.KeySet.importFromPrivateKey(keyWallet.KeySet.PrivateKey);

    let account = new AccountWallet();
    account.key = keyWallet;
    account.child = [];
    account.isImport = true;
    account.name = accountName;

    return account;
  }

  async createAccountWithId(accountId, accountName) {
    const childKey = await this.MasterAccount.key.newChildKey(accountId);
    const accountWallet = new AccountWallet();
    accountWallet.key = childKey;
    accountWallet.child = [];
    accountWallet.name = accountName;

    return accountWallet;
  }

  exportAccountPrivateKey(childIndex) {
    return this.MasterAccount.child[childIndex].key.base58CheckSerialize(PriKeyType);
  }

  exportAccountReadonlyKey(childIndex) {
    return this.MasterAccount.child[childIndex].key.base58CheckSerialize(ReadonlyKeyType);
  }

  validateAccountName(name) {
    if (!name) {
      throw new CustomError(ErrorObject.InvalidAccountName, "Account name is invalid");
    }

    for (let i = 0; i < this.MasterAccount.child.length; i++) {
      let account = this.MasterAccount.child[i];

      if (account.name === name) {
        throw new CustomError(ErrorObject.ExistedAccountErr, "Name of importing account was existed");
      }
    }
  }

  validatePrivateKey(privateKey) {
    for (let i = 0; i < this.MasterAccount.child.length; i++) {
      let account = this.MasterAccount.child[i];

      if (account.key.base58CheckSerialize(PriKeyType) == privateKey) {
        throw new CustomError(ErrorObject.ExistedAccountErr, "Private key of importing account was existed");
      }
    }
  }

  removeAccount(accPrivateKeyStr, passPhrase) {
    for (let i = 0; i < this.MasterAccount.child.length; i++) {
      let account = this.MasterAccount.child[i];
      if (account.key.base58CheckSerialize(PriKeyType) === accPrivateKeyStr) {
        this.MasterAccount.child.splice(i, 1);
        this.save(passPhrase);
        return;
      }
    }
    throw new CustomError(ErrorObject.UnexpectedErr, "Account need to be removed is not existed");
  }

  async importAccount(privakeyStr, accountName, passPhrase) {
    for (let i = 0; i < this.MasterAccount.child.length; i++) {
      let account = this.MasterAccount.child[i];

      if (account.key.base58CheckSerialize(PriKeyType) === privakeyStr) {
        throw new CustomError(ErrorObject.ExistedAccountErr, "Private key of importing account was existed");
      }

      if (account.name === accountName) {
        throw new CustomError(ErrorObject.ExistedAccountErr, "Name of importing account was existed");
      }
    }

    const account = await this.createAccountWithPrivateKey(privakeyStr, accountName);

    this.MasterAccount.child.push(account);
    this.save(this.PassPhrase || passPhrase);
    return account
  }

  async importAccountWithId(accountId, accountName, index = 0) {
    try {
      this.validateAccountName(accountName);
    } catch {
      this.importAccountWithId(accountId, accountName + index, index + 1);
    }

    const account = await this.createAccountWithId(accountId, accountName);

    this.validatePrivateKey(account.key.base58CheckSerialize(PriKeyType));

    this.MasterAccount.child.push(account);
    this.save(this.PassPhrase);

    return account;
  }

  save(password = '') {
    if (password === '') {
      password = this.PassPhrase
    }

    // parse to byte[]
    for (let i = 0; i < this.MasterAccount.child.length; i++) {
      this.MasterAccount.child[i].key.ChainCode = Array.from(this.MasterAccount.child[i].key.ChainCode);
      this.MasterAccount.child[i].key.ChildNumber = Array.from(this.MasterAccount.child[i].key.ChildNumber);
      this.MasterAccount.child[i].key.KeySet.PrivateKey = Array.from(this.MasterAccount.child[i].key.KeySet.PrivateKey);
      this.MasterAccount.child[i].key.KeySet.PaymentAddress.Pk = Array.from(this.MasterAccount.child[i].key.KeySet.PaymentAddress.Pk)
      this.MasterAccount.child[i].key.KeySet.PaymentAddress.Tk = Array.from(this.MasterAccount.child[i].key.KeySet.PaymentAddress.Tk)
      this.MasterAccount.child[i].key.KeySet.ReadonlyKey.Pk = Array.from(this.MasterAccount.child[i].key.KeySet.ReadonlyKey.Pk)
      this.MasterAccount.child[i].key.KeySet.ReadonlyKey.Rk = Array.from(this.MasterAccount.child[i].key.KeySet.ReadonlyKey.Rk)
    }

    this.MasterAccount.key.ChainCode = Array.from(this.MasterAccount.key.ChainCode);
    this.MasterAccount.key.ChildNumber = Array.from(this.MasterAccount.key.ChildNumber);
    this.MasterAccount.key.KeySet.PrivateKey = Array.from(this.MasterAccount.key.KeySet.PrivateKey);
    this.MasterAccount.key.KeySet.PaymentAddress.Pk = Array.from(this.MasterAccount.key.KeySet.PaymentAddress.Pk);
    this.MasterAccount.key.KeySet.PaymentAddress.Tk = Array.from(this.MasterAccount.key.KeySet.PaymentAddress.Tk);
    this.MasterAccount.key.KeySet.ReadonlyKey.Pk = Array.from(this.MasterAccount.key.KeySet.ReadonlyKey.Pk);
    this.MasterAccount.key.KeySet.ReadonlyKey.Rk = Array.from(this.MasterAccount.key.KeySet.ReadonlyKey.Rk);

    // remove cached of master account and its childs from wallet before saving wallet
    let masterDerivatorToSerialNumberCache = this.MasterAccount.derivatorToSerialNumberCache;
    this.MasterAccount.derivatorToSerialNumberCache = {};

    let masterSpentCoinCached = this.MasterAccount.spentCoinCached;
    this.MasterAccount.spentCoinCached = {};

    let childDerivatorToSerialNumberCaches = new Array(this.MasterAccount.child.length);
    let childSpentCoinCacheds = new Array(this.MasterAccount.child.length);

    for (let i = 0; i < this.MasterAccount.child.length; i++) {

      childDerivatorToSerialNumberCaches[i] = this.MasterAccount.child[i].derivatorToSerialNumberCache;
      childSpentCoinCacheds[i] = this.MasterAccount.child[i].spentCoinCached;

      this.MasterAccount.child[i].derivatorToSerialNumberCache = {};
      this.MasterAccount.child[i].spentCoinCached = {};
    }

    let data = JSON.stringify(this);

    this.MasterAccount.derivatorToSerialNumberCache = masterDerivatorToSerialNumberCache;
    this.MasterAccount.spentCoinCached = masterSpentCoinCached;
    for (let i = 0; i < childDerivatorToSerialNumberCaches.length; i++) {
      this.MasterAccount.child[i].derivatorToSerialNumberCache = childDerivatorToSerialNumberCaches[i];
      this.MasterAccount.child[i].spentCoinCached = childSpentCoinCacheds[i];
    }

    // encrypt
    let cipherText = CryptoJS.AES.encrypt(data, password);

    // storage
    if (this.Storage != null) {
      return this.Storage.setItem(this.Name, cipherText.toString());
    }
  }

  clearCached(storage) {
    this.MasterAccount.clearCached(storage);
    for (let i = 0; i < this.MasterAccount.child.length; i++) {
      this.MasterAccount.child[i].clearCached(storage, `${this.Name}-${this.MasterAccount.child[i].name}-cached`);
    }
    this.save('');
  }

  async getHistoryByAccount(accName) {
    let account = this.getAccountByName(accName);
    return account.getNormalTxHistory();
  }

  async loadWallet(password) {
    if (this.Storage != null) {
      let cipherText = await this.Storage.getItem(this.Name);
      if (!cipherText) return false;
      let data = CryptoJS.AES.decrypt(cipherText, password);
      let jsonStr = data.toString(CryptoJS.enc.Utf8);

      try {
        let obj = JSON.parse(jsonStr);
        Object.setPrototypeOf(obj, Wallet.prototype);
        Object.setPrototypeOf(obj.MasterAccount, AccountWallet.prototype);
        Object.setPrototypeOf(obj.MasterAccount.key, KeyWallet.prototype);

        Object.assign(this, obj);

        for (let i = 0; i < obj.MasterAccount.child.length; i++) {
          Object.setPrototypeOf(obj.MasterAccount.child[i], AccountWallet.prototype);
          Object.setPrototypeOf(obj.MasterAccount.child[i].key, KeyWallet.prototype);

          // chaincode
          Object.setPrototypeOf(obj.MasterAccount.child[i].key.ChainCode, Array.prototype);
          obj.MasterAccount.child[i].key.ChainCode = new Uint8Array(obj.MasterAccount.child[i].key.ChainCode)

          // child num
          Object.setPrototypeOf(obj.MasterAccount.child[i].key.ChildNumber, Array.prototype);
          obj.MasterAccount.child[i].key.ChildNumber = new Uint8Array(obj.MasterAccount.child[i].key.ChildNumber)

          Object.setPrototypeOf(obj.MasterAccount.child[i].key.KeySet, KeySet.prototype);

          // payment address
          Object.setPrototypeOf(obj.MasterAccount.child[i].key.KeySet.PaymentAddress, PaymentAddress.prototype);
          Object.setPrototypeOf(obj.MasterAccount.child[i].key.KeySet.PaymentAddress.Pk, Array.prototype);
          obj.MasterAccount.child[i].key.KeySet.PaymentAddress.Pk = new Uint8Array(obj.MasterAccount.child[i].key.KeySet.PaymentAddress.Pk);
          Object.setPrototypeOf(obj.MasterAccount.child[i].key.KeySet.PaymentAddress.Tk, Array.prototype);
          obj.MasterAccount.child[i].key.KeySet.PaymentAddress.Tk = new Uint8Array(obj.MasterAccount.child[i].key.KeySet.PaymentAddress.Tk);

          // read only key
          Object.setPrototypeOf(obj.MasterAccount.child[i].key.KeySet.ReadonlyKey, ViewingKey.prototype);
          Object.setPrototypeOf(obj.MasterAccount.child[i].key.KeySet.ReadonlyKey.Pk, Array.prototype);
          obj.MasterAccount.child[i].key.KeySet.ReadonlyKey.Pk = new Uint8Array(obj.MasterAccount.child[i].key.KeySet.ReadonlyKey.Pk);
          Object.setPrototypeOf(obj.MasterAccount.child[i].key.KeySet.ReadonlyKey.Rk, Array.prototype);
          obj.MasterAccount.child[i].key.KeySet.ReadonlyKey.Rk = new Uint8Array(obj.MasterAccount.child[i].key.KeySet.ReadonlyKey.Rk);

          // private key
          Object.setPrototypeOf(obj.MasterAccount.child[i].key.KeySet.PrivateKey, Array.prototype);
          obj.MasterAccount.child[i].key.KeySet.PrivateKey = new Uint8Array(obj.MasterAccount.child[i].key.KeySet.PrivateKey);
        }

        Object.assign(this, obj);
      } catch (e) {

        throw new CustomError(ErrorObject.LoadWalletErr, e.message || "Error when load wallet");
      }
    }
  }

  async loadAccountsCached(accName = null) {
    if (accName) {
      let account = this.getAccountByName(accName);
      return await account.loadAccountCached(this.Storage);
    }

    await this.MasterAccount.loadAccountCached(this.Storage);
    for (let i = 0; i < this.MasterAccount.child.length; i++) {
      await this.MasterAccount.child[i].loadAccountCached(this.Storage);
    }
  }

  async listAccount() {
    const accounts = [];

    for (let index = 0; index < this.MasterAccount.child.length; index++) {
      const account = this.MasterAccount.child[index];
      const info = await account.getDeserializeInformation();

      accounts.push({
        ...info,
        "Index": index,
      });
    }

    return accounts;
  }

  async listAccountWithBLSPubKey() {
    let accounts = [];

    for (let i = 0; i < this.MasterAccount.child.length; i++) {
      let child = this.MasterAccount.child[i];
      let miningSeedKey = hashSha3BytesToBytes(hashSha3BytesToBytes(child.key.KeySet.PrivateKey));
      let blsPublicKey = await generateBLSPubKeyB58CheckEncodeFromSeed(miningSeedKey);

      accounts[i] = {
        "AccountName": child.name,
        "BLSPublicKey": blsPublicKey,
        "Index": i,
      }
    }

    return accounts;
  }

  async updateStatusHistory() {
    for (let i = 0; i < this.MasterAccount.child.length; i++) {
      await this.MasterAccount.child[i].updateAllTransactionsStatus();
    }
  }

  async updateTxStatus(txId) {
    let tx;
    let account;
    for (account of this.MasterAccount.child) {
      const nativeTx = account.txHistory.NormalTx.find(item => item.txID === txId);
      const coinTx = account.txHistory.PrivacyTokenTx.find(item => item.txID === txId);

      tx = nativeTx || coinTx;

      if (tx) {
        break;
      }
    }

    if (!tx || !account) {
      return;
    }

    let response;
    try {
      response = await Wallet.RpcClient.getTransactionByHash(txId);
    } catch (e) {
      throw new CustomError(ErrorObject.GetTxByHashErr, e.message);
    }

    if (response.isInBlock) {
      tx.status = ConfirmedTx;

      if (tx.isPrivacyNativeToken) {
        account.removeObjectFromSpendingCoins(txId);
      }
    } else if (!response.isInBlock && !response.isInMempool && response.err !== null) {
      tx.status = FailedTx;

      if (tx.isPrivacyNativeToken) {
        account.removeObjectFromSpendingCoins(txId);
      }
    }
  }

  deleteWallet() {
    try {
      if (typeof this.Storage.removeItem === 'function') {
        this.Storage.removeItem("Wallet");
      }
    } catch (e) {
      throw new CustomError(ErrorObject.DeleteWalletErr, e.message || "Can not remove item in storage");
    }
  }

  static RpcClient = new RpcClient();
  static RandomBytesFunc = null;

  static setPrivacyUtilRandomBytesFunc(randomBytesFunc) {
    setRandBytesFunc(randomBytesFunc);
  }

  static ProgressTx = 0;

  static sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  static async updateProgressTx(progress) {
    Wallet.ProgressTx = progress;
    await Wallet.sleep(100);
  }

  static async resetProgressTx() {
    await Wallet.updateProgressTx(0);
  }

  static ShardNumber = 8;

  static Debug = '';
}

class DefaultStorage {
  constructor() {
    this.Data = {}
  }

  async setItem(key, value) {
    this.Data[key] = value
    return Promise.resolve()
  }

  async getItem(key) {
    return this.Data[key];
  }
}

export {
  Wallet, AccountWallet, DefaultStorage, TxHistoryInfo,
  RpcClient, PaymentInfo, KeyWallet,
  FailedTx,
  SuccessTx,
  ConfirmedTx,
  MetaStakingBeacon,
  MetaStakingShard,
  checkEncode,
  getEstimateFee, getEstimateFeeForPToken,
  getMaxWithdrawAmount,
  toNanoPRV,
  toPRV,
  getShardIDFromLastByte,
  generateECDSAKeyPair,
  generateBLSKeyPair,
  RPCHttpService,
  BurningRequestMeta,
  WithDrawRewardRequestMeta,
  PDEContributionMeta,
  PDETradeRequestMeta,
  PDEWithdrawalRequestMeta,
  hybridEncryption, hybridDecryption,
  encryptMessageOutCoin, decryptMessageOutCoin,
  constants,
  MnemonicGenerator,
}
