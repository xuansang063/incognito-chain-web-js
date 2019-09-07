import bn from 'bn.js';
import { KeyWallet, NewMasterKey } from "./hdwallet";
import { MnemonicGenerator } from "./mnemonic";
import CryptoJS from "crypto-js";
import JSON from "circular-json";
import { KeySet } from '../keySet';
import { PaymentAddress, ViewingKey, PaymentInfo } from '../key';
import { CustomTokenParamTx, TxTokenVin, TxTokenVout } from "../tx/txcustomtokendata";
import { CustomTokenPrivacyParamTx } from "../tx/txprivacytokendata";
import { RpcClient } from "../rpcclient/rpcclient";
import { setRandBytesFunc, hashSha3BytesToBytes } from "privacy-js-lib/lib/privacy_utils"
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
  PriKeyType,
  BurnAddress,
} from "./constants";
import { checkEncode } from "../base58";
import { getShardIDFromLastByte } from "../common";
import { AccountWallet } from "./accountWallet";
import { TxHistoryInfo } from "./history";
import { getEstimateFee, getEstimateFeeForSendingToken, getEstimateFeeToDefragment, getEstimateTokenFee, getMaxWithdrawAmount } from "../tx/utils";
import { toNanoPRV, toPRV } from "./utils";
import { generateECDSAKeyPair } from "privacy-js-lib/lib/ecdsa";
import { generateBLSKeyPair } from "privacy-js-lib/lib/bls";
import { ENCODE_VERSION } from "../constants";
import { CustomError, ErrorObject } from "../errorhandler";
import { generateBLSPubKeyB58CheckEncodeFromSeed } from "../committeekey";

class Wallet {
  constructor() {
    this.Seed = [];
    this.Entropy = [];
    this.PassPhrase = "";
    this.Mnemonic = "";
    this.MasterAccount = new AccountWallet();
    this.Name = "";
    this.Storage = null;

    // this.getAccountIndexByName = this.getAccountIndexByName.bind(this);
  }

  init(passPhrase, numOfAccount, name, storage, shardID = null) {
    // generate mnenomic generator
    let mnemonicGen = new MnemonicGenerator();
    this.Name = name;
    try {
      this.Entropy = mnemonicGen.newEntropy(128);
    } catch (e) {
      throw new CustomError(ErrorObject.NewEntropyErr, e.message || "Can not create new entropy when initing wallet");
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
      throw new CustomError(ErrorObject.WrongPassPhraseErr, "Passphrase is not correct when removing account");
    }

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

  importAccount(privakeyStr, accountName, passPhrase) {
    if (passPhrase != this.PassPhrase) {
      throw new CustomError(ErrorObject.WrongPassPhraseErr, "Passphrase is not correct when importing account");
    }

    for (let i = 0; i < this.MasterAccount.child.length; i++) {
      let account = this.MasterAccount.child[i];

      if (account.key.base58CheckSerialize(PriKeyType) == privakeyStr) {
        throw new CustomError(ErrorObject.ExistedAccountErr, "Private key of importing account was existed");
      }

      if (account.name == accountName) {
        throw new CustomError(ErrorObject.ExistedAccountErr, "Name of importing account was existed");
      }
    }

    let keyWallet;
    try {
      keyWallet = KeyWallet.base58CheckDeserialize(privakeyStr)
    } catch (e) {
      throw new CustomError(ErrorObject.B58CheckDeserializedErr, "Can not base58 check deserialized private key of importing account");;
    }

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

  save(password = "") {
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

    // remove cached of master account and its childs from wallet before saving wallet
    let masterDerivatorPointCached = this.MasterAccount.derivatorPointCached;
    this.MasterAccount.derivatorPointCached = {};

    let masterInputCoinCached = this.MasterAccount.inputCoinCached;
    this.MasterAccount.inputCoinCached = {};

    let masterDerivatorJsonCached = this.MasterAccount.derivatorJsonCached;
    this.MasterAccount.derivatorJsonCached = {};

    let masterInputCoinJsonCached = this.MasterAccount.inputCoinJsonCached;
    this.MasterAccount.inputCoinJsonCached = {};

    let masterSpentCoinCached = this.MasterAccount.spentCoinCached;
    this.MasterAccount.spentCoinCached = {};

    let childDerivatorPointCacheds = new Array(this.MasterAccount.child.length);
    let childInputCoinCacheds = new Array(this.MasterAccount.child.length);
    let childDerivatorJsonCacheds = new Array(this.MasterAccount.child.length);
    let childInputCoinJsonCacheds = new Array(this.MasterAccount.child.length);
    let childSpentCoinCacheds = new Array(this.MasterAccount.child.length);

    for (let i = 0; i < this.MasterAccount.child.length; i++) {
      childDerivatorPointCacheds[i] = this.MasterAccount.child[i].derivatorPointCached;
      childInputCoinCacheds[i] = this.MasterAccount.child[i].inputCoinCached;
      childDerivatorJsonCacheds[i] = this.MasterAccount.child[i].derivatorJsonCached;
      childInputCoinJsonCacheds[i] = this.MasterAccount.child[i].inputCoinJsonCached;
      childSpentCoinCacheds[i] = this.MasterAccount.child[i].spentCoinCached;

      this.MasterAccount.child[i].derivatorPointCached = {};
      this.MasterAccount.child[i].inputCoinCached = {};
      this.MasterAccount.child[i].derivatorJsonCached = {};
      this.MasterAccount.child[i].inputCoinJsonCached = {};
      this.MasterAccount.child[i].spentCoinCached = {};
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
    this.MasterAccount.derivatorJsonCached = masterDerivatorJsonCached;
    this.MasterAccount.inputCoinJsonCached = masterInputCoinJsonCached;
    this.MasterAccount.spentCoinCached = masterSpentCoinCached;
    for (let i = 0; i < childDerivatorPointCacheds.length; i++) {
      this.MasterAccount.child[i].derivatorPointCached = childDerivatorPointCacheds[i];
      this.MasterAccount.child[i].inputCoinCached = childInputCoinCacheds[i];
      this.MasterAccount.child[i].derivatorJsonCached = childDerivatorJsonCacheds[i];
      this.MasterAccount.child[i].inputCoinJsonCached = childInputCoinJsonCacheds[i];
      this.MasterAccount.child[i].spentCoinCached = childSpentCoinCacheds[i];
    }

    // console.log("Data wallet after JSON.stringify: ", data);
    // encrypt
    let cipherText = CryptoJS.AES.encrypt(data, password)

    // storage
    if (this.Storage != null) {
      console.log("this.Storage: ", this.Storage);
      this.Storage.setItem("Wallet", cipherText.toString());
    }

    // save cached of each accounts
    this.MasterAccount.saveAccountCached(password, this.Storage);
    for (let i = 0; i < this.MasterAccount.child.length; i++) {
      this.MasterAccount.child[i].saveAccountCached(password, this.Storage);
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

          if (obj.MasterAccount.child[i].spendingCoins) {
            for (let j = 0; j < obj.MasterAccount.child[i].spendingCoins.length; j++) {
              for (let k = 0; k < obj.MasterAccount.child[i].spendingCoins[j].spendingSNs.length; k++) {
                Object.setPrototypeOf(obj.MasterAccount.child[i].spendingCoins[j].spendingSNs[k], Array.prototype);
                obj.MasterAccount.child[i].spendingCoins[j].spendingSNs[k] = new Uint8Array(obj.MasterAccount.child[i].spendingCoins[j].spendingSNs[k]);
              }
            }
          }
        }

        Object.assign(this, obj);
      } catch (e) {
        console.log("ERR when load wallet: ", e);
        throw new CustomError(ErrorObject.LoadWalletErr, e.message || "Error when load wallet");
      }
    }
  }

  async loadAccountsCached(accName = null) {
    console.log("Loading account cached................................");
    let password = this.PassPhrase;

    if (accName) {
      let account = this.getAccountByName(accName);
      return await account.loadAccountCached(password, this.Storage);
    }

    await this.MasterAccount.loadAccountCached(password, this.Storage);
    for (let i = 0; i < this.MasterAccount.child.length; i++) {
      await this.MasterAccount.child[i].loadAccountCached(password, this.Storage);
    }
  }

  async listAccount() {
    // return this.MasterAccount.child.map(async (child, index) => {
    //   let miningSeedKey = hashSha3BytesToBytes(hashSha3BytesToBytes(child.key.KeySet.PrivateKey));
    //   let blsPublicKey = await generateBLSPubKeyB58CheckEncodeFromSeed(miningSeedKey);

    //   return {
    //     "AccountName": child.name,
    //     "PrivateKey": child.key.base58CheckSerialize(PriKeyType),
    //     "PaymentAddress": child.key.base58CheckSerialize(PaymentAddressType),
    //     "ReadonlyKey": child.key.base58CheckSerialize(ReadonlyKeyType),
    //     "PublicKey": child.key.getPublicKeyByHex(),
    //     "PublicKeyCheckEncode": child.key.getPublicKeyCheckEncode(),
    //     "BlockProducerKey": checkEncode(miningSeedKey, ENCODE_VERSION),
    //     "BLSPublicKey": blsPublicKey,
    //     "PublicKeyBytes": child.key.KeySet.PaymentAddress.Pk.toString(),
    //     "Index": index,
    //   }
    // })

    let accounts = [];

    for (let i = 0; i < this.MasterAccount.child.length; i++) {
      let child = this.MasterAccount.child[i];
      let miningSeedKey = hashSha3BytesToBytes(hashSha3BytesToBytes(child.key.KeySet.PrivateKey));
      let blsPublicKey = await generateBLSPubKeyB58CheckEncodeFromSeed(miningSeedKey);

      accounts[i] = {
        "AccountName": child.name,
        "PrivateKey": child.key.base58CheckSerialize(PriKeyType),
        "PaymentAddress": child.key.base58CheckSerialize(PaymentAddressType),
        "ReadonlyKey": child.key.base58CheckSerialize(ReadonlyKeyType),
        "PublicKey": child.key.getPublicKeyByHex(),
        "PublicKeyCheckEncode": child.key.getPublicKeyCheckEncode(),
        "BlockProducerKey": checkEncode(miningSeedKey, ENCODE_VERSION),
        "BLSPublicKey": blsPublicKey,
        "PublicKeyBytes": child.key.KeySet.PaymentAddress.Pk.toString(),
        "Index": i,
      }
    }

    return accounts;
  }

  async updateStatusHistory() {
    for (let i = 0; i < this.MasterAccount.child.length; i++) {
      if (this.MasterAccount.child[i].txHistory) {
        if (this.MasterAccount.child[i].txHistory.NormalTx) {
          for (let j = 0; j < this.MasterAccount.child[i].txHistory.NormalTx.length; j++) {
            if (this.MasterAccount.child[i].txHistory.NormalTx[j].status == SuccessTx) {
              let response;
              try {
                response = await Wallet.RpcClient.getTransactionByHash(this.MasterAccount.child[i].txHistory.NormalTx[j].txID);
              } catch (e) {
                throw new CustomError(ErrorObject.GetTxByHashErr, e.message || "Can not get normal transaction by hash");
              }

              if (response.isInBlock) {
                this.MasterAccount.child[i].txHistory.NormalTx[j].status = ConfirmedTx;
              }
            }
          }
        }

        if (this.MasterAccount.child[i].txHistory.CustomTokenTx) {
          for (let j = 0; j < this.MasterAccount.child[i].txHistory.CustomTokenTx.length; j++) {
            if (this.MasterAccount.child[i].txHistory.CustomTokenTx[j].status == SuccessTx) {
              let response;
              try {
                response = await Wallet.RpcClient.getTransactionByHash(this.MasterAccount.child[i].txHistory.CustomTokenTx[j].txID);
              } catch (e) {
                throw new CustomError(ErrorObject.GetTxByHashErr, e.message || "Can not get custom token transaction by hash");
              }

              if (response.isInBlock) {
                this.MasterAccount.child[i].txHistory.CustomTokenTx[j].status = ConfirmedTx;
              }
            }
          }
        }

        if (this.MasterAccount.child[i].txHistory.PrivacyCustomTokenTx) {
          for (let j = 0; j < this.MasterAccount.child[i].txHistory.PrivacyCustomTokenTx.length; j++) {
            if (this.MasterAccount.child[i].txHistory.PrivacyCustomTokenTx[j].status == SuccessTx) {
              let response;
              try {
                response = await Wallet.RpcClient.getTransactionByHash(this.MasterAccount.child[i].txHistory.PrivacyCustomTokenTx[j].txID);
              } catch (e) {
                throw new CustomError(ErrorObject.GetTxByHashErr, e.message || "Can not get privacy token transaction by hash");
              }

              if (response.isInBlock) {
                this.MasterAccount.child[i].txHistory.PrivacyCustomTokenTx[j].status = ConfirmedTx;
              }
            }
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
            try {
              response = await Wallet.RpcClient.getTransactionByHash(this.MasterAccount.child[i].spendingCoins[j].txID);
            } catch (e) {
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
  getEstimateFee, getEstimateFeeForSendingToken, getEstimateFeeToDefragment, getEstimateTokenFee,
  getMaxWithdrawAmount,
  toNanoPRV,
  toPRV,
  BurnAddress,
  getShardIDFromLastByte,
  generateECDSAKeyPair,
  generateBLSKeyPair,
}
