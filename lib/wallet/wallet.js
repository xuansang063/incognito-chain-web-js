import * as constantsWallet from './constants';
import {KeyWallet as keyWallet, KeyWallet, NewMasterKey} from "./hdwallet";
import {MnemonicGenerator} from "./mnemonic";
import CryptoJS from "crypto-js";
import JSON from "circular-json";
import * as keyset from '../keySet';
import * as key from '../key';
import {RpcClient} from '../rpcclient/rpcclient';
import {Tx} from "../tx/txprivacy";
import * as constantsTx from '../tx/constants';
import {CustomTokenParamTx, TxTokenVout} from "../tx/txcustomtokendata";
import {CustomTokenInit} from "../tx/constants";
import {TxCustomToken} from "../tx/txcustomtoken";

import bn from 'bn.js';
import {convertHashToStr} from "../common";
import {TxCustomTokenPrivacy} from "../tx/txcustomtokenprivacy";
const rpcClient = new RpcClient("http://localhost:9334");

class TrxHistoryInfo{
  constructor(){
    this.amount = 0;
    this.fee = 0;
    this.txID = "";
    this.type = "";
    this.receivers = [];
    this.tokenName = "";
    this.tokenID = "";
    this.tokenSymbol = "";
    this.status = "";
    this.time = "";
  }
  addHistoryInfo(txID, type, amount, fee, receivers, tokenName, tokenID, tokenSymbol, mileseconds){
    this.amount = amount;
    this.fee = fee;
    this.txID = txID;
    this.type = type;
    this.receivers = receivers;
    this.tokenName = tokenName;
    this.tokenID = tokenID;
    this.tokenSymbol = tokenSymbol;
    this.time = new Date(mileseconds);
  }
  updateStatus(newStatus){
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
    this.trxHistory = {NormalTrx:[],CustomTokenTrx: [], PrivacyCustomTokenTrx: []};
    
    this.getBalance = this.getBalance.bind(this)
  }

  listFollowingTokens = () => {
    return this.followingTokens;
  };

  addFollowingToken = (tokenData) => {
    this.followingTokens.push(tokenData);
  };
  saveNormalTx = (txID, type, amount, fee,receivers, tokenName, tokenID, tokenSymbol) => {
    let saveTrxObj = new TrxHistoryInfo();
    saveTrxObj.addHistoryInfo(txID, type, amount, fee, receivers, tokenName, tokenID, tokenSymbol);
    this.trxHistory.NormalTrx.push(saveTrxObj);
  };
  saveCustomTokenTx = (txID, type, amount, fee, receivers, tokenName, tokenID, tokenSymbol) =>{
    let saveTrxObj = new TrxHistoryInfo();
    saveTrxObj.addHistoryInfo(txID, type, amount, fee, receivers, tokenName, tokenID, tokenSymbol);
    this.trxHistory.CustomTokenTrx.push(saveTrxObj);
  };
  savePrivacyCustomTokenTx = (txID, type, amount, fee, receivers, tokenName, tokenID, tokenSymbol) => {
    let saveTrxObj = new TrxHistoryInfo();
    saveTrxObj.addHistoryInfo(txID, type, amount, fee, receivers, tokenName, tokenID, tokenSymbol);
    this.trxHistory.PrivacyCustomTokenTrx.push(saveTrxObj);
  };
  getNormalTx = () => {
    return this.trxHistory.NormalTrx;
  };
  getPrivacyCustomTokenTx = () => {
    return this.trxHistory.PrivacyCustomTokenTrx;
  };
  getCustomTokenTx = () => {
    return this.trxHistory.CustomTokenTrx;
  };
  async getBalance(){
    let paymentAddrSerialize = this.key.base58CheckSerialize(constantsWallet.PaymentAddressType);
    let readOnlyKeySerialize = this.key.base58CheckSerialize(constantsWallet.ReadonlyKeyType);
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
    let res0 = await rpcClient.getUnspentCustomToken(this.key.base58CheckSerialize(constantsWallet.PaymentAddressType),
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
      let inputForTx = await rpcClient.prepareInputForTx(senderSkStr, paymentInfos);
      console.timeEnd("Time for preparing input for constant tx");

      let tx = new Tx("http://localhost:9334");

      console.time("Time for creating tx");
      let err = await tx.init(this.key.KeySet.PrivateKey, paymentAddressStr, paymentInfos,
          inputForTx.inputCoins, inputForTx.inputCoinStrs, new bn(0), true, null, null);

      if (err !== null){
        console.log("ERR when creating tx")
      }
      console.timeEnd("Time for creating tx");

      // console.log("*************** CONSTANT TX: ", tx);

      let response = await rpcClient.sendRawTx(tx);
      if (response.err !== null){
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
      let inputForTx = await rpcClient.prepareInputForTx(senderSkStr, paymentInfos);
      console.timeEnd("Time for preparing input for custom token tx");

      let inputForCustomTokenTx = await rpcClient.prepareInputForCustomTokenTx(senderSkStr, tokenParams);
      tokenParams.vins = inputForCustomTokenTx.tokenVins;

      console.log("Prepare: vins: ", inputForCustomTokenTx.tokenVins);
      console.log("Prepare: lost custom token: ", inputForCustomTokenTx.listCustomToken);

      let tx = new TxCustomToken("http://localhost:9334");
      await tx.init(this.key.KeySet.PrivateKey, paymentAddressStr, paymentInfos, inputForTx.inputCoins, inputForTx.inputCoinStrs, new bn(0), tokenParams, inputForCustomTokenTx.listCustomToken, null, false);

      console.log("Token ID:  ", convertHashToStr(tx.txTokenData.propertyID));

      let responseSendTX = await rpcClient.sendRawTxCustomToken(tx);
      if (responseSendTX.txId !== null) {
        console.log("SENDING CUSTOM TOKEN IS SUCCESSFUL ", responseSendTX.txId);
      } else {
        console.log("SENDING CUSTOM TOKEN IS FAILED ", responseSendTX.txId);
      }
    } catch (e) {
      console.log(e);
    }
  };

  createAndSendPrivacyCustomToken = async (paymentInfos = null, tokenParams) =>{
    let senderSkStr = this.key.base58CheckSerialize(constantsWallet.PriKeyType);
    let paymentAddressStr = this.key.base58CheckSerialize(constantsWallet.PaymentAddressType);

    try {
      console.time("Time for preparing input for custom token tx");
      let inputForTx = await rpcClient.prepareInputForTx(senderSkStr, paymentInfos);
      console.timeEnd("Time for preparing input for custom token tx");


      console.log("token param before preparing input: ", tokenParams);
      let inputForPrivacyCustomTokenTx = await rpcClient.prepareInputForTxCustomTokenPrivacy(senderSkStr, tokenParams);
      tokenParams.tokenInput = inputForPrivacyCustomTokenTx.tokenInputs;

      console.log("Prepare: vins: ", inputForPrivacyCustomTokenTx.tokenInputs);
      console.log("Prepare: list custom token: ", inputForPrivacyCustomTokenTx.listCustomToken);

      let tx = new TxCustomTokenPrivacy("http://localhost:9334");
      await tx.init(this.key.KeySet.PrivateKey, paymentAddressStr, paymentInfos, inputForTx.inputCoins, inputForTx.inputCoinStrs, new bn(0), tokenParams, inputForPrivacyCustomTokenTx.listCustomToken, null, false);

      console.log("Token ID:  ", convertHashToStr(tx.txTokenPrivacyData.propertyID));

      let responseSendTX = await rpcClient.sendRawTxCustomTokenPrivacy(tx);
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

    // storage
    if (this.Storage != null) {
      this.Storage.setItem("Wallet", cipherText);
    }
  }
  setTrxHistory(){
    for (let i=0;i<this.MasterAccount.child.length;i++){
      let child = this.MasterAccount.child[i];
      if (typeof this.walletTrx[i] === "undefined"){
        this.walletTrx[i] = new Array();
      }
      this.walletTrx[i].push(child.trxHistory)
    }
    this.Storage.setItem("Wallet Trx History", this.walletTrx)
  }
  getHistoryByAccount(accName){
    let historicTrxList = this.Storage.getItem("Wallet Trx History");
    let index = 0;
    for (let i=0;i<this.MasterAccount.child.length;i++){
      if (this.MasterAccount.child[i].name === accName){
        index = i;
        break;
      }
    }
    return historicTrxList[index]
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
          Object.setPrototypeOf(obj.MasterAccount.child[i].key.KeySet.ReadonlyKey.PublicKey, ArrayBuffer.prototype);
          temp = new Uint8Array(33)
          temp.set(obj.MasterAccount.child[i].key.KeySet.ReadonlyKey.PublicKey);
          obj.MasterAccount.child[i].key.KeySet.ReadonlyKey.Pk = temp
        }
        delete obj.Storage
        Object.assign(this, obj)
      } catch (e) {
        throw e;
      }
    }
  }


  async listAccount() {
    return await Promise.all(this.MasterAccount.child.map(async child => {
      return {
        "Account Name": child.name,
        "PaymentAddress": child.key.base58CheckSerialize(constantsWallet.PaymentAddressType),
        "ReadonlyKey": child.key.base58CheckSerialize(constantsWallet.ReadonlyKeyType),
        "Balance": await child.getBalance()
      }
    }))
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

module.exports = {Wallet, AccountWallet, DefaultStorage, TrxHistoryInfo};