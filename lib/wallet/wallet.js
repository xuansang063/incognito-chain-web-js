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
    this.Name = "";
    this.Key = new KeyWallet();
    this.Child = [];
    this.IsImport = false;
  }
}

class Wallet {
  constructor() {
    this.Seed = [];
    this.Entropy = [];
    this.PassPhrase = "";
    this.Mnemonic = "";
    this.MasterAccount = new AccountWallet();
    this.Name = "";
    this.Storage = null;
    this.rpcClient = new RpcClient();
  }

  init(passPhrase, numOfAccount, name, storage) {
    let mnemonicGen = new MnemonicGenerator();
    this.Name = name;
    this.Entropy = mnemonicGen.newEntropy(128);
    this.Mnemonic = mnemonicGen.newMnemonic(this.Entropy);
    this.Seed = mnemonicGen.newSeed(this.Mnemonic, passPhrase);
    this.PassPhrase = passPhrase

    let masterKey = NewMasterKey(this.Seed);

    this.MasterAccount = new AccountWallet()
    this.MasterAccount.Key = masterKey;
    this.MasterAccount.Child = [];
    this.MasterAccount.Name = "master";

    if (numOfAccount == 0) {
      numOfAccount = 1;
    }

    for (let i = 0; i < numOfAccount; i++) {
      let childKey = this.MasterAccount.Key.newChildKey(i);
      let account = new AccountWallet()
      account.Name = "AccountWallet " + i;
      account.Child = [];
      account.Key = childKey;
      this.MasterAccount.Child.push(account)
    }

    this.Storage = storage;
  }

  createNewAccount(accountName) {
    let newIndex = this.MasterAccount.Child.length;
    let childKey = this.MasterAccount.Key.newChildKey(newIndex);
    if (accountName === "") {
      accountName = "AccountWallet " + newIndex;
    }
    let accountWallet = new AccountWallet()
    accountWallet.Key = childKey;
    accountWallet.Child = [];
    accountWallet.Name = accountName;

    this.MasterAccount.Child.push(accountWallet);
    this.save(this.PassPhrase)

    return accountWallet;
  }

  exportAccount(childIndex) {
    return this.MasterAccount.Child[childIndex].Key.base58CheckSerialize(constantsWallet.PriKeyType);
  }

  removeAccount(privakeyStr, accountName, passPhrase) {
    if (passPhrase !== this.PassPhrase) {
      throw new Error("Wrong passphrase")
    }
    for (let i = 0; i < this.MasterAccount.Child.length; i++) {
      let account = this.MasterAccount.Child[i];
      if (account.Key.base58CheckSerialize(PriKeyType) === privakeyStr) {
        this.MasterAccount.Child.splice(i);
        this.save(this.PassPhrase)
        return
      }
    }
    throw new Error("Unexpected error")
  }

  importAccount(privakeyStr, accountName, passPhrase) {
    if (passPhrase != this.PassPhrase) {
      throw new Error("Wrong passphrase")
    }

    for (let i = 0; i < this.MasterAccount.Child.length; i++) {
      let account = this.MasterAccount.Child[i];
      if (account.Key.base58CheckSerialize(constantsWallet.PriKeyType) == privakeyStr) {
        throw new Error("Existed account");
      }
      if (account.Name == accountName) {
        throw new Error("Existed account");
      }
    }

    let keyWallet = KeyWallet.base58CheckDeserialize(privakeyStr)
    keyWallet.KeySet.importFromPrivateKey(keyWallet.KeySet.PrivateKey);

    let account = new AccountWallet()
    account.Key = keyWallet;
    account.Child = [];
    account.IsImport = true;
    account.Name = accountName;

    this.MasterAccount.Child.push(account)

    this.save(this.PassPhrase)

    return account
  }

  save(password) {
    if (password == "") {
      password = this.PassPhrase
    }

    // parse to byte[]
    let data = JSON.stringify(this)

    // encrypt
    let cipherText = CryptoJS.AES.encrypt(data, password)

    // storage
    if (this.Storage != null) {
      this.Storage.setItem("Wallet", cipherText);
    }
  }

  loadWallet(password) {
    if (this.Storage != null) {
      let cipherText = this.Storage.getItem("Wallet");
      let data = CryptoJS.AES.decrypt(cipherText, password)
      let jsonStr = data.toString(CryptoJS.enc.Utf8);

      try {
        let obj = JSON.parse(jsonStr);
        Object.setPrototypeOf(obj, Wallet.prototype);
        Object.setPrototypeOf(obj.MasterAccount, AccountWallet.prototype);
        Object.setPrototypeOf(obj.MasterAccount.Key, KeyWallet.prototype);
        for (let i = 0; i < obj.MasterAccount.Child.length; i++) {
          Object.setPrototypeOf(obj.MasterAccount.Child[i], AccountWallet.prototype);
          Object.setPrototypeOf(obj.MasterAccount.Child[i].Key, KeyWallet.prototype);

          Object.setPrototypeOf(obj.MasterAccount.Child[i].Key.ChainCode, ArrayBuffer.prototype);
          let temp = new Uint8Array(32)
          temp.set(obj.MasterAccount.Child[i].Key.ChainCode)
          obj.MasterAccount.Child[i].Key.ChainCode = temp

          Object.setPrototypeOf(obj.MasterAccount.Child[i].Key.ChildNumber, ArrayBuffer.prototype);
          temp = new Uint8Array(4)
          temp.set(obj.MasterAccount.Child[i].Key.ChildNumber)
          obj.MasterAccount.Child[i].Key.ChildNumber = temp

          Object.setPrototypeOf(obj.MasterAccount.Child[i].Key.KeySet, keyset.KeySet.prototype);
          Object.setPrototypeOf(obj.MasterAccount.Child[i].Key.KeySet.PaymentAddress, key.PaymentAddress.prototype);

          Object.setPrototypeOf(obj.MasterAccount.Child[i].Key.KeySet.PaymentAddress.Pk, ArrayBuffer.prototype);
          temp = new Uint8Array(33)
          temp.set(obj.MasterAccount.Child[i].Key.KeySet.PaymentAddress.Pk)
          obj.MasterAccount.Child[i].Key.KeySet.PaymentAddress.Pk = temp

          Object.setPrototypeOf(obj.MasterAccount.Child[i].Key.KeySet.PaymentAddress.Tk, ArrayBuffer.prototype);
          temp = new Uint8Array(33)
          temp.set(obj.MasterAccount.Child[i].Key.KeySet.PaymentAddress.Tk)
          obj.MasterAccount.Child[i].Key.KeySet.PaymentAddress.Tk = temp

          Object.setPrototypeOf(obj.MasterAccount.Child[i].Key.KeySet.ReadonlyKey, key.ViewingKey.prototype);
          Object.setPrototypeOf(obj.MasterAccount.Child[i].Key.KeySet.ReadonlyKey.PublicKey, ArrayBuffer.prototype);
          temp = new Uint8Array(33)
          temp.set(obj.MasterAccount.Child[i].Key.KeySet.ReadonlyKey.PublicKey)
          obj.MasterAccount.Child[i].Key.KeySet.ReadonlyKey.Pk = temp
        }
        delete obj.Storage
        Object.assign(this, obj)
      } catch (e) {
        throw e;
      }
    }
  }

  async getBalance(privakeyStr) {
    let myKeyWallet = keyWallet.base58CheckDeserialize(privakeyStr);
    myKeyWallet.KeySet.importFromPrivateKey(myKeyWallet.KeySet.PrivateKey);
    let paymentAddrSerialize = myKeyWallet.base58CheckSerialize(constantsWallet.PaymentAddressType);
    let readOnlyKeySerialize = myKeyWallet.base58CheckSerialize(constantsWallet.ReadonlyKeyType);
    let res = await this.rpcClient.getOutputCoin(paymentAddrSerialize, readOnlyKeySerialize);
    let allOutputCoinStrs;
    if (res.err === null) {
      allOutputCoinStrs = res.outCoins
    } else {
      console.log('ERR when call API get output: ', res.err);
    }
    // parse input coin from string
    let inputCoins = this.rpcClient.parseInputCoinFromStr(allOutputCoinStrs, myKeyWallet);

    let unspentCoinList = await this.rpcClient.getUnspentCoin(inputCoins, paymentAddrSerialize, allOutputCoinStrs);
    var unspentCoinString = unspentCoinList.unspentCoinStrs;
    let accountBalance = 0;
    for (let i = 0; i < unspentCoinString.length; i++) {
      accountBalance += parseInt(unspentCoinString[i].Value)
    }
    return accountBalance
  }

  async getCustomTokenBalance(privatekeyStr, tokenIDStr) {
    let myKeyWallet = keyWallet.base58CheckDeserialize(privatekeyStr);
    myKeyWallet.KeySet.importFromPrivateKey(myKeyWallet.KeySet.PrivateKey);
    let res0 = await this.rpcClient.getUnspentToken(myKeyWallet.base58CheckSerialize(constantWallet.PaymentAddressType),
      tokenIDStr);
    let vins = res0.listUnspentCustomToken;
    return vins
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