import * as constantsWallet from './constants';
import {KeyWallet, NewMasterKey} from "./hdwallet";
import {MnemonicGenerator} from "./mnemonic";
import CryptoJS from "crypto-js";
import JSON from "circular-json";
import * as keyset from '../keySet';
import * as key from '../key';
import {Tx} from "../tx/txprivacy";
import {TxCustomToken} from "../tx/txcustomtoken";
import {TxCustomTokenPrivacy} from "../tx/txcustomtokenprivacy";
import {convertHashToStr} from "../common";
import bn from 'bn.js';
import {RpcClient} from "../rpcclient/rpcclient";

class TrxHistoryInfo {
  constructor() {
    this.amount = 0;
    this.fee = 0;
    this.txID = "";
    this.type = "";
    this.receiver = [];
    this.tokenName = "";
    this.tokenID = "";
    this.tokenSymbol = "";
    this.status = ""
  }

  addHistoryInfo(amount = 0, fee = 0, txID, type, receiver, tokenName = "", tokenID = "", tokenSymbol = "") {
    this.amount = amount;
    this.fee = fee;
    this.txID = txID;
    this.type = type;
    this.tokenName = tokenName;
    this.tokenID = tokenID;
    this.tokenSymbol = tokenSymbol;
  }

  updateStatus(newStatus) {
    this.status = newStatus
  }

}

class AccountWallet {
  constructor() {
    this.name = "";
    this.key = new KeyWallet();
    this.child = [];
    this.isImport = false;
    this.followingTokens = [];
    this.trxHistory = {NormalTrx: [], CustomTokenTrx: [], PrivacyCustomTokenTrx: []};
  }

  listFollowingTokens = () => {
    return this.followingTokens;
  };

  addFollowingToken = (tokenData) => {
    this.followingTokens.push(tokenData);
  };
  saveNormalTrx = (saveTrxObj) => {
    this.trxHistory.NormalTrx.push(saveTrxObj);
  };
  saveCustomTokenTrx = (saveTrxObj) => {
    this.trxHistory.CustomTokenTrx.push(saveTrxObj);
  };
  savePrivacyCustomToken = (saveTrxObj) => {
    this.trxHistory.PrivacyCustomTokenTrx.push(saveTrxObj);
  };
  getNormalTrx = () => {
    return this.trxHistory.NormalTrx;
  };
  getPrivacyCustomTokenTrx = () => {
    return this.trxHistory.PrivacyCustomTokenTrx;
  };
  getCustomTokenTrx = () => {
    return this.trxHistory.CustomTokenTrx;
  };
  getBalance = async () => {
    let paymentAddrSerialize = this.key.base58CheckSerialize(constantsWallet.PaymentAddressType);
    let readOnlyKeySerialize = this.key.base58CheckSerialize(constantsWallet.ReadonlyKeyType);
    let res = await Wallet.RpcClient.getOutputCoin(paymentAddrSerialize, readOnlyKeySerialize);
    let allOutputCoinStrs;
    if (res.err === null) {
      allOutputCoinStrs = res.outCoins
    } else {
      console.log('ERR when call API get output: ', res.err);
    }
    // parse input coin from string
    let inputCoins = Wallet.RpcClient.parseInputCoinFromStr(allOutputCoinStrs, this.key);
    let unspentCoinList = await Wallet.RpcClient.getUnspentCoin(inputCoins, paymentAddrSerialize, allOutputCoinStrs);
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
    let res = await Wallet.RpcClient.getOutputCoin(paymentAddrSerialize, readOnlyKeySerialize, privacyCustomTokenID);
    let allOutputCoinStrs;
    if (res.err === null) {
      allOutputCoinStrs = res.outCoins
    } else {
      console.log('ERR when call API get output: ', res.err);
    }
    // parse input coin from string
    let inputCoins = Wallet.RpcClient.parseInputCoinFromStr(allOutputCoinStrs, this.key);
    let unspentCoinList = await Wallet.RpcClient.getUnspentCoin(inputCoins, paymentAddrSerialize, allOutputCoinStrs, privacyCustomTokenID);
    var unspentCoinString = unspentCoinList.unspentCoinStrs;
    let accountBalance = 0;
    for (let i = 0; i < unspentCoinString.length; i++) {
      accountBalance += parseInt(unspentCoinString[i].Value)
    }
    return accountBalance
  }

  getCustomTokenBalance = async (customTokenIDStr) => {
    let res0 = await Wallet.RpcClient.getUnspentCustomToken(this.key.base58CheckSerialize(constantsWallet.PaymentAddressType),
      customTokenIDStr);
    let vins = res0.listUnspentCustomToken;
    let accountBalance = 0;
    for (let i = 0; i < vins.length; i++) {
      accountBalance += parseInt(vins[i].Value)
    }
    return accountBalance
  };

  createAndSendConstant = async (paymentInfos) => {
    let senderSkStr = this.key.base58CheckSerialize(constantsWallet.PriKeyType);
    let paymentAddressStr = this.key.base58CheckSerialize(constantsWallet.PaymentAddressType);

    try {
      console.time("Time for preparing input for constant tx");
      console.log("Wallet: ", Wallet.RpcClient);
      let inputForTx = await Wallet.RpcClient.prepareInputForTx(senderSkStr, paymentInfos);
      console.timeEnd("Time for preparing input for constant tx");

      let tx = new Tx(Wallet.RpcClient);

      console.time("Time for creating tx");
      let err = await tx.init(this.key.KeySet.PrivateKey, paymentAddressStr, paymentInfos,
        inputForTx.inputCoins, inputForTx.inputCoinStrs, new bn(0), true, null, null);

      if (err !== null) {
        console.log("ERR when creating tx")
      }
      console.timeEnd("Time for creating tx");

      // console.log("*************** CONSTANT TX: ", tx);

      let response = await Wallet.RpcClient.sendRawTx(tx);
      if (response.err !== null) {
        console.log("ERR when sending constant tx: ", response.err);
      }
    } catch (e) {
      console.log(e);
    }
  };

  createAndSendCustomToken = async (paymentInfos = null, tokenParams) => {
    let senderSkStr = this.key.base58CheckSerialize(constantsWallet.PriKeyType);
    let paymentAddressStr = this.key.base58CheckSerialize(constantsWallet.PaymentAddressType);

    try {
      console.time("Time for preparing input for custom token tx");
      let inputForTx = await Wallet.RpcClient.prepareInputForTx(senderSkStr, paymentInfos);
      console.timeEnd("Time for preparing input for custom token tx");

      let inputForCustomTokenTx = await Wallet.RpcClient.prepareInputForCustomTokenTx(senderSkStr, tokenParams);
      tokenParams.vins = inputForCustomTokenTx.tokenVins;

      console.log("Prepare: vins: ", inputForCustomTokenTx.tokenVins);
      console.log("Prepare: lost custom token: ", inputForCustomTokenTx.listCustomToken);

      let tx = new TxCustomToken(Wallet.RpcClient);
      await tx.init(this.key.KeySet.PrivateKey, paymentAddressStr, paymentInfos, inputForTx.inputCoins, inputForTx.inputCoinStrs, new bn(0), tokenParams, inputForCustomTokenTx.listCustomToken, null, false);

      console.log("Token ID:  ", convertHashToStr(tx.txTokenData.propertyID));

      let responseSendTX = await Wallet.RpcClient.sendRawTxCustomToken(tx);
      if (responseSendTX.txId !== null) {
        console.log("SENDING CUSTOM TOKEN IS SUCCESSFUL ", responseSendTX.txId);
      } else {
        console.log("SENDING CUSTOM TOKEN IS FAILED ", responseSendTX.txId);
      }
    } catch (e) {
      console.log(e);
    }
  };

  createAndSendPrivacyCustomToken = async (paymentInfos = null, tokenParams) => {
    let senderSkStr = this.key.base58CheckSerialize(constantsWallet.PriKeyType);
    let paymentAddressStr = this.key.base58CheckSerialize(constantsWallet.PaymentAddressType);

    try {
      console.time("Time for preparing input for custom token tx");
      let inputForTx = await Wallet.RpcClient.prepareInputForTx(senderSkStr, paymentInfos);
      console.timeEnd("Time for preparing input for custom token tx");


      console.log("token param before preparing input: ", tokenParams);
      let inputForPrivacyCustomTokenTx = await Wallet.RpcClient.prepareInputForTxCustomTokenPrivacy(senderSkStr, tokenParams);
      tokenParams.tokenInputs = inputForPrivacyCustomTokenTx.tokenInputs;

      // console.log("Prepare: vins: ", inputForPrivacyCustomTokenTx.tokenInputs);
      // console.log("Prepare: list custom token: ", inputForPrivacyCustomTokenTx.listCustomToken);

      let tx = new TxCustomTokenPrivacy(Wallet.RpcClient);
      await tx.init(this.key.KeySet.PrivateKey, paymentAddressStr, paymentInfos, inputForTx.inputCoins, inputForTx.inputCoinStrs, new bn(0), tokenParams, inputForPrivacyCustomTokenTx.listCustomToken, null, false);

      let responseSendTX = await Wallet.RpcClient.sendRawTxCustomTokenPrivacy(tx);
      if (responseSendTX.txId !== null) {
        console.log("SENDING CUSTOM TOKEN IS SUCCESSFUL ", responseSendTX.txId);
      } else {
        console.log("SENDING CUSTOM TOKEN IS FAILED ", responseSendTX.txId);
      }
    } catch (e) {
      console.log(e);
    }
  };

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
    this.walletTrx = []
  }

  init(passPhrase, numOfAccount, name, storage) {
    let mnemonicGen = new MnemonicGenerator();
    this.Name = name;
    this.Entropy = mnemonicGen.newEntropy(128);
    this.Mnemonic = mnemonicGen.newMnemonic(this.Entropy);
    this.Seed = mnemonicGen.newSeed(this.Mnemonic, passPhrase);
    this.PassPhrase = passPhrase
    let masterKey = NewMasterKey(this.Seed);
    this.PassPhrase = passPhrase
    this.MasterAccount = new AccountWallet()
    this.MasterAccount.key = masterKey;
    this.MasterAccount.child = [];
    this.MasterAccount.name = "master";

    if (numOfAccount == 0) {
      numOfAccount = 1;
    }

    for (let i = 0; i < numOfAccount; i++) {
      let childKey = this.MasterAccount.key.newChildKey(i);
      let account = new AccountWallet();
      account.name = "AccountWallet " + i;
      account.child = [];
      account.key = childKey;
      this.MasterAccount.child.push(account)
    }

    this.Storage = storage;
  }

  createNewAccount(accountName) {
    let newIndex = this.MasterAccount.child.length;
    let childKey = this.MasterAccount.key.newChildKey(newIndex);
    if (accountName === "") {
      accountName = "AccountWallet " + newIndex;
    }
    let accountWallet = new AccountWallet()
    accountWallet.key = childKey;
    accountWallet.child = [];
    accountWallet.name = accountName;

    this.MasterAccount.child.push(accountWallet);
    this.save(this.PassPhrase)

    return accountWallet;
  }

  exportAccountPrivateKey(childIndex) {
    return this.MasterAccount.child[childIndex].key.base58CheckSerialize(constantsWallet.PriKeyType);
  }

  exportAccountReadonlyKey(childIndex) {
    return this.MasterAccount.child[childIndex].key.base58CheckSerialize(constantsWallet.ReadonlyKeyType);
  }

  removeAccount(privakeyStr, accountName, passPhrase) {
    if (passPhrase !== this.PassPhrase) {
      throw new Error("Wrong passphrase")
    }
    for (let i = 0; i < this.MasterAccount.child.length; i++) {
      let account = this.MasterAccount.child[i];
      if (account.key.base58CheckSerialize(PriKeyType) === privakeyStr) {
        this.MasterAccount.child.splice(i);
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

    for (let i = 0; i < this.MasterAccount.child.length; i++) {
      let account = this.MasterAccount.child[i];
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
    this.MasterAccount.child.push(account)
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

    console.log('cipherText', cipherText)
    // storage
    if (this.Storage != null) {
      return this.Storage.setItem("Wallet", cipherText.toString());
    }
  }

  setTrxHistory() {
    for (let i = 0; i < this.MasterAccount.child.length; i++) {
      let child = this.MasterAccount.child[i];
      if (typeof this.walletTrx[i] === "undefined") {
        this.walletTrx[i] = new Array();
      }
      this.walletTrx[i].push(child.trxHistory)
    }
    return this.Storage.setItem("Wallet Trx History", this.walletTrx)
  }

  async getHistoryByAccount(accName) {
    let historicTrxList = await this.Storage.getItem("Wallet Trx History");
    let index = 0;
    for (let i = 0; i < this.MasterAccount.child.length; i++) {
      if (this.MasterAccount.child[i].name === accName) {
        index = i;
        break;
      }
    }
    return historicTrxList[index]
  }

  async loadWallet(password) {
    if (this.Storage != null) {
      let cipherText = await this.Storage.getItem("Wallet");
      if (!cipherText) return false;
      let data = CryptoJS.AES.decrypt(cipherText, password)
      let jsonStr = data.toString(CryptoJS.enc.Utf8);

      try {
        let obj = JSON.parse(jsonStr);
        Object.setPrototypeOf(obj, Wallet.prototype);
        Object.setPrototypeOf(obj.MasterAccount, AccountWallet.prototype);
        Object.setPrototypeOf(obj.MasterAccount.key, KeyWallet.prototype);
        for (let i = 0; i < obj.MasterAccount.child.length; i++) {
          Object.setPrototypeOf(obj.MasterAccount.child[i], AccountWallet.prototype);
          Object.setPrototypeOf(obj.MasterAccount.child[i].key, KeyWallet.prototype);

          Object.setPrototypeOf(obj.MasterAccount.child[i].key.ChainCode, ArrayBuffer.prototype);
          let temp = new Uint8Array(32)
          temp.set(obj.MasterAccount.child[i].key.ChainCode)
          obj.MasterAccount.child[i].key.ChainCode = temp

          Object.setPrototypeOf(obj.MasterAccount.child[i].key.ChildNumber, ArrayBuffer.prototype);
          temp = new Uint8Array(4)
          temp.set(obj.MasterAccount.child[i].key.ChildNumber)
          obj.MasterAccount.child[i].key.ChildNumber = temp

          Object.setPrototypeOf(obj.MasterAccount.child[i].key.KeySet, keyset.KeySet.prototype);
          Object.setPrototypeOf(obj.MasterAccount.child[i].key.KeySet.PaymentAddress, key.PaymentAddress.prototype);

          Object.setPrototypeOf(obj.MasterAccount.child[i].key.KeySet.PaymentAddress.Pk, ArrayBuffer.prototype);
          temp = new Uint8Array(33)
          temp.set(obj.MasterAccount.child[i].key.KeySet.PaymentAddress.Pk)
          obj.MasterAccount.child[i].key.KeySet.PaymentAddress.Pk = temp

          Object.setPrototypeOf(obj.MasterAccount.child[i].key.KeySet.PaymentAddress.Tk, ArrayBuffer.prototype);
          temp = new Uint8Array(33)
          temp.set(obj.MasterAccount.child[i].key.KeySet.PaymentAddress.Tk)
          obj.MasterAccount.child[i].key.KeySet.PaymentAddress.Tk = temp

          Object.setPrototypeOf(obj.MasterAccount.child[i].key.KeySet.ReadonlyKey, key.ViewingKey.prototype);
          Object.setPrototypeOf(obj.MasterAccount.child[i].key.KeySet.ReadonlyKey.Pk, ArrayBuffer.prototype);
          temp = new Uint8Array(33)
          temp.set(obj.MasterAccount.child[i].key.KeySet.ReadonlyKey.Pk);
          obj.MasterAccount.child[i].key.KeySet.ReadonlyKey.Pk = temp
        }
        delete obj.Storage
        Object.assign(this, obj)
        return this
      } catch (e) {
        throw e;
      }
    }
  }


  listAccount() {
    let listAcc = [];
    for (let i = 0; i < this.MasterAccount.child.length; i++) {
      let child = this.MasterAccount.child[i];
      let account = {
        "Account Name": child.name,
        "PaymentAddress": child.key.base58CheckSerialize(constantsWallet.PaymentAddressType),
        "ReadonlyKey": child.key.base58CheckSerialize(constantsWallet.ReadonlyKeyType),
      }
      listAcc.push(account)
    }
    return listAcc
  }

  static RpcClient;
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

export {Wallet, AccountWallet, DefaultStorage, TrxHistoryInfo}