import bn from 'bn.js';
import { KeyWallet, NewMasterKey } from "./hdwallet";
import { MnemonicGenerator } from "./mnemonic";
import CryptoJS from "crypto-js";
import JSON from "circular-json";
import { KeySet } from '../keySet';
import { PaymentAddress, ViewingKey, PaymentInfo } from '../key';
import { CustomTokenParamTx, TxTokenVin, TxTokenVout } from "../tx/txcustomtokendata";
import { CustomTokenPrivacyParamTx } from "../tx/txcustomkenprivacydata";
import { RpcClient } from "../rpcclient/rpcclient";
import { Utility } from "privacy-js-lib/lib/privacy_utils"
import {
  FailedTx,
  SuccessTx,
  ConfirmedTx,
  AmountStakingBeacon,
  MetaStakingBeacon,
  AmountStakingShard,
  MetaStakingShard,
  PaymentAddressType,
  ReadonlyKeyType,
  PriKeyType
} from "./constants";
import { checkEncode } from "../base58";
import { getShardIDFromLastByte } from "../common";
import { AccountWallet } from "./accountWallet";
import { TxHistoryInfo } from "./history";
import { getEstimateFee, getEstimateFeeForSendingToken, getEstimateFeeToDefragment } from "../tx/utils";

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

  init(passPhrase, numOfAccount, name, storage, shardID = null) {
    // generate mnenomic generator
    let mnemonicGen = new MnemonicGenerator();
    this.Name = name;
    try {
      this.Entropy = mnemonicGen.newEntropy(128);
    } catch (e) {
      throw e;
    }

    // mnemonic
    this.Mnemonic = mnemonicGen.newMnemonic(this.Entropy);
    console.log("Mnemonic", this.Mnemonic);

    // seed
    this.Seed = mnemonicGen.newSeed(this.Mnemonic, passPhrase);

    // passphrase
    this.PassPhrase = passPhrase

    // generate master key from seed
    let masterKey = NewMasterKey(this.Seed);

    // master account with master key
    this.MasterAccount = new AccountWallet()
    this.MasterAccount.key = masterKey;
    this.MasterAccount.child = [];
    this.MasterAccount.name = "master";

    if (numOfAccount == 0) {
      numOfAccount = 1;
    }

    // generate account(s)
    if (shardID != null) {
      // only create account for specific Shard
      for (let i = 0; i < numOfAccount; i++) {
        let newIndex = 0;
        for (let j = this.MasterAccount.child.length - 1; j >= 0; j--) {
          let temp = this.MasterAccount.child[j];
          if (!temp.isImport) {
            let childNumber = new bn(temp.key.ChildNumber)
            newIndex = childNumber.toNumber() + 1
            break;
          }
        }

        let childKey = null;
        while (true) {
          childKey = this.MasterAccount.key.newChildKey(newIndex);
          let lastByte = childKey.KeySet.PaymentAddress.Pk[childKey.KeySet.PaymentAddress.Pk.length - 1];
          if (getShardIDFromLastByte(lastByte) == shardID) {
            break;
          }
          newIndex += 1
        }

        let account = new AccountWallet();
        account.name = "Account " + i;
        account.child = [];
        account.key = childKey;
        this.MasterAccount.child.push(account)
      }
    } else {
      // create account for any shard
      for (let i = 0; i < numOfAccount; i++) {
        let childKey = this.MasterAccount.key.newChildKey(i);
        let account = new AccountWallet();
        account.name = "Account " + i;
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

  createNewAccount(accountName, shardID = null) {
    if (shardID != null) {
      // only create account for specific Shard
      let newIndex = 0;
      for (let j = this.MasterAccount.child.length - 1; j >= 0; j--) {
        const temp = this.MasterAccount.child[j];
        if (temp && !temp.isImport) {
          let childNumber = new bn(temp.key.ChildNumber)
          newIndex = childNumber.toNumber() + 1
          break;
        }
      }

      let childKey = null;
      while (true) {
        childKey = this.MasterAccount.key.newChildKey(newIndex);
        let lastByte = childKey.KeySet.PaymentAddress.Pk[childKey.KeySet.PaymentAddress.Pk.length - 1];
        if (getShardIDFromLastByte(lastByte) == shardID) {
          break;
        }
        newIndex += 1;
      }

      if (accountName === "") {
        accountName = "AccountWallet " + newIndex;
      }
      let accountWallet = new AccountWallet();
      accountWallet.key = childKey;
      accountWallet.child = [];
      accountWallet.name = accountName;

      this.MasterAccount.child.push(accountWallet);
      this.save(this.PassPhrase);

      return accountWallet;
    } else {
      let newIndex = this.MasterAccount.child.length;
      let childKey = this.MasterAccount.key.newChildKey(newIndex);
      if (accountName === "") {
        accountName = "AccountWallet " + newIndex;
      }
      let accountWallet = new AccountWallet();
      accountWallet.key = childKey;
      accountWallet.child = [];
      accountWallet.name = accountName;

      this.MasterAccount.child.push(accountWallet);
      this.save(this.PassPhrase);

      return accountWallet;
    }
  }

  exportAccountPrivateKey(childIndex) {
    return this.MasterAccount.child[childIndex].key.base58CheckSerialize(PriKeyType);
  }

  exportAccountReadonlyKey(childIndex) {
    return this.MasterAccount.child[childIndex].key.base58CheckSerialize(ReadonlyKeyType);
  }

  removeAccount(accPrivateKeyStr, passPhrase) {
    if (passPhrase !== this.PassPhrase) {
      throw new Error("Wrong passphrase")
    }

    for (let i = 0; i < this.MasterAccount.child.length; i++) {
      let account = this.MasterAccount.child[i];
      if (account.key.base58CheckSerialize(PriKeyType) === accPrivateKeyStr) {
        this.MasterAccount.child.splice(i, 1);
        this.save(this.PassPhrase)
        console.log("Wallet after remove account: ", this);
        console.log("Remove account done!");
        return
      }
    }
    throw new Error("Unexpected error")
  }

  importAccount(privakeyStr, accountName, passPhrase) {
    if (passPhrase != this.PassPhrase) {
      throw new Error("Wrong passphrase")
    }

    for (let i = 0; i < this.MasterAccount.child.length; i++) {
      let account = this.MasterAccount.child[i];

      if (account.key.base58CheckSerialize(PriKeyType) == privakeyStr) {
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

    this.MasterAccount.child.push(account)
    this.save(this.PassPhrase);
    return account
  }

  save(password) {
    console.log("Saving wallet ....")
    if (password == "") {
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

    let masterDerivatorPointCached = this.MasterAccount.derivatorPointCached;
    this.MasterAccount.derivatorPointCached = {};
    let masterInputCoinCached = this.MasterAccount.inputCoinCached;
    this.MasterAccount.inputCoinCached = {}
    let childDerivatorPointCacheds = new Array(this.MasterAccount.child.length);
    let childInputCoinCacheds = new Array(this.MasterAccount.child.length);

    for (let i = 0; i < this.MasterAccount.child.length; i++) {
      childDerivatorPointCacheds[i] = this.MasterAccount.child[i].derivatorPointCached;
      childInputCoinCacheds[i] = this.MasterAccount.child[i].inputCoinCached;
      this.MasterAccount.child[i].derivatorPointCached = {}
      this.MasterAccount.child[i].inputCoinCached = {}
    }

    for (let i = 0; i < this.MasterAccount.child.length; i++) {
      if (this.MasterAccount.child[i].spendingCoins) {
        for (let j = 0; j < this.MasterAccount.child[i].spendingCoins.length; j++) {
          for (let k = 0; k < this.MasterAccount.child[i].spendingCoins[j].spendingSNs.length; k++) {
            this.MasterAccount.child[i].spendingCoins[j].spendingSNs[k] = Array.from(this.MasterAccount.child[i].spendingCoins[j].spendingSNs[k]);
            console.log("save wallet this.MasterAccount.child[i].spendingCoins[j].spendingSNs[k]:", this.MasterAccount.child[i].spendingCoins[j].spendingSNs[k]);
          }
        }
      }
    }

    let data = JSON.stringify(this);

    this.MasterAccount.derivatorPointCached = masterDerivatorPointCached;
    this.MasterAccount.inputCoinCached = masterInputCoinCached;
    for (let i = 0; i < childDerivatorPointCacheds.length; i++) {
      this.MasterAccount.child[i].derivatorPointCached = childDerivatorPointCacheds[i];
      this.MasterAccount.child[i].inputCoinCached = childInputCoinCacheds[i];
    }

    // console.log("Data wallet after JSON.stringify: ", data);
    // encrypt
    let cipherText = CryptoJS.AES.encrypt(data, password)

    // console.log('cipherText wallet when saving', cipherText)
    // console.log("this.Storage: ", this.Storage);
    // storage
    if (this.Storage != null) {
      return this.Storage.setItem("Wallet", cipherText.toString());
    }
  }

  clearCached() {
    this.MasterAccount.clearCached();
    for (let i = 0; i < this.MasterAccount.child.length; i++) {
      this.MasterAccount.child[i].clearCached();
    }
    this.save('');
  }

  async getHistoryByAccount(accName) {
    let account = this.getAccountByName(accName);
    return account.getNormalTx();
  }

  async loadWallet(password) {
    if (this.Storage != null) {
      let cipherText = await this.Storage.getItem("Wallet");
      if (!cipherText) return false;
      let data = CryptoJS.AES.decrypt(cipherText, password);
      let jsonStr = data.toString(CryptoJS.enc.Utf8);
      const tasks = [];

      try {
        let obj = JSON.parse(jsonStr);
        Object.setPrototypeOf(obj, Wallet.prototype);
        Object.setPrototypeOf(obj.MasterAccount, AccountWallet.prototype);
        Object.setPrototypeOf(obj.MasterAccount.key, KeyWallet.prototype);

        tasks.push(obj.MasterAccount.loadDerivatorCached());
        tasks.push(obj.MasterAccount.loadInputCoinCached());

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
          Object.setPrototypeOf(obj.MasterAccount.child[i].key.KeySet.PaymentAddress,   PaymentAddress.prototype);
          Object.setPrototypeOf(obj.MasterAccount.child[i].key.KeySet.PaymentAddress.Pk, Array.prototype);
          obj.MasterAccount.child[i].key.KeySet.PaymentAddress.Pk = new Uint8Array(obj.MasterAccount.child[i].key.KeySet.PaymentAddress.Pk)
          Object.setPrototypeOf(obj.MasterAccount.child[i].key.KeySet.PaymentAddress.Tk, Array.prototype);
          obj.MasterAccount.child[i].key.KeySet.PaymentAddress.Tk = new Uint8Array(obj.MasterAccount.child[i].key.KeySet.PaymentAddress.Tk)

          // read only key
          Object.setPrototypeOf(obj.MasterAccount.child[i].key.KeySet.ReadonlyKey,   ViewingKey.prototype);
          Object.setPrototypeOf(obj.MasterAccount.child[i].key.KeySet.ReadonlyKey.Pk, Array.prototype);
          obj.MasterAccount.child[i].key.KeySet.ReadonlyKey.Pk = new Uint8Array(obj.MasterAccount.child[i].key.KeySet.ReadonlyKey.Pk)
          Object.setPrototypeOf(obj.MasterAccount.child[i].key.KeySet.ReadonlyKey.Rk, Array.prototype);
          obj.MasterAccount.child[i].key.KeySet.ReadonlyKey.Rk = new Uint8Array(obj.MasterAccount.child[i].key.KeySet.ReadonlyKey.Rk)

          // private key
          Object.setPrototypeOf(obj.MasterAccount.child[i].key.KeySet.PrivateKey, Array.prototype);
          obj.MasterAccount.child[i].key.KeySet.PrivateKey = new Uint8Array(obj.MasterAccount.child[i].key.KeySet.PrivateKey)

          // console.log("obj.MasterAccount.child[i].spendingCoins.length: ", obj.MasterAccount.child[i].spendingCoins.length);

          if (obj.MasterAccount.child[i].spendingCoins) {
            for (let j = 0; j < obj.MasterAccount.child[i].spendingCoins.length; j++) {
              for (let k = 0; k < obj.MasterAccount.child[i].spendingCoins[j].spendingSNs.length; k++) {
                Object.setPrototypeOf(obj.MasterAccount.child[i].spendingCoins[j].spendingSNs[k], Array.prototype);
                // console.log("Load Wallet obj.MasterAccount.child[i].spendingCoins[j].spendingSNs[k] before: ", obj.MasterAccount.child[i].spendingCoins[j].spendingSNs[k]);
                obj.MasterAccount.child[i].spendingCoins[j].spendingSNs[k] = new Uint8Array(obj.MasterAccount.child[i].spendingCoins[j].spendingSNs[k])
                // console.log("Load Wallet obj.MasterAccount.child[i].spendingCoins[j].spendingSNs[k] after: ", obj.MasterAccount.child[i].spendingCoins[j].spendingSNs[k]);
              }
            }
          }
          tasks.push(Promise.all([
            obj.MasterAccount.child[i].loadDerivatorCached(),
            obj.MasterAccount.child[i].loadInputCoinCached()
          ]).then(() => {
            delete obj.Storage;
            Object.assign(this, obj);
            return Promise.resolve();
          }));
        }

        return Promise.all(tasks);
      } catch (e) {
        throw e;
      }
    }
  }

  listAccount() {
    return this.MasterAccount.child.map((child, index) => {
      return {
        "AccountName": child.name,
        "PrivateKey": child.key.base58CheckSerialize(PriKeyType),
        "PaymentAddress": child.key.base58CheckSerialize(PaymentAddressType),
        "ReadonlyKey": child.key.base58CheckSerialize(ReadonlyKeyType),
        "PublicKey": child.key.getPublicKeyByHex(),
        "PublicKeyCheckEncode": child.key.getPublicKeyCheckEncode(),
        "PublicKeyBytes": child.key.KeySet.PaymentAddress.Pk.toString(),
        "Index": index,
      }
    })
  }

  async updateStatusHistory() {
    for (let i = 0; i < this.MasterAccount.child.length; i++) {
      for (let j = 0; j < this.MasterAccount.child[i].txHistory.NormalTx.length; j++) {
        if (this.MasterAccount.child[i].txHistory.NormalTx[j].status == SuccessTx) {
          let response;
          try{
            response = await Wallet.RpcClient.getTransactionByHash(this.MasterAccount.child[i].txHistory.NormalTx[j].txID);
          } catch(e){
            throw e;
          }
          
          if (response.isInBlock) {
            this.MasterAccount.child[i].txHistory.NormalTx[j].status = ConfirmedTx;
          }
        }
      }

      for (let j = 0; j < this.MasterAccount.child[i].txHistory.CustomTokenTx.length; j++) {
        if (this.MasterAccount.child[i].txHistory.CustomTokenTx[j].status == SuccessTx) {
          let response;
          try{
            response = await Wallet.RpcClient.getTransactionByHash(this.MasterAccount.child[i].txHistory.CustomTokenTx[j].txID);
          } catch(e){
            throw e;
          }

          if (response.isInBlock) {
            this.MasterAccount.child[i].txHistory.CustomTokenTx[j].status = ConfirmedTx;
          }
        }
      }

      for (let j = 0; j < this.MasterAccount.child[i].txHistory.PrivacyCustomTokenTx.length; j++) {
        if (this.MasterAccount.child[i].txHistory.PrivacyCustomTokenTx[j].status == SuccessTx) {
          let response;
          try{
            response = await Wallet.RpcClient.getTransactionByHash(this.MasterAccount.child[i].txHistory.PrivacyCustomTokenTx[j].txID);
          } catch(e){
            throw e;
          }

          if (response.isInBlock) {
            this.MasterAccount.child[i].txHistory.PrivacyCustomTokenTx[j].status = ConfirmedTx;
          }
        }
      }
    }
  }

  updateSpendingList() {
    let interval = setInterval(async () => {
      let update = false;
      for (let i = 0; i < this.MasterAccount.child.length; i++) {
        if (this.MasterAccount.child[i].spendingCoins) {
          for (let j = 0; j < this.MasterAccount.child[i].spendingCoins.length; j++) {
            let response;
            try{
              response = await Wallet.RpcClient.getTransactionByHash(this.MasterAccount.child[i].spendingCoins[j].txID);
            } catch(e){
              throw e;
            }

            if (response.isInBlock || (response.err != null && response.isInBlock === false && response.isInMempool === false)) {
              this.MasterAccount.child[i].removeObjectFromSpendingCoins(this.MasterAccount.child[i].spendingCoins[j].txID);
              update = true;
            }
          }
        }
      }
      if (update) {
        this.save(this.PassPhrase);
      }
    }, 3000);
  }

  static RpcClient = new RpcClient();
  static RandomBytesFunc = null;

  static setPrivacyUtilRandomBytesFunc(randomBytesFunc) {
    Utility.RandomBytesFunc = randomBytesFunc;
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
    await Wallet.updateProgressTx(0)
  }

  static ShardNumber = 4;
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
  RpcClient, CustomTokenParamTx, CustomTokenPrivacyParamTx, PaymentInfo, KeyWallet, TxTokenVin, TxTokenVout,
  FailedTx,
  SuccessTx,
  ConfirmedTx,
  AmountStakingBeacon,
  MetaStakingBeacon,
  AmountStakingShard,
  MetaStakingShard,
  checkEncode,
  getEstimateFee, getEstimateFeeForSendingToken, getEstimateFeeToDefragment
}
