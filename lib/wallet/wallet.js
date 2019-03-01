import * as constantsWallet from './constants';
import {KeyWallet as keyWallet, KeyWallet, NewMasterKey} from "./hdwallet";
import {MnemonicGenerator} from "./mnemonic";
import CryptoJS from "crypto-js";
import JSON from "circular-json";
import * as keyset from '../keySet';
import * as key from '../key';
import {RpcClient} from '../rpcclient/rpcclient'

class AccountWallet {
  constructor() {
    this.name = "";
    this.key = new KeyWallet();
    this.child = [];
    this.isImport = false;
    this.followingTokens = [];
  }

  listFollowingTokens = () => {
    return this.followingTokens;
  }

  addFollowingToken = (tokenData) => {
    this.followingTokens.push(tokenData);
  }

  getBalance = async () => {
    let paymentAddrSerialize = this.key.base58CheckSerialize(constantsWallet.PaymentAddressType);
    let readOnlyKeySerialize = this.key.base58CheckSerialize(constantsWallet.ReadonlyKeyType);
    let rpcClient = new RpcClient();
    let res = await rpcClient.getOutputCoin(paymentAddrSerialize, readOnlyKeySerialize);
    let allOutputCoinStrs;
    if (res.err === null) {
      allOutputCoinStrs = res.outCoins
    } else {
      console.log('ERR when call API get output: ', res.err);
    }
    // parse input coin from string
    let inputCoins = rpcClient.parseInputCoinFromStr(allOutputCoinStrs, this.key);
    let unspentCoinList = await rpcClient.getUnspentCoin(inputCoins, paymentAddrSerialize, allOutputCoinStrs);
    var unspentCoinString = unspentCoinList.unspentCoinStrs;
    let accountBalance = 0;
    for (let i = 0; i < unspentCoinString.length; i++) {
      accountBalance += parseInt(unspentCoinString[i].Value)
    }
    return accountBalance
  }

  getPrivacyCustomTokenBalance = async (privacyCustomTokenID) => {
    let paymentAddrSerialize = this.key.base58CheckSerialize(constantsWallet.PaymentAddressType);
    let readOnlyKeySerialize = this.key.base58CheckSerialize(constantsWallet.ReadonlyKeyType);
    let rpcClient = new RpcClient();
    let res = await rpcClient.getOutputCoin(paymentAddrSerialize, readOnlyKeySerialize, privacyCustomTokenID);
    let allOutputCoinStrs;
    if (res.err === null) {
      allOutputCoinStrs = res.outCoins
    } else {
      console.log('ERR when call API get output: ', res.err);
    }
    // parse input coin from string
    let inputCoins = rpcClient.parseInputCoinFromStr(allOutputCoinStrs, this.key);
    let unspentCoinList = await rpcClient.getUnspentCoin(inputCoins, paymentAddrSerialize, allOutputCoinStrs, privacyCustomTokenID);
    var unspentCoinString = unspentCoinList.unspentCoinStrs;
    let accountBalance = 0;
    for (let i = 0; i < unspentCoinString.length; i++) {
      accountBalance += parseInt(unspentCoinString[i].Value)
    }
    return accountBalance
  }

  getCustomTokenBalance = async (customTokenIDStr) => {
    let rpcClient = new RpcClient();
    let res0 = await rpcClient.getUnspentCustomToken(this.key.base58CheckSerialize(constantsWallet.PaymentAddressType),
      customTokenIDStr);
    let vins = res0.listUnspentCustomToken;
    let accountBalance = 0;
    for (let i = 0; i < vins.length; i++) {
      accountBalance += parseInt(vins[i].Value)
    }
    return accountBalance
  }

  createAndSendConstant = async (paymentInfos) => {
    // TODO 0xkraken
  }

  createAndSendCustomToken = async (paymentInfos = null, customTokenPaymentParams) => {
    // TODO 0xkraken
  }

  createAndSendPrivacyCustomToken = async (paymentInfos = null, privacyCustomTokenParams) => {
    // TODO 0xkraken
  }

  estimateFee = async (defaultFee = -1, paymentInfos, metadata = null, custoTokenParams = {}, privacyCustomTokenParams = {}) => {
    // TODO kraken

  }


}

class Wallet {
  constructor() {
    this.seed = [];
    this.entropy = [];
    this.passPhrase = "";
    this.mnemonic = "";
    this.masterAccount = new AccountWallet();
    this.name = "";
    this.storage = null;
  }

  init(passPhrase, numOfAccount, name, storage) {
    let mnemonicGen = new MnemonicGenerator();
    this.name = name;
    this.entropy = mnemonicGen.newEntropy(128);
    this.mnemonic = mnemonicGen.newMnemonic(this.entropy);
    this.seed = mnemonicGen.newSeed(this.mnemonic, passPhrase);
    this.passPhrase = passPhrase
    let masterKey = NewMasterKey(this.seed);
    this.passPhrase = passPhrase
    this.masterAccount = new AccountWallet()
    this.masterAccount.key = masterKey;
    this.masterAccount.child = [];
    this.masterAccount.name = "master";

    if (numOfAccount == 0) {
      numOfAccount = 1;
    }

    for (let i = 0; i < numOfAccount; i++) {
      let childKey = this.masterAccount.key.newChildKey(i);
      let account = new AccountWallet()
      account.name = "AccountWallet " + i;
      account.child = [];
      account.key = childKey;
      this.masterAccount.child.push(account)
    }

    this.storage = storage;
  }

  createNewAccount(accountName) {
    let newIndex = this.masterAccount.child.length;
    let childKey = this.masterAccount.key.newChildKey(newIndex);
    if (accountName === "") {
      accountName = "AccountWallet " + newIndex;
    }
    let accountWallet = new AccountWallet()
    accountWallet.key = childKey;
    accountWallet.child = [];
    accountWallet.name = accountName;

    this.masterAccount.child.push(accountWallet);
    this.save(this.passPhrase)

    return accountWallet;
  }

  exportAccountPrivateKey(childIndex) {
    return this.masterAccount.child[childIndex].key.base58CheckSerialize(constantsWallet.PriKeyType);
  }

  exportAccountReadonlyKey(childIndex) {
    return this.masterAccount.child[childIndex].key.base58CheckSerialize(constantsWallet.ReadonlyKeyType);
  }

  removeAccount(privakeyStr, accountName, passPhrase) {
    if (passPhrase !== this.passPhrase) {
      throw new Error("Wrong passphrase")
    }
    for (let i = 0; i < this.masterAccount.child.length; i++) {
      let account = this.masterAccount.child[i];
      if (account.key.base58CheckSerialize(PriKeyType) === privakeyStr) {
        this.masterAccount.child.splice(i);
        this.save(this.passPhrase)
        return
      }
    }
    throw new Error("Unexpected error")
  }

  importAccount(privakeyStr, accountName, passPhrase) {
    if (passPhrase != this.passPhrase) {
      throw new Error("Wrong passphrase")
    }

    for (let i = 0; i < this.masterAccount.child.length; i++) {
      let account = this.masterAccount.child[i];
      if (account.key.base58CheckSerialize(constantsWallet.PriKeyType) == privakeyStr) {
        throw new Error("Existed account");
      }
      if (account.name == accountName) {
        throw new Error("Existed account");
      }
    }

    let keyWallet = KeyWallet.base58CheckDeserialize(privakeyStr)
    keyWallet.KeySet.importFromPrivateKey(keyWallet.KeySet.PrivateKey);
    let account = new AccountWallet()
    account.key = keyWallet;
    account.child = [];
    account.isImport = true;
    account.name = accountName;
    this.masterAccount.child.push(account)
    this.save(this.passPhrase)
    return account
  }

  save(password) {
    if (password == "") {
      password = this.passPhrase
    }

    // parse to byte[]
    let data = JSON.stringify(this)

    // encrypt
    let cipherText = CryptoJS.AES.encrypt(data, password)

    // storage
    if (this.storage != null) {
      this.storage.setItem("Wallet", cipherText);
    }
  }

  loadWallet(password) {
    if (this.storage != null) {
      let cipherText = this.storage.getItem("Wallet");
      let data = CryptoJS.AES.decrypt(cipherText, password)
      let jsonStr = data.toString(CryptoJS.enc.Utf8);

      try {
        let obj = JSON.parse(jsonStr);
        Object.setPrototypeOf(obj, Wallet.prototype);
        Object.setPrototypeOf(obj.masterAccount, AccountWallet.prototype);
        Object.setPrototypeOf(obj.masterAccount.key, KeyWallet.prototype);
        for (let i = 0; i < obj.masterAccount.child.length; i++) {
          Object.setPrototypeOf(obj.masterAccount.child[i], AccountWallet.prototype);
          Object.setPrototypeOf(obj.masterAccount.child[i].key, KeyWallet.prototype);

          Object.setPrototypeOf(obj.masterAccount.child[i].key.ChainCode, ArrayBuffer.prototype);
          let temp = new Uint8Array(32)
          temp.set(obj.masterAccount.child[i].key.ChainCode)
          obj.masterAccount.child[i].key.ChainCode = temp

          Object.setPrototypeOf(obj.masterAccount.child[i].key.ChildNumber, ArrayBuffer.prototype);
          temp = new Uint8Array(4)
          temp.set(obj.masterAccount.child[i].key.ChildNumber)
          obj.masterAccount.child[i].key.ChildNumber = temp

          Object.setPrototypeOf(obj.masterAccount.child[i].key.KeySet, keyset.KeySet.prototype);
          Object.setPrototypeOf(obj.masterAccount.child[i].key.KeySet.PaymentAddress, key.PaymentAddress.prototype);

          Object.setPrototypeOf(obj.masterAccount.child[i].key.KeySet.PaymentAddress.Pk, ArrayBuffer.prototype);
          temp = new Uint8Array(33)
          temp.set(obj.masterAccount.child[i].key.KeySet.PaymentAddress.Pk)
          obj.masterAccount.child[i].key.KeySet.PaymentAddress.Pk = temp

          Object.setPrototypeOf(obj.masterAccount.child[i].key.KeySet.PaymentAddress.Tk, ArrayBuffer.prototype);
          temp = new Uint8Array(33)
          temp.set(obj.masterAccount.child[i].key.KeySet.PaymentAddress.Tk)
          obj.masterAccount.child[i].key.KeySet.PaymentAddress.Tk = temp

          Object.setPrototypeOf(obj.masterAccount.child[i].key.KeySet.ReadonlyKey, key.ViewingKey.prototype);
          Object.setPrototypeOf(obj.masterAccount.child[i].key.KeySet.ReadonlyKey.PublicKey, ArrayBuffer.prototype);
          temp = new Uint8Array(33)
          temp.set(obj.masterAccount.child[i].key.KeySet.ReadonlyKey.PublicKey)
          obj.masterAccount.child[i].key.KeySet.ReadonlyKey.Pk = temp
        }
        delete obj.storage
        Object.assign(this, obj)
      } catch (e) {
        throw e;
      }
    }
  }

  listAccount() {
    let listAcc = [];
    for (let i = 0; i < this.masterAccount.child.length; i++) {
      let child = this.masterAccount.child[i];
      let account = {
        "Account Name": child.name,
        "PaymentAddress": child.key.base58CheckSerialize(constantsWallet.PaymentAddressType),
        "ReadonlyKey": child.key.base58CheckSerialize(constantsWallet.ReadonlyKeyType),
      }
      listAcc.push(account)
    }
    return listAcc
  }
}

class DefaultStorage {
  constructor() {
    this.Data = {}
  }

  setItem(key, value) {
    this.Data[key] = value
  }

  getItem(key) {
    return this.Data[key];
  }
}

module.exports = {Wallet, AccountWallet, DefaultStorage}