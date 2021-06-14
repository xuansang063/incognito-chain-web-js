import _ from "lodash";
import Validator from "./utils/validator";
import { KeySet } from "./common/keySet";
import { PaymentAddress, ViewingKey, PaymentInfo } from "./common/key";
import { RpcClient } from "./rpcclient/rpcclient";
import { setRandBytesFunc, hashSha3BytesToBytes } from "./privacy/utils";
import { hybridEncryption, hybridDecryption } from "./privacy/hybridEncryption";
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
  PDEPRVRequiredContributionRequestMeta,
  PDETradeRequestMeta,
  PDECrossPoolTradeRequestMeta,
  PDEWithdrawalRequestMeta,
  PRVIDSTR,
  KeyWallet,
  NewKey,
  TxHistoryInfo,
  toNanoPRV,
  toPRV,
  encryptMessageOutCoin,
  decryptMessageOutCoin,
} from "./core";
import {
  CustomTokenTransfer,
  CustomTokenInit,
  MAX_INPUT_PER_TX,
} from "./tx/constants";
import { checkEncode } from "./common/base58";
import {
  getShardIDFromLastByte,
  getChildIdFromChildNumberArray,
} from "./common/common";
import { Account } from "@lib/module/Account";
import {
  getEstimateFee,
  getEstimateFeeForPToken,
  getMaxWithdrawAmount,
} from "./tx/utils";
import { generateECDSAKeyPair } from "./privacy/ecdsa";
import { generateBLSKeyPair } from "./privacy/bls";
import { ENCODE_VERSION, ED25519_KEY_SIZE } from "./common/constants";
import { CustomError, ErrorObject } from "./common/errorhandler";
import { generateBLSPubKeyB58CheckEncodeFromSeed } from "./common/committeekey";
import { defaultCoinChooser as coinChooser } from "./services/coinChooser";
import CryptoJS from "crypto-js";
import { newMnemonic, newSeed, validateMnemonic } from "./core/mnemonic";
import { RpcHTTPCoinServiceClient } from "./rpcclient/rpchttpcoinservice";
import { PrivacyVersion } from "./core/constants";
import ACCOUNT_CONSTANT from "./module/Account/account.constants";
import { wasm } from "./wasm";

const constants = {
  CustomTokenTransfer,
  MAX_INPUT_PER_TX,
};

class Wallet {
  constructor() {
    this.PassPhrase = "";
    this.Mnemonic = "";
    this.MasterAccount = new Account(this);
    this.Name = "";
    this.Storage = null;
    this.Seed = "";
  }

  async init(passPhrase, storage, walletName, accountName) {
    new Validator("passPhrase", passPhrase).required().string();
    new Validator("storage", storage).required().object();
    new Validator("walletName", walletName).required().string();
    new Validator("accountName", accountName).required().string();
    new Validator("WASM", wasm).required().object();
    console.log(typeof wasm);
    this.Name = walletName;
    this.Mnemonic = newMnemonic();
    this.PassPhrase = passPhrase;
    this.IsBIP44 = true;
    this.Storage = storage;
    console.log("init wallet");
    await this._generateMasterAccount();
    await this._generateFirstAccount(accountName);
    return this;
  }

  /**
   *
   * @param {string} mnemonic // Ex: "ability able about above absent absorb abstract absurd abuse access accident Account"
   * @param {string} passPhrase
   * @param {string} name
   * @param {*} storage
   */
  async import(mnemonic, passPhrase, name, storage) {
    // check passphrase
    // if (this.PassPhrase !== passPhrase){
    //   throw new CustomError(ErrorObject.WrongPassPhraseErr, "Wrong passphrase when importing wallet");
    // }

    if (!validateMnemonic(mnemonic)) {
      throw new CustomError(
        ErrorObject.MnemonicInvalidErr,
        ErrorObject.MnemonicInvalidErr.description
      );
    }

    this.PassPhrase = passPhrase;
    this.Name = name;
    this.IsBIP44 = true;
    this.Mnemonic = mnemonic;

    await this._generateMasterAccount();
    await this._generateFirstAccount();

    this.Storage = storage;
  }

  async _generateMasterAccount() {
    this.Seed = newSeed(this.Mnemonic);
    const masterAccountKey = await NewKey(this.Seed, 0, -1);
    this.MasterAccount = new Account(Wallet);
    this.MasterAccount.key = masterAccountKey;
    this.MasterAccount.child = [];
    this.MasterAccount.name = "master";
  }

  async _generateFirstAccount(accountName = "Anon") {
    const account = await this.createAccountWithId(1, accountName);
    this.MasterAccount.child.push(account);
  }

  getAccountByName(accountName) {
    return this.MasterAccount.child.find((item) => item.name === accountName);
  }

  getAccountIndexByName(accountName) {
    return this.MasterAccount.child.findIndex(
      (item) => item.name.toLowerCase() === accountName.toLowerCase()
    );
  }

  async getCreatedAccounts({ deserialize = true } = {}) {
    new Validator("deserialize", deserialize).boolean();
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
    const accountName = "Test";
    const newAccount = await this.createAccountWithPrivateKey(
      privateKey,
      accountName
    );
    const childId = await getChildIdFromChildNumberArray(
      newAccount.key.ChildNumber
    );
    const newAccountWithId = await this.createAccountWithId(
      childId,
      accountName
    );
    return (
      newAccountWithId.key.base58CheckSerialize(PriKeyType) === privateKey &&
      newAccountWithId.key.base58CheckSerialize(PriKeyType) ===
        newAccount.key.base58CheckSerialize(PriKeyType)
    );
  }

  /**
   * Create and add Account to wallet
   * @param accountName
   * @param shardID
   * @returns {*}
   */
  async createNewAccount(accountName, shardID = null, excludedIds) {
    new Validator("accountName", accountName).required().string();
    new Validator("shardID", shardID).number();
    new Validator("excludedIds", excludedIds).array();
    const newAccount = await this.createAccount(
      accountName,
      shardID,
      excludedIds
    );
    this.MasterAccount.child.push(newAccount);
    await this.save(this.PassPhrase);
    return newAccount;
  }

  async createAccount(accountName, shardID, excludedIds = []) {
    let childKey;

    const createdAccounts = await this.getCreatedAccounts(true);
    const createdIds = createdAccounts.map((item) => item.ID);

    const possibleIds = createdIds.filter((id) => !createdIds.includes(id + 1));

    let newId = possibleIds.length > 0 ? Math.min(...possibleIds) + 1 : 1;

    const createdPrivateKeys = createdAccounts.map((item) => item.PrivateKey);

    while (true) {
      childKey = await NewKey(this.Seed, newId, 0);
      const newPrivateKey = childKey.base58CheckSerialize(PriKeyType);
      const lastByte =
        childKey.KeySet.PaymentAddress.Pk[
          childKey.KeySet.PaymentAddress.Pk.length - 1
        ];
      const isExisted = createdPrivateKeys.includes(newPrivateKey);

      if (
        isExisted ||
        (_.isNumber(shardID) && lastByte !== shardID) ||
        excludedIds.includes(newId)
      ) {
        newId++;
        continue;
      }

      const accountWallet = new Account(Wallet);
      accountWallet.key = childKey;
      accountWallet.child = [];
      accountWallet.name = accountName || newId;

      return accountWallet;
    }
  }

  async createAccountWithPrivateKey(privakeyStr, accountName) {
    new Validator("privakeyStr", privakeyStr).string().required();
    new Validator("accountName", accountName).string().required();
    let keyWallet;
    try {
      keyWallet = KeyWallet.base58CheckDeserialize(privakeyStr);
    } catch (e) {
      throw new CustomError(
        ErrorObject.B58CheckDeserializedErr,
        "Can not base58 check deserialized private key of importing Account"
      );
    }
    if (keyWallet.KeySet.PrivateKey.length !== ED25519_KEY_SIZE) {
      throw new CustomError(
        ErrorObject.PrivateKeyInvalidErr,
        "Private key is empty"
      );
    }
    await keyWallet.KeySet.importFromPrivateKey(keyWallet.KeySet.PrivateKey);
    let account = new Account(Wallet);
    account.key = keyWallet;
    account.child = [];
    account.isImport = true;
    account.name = accountName;
    return account;
  }

  async createAccountWithId(accountId, accountName) {
    const childKey = await NewKey(this.Seed, accountId, 0);
    const accountWallet = new Account(Wallet);
    accountWallet.key = childKey;
    accountWallet.child = [];
    accountWallet.name = accountName;
    return accountWallet;
  }

  exportAccountPrivateKey(childIndex) {
    return this.MasterAccount.child[childIndex].key.base58CheckSerialize(
      PriKeyType
    );
  }

  exportAccountReadonlyKey(childIndex) {
    return this.MasterAccount.child[childIndex].key.base58CheckSerialize(
      ReadonlyKeyType
    );
  }

  validateAccountName(name) {
    if (!name) {
      throw new CustomError(
        ErrorObject.InvalidAccountName,
        "Account name is invalid"
      );
    }

    for (let i = 0; i < this.MasterAccount.child.length; i++) {
      let account = this.MasterAccount.child[i];

      if (account.name === name) {
        throw new CustomError(
          ErrorObject.ExistedAccountErr,
          "Name of importing Account was existed"
        );
      }
    }
  }

  validatePrivateKey(privateKey) {
    for (let i = 0; i < this.MasterAccount.child.length; i++) {
      let account = this.MasterAccount.child[i];

      if (account.key.base58CheckSerialize(PriKeyType) == privateKey) {
        throw new CustomError(
          ErrorObject.ExistedAccountErr,
          "Private key of importing Account was existed"
        );
      }
    }
  }

  async removeAccount(accPrivateKeyStr, passPhrase) {
    new Validator("accPrivateKeyStr", accPrivateKeyStr).string().required();
    new Validator("passPhrase", passPhrase).string();
    for (let i = 0; i < this.MasterAccount.child.length; i++) {
      let account = this.MasterAccount.child[i];
      if (account.key.base58CheckSerialize(PriKeyType) === accPrivateKeyStr) {
        this.MasterAccount.child.splice(i, 1);
        await this.save(passPhrase);
        return;
      }
    }
    throw new CustomError(
      ErrorObject.UnexpectedErr,
      "Account need to be removed is not existed"
    );
  }

  async importAccount(privakeyStr, accountName, passPhrase) {
    new Validator("privakeyStr", privakeyStr).string().required();
    new Validator("accountName", accountName).string().required();
    new Validator("passPhrase", passPhrase).string();
    for (let i = 0; i < this.MasterAccount.child.length; i++) {
      let account = this.MasterAccount.child[i];
      if (account.key.base58CheckSerialize(PriKeyType) === privakeyStr) {
        throw new CustomError(
          ErrorObject.ExistedAccountErr,
          "Private key of importing Account was existed"
        );
      }
      if (account.name === accountName) {
        throw new CustomError(
          ErrorObject.ExistedAccountErr,
          "Name of importing Account was existed"
        );
      }
    }
    const account = await this.createAccountWithPrivateKey(
      privakeyStr,
      accountName
    );
    this.MasterAccount.child.push(account);
    await this.save(this.PassPhrase || passPhrase);
    return account;
  }

  async importAccountWithId(accountId, accountName, index = 0) {
    new Validator("accountId", accountId).required();
    new Validator("accountName", accountName).string().required();
    try {
      this.validateAccountName(accountName);
    } catch {
      this.importAccountWithId(accountId, accountName + index, index + 1);
    }
    const account = await this.createAccountWithId(accountId, accountName);
    this.validatePrivateKey(account.key.base58CheckSerialize(PriKeyType));
    this.MasterAccount.child.push(account);
    await this.save(this.PassPhrase);
    return account;
  }

  async save(password = "") {
    if (password === "") {
      password = this.PassPhrase;
    }
    // parse to byte[]
    for (let i = 0; i < this.MasterAccount.child.length; i++) {
      this.MasterAccount.child[i].key.ChainCode = Array.from(
        this.MasterAccount.child[i].key.ChainCode
      );
      this.MasterAccount.child[i].key.ChildNumber = Array.from(
        this.MasterAccount.child[i].key.ChildNumber
      );
      this.MasterAccount.child[i].key.KeySet.PrivateKey = Array.from(
        this.MasterAccount.child[i].key.KeySet.PrivateKey
      );
      this.MasterAccount.child[i].key.KeySet.PaymentAddress.Pk = Array.from(
        this.MasterAccount.child[i].key.KeySet.PaymentAddress.Pk
      );
      this.MasterAccount.child[i].key.KeySet.PaymentAddress.Tk = Array.from(
        this.MasterAccount.child[i].key.KeySet.PaymentAddress.Tk
      );
      this.MasterAccount.child[i].key.KeySet.ReadonlyKey.Pk = Array.from(
        this.MasterAccount.child[i].key.KeySet.ReadonlyKey.Pk
      );
      this.MasterAccount.child[i].key.KeySet.ReadonlyKey.Rk = Array.from(
        this.MasterAccount.child[i].key.KeySet.ReadonlyKey.Rk
      );
    }
    this.MasterAccount.key.ChainCode = Array.from(
      this.MasterAccount.key.ChainCode
    );
    this.MasterAccount.key.ChildNumber = Array.from(
      this.MasterAccount.key.ChildNumber
    );
    this.MasterAccount.key.KeySet.PrivateKey = Array.from(
      this.MasterAccount.key.KeySet.PrivateKey
    );
    this.MasterAccount.key.KeySet.PaymentAddress.Pk = Array.from(
      this.MasterAccount.key.KeySet.PaymentAddress.Pk
    );
    this.MasterAccount.key.KeySet.PaymentAddress.Tk = Array.from(
      this.MasterAccount.key.KeySet.PaymentAddress.Tk
    );
    this.MasterAccount.key.KeySet.ReadonlyKey.Pk = Array.from(
      this.MasterAccount.key.KeySet.ReadonlyKey.Pk
    );
    this.MasterAccount.key.KeySet.ReadonlyKey.Rk = Array.from(
      this.MasterAccount.key.KeySet.ReadonlyKey.Rk
    );

    let data = JSON.stringify(this);
    // encrypt
    let cipherText = CryptoJS.AES.encrypt(data, password);
    // storage
    if (this.Storage != null) {
      await this.Storage.setItem(this.Name, cipherText.toString());
    }
  }
  async clearCached(storage) {
    new Validator("storage", storage).required();
    this.MasterAccount.clearCached(storage);
    for (let i = 0; i < this.MasterAccount.child.length; i++) {
      this.MasterAccount.child[i].clearCached(
        storage,
        `${this.Name}-${this.MasterAccount.child[i].name}-cached`
      );
    }
    await this.save("");
  }

  async getHistoryByAccount(accName) {
    let account = this.getAccountByName(accName);
    return account.getNormalTxHistory();
  }

  // not pure function
  async reImportPrototype(account) {
    Object.setPrototypeOf(account, Account.prototype);
    Object.setPrototypeOf(account.key, KeyWallet.prototype);
    // chaincode
    Object.setPrototypeOf(account.key.ChainCode, Array.prototype);
    account.key.ChainCode = new Uint8Array(account.key.ChainCode);
    // child num
    Object.setPrototypeOf(account.key.ChildNumber, Array.prototype);
    account.key.ChildNumber = new Uint8Array(account.key.ChildNumber);
    Object.setPrototypeOf(account.key.KeySet, KeySet.prototype);
    // payment address
    Object.setPrototypeOf(
      account.key.KeySet.PaymentAddress,
      PaymentAddress.prototype
    );
    Object.setPrototypeOf(
      account.key.KeySet.PaymentAddress.Pk,
      Array.prototype
    );
    account.key.KeySet.PaymentAddress.Pk = new Uint8Array(
      account.key.KeySet.PaymentAddress.Pk
    );
    Object.setPrototypeOf(
      account.key.KeySet.PaymentAddress.Tk,
      Array.prototype
    );
    account.key.KeySet.PaymentAddress.Tk = new Uint8Array(
      account.key.KeySet.PaymentAddress.Tk
    );
    // read only key
    Object.setPrototypeOf(account.key.KeySet.ReadonlyKey, ViewingKey.prototype);
    Object.setPrototypeOf(account.key.KeySet.ReadonlyKey.Pk, Array.prototype);
    account.key.KeySet.ReadonlyKey.Pk = new Uint8Array(
      account.key.KeySet.ReadonlyKey.Pk
    );
    Object.setPrototypeOf(account.key.KeySet.ReadonlyKey.Rk, Array.prototype);
    account.key.KeySet.ReadonlyKey.Rk = new Uint8Array(
      account.key.KeySet.ReadonlyKey.Rk
    );
    // private key
    Object.setPrototypeOf(account.key.KeySet.PrivateKey, Array.prototype);
    account.key.KeySet.PrivateKey = new Uint8Array(
      account.key.KeySet.PrivateKey
    );
    await account.key.KeySet.importFromPrivateKey(
      account.key.KeySet.PrivateKey
    );
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
        Object.setPrototypeOf(obj.MasterAccount, Account.prototype);
        Object.setPrototypeOf(obj.MasterAccount.key, KeyWallet.prototype);
        Object.setPrototypeOf(obj.MasterAccount.key.KeySet, KeySet.prototype);
        obj.Seed = Buffer.from(obj.Seed);
        Object.assign(this, obj);
        let task = [
          ...obj.MasterAccount.child.map((account) =>
            this.reImportPrototype(account)
          ),
          this.reImportPrototype(obj.MasterAccount),
        ];
        await Promise.all(task);
        Object.assign(this, obj);
      } catch (e) {
        throw new CustomError(
          ErrorObject.LoadWalletErr,
          e.message || "Error when load wallet"
        );
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
        Index: index,
      });
    }
    return accounts;
  }

  async listAccountWithBLSPubKey() {
    let accounts = [];
    for (let i = 0; i < this.MasterAccount.child.length; i++) {
      let child = this.MasterAccount.child[i];
      let miningSeedKey = hashSha3BytesToBytes(
        hashSha3BytesToBytes(child.key.KeySet.PrivateKey)
      );
      let blsPublicKey = await generateBLSPubKeyB58CheckEncodeFromSeed(
        miningSeedKey
      );
      accounts[i] = {
        AccountName: child.name,
        BLSPublicKey: blsPublicKey,
        Index: i,
      };
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
      const nativeTx = account.txHistory.NormalTx.find(
        (item) => item.txID === txId
      );
      const coinTx = account.txHistory.PrivacyTokenTx.find(
        (item) => item.txID === txId
      );

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
    } else if (
      !response.isInBlock &&
      !response.isInMempool &&
      response.err !== null
    ) {
      tx.status = FailedTx;
    }
  }

  deleteWallet() {
    try {
      if (typeof this.Storage.removeItem === "function") {
        this.Storage.removeItem("Wallet");
      }
    } catch (e) {
      throw new CustomError(
        ErrorObject.DeleteWalletErr,
        e.message || "Can not remove item in storage"
      );
    }
  }

  static RandomBytesFunc = null;
  static setPrivacyUtilRandomBytesFunc(randomBytesFunc) {
    setRandBytesFunc(randomBytesFunc);
  }
  static sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
  static RpcClient;
  static Debug = "";
  static RpcCoinService;
  static PrivacyVersion = PrivacyVersion.ver2;
  static UseLegacyEncoding = true;
  static PubsubService = "";
  static RpcRequestService = "";
  static AuthToken = "";
  static RpcApiService = "";
}

class DefaultStorage {
  constructor() {
    this.Data = {};
  }

  async setItem(key, value) {
    this.Data[key] = value;
    return Promise.resolve();
  }

  async getItem(key) {
    return this.Data[key];
  }
}

export {
  Wallet,
  Account,
  DefaultStorage,
  TxHistoryInfo,
  RpcClient,
  PaymentInfo,
  KeyWallet,
  PaymentAddressType,
  CustomTokenTransfer,
  CustomTokenInit,
  PRVIDSTR,
  ENCODE_VERSION,
  FailedTx,
  SuccessTx,
  ConfirmedTx,
  MetaStakingBeacon,
  MetaStakingShard,
  checkEncode,
  getEstimateFee,
  getEstimateFeeForPToken,
  getMaxWithdrawAmount,
  toNanoPRV,
  toPRV,
  getShardIDFromLastByte,
  generateECDSAKeyPair,
  generateBLSKeyPair,
  BurningRequestMeta,
  WithDrawRewardRequestMeta,
  PDEContributionMeta,
  PDEPRVRequiredContributionRequestMeta,
  PDETradeRequestMeta,
  PDECrossPoolTradeRequestMeta,
  PDEWithdrawalRequestMeta,
  hybridEncryption,
  hybridDecryption,
  encryptMessageOutCoin,
  decryptMessageOutCoin,
  constants,
  coinChooser,
  newMnemonic,
  newSeed,
  validateMnemonic,
  RpcHTTPCoinServiceClient,
  PrivacyVersion,
  Validator,
  ACCOUNT_CONSTANT,
};
