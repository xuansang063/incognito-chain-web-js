import * as constantsWallet from './constants';
import * as constantsTx from '../tx/constants';
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
    this.status = constantsWallet.FailedTx;
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

  listFollowingTokens() {
    return this.followingTokens;
  };

  addFollowingToken(...tokenData) {
    this.followingTokens.push(...tokenData);
  };

  removeFollowingToken(tokenId) {
    const removedIndex = this.followingTokens.findIndex(token => token.ID === tokenId)
    this.followingTokens.splice(removedIndex, 1)
  }

  saveNormalTx(txID, type, amount, fee, receiver, tokenName, tokenID, tokenSymbol, mileseconds, status) {
    let saveTrxObj = new TrxHistoryInfo();
    saveTrxObj.addHistoryInfo(txID, type, amount, fee, receiver, tokenName, tokenID, tokenSymbol, mileseconds);
    saveTrxObj.updateStatus(status);
    this.trxHistory.NormalTrx.push(saveTrxObj);
  };
  saveCustomTokenTx(txID, type, amount, fee, receiver, tokenName, tokenID, tokenSymbol, mileseconds, status) {
    let saveTrxObj = new TrxHistoryInfo();
    saveTrxObj.addHistoryInfo(txID, type, amount, fee, receiver, tokenName, tokenID, tokenSymbol, mileseconds);
    saveTrxObj.updateStatus(status);
    this.trxHistory.CustomTokenTrx.push(saveTrxObj);
  };
  savePrivacyCustomTokenTx(txID, type, amount, fee, receiver, tokenName, tokenID, tokenSymbol, mileseconds){
    let saveTrxObj = new TrxHistoryInfo();
    saveTrxObj.addHistoryInfo(txID, type, amount, fee, receiver, tokenName, tokenID, tokenSymbol, mileseconds);
    this.trxHistory.PrivacyCustomTokenTrx.push(saveTrxObj);
  };
  getNormalTrx = () => {
    return this.trxHistory.NormalTrx;
  };

  getPrivacyCustomTokenTrx() {
    return this.trxHistory.PrivacyCustomTokenTrx;
  };

  getCustomTokenTrx() {
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
    let inputCoins = Wallet.RpcClient.parseInputCoinFromEncodedObject(allOutputCoinStrs, this.key);
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
    let inputCoins = Wallet.RpcClient.parseInputCoinFromEncodedObject(allOutputCoinStrs, this.key);
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

  async createAndSendConstant(paymentInfos, receiverPaymentAddrStr) {
    console.log("LIB: spending key when sending constant: ", this.key.KeySet.PrivateKey);

    console.log("Payment info when create tx: ", paymentInfos);
    let senderSkStr = this.key.base58CheckSerialize(constantsWallet.PriKeyType);
    let paymentAddressStr = this.key.base58CheckSerialize(constantsWallet.PaymentAddressType);

    try {
      // prepare input for tx
      console.time("Time for preparing input for constant tx");
      console.log("Wallet: ", Wallet.RpcClient);
      let inputForTx;
      try{
        inputForTx = await Wallet.RpcClient.prepareInputForTx(senderSkStr, paymentInfos);
        console.log("input after prepare: ", inputForTx);
      }catch(e){
        throw e;
      }
      console.timeEnd("Time for preparing input for constant tx");

      // init tx
      let tx = new Tx(Wallet.RpcClient);

      try {
        console.time("Time for creating tx");
        await tx.init(this.key.KeySet.PrivateKey, paymentAddressStr, paymentInfos,
          inputForTx.inputCoins, inputForTx.inputCoinStrs, new bn(0), true, null, null);
        console.timeEnd("Time for creating tx");
      } catch (e) {
        console.timeEnd("Time for creating tx");
        console.log("ERR when creating tx")
        return {
          txId: null,
          err: new Error("ERR when creating tx: " + e.toString())
        }
      }

      // console.log("*************** CONSTANT TX: ", tx);
      let response = await Wallet.RpcClient.sendRawTx(tx);

      // saving history tx
      // check status of tx
      let status = constantsWallet.FailedTx;
      if (response.txId){
        tx.txId = response.txId
        status = constantsWallet.SuccessTx;
      }

      let amount = new bn(0);
      for (let i=0; i<paymentInfos.length; i++){
        amount = amount.add(paymentInfos[i].Amount);
      }

      this.saveNormalTx(tx.txId, tx.type, amount, tx.fee, receiverPaymentAddrStr, null, null, null, tx.lockTime, status);
      console.log("history: ", this.trxHistory);
      // this.trxHistory.NormalTrx.updateStatus(status);

      console.log("SENDING CONSTANT DONE!!!!")
      return response;
    } catch (e) {
      console.log(e);
      throw e;
    }
  };

  async createAndSendCustomToken(paymentInfos = null, tokenParams, receiverPaymentAddrStr) {
    let senderSkStr = this.key.base58CheckSerialize(constantsWallet.PriKeyType);
    let paymentAddressStr = this.key.base58CheckSerialize(constantsWallet.PaymentAddressType);

    try {
      console.log("Preparing input for nomal tx ....")
      let inputForTx
      try{
        console.time("Time for preparing input for custom token tx");
        inputForTx = await Wallet.RpcClient.prepareInputForTx(senderSkStr, paymentInfos);
        console.timeEnd("Time for preparing input for custom token tx");
      } catch(e){
        throw e;
      }
      
      let inputForCustomTokenTx;
      try{
        console.log("Preparing input for custom token tx ....")
        inputForCustomTokenTx = await Wallet.RpcClient.prepareInputForCustomTokenTx(senderSkStr, tokenParams);
      } catch(e){
        throw e;
      }
  
      tokenParams.vins = inputForCustomTokenTx.tokenVins;
      tokenParams.vinsAmount = inputForCustomTokenTx.vinsAmount;

      // for (let i = 0; i < tokenParams.vins.length; i++) {
      //   tokenParams.vinsAmount += tokenParams.vins[i].value;
      // }

      console.log("Prepare: token vins: ", inputForCustomTokenTx.tokenVins);
      console.log("Prepare: list custom token: ", inputForCustomTokenTx.listCustomToken);

      let tx = new TxCustomToken(Wallet.RpcClient);

      try {
        await tx.init(this.key.KeySet.PrivateKey, paymentAddressStr, paymentInfos, inputForTx.inputCoins, inputForTx.inputCoinStrs, new bn(0), tokenParams, inputForCustomTokenTx.listCustomToken, null, false);
      } catch (e) {
        console.log("ERR when creating custom token tx")
        return {
          txId: null,
          err: new Error("ERR when creating custom token tx: " + e.toString())
        }
      }

      // console.log("Token ID:  ", convertHashToStr(tx.txTokenData.propertyID));

      console.log("Sending custom token tx ....")
      let responseSendTX = await Wallet.RpcClient.sendRawTxCustomToken(tx);
      console.log("SENDING CUSTOM TOKEN DONE!!!!")

      // saving history tx
      // check status of tx

      console.log("Saving custom token tx ....")
      let status = constantsWallet.FailedTx;
      if (responseSendTX.txId){
        tx.txId = responseSendTX.txId
        status = constantsWallet.SuccessTx;

        // add to following token list if tx is init token
        if (tx.txTokenData.type == constantsTx.CustomTokenInit){
          this.addFollowingToken(tx.txTokenData);
          console.log("List following token after adding: ", this.followingTokens);
        }
      }

      let amount = new bn(0);
      for (let i=0; i<paymentInfos.length; i++){
        amount = amount.add(paymentInfos[i].Amount);
      }

      this.saveCustomTokenTx(tx.txId, tx.type, tx.txTokenData.amount, tx.fee, receiverPaymentAddrStr, tx.txTokenData.propertyName, tx.txTokenData.propertyID, tx.txTokenData.propertySymbol, tx.lockTime, status);
      console.log("history: ", this.trxHistory);

      return responseSendTX;
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
      //todo:


      // saving history tx
      // check status of tx

      console.log("Saving custom token tx ....")
      let status = constantsWallet.FailedTx;
      if (responseSendTX.txId){
        tx.txId = responseSendTX.txId
        status = constantsWallet.SuccessTx;

        // add to following token list if tx is init token
        if (tx.txTokenData.type == constantsTx.CustomTokenInit){
          this.addFollowingToken(tx.txTokenData);
          console.log("List following token after adding: ", this.followingTokens);
        }
        
      }

      let amount = new bn(0);
      for (let i=0; i<paymentInfos.length; i++){
        amount = amount.add(paymentInfos[i].Amount);
      }

      this.saveCustomTokenTx(tx.txId, tx.type, tx.txTokenData.amount, tx.fee, receiverPaymentAddrStr, tx.txTokenData.propertyName, tx.txTokenData.propertyID, tx.txTokenData.propertySymbol, tx.lockTime, status);
      console.log("history: ", this.trxHistory);


      // if (responseSendTX.txId !== null) {
      //   console.log("SENDING CUSTOM TOKEN IS SUCCESSFUL ", responseSendTX.txId);
      // } else {
      //   console.log("SENDING CUSTOM TOKEN IS FAILED ", responseSendTX.txId);
      // }

      return responseSendTX;
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

          // chaincode
          Object.setPrototypeOf(obj.MasterAccount.child[i].key.ChainCode, Array.prototype);
          obj.MasterAccount.child[i].key.ChainCode = new Uint8Array(obj.MasterAccount.child[i].key.ChainCode)

          // child num
          Object.setPrototypeOf(obj.MasterAccount.child[i].key.ChildNumber, Array.prototype);
          obj.MasterAccount.child[i].key.ChildNumber = new Uint8Array(obj.MasterAccount.child[i].key.ChildNumber)

          Object.setPrototypeOf(obj.MasterAccount.child[i].key.KeySet, keyset.KeySet.prototype);

          // payment address
          
          Object.setPrototypeOf(obj.MasterAccount.child[i].key.KeySet.PaymentAddress, key.PaymentAddress.prototype);
          Object.setPrototypeOf(obj.MasterAccount.child[i].key.KeySet.PaymentAddress.Pk, Array.prototype);
          obj.MasterAccount.child[i].key.KeySet.PaymentAddress.Pk = new Uint8Array(obj.MasterAccount.child[i].key.KeySet.PaymentAddress.Pk)
          Object.setPrototypeOf(obj.MasterAccount.child[i].key.KeySet.PaymentAddress.Tk, Array.prototype);
          obj.MasterAccount.child[i].key.KeySet.PaymentAddress.Tk = new Uint8Array(obj.MasterAccount.child[i].key.KeySet.PaymentAddress.Tk)

          // read only key
          Object.setPrototypeOf(obj.MasterAccount.child[i].key.KeySet.ReadonlyKey, key.ViewingKey.prototype);
          Object.setPrototypeOf(obj.MasterAccount.child[i].key.KeySet.ReadonlyKey.Pk, Array.prototype);
          obj.MasterAccount.child[i].key.KeySet.ReadonlyKey.Pk = new Uint8Array(obj.MasterAccount.child[i].key.KeySet.ReadonlyKey.Pk)
          Object.setPrototypeOf(obj.MasterAccount.child[i].key.KeySet.ReadonlyKey.Rk, Array.prototype);
          obj.MasterAccount.child[i].key.KeySet.ReadonlyKey.Rk = new Uint8Array(obj.MasterAccount.child[i].key.KeySet.ReadonlyKey.Rk)

          // private key
          Object.setPrototypeOf(obj.MasterAccount.child[i].key.KeySet.PrivateKey, Array.prototype);
          obj.MasterAccount.child[i].key.KeySet.PrivateKey = new Uint8Array(obj.MasterAccount.child[i].key.KeySet.PrivateKey)
        }
        delete obj.Storage
        Object.assign(this, obj)
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

export {
  Wallet, AccountWallet, DefaultStorage, TrxHistoryInfo,
  RpcClient, CustomTokenParamTx, CustomTokenPrivacyParamTx, PaymentInfo, KeyWallet, TxTokenVin, TxTokenVout
}
