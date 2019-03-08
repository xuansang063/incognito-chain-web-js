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
import {CustomTokenParamTx, TxTokenVin, TxTokenVout} from "../tx/txcustomtokendata";
import {CustomTokenPrivacyParamTx} from "../tx/txcustomkenprivacydata";
import {convertHashToStr} from "../common";
import bn from 'bn.js';
import {RpcClient} from "../rpcclient/rpcclient";
import {PaymentInfo} from "../key";

class TrxHistoryInfo {
  constructor() {
    this.amount = 0;
    this.fee = 0;
    this.txID = "";
    this.type = "";
    this.receivers = [];
    this.tokenName = "";
    this.tokenID = "";
    this.tokenSymbol = "";
    this.status = ""
  }

  addHistoryInfo(txID, type, amount, fee, receiver, tokenName, tokenID, tokenSymbol, mileseconds) {
    this.amount = amount;
    this.fee = fee;
    this.txID = txID;
    this.type = type;
    this.tokenName = tokenName;
    this.tokenID = tokenID;
    this.tokenSymbol = tokenSymbol;
    this.Date = new Date(mileseconds)
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

    this.getBalance = this.getBalance.bind(this);
    this.createAndSendConstant = this.createAndSendConstant.bind(this);
    this.createAndSendCustomToken = this.createAndSendCustomToken.bind(this);
    this.createAndSendPrivacyCustomToken = this.createAndSendPrivacyCustomToken.bind(this);
    this.getCustomTokenBalance = this.getCustomTokenBalance.bind(this)
    this.getPrivacyCustomTokenBalance = this.getPrivacyCustomTokenBalance.bind(this)
    this.listFollowingTokens = this.listFollowingTokens.bind(this)
    this.addFollowingToken = this.addFollowingToken.bind(this)
    this.removeFollowingToken = this.removeFollowingToken.bind(this)
    this.getPrivacyCustomTokenTrx = this.getPrivacyCustomTokenTrx.bind(this)
    this.getCustomTokenTrx = this.getCustomTokenTrx.bind(this)
  }

  listFollowingTokens(){
    return this.followingTokens;
  };

  addFollowingToken(...tokenData){
    this.followingTokens.push(...tokenData);
  };
  removeFollowingToken(tokenId){
    const removedIndex = this.followingTokens.findIndex(token => token.ID === tokenId)
    this.followingTokens.splice(removedIndex, 1)
  }
  saveNormalTx = (txID, type, amount, fee, receiver, tokenName, tokenID, tokenSymbol, mileseconds) => {
    let saveTrxObj = new TrxHistoryInfo();
    saveTrxObj.addHistoryInfo(txID, type, amount, fee, receiver, tokenName, tokenID, tokenSymbol, mileseconds);
    this.trxHistory.NormalTrx.push(saveTrxObj);
  };
  saveCustomTokenTx = (txID, type, amount, fee, receiver, tokenName, tokenID, tokenSymbol, mileseconds) => {
    let saveTrxObj = new TrxHistoryInfo();
    saveTrxObj.addHistoryInfo(txID, type, amount, fee, receiver, tokenName, tokenID, tokenSymbol, mileseconds);
    this.trxHistory.CustomTokenTrx.push(saveTrxObj);
  };
  savePrivacyCustomTokenTx = (txID, type, amount, fee, receiver, tokenName, tokenID, tokenSymbol, mileseconds) => {
    let saveTrxObj = new TrxHistoryInfo();
    saveTrxObj.addHistoryInfo(txID, type, amount, fee, receiver, tokenName, tokenID, tokenSymbol, mileseconds);
    this.trxHistory.PrivacyCustomTokenTrx.push(saveTrxObj);
  };
  getNormalTrx = () => {
    return this.trxHistory.NormalTrx;
  };
  getPrivacyCustomTokenTrx(){
    return this.trxHistory.PrivacyCustomTokenTrx;
  };
  getCustomTokenTrx(){
    return this.trxHistory.CustomTokenTrx;
  };

  async getBalance() {
    console.time("Get balance: ");
    let paymentAddrSerialize = this.key.base58CheckSerialize(constantsWallet.PaymentAddressType);
    let readOnlyKeySerialize = this.key.base58CheckSerialize(constantsWallet.ReadonlyKeyType);
    let res = await Wallet.RpcClient.getOutputCoin(paymentAddrSerialize, readOnlyKeySerialize);
    let allOutputCoinStrs;
    if (res.err === null) {
      allOutputCoinStrs = res.outCoins
    } else {
      console.log('ERR when call API get output: ', res.err);
    }
    if (allOutputCoinStrs.length == 0) {
      console.timeEnd("Get balance: ");
      return 0;
    }



    // parse input coin from string
    let inputCoins = Wallet.RpcClient.parseInputCoinFromStr(allOutputCoinStrs, this.key);
    let unspentCoinList = await Wallet.RpcClient.getUnspentCoin(inputCoins, paymentAddrSerialize, allOutputCoinStrs);
    var unspentCoinString = unspentCoinList.unspentCoinStrs;
    let accountBalance = 0;
    for (let i = 0; i < unspentCoinString.length; i++) {
      accountBalance += parseInt(unspentCoinString[i].Value)
    }
    console.timeEnd("Get balance: ");
    return accountBalance
  }

  async getPrivacyCustomTokenBalance(privacyCustomTokenID) {
    let paymentAddrSerialize = this.key.base58CheckSerialize(constantsWallet.PaymentAddressType);
    let readOnlyKeySerialize = this.key.base58CheckSerialize(constantsWallet.ReadonlyKeyType);
    let res = await Wallet.RpcClient.getOutputCoin(paymentAddrSerialize, readOnlyKeySerialize, privacyCustomTokenID);
    let allOutputCoinStrs;
    if (res.err === null) {
      allOutputCoinStrs = res.outCoins
    } else {
      console.log('ERR when call API get output: ', res.err);
    }
    if (allOutputCoinStrs.length == 0) {
      return 0;
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

  async getCustomTokenBalance(customTokenIDStr) {
    let res0 = await Wallet.RpcClient.getUnspentCustomToken(this.key.base58CheckSerialize(constantsWallet.PaymentAddressType),
      customTokenIDStr);
    let vins = res0.listUnspentCustomToken;
    let accountBalance = 0;
    for (let i = 0; i < vins.length; i++) {
      accountBalance += parseInt(vins[i].Value)
    }
    return accountBalance
  };

  async createAndSendConstant(paymentInfos) {

    console.log("Payment info when create tx: ", paymentInfos);
    let senderSkStr = this.key.base58CheckSerialize(constantsWallet.PriKeyType);
    let paymentAddressStr = this.key.base58CheckSerialize(constantsWallet.PaymentAddressType);

    try {
      console.time("Time for preparing input for constant tx");
      console.log("Wallet: ", Wallet.RpcClient);
      let inputForTx = await Wallet.RpcClient.prepareInputForTx(senderSkStr, paymentInfos);
      console.log("input after prepare: ", inputForTx);
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
        return {
          txId: null,
          err: response.err,
        };
      } else {
        return {
          txId: response.txId,
          err: null,
        };
      }
    } catch (e) {
      console.log(e);
    }
  };

  async createAndSendCustomToken(paymentInfos = null, tokenParams) {
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
      console.log("SENDING CUSTOM TOKEN DONE!!!!")
      return responseSendTX;
      // if (!responseSendTX.txId && responseSendTX.err === null) {

      //   console.log("SENDING CUSTOM TOKEN IS SUCCESSFUL ", responseSendTX.txId);
      // } else {
      //   console.log("SENDING CUSTOM TOKEN IS FAILED ", responseSendTX.txId);
      // }
    } catch (e) {
      console.log(e);
    }
  };

  async createAndSendPrivacyCustomToken(paymentInfos = null, tokenParams) {
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

  getAccountByName(accountName) {
    return this.MasterAccount.child.find(item => item.name === accountName)
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
    account.key.KeySet.PrivateKey = Array.from(account.key.KeySet.PrivateKey);
    account.key.KeySet.PaymentAddress.Pk = Array.from(account.key.KeySet.PaymentAddress.Pk);
    account.key.KeySet.PaymentAddress.Tk = Array.from(account.key.KeySet.PaymentAddress.Tk);
    account.key.KeySet.ReadonlyKey.Pk = Array.from(account.key.KeySet.ReadonlyKey.Pk);
    account.key.KeySet.ReadonlyKey.Rk = Array.from(account.key.KeySet.ReadonlyKey.Rk);
    this.MasterAccount.key.KeySet.PrivateKey = Array.from(this.MasterAccount.key.KeySet.PrivateKey);
    this.MasterAccount.key.KeySet.PaymentAddress.Pk = Array.from(this.MasterAccount.key.KeySet.PaymentAddress.Pk);
    this.MasterAccount.key.KeySet.PaymentAddress.Tk = Array.from(this.MasterAccount.key.KeySet.PaymentAddress.Tk);
    this.MasterAccount.key.KeySet.ReadonlyKey.Pk = Array.from(this.MasterAccount.key.KeySet.ReadonlyKey.Pk);
    this.MasterAccount.key.KeySet.ReadonlyKey.Rk = Array.from(this.MasterAccount.key.KeySet.ReadonlyKey.Rk);
    this.MasterAccount.child.push(account)
    this.save(this.PassPhrase);
    return account
  }

  save(password) {
    if (password == "") {
      password = this.PassPhrase
    }

    // parse to byte[]
    // for (let i = 0 ; i < this.MasterAccount.child.length; i++) {
    //   this.MasterAccount.child[i].ChainCode = [...this.MasterAccount.child[i].ChainCode];
    // }
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
      this.walletTrx.push(child.trxHistory)
    }
    return this.Storage.setItem("Wallet Trx History", this.walletTrx)
  }

  async getHistoryByAccount(accName) {
    let historicTrxList = await this.Storage.getItem("Wallet Trx History");
    if (!historicTrxList) return []
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
    return this.MasterAccount.child.map((child, index) => {
      return {
        "Account Name": child.name,
        "PrivateKey": child.key.base58CheckSerialize(constantsWallet.PriKeyType),
        "PaymentAddress": child.key.base58CheckSerialize(constantsWallet.PaymentAddressType),
        "ReadonlyKey": child.key.base58CheckSerialize(constantsWallet.ReadonlyKeyType),
        "Index": index,
      }
    })
  }

  static RpcClient = new RpcClient();
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

export {Wallet, AccountWallet, DefaultStorage, TrxHistoryInfo,
  RpcClient, CustomTokenParamTx, CustomTokenPrivacyParamTx, PaymentInfo, KeyWallet, TxTokenVin, TxTokenVout}
