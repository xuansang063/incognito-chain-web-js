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
import {genImageFromStr} from "./utils";
import {
  FailedTx,
  SuccessTx,
  ConfirmedTx,
  AmountStakingBeacon,
  MetaStakingBeacon,
  AmountStakingShard,
  MetaStakingShard,
} from "./constants";

import * as base58 from "../base58";
import {checkEncode} from "../base58";

const P256 = ec.P256;
import * as ec from "privacy-js-lib/lib/ec";
import * as coin from '../coin';


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
    this.isIn = null;
    this.time = ""
    this.status = constantsWallet.FailedTx;
  }

  addHistoryInfo(txID, type, amount, fee, receivers, tokenName, tokenID, tokenSymbol, mileseconds, isIn) {
    this.amount = amount;
    this.fee = fee;
    this.receivers = receivers;
    this.txID = txID;
    this.type = type;
    this.tokenName = tokenName;
    this.tokenID = tokenID;
    this.tokenSymbol = tokenSymbol;
    this.time = new Date(mileseconds);
    this.isIn = isIn;
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
    this.getCustomTokenBalance = this.getCustomTokenBalance.bind(this);
    this.getPrivacyCustomTokenBalance = this.getPrivacyCustomTokenBalance.bind(this);
    this.listFollowingTokens = this.listFollowingTokens.bind(this);
    this.addFollowingToken = this.addFollowingToken.bind(this);
    this.removeFollowingToken = this.removeFollowingToken.bind(this);
    this.getPrivacyCustomTokenTrx = this.getPrivacyCustomTokenTrx.bind(this);
    this.getCustomTokenTrx = this.getCustomTokenTrx.bind(this)

    this.derivatorPointCached = {}
    this.derivatorJsonCached = {}
    this.spentCoinCached = {}
    this.inputCoinCached = {}
    this.inputCoinJsonCached = {}
  };

  clearCached() {
    this.derivatorPointCached = {}
    this.derivatorJsonCached = {}
    this.spentCoinCached = {}
    this.inputCoinCached = {}
    this.inputCoinJsonCached = {}
  }

  listFollowingTokens() {
    return this.followingTokens;
  };

  /**
   * @param {...{ID: string, Image: string, Name: string, Symbol: string, Amount: number, IsPrivacy: boolean, isInit: boolean}} tokenData - tokens to follow
   */
  addFollowingToken(...tokenData) {
    this.followingTokens.unshift(...tokenData);
  };

  removeFollowingToken(tokenId) {
    const removedIndex = this.followingTokens.findIndex(token => token.ID === tokenId)
    this.followingTokens.splice(removedIndex, 1)
  }

  saveNormalTx(tx, amount, receivers, tokenName, tokenID, tokenSymbol, status, isIn) {
    let saveTrxObj = new TrxHistoryInfo();
    console.log("TX FEE when saving: ", tx.fee);
    saveTrxObj.addHistoryInfo(tx.txId, tx.type, amount, tx.fee / 100, receivers, tokenName, tokenID, tokenSymbol, tx.lockTime, isIn);
    saveTrxObj.updateStatus(status);
    this.trxHistory.NormalTrx.unshift(saveTrxObj);
  };

  // saveStakingTx(tx, amount, receivers, tokenName, tokenID, tokenSymbol, status, isIn) {
  //   let saveTrxObj = new TrxHistoryInfo();
  //   console.log("TX FEE when saving: ", tx.fee);
  //   saveTrxObj.addHistoryInfo(tx.txId, tx.type, amount, tx.fee / 100, receivers, tokenName, tokenID, tokenSymbol, tx.lockTime, isIn);
  //   saveTrxObj.updateStatus(status);
  //   this.trxHistory.StakingTrx.unshift(saveTrxObj);
  // };

  saveCustomTokenTx(tx, receivers, status, isIn, amount) {

    let saveTrxObj = new TrxHistoryInfo();
    saveTrxObj.addHistoryInfo(tx.txId, tx.type, amount, tx.fee / 100, receivers, tx.txTokenData.propertyName, tx.txTokenData.propertyID, tx.txTokenData.propertySymbol, tx.lockTime, isIn);
    saveTrxObj.updateStatus(status);
    this.trxHistory.CustomTokenTrx.unshift(saveTrxObj);
  };

  savePrivacyCustomTokenTx(tx, receivers, status, isIn, amount) {
    let saveTrxObj = new TrxHistoryInfo();
    // , receiverPaymentAddrStr,
    saveTrxObj.addHistoryInfo(tx.txId, tx.type, amount, tx.fee / 100, receivers, tx.txTokenPrivacyData.propertyName, tx.txTokenPrivacyData.propertyID, tx.txTokenPrivacyData.propertySymbol, tx.lockTime, isIn);
    saveTrxObj.updateStatus(status);
    this.trxHistory.PrivacyCustomTokenTrx.unshift(saveTrxObj);
  };

  getNormalTrx() {
    return this.trxHistory.NormalTrx;
  };

  getPrivacyCustomTokenTrx() {
    return this.trxHistory.PrivacyCustomTokenTrx;
  };

  getCustomTokenTrx() {
    return this.trxHistory.CustomTokenTrx;
  };

  getPrivacyCustomTokenTrxByTokenID(id) {
    let queryResult = new Array();
    for (let i = 0; i < this.trxHistory.PrivacyCustomTokenTrx.length; i++) {
      if (this.trxHistory.PrivacyCustomTokenTrx[i].tokenID === id)
        queryResult.push(this.trxHistory.PrivacyCustomTokenTrx[i])
    }
    return queryResult;
  }

  getCustomTokenTrxByTokenID(id) {
    let queryResult = new Array();
    for (let i = 0; i < this.trxHistory.CustomTokenTrx.length; i++) {
      if (this.trxHistory.CustomTokenTrx[i].tokenID === id)
        queryResult.push(this.trxHistory.CustomTokenTrx[i])
    }
    return queryResult;
  }

  async mergeDerivatorCached() {
    this.derivatorJsonCached = this.derivatorJsonCached == undefined ? {} : this.derivatorJsonCached
    this.derivatorPointCached = this.derivatorPointCached == undefined ? {} : this.derivatorPointCached
    for (let k in this.derivatorPointCached) {
      if (k != undefined && this.derivatorJsonCached[k] == undefined) {
        this.derivatorJsonCached[k] = base58.checkEncode(this.derivatorPointCached[k].compress(), 0x00);
      }
    }
    // console.log(`${this.name} mergeDerivatorCached`, this.derivatorJsonCached);
  }

  async loadDerivatorCached() {
    this.derivatorJsonCached = this.derivatorJsonCached == undefined ? {} : this.derivatorJsonCached
    this.derivatorPointCached = this.derivatorPointCached == undefined ? {} : this.derivatorPointCached
    for (let k in this.derivatorJsonCached) {
      if (k != undefined && this.derivatorPointCached[k] == undefined) {
        this.derivatorPointCached[k] = P256.decompress(base58.checkDecode(this.derivatorJsonCached[k]).bytesDecoded);
      }
    }
    // console.log(`${this.name} loadDerivatorCached`, this.derivatorJsonCached);
  }

  async mergeInputCoinJsonCached(allOutputCoinStrs, inputCoins, tokenID = 'constant') {
    // console.log(`${this.name} mergeInputCoinJsonCached allOutputCoinStrs`, allOutputCoinStrs);
    // console.log(`${this.name} mergeInputCoinJsonCached inputCoins`, inputCoins);
    // console.log(`${this.name} mergeInputCoinJsonCached tokenID`, tokenID);
    this.inputCoinCached = this.inputCoinCached == undefined ? {} : this.inputCoinCached
    this.inputCoinJsonCached = this.inputCoinJsonCached == undefined ? {} : this.inputCoinJsonCached
    for (let i = 0; i < allOutputCoinStrs.length; i++) {
      const sndStr = `${tokenID}_${allOutputCoinStrs[i].SNDerivator}`;
      const oObject = inputCoins[i];
      if (this.inputCoinCached[sndStr] == undefined) {
        this.inputCoinCached[sndStr] = oObject;
        const jsonObject = {};
        jsonObject.publicKey = base58.checkEncode(oObject.coinDetails.publicKey.compress(), 0x00);
        jsonObject.coinCommitment = base58.checkEncode(oObject.coinDetails.coinCommitment.compress(), 0x00);
        jsonObject.snderivator = oObject.coinDetails.snderivator.toString();
        jsonObject.randomness = oObject.coinDetails.randomness.toString();
        jsonObject.value = oObject.coinDetails.value.toString();
        jsonObject.info = base58.checkEncode(oObject.coinDetails.info, 0x00);
        jsonObject.serialNumber = base58.checkEncode(oObject.coinDetails.serialNumber.compress(), 0x00);
        this.inputCoinJsonCached[sndStr] = jsonObject
      }
    }
    // console.log(`${this.name} mergeInputCoinJsonCached`, this.inputCoinCached);
  }

  async loadInputCoinCached() {
    this.inputCoinCached = this.inputCoinCached == undefined ? {} : this.inputCoinCached
    this.inputCoinJsonCached = this.inputCoinJsonCached == undefined ? {} : this.inputCoinJsonCached
    for (let sndStr in this.inputCoinJsonCached) {
      if (sndStr != undefined && this.inputCoinCached[sndStr] == undefined) {
        const jsonObject = this.inputCoinJsonCached[sndStr];

        const oObject = new coin.InputCoin();
        oObject.coinDetails.publicKey = P256.decompress(base58.checkDecode(jsonObject.publicKey).bytesDecoded);
        oObject.coinDetails.coinCommitment = P256.decompress(base58.checkDecode(jsonObject.coinCommitment).bytesDecoded);
        oObject.coinDetails.snderivator = new bn(jsonObject.snderivator);
        oObject.coinDetails.randomness = new bn(jsonObject.randomness);
        oObject.coinDetails.value = new bn(jsonObject.value);
        oObject.coinDetails.info = base58.checkDecode(jsonObject.info).bytesDecoded;
        oObject.coinDetails.serialNumber = P256.decompress(base58.checkDecode(jsonObject.serialNumber).bytesDecoded);

        this.inputCoinCached[sndStr] = oObject
      }
    }
    console.log(`${this.name} loadInputCoinCached`, this.inputCoinCached);
  }

  analyzeOutputCoinFromCached(allOutputCoinStrs, tokenID = 'constant') {
    this.inputCoinCached = this.inputCoinCached == undefined ? {} : this.inputCoinCached
    // console.log(`${this.name} analyzeOutputCoinFromCached allOutputCoinStrs`, allOutputCoinStrs);
    // console.log(`${this.name} analyzeOutputCoinFromCached tokenID`, tokenID);
    let leftOutputCoinStrs = [];
    let cachedOutputCoinStrs = [];
    let cachedInputCoins = [];
    for (let i = 0; i < allOutputCoinStrs.length; i++) {
      const sndStr = `${tokenID}_${allOutputCoinStrs[i].SNDerivator}`;
      if (this.inputCoinCached[sndStr] != undefined) {
        cachedOutputCoinStrs.push(allOutputCoinStrs[i]);
        // console.log("this.inputCoinCached[sndStr]: ", this.inputCoinCached[sndStr]);
        cachedInputCoins.push(this.inputCoinCached[sndStr]);
      } else {
        leftOutputCoinStrs.push(allOutputCoinStrs[i]);
      }
    }
    // console.log(`${this.name} analyzeOutputCoinFromCached leftOutputCoinStrs`, leftOutputCoinStrs);
    // console.log(`${this.name} analyzeOutputCoinFromCached cachedOutputCoinStrs`, cachedOutputCoinStrs);
    // console.log(`${this.name} analyzeOutputCoinFromCached cachedInputCoins`, cachedInputCoins);
    return {
      leftOutputCoinStrs: leftOutputCoinStrs,
      cachedOutputCoinStrs: cachedOutputCoinStrs,
      cachedInputCoins: cachedInputCoins,
    }
  }

  async mergeSpentCoinCached(unspentCoinStrs, inputCoins, tokenID = 'constant') {
    this.spentCoinCached = this.spentCoinCached == undefined ? {} : this.spentCoinCached
    // console.log(`${this.name} mergeSpentCoinCached unspentCoinStrs`, unspentCoinStrs);
    // console.log(`${this.name} mergeSpentCoinCached inputCoins`, inputCoins);
    // console.log(`${this.name} mergeSpentCoinCached tokenID`, tokenID);
    let chkAll = {};
    for (let i = 0; i < inputCoins.length; i++) {
      const sndStr = `${tokenID}_${inputCoins[i].coinDetails.snderivator}`;
      chkAll[sndStr] = true
    }
    for (let i = 0; i < unspentCoinStrs.length; i++) {
      let sndDecode = base58.checkDecode(unspentCoinStrs[i].SNDerivator).bytesDecoded;
      let snderivator = new bn(sndDecode);
      const sndStr = `${tokenID}_${snderivator}`;
      chkAll[sndStr] = false
    }
    for (let sndStr in chkAll) {
      if (sndStr != undefined && chkAll[sndStr] == true) {
        this.spentCoinCached[sndStr] = true
      }
    }
    // console.log(`${this.name} mergeSpentCoinCached spentCoinCached`, this.spentCoinCached);
  }

  analyzeSpentCoinFromCached(inputCoins, allOutputCoinStrs, tokenID = 'constant') {
    // console.log(`${this.name} analyzeSpentCoinFromCached inputCoins`, inputCoins);
    // console.log(`${this.name} analyzeSpentCoinFromCached allOutputCoinStrs`, allOutputCoinStrs);
    // console.log(`${this.name} analyzeSpentCoinFromCached tokenID`, tokenID);
    this.spentCoinCached = this.spentCoinCached == undefined ? {} : this.spentCoinCached
    let inputCoinsRet = []
    let allOutputCoinStrsRet = []
    for (let i = 0; i < inputCoins.length; i++) {
      const sndStr = `${tokenID}_${inputCoins[i].coinDetails.snderivator}`;
      if (this.spentCoinCached[sndStr] == undefined) {
        inputCoinsRet.push(inputCoins[i]);
        allOutputCoinStrsRet.push(allOutputCoinStrs[i]);
      }
    }
    // console.log(`${this.name} analyzeSpentCoinFromCached inputCoinsRet`, inputCoinsRet);
    // console.log(`${this.name} analyzeSpentCoinFromCached allOutputCoinStrsRet`, allOutputCoinStrsRet);
    return {
      inputCoinsRet: inputCoinsRet,
      allOutputCoinStrsRet: allOutputCoinStrsRet,
    };
  }

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
    const {leftOutputCoinStrs, cachedOutputCoinStrs, cachedInputCoins} = this.analyzeOutputCoinFromCached(allOutputCoinStrs);
    let inputCoins = cachedInputCoins;
    if (leftOutputCoinStrs.length > 0) {
      let leftInputCoins = Wallet.RpcClient.parseInputCoinFromEncodedObject(leftOutputCoinStrs, this.key, this.derivatorPointCached);
      this.mergeDerivatorCached();
      this.mergeInputCoinJsonCached(leftOutputCoinStrs, leftInputCoins);
      inputCoins = inputCoins.concat(leftInputCoins);
      allOutputCoinStrs = cachedOutputCoinStrs.concat(leftOutputCoinStrs);
    }
    // analyze from cache
    let {inputCoinsRet, allOutputCoinStrsRet} = this.analyzeSpentCoinFromCached(inputCoins, allOutputCoinStrs);
    let unspentCoinList = await Wallet.RpcClient.getUnspentCoin(inputCoinsRet, paymentAddrSerialize, allOutputCoinStrsRet);
    // update cache
    this.mergeSpentCoinCached(unspentCoinList.unspentCoinStrs, inputCoins);
    var unspentCoinString = unspentCoinList.unspentCoinStrs;

    let accountBalance = 0;
    for (let i = 0; i < unspentCoinString.length; i++) {
      accountBalance += parseInt(unspentCoinString[i].Value)
    }

    // console.log(this.name , " inputCoinCached after getbalance : ", this.inputCoinCached);
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
    const {leftOutputCoinStrs, cachedOutputCoinStrs, cachedInputCoins} = this.analyzeOutputCoinFromCached(allOutputCoinStrs, privacyCustomTokenID);
    let inputCoins = cachedInputCoins;
    if (leftOutputCoinStrs.length > 0) {
      let leftInputCoins = Wallet.RpcClient.parseInputCoinFromEncodedObject(leftOutputCoinStrs, this.key, this.derivatorPointCached, privacyCustomTokenID);
      this.mergeDerivatorCached();
      this.mergeInputCoinJsonCached(leftOutputCoinStrs, leftInputCoins, privacyCustomTokenID);
      inputCoins = inputCoins.concat(leftInputCoins);
      allOutputCoinStrs = cachedOutputCoinStrs.concat(leftOutputCoinStrs);
    }
    // let inputCoins = Wallet.RpcClient.parseInputCoinFromEncodedObject(allOutputCoinStrs, this.key);
    let {inputCoinsRet, allOutputCoinStrsRet} = this.analyzeSpentCoinFromCached(inputCoins, allOutputCoinStrs, privacyCustomTokenID);
    let unspentCoinList = await Wallet.RpcClient.getUnspentCoin(inputCoinsRet, paymentAddrSerialize, allOutputCoinStrsRet, privacyCustomTokenID);
    this.mergeSpentCoinCached(unspentCoinList.unspentCoinStrs, inputCoins, privacyCustomTokenID);
    var unspentCoinString = unspentCoinList.unspentCoinStrs;
    let accountBalance = 0;
    for (let i = 0; i < unspentCoinString.length; i++) {
      accountBalance += parseInt(unspentCoinString[i].Value)
    }
    return accountBalance
  }

  async getCustomTokenBalance(customTokenIDStr) {
    console.log('begin getCustomTokenBalance(customTokenIDStr)', customTokenIDStr)
    let res0 = await Wallet.RpcClient.getUnspentCustomToken(this.key.base58CheckSerialize(constantsWallet.PaymentAddressType),
      customTokenIDStr);

    // console.log('\t loaded getUnspentCustomToken', res0)
    let vins = res0.listUnspentCustomToken;
    let accountBalance = 0;
    for (let i = 0; i < vins.length; i++) {
      accountBalance += parseInt(vins[i].Value)
    }
    // console.log('\t accountBalance', accountBalance)
    return accountBalance
  };

  async createAndSendConstant(param, fee, isPrivacy) {
    await Wallet.updateProgressTx(10)
    // create paymentInfos
    let paymentInfos = new Array(param.length);
    let receiverPaymentAddrStr = new Array(param.length);

    for (let i = 0; i < paymentInfos.length; i++) {
      let keyWallet = KeyWallet.base58CheckDeserialize(
        param[i].paymentAddressStr
      );
      receiverPaymentAddrStr[i] = param[i].paymentAddressStr;
      paymentInfos[i] = new PaymentInfo(
        keyWallet.KeySet.PaymentAddress,
        new bn(param[i].amount)
      );
    }

    // console.log("LIB: spending key when sending constant: ", this.key.KeySet.PrivateKey);

    // console.log("Payment info when create tx: ", paymentInfos);
    let senderSkStr = this.key.base58CheckSerialize(constantsWallet.PriKeyType);
    let paymentAddressStr = this.key.base58CheckSerialize(constantsWallet.PaymentAddressType);

    console.time("Time for create and send tx");
    try {
      // prepare input for tx
      console.time("Time for preparing input for constant tx");
      // console.log("Wallet: ", Wallet.RpcClient);
      let inputForTx;
      try {
        inputForTx = await Wallet.RpcClient.prepareInputForTx(senderSkStr, paymentInfos, new bn(fee), this);
        console.log("input after prepare: ", inputForTx);
      } catch (e) {
        throw e;
      }
      console.timeEnd("Time for preparing input for constant tx");

      await Wallet.updateProgressTx(30)

      // init tx
      let tx = new Tx(Wallet.RpcClient);

      let amount = new bn(0);
      for (let i = 0; i < paymentInfos.length; i++) {
        amount = amount.add(paymentInfos[i].Amount);
      }

      console.log("Input before init tx: ", inputForTx.inputCoins[0].coinDetails.value);

      try {
        console.time("Time for creating tx");
        await tx.init(this.key.KeySet.PrivateKey, paymentAddressStr, paymentInfos,
          inputForTx.inputCoins, inputForTx.inputCoinStrs, new bn(fee), isPrivacy, null, null);
        console.timeEnd("Time for creating tx");
      } catch (e) {
        console.timeEnd("Time for creating tx");
        console.log("ERR when creating tx: ", e);
        return {
          txId: null,
          err: new Error("ERR when creating tx: " + e.toString())
        }
      }

      await Wallet.updateProgressTx(60)

      // console.log("*************** CONSTANT TX: ", tx);
      let response = await Wallet.RpcClient.sendRawTx(tx);

      await Wallet.updateProgressTx(90)

      console.log("SENDING CONSTANT DONE!!!!");
      console.timeEnd("Time for create and send tx");

      // saving history tx
      console.log("Saving tx history.....");
      console.time("Saving tx history: ");

      // check status of tx
      let status = constantsWallet.FailedTx;
      if (response.txId) {
        tx.txId = response.txId
        status = constantsWallet.SuccessTx;

        response.type = tx.type;
        response.fee = tx.fee;
        response.lockTime = tx.lockTime;
        response.amount = amount;
        response.txStatus = status;
      }

      console.log("Amount number when saving: ", amount.toNumber());
      this.saveNormalTx(tx, amount.toNumber() / 100, receiverPaymentAddrStr, null, null, null, status, false);
      console.log("history after saving: ", this.trxHistory);

      console.timeEnd("Saving tx history: ");

      await Wallet.updateProgressTx(100)
      console.log("Progress Tx: ", Wallet.ProgressTx);

      return response;
    } catch (e) {
      await Wallet.updateProgressTx(0)
      console.log(e);
      throw e;
    }
  };


  // staking tx always send constant to address
  // param.type: 0 : shard, 1: beacon
  // param.burningAddress: burningAddress
  // fee in Number
  async createAndSendStakingTx(param, fee) {
    await Wallet.updateProgressTx(10)
    let amount;
    try {
      let response = Wallet.RpcClient.getStakingAmount(param.type);
      amount = response.res;
    } catch (e) {
      throw e;
    }

    let meta;
    if (param.type == constantsWallet.ShardStakingType) {
      meta = {Type: constantsWallet.MetaStakingShard};
    } else {
      meta = {Type: constantsWallet.MetaStakingBeacon};
    }

    // create paymentInfos
    let paymentInfos = new Array(1);
    let receiverPaymentAddrStr = new Array(1);
    receiverPaymentAddrStr[0] = param.burningAddress;

    let keyWallet = KeyWallet.base58CheckDeserialize(
      receiverPaymentAddrStr[0]
    );
    paymentInfos[0] = new PaymentInfo(
      keyWallet.KeySet.PaymentAddress,
      new bn(amount)
    );

    console.log("LIB: spending key when sending constant: ", this.key.KeySet.PrivateKey);

    console.log("Payment info when create staking tx: ", paymentInfos);
    let senderSkStr = this.key.base58CheckSerialize(constantsWallet.PriKeyType);
    let paymentAddressStr = this.key.base58CheckSerialize(constantsWallet.PaymentAddressType);

    console.time("Time for create and send tx");
    try {
      // prepare input for tx
      console.time("Time for preparing input for staking tx");
      console.log("Wallet: ", Wallet.RpcClient);
      let inputForTx;
      try {
        inputForTx = await Wallet.RpcClient.prepareInputForTx(senderSkStr, paymentInfos, new bn(fee), this);
        console.log("input after prepare: ", inputForTx);
      } catch (e) {
        throw e;
      }
      console.timeEnd("Time for preparing input for staking tx");

      await Wallet.updateProgressTx(30)

      // init txs
      let tx = new Tx(Wallet.RpcClient);

      let amountToSpent = new bn(0);
      for (let i = 0; i < paymentInfos.length; i++) {
        amountToSpent = amountToSpent.add(paymentInfos[i].Amount);
      }

      try {
        console.time("Time for creating tx");
        await tx.init(this.key.KeySet.PrivateKey, paymentAddressStr, paymentInfos,
          inputForTx.inputCoins, inputForTx.inputCoinStrs, new bn(fee), false, null, meta);
        console.timeEnd("Time for creating tx");
      } catch (e) {
        console.timeEnd("Time for creating tx");
        console.log("ERR when creating tx: ", e);
        return {
          txId: null,
          err: new Error("ERR when creating tx: " + e.toString())
        }
      }
      await Wallet.updateProgressTx(60)

      // console.log("*************** CONSTANT TX: ", tx);
      let response = await Wallet.RpcClient.sendRawTx(tx);


      await Wallet.updateProgressTx(90)

      console.log("SENDING STAKING TX DONE!!!!");
      console.timeEnd("Time for create and send tx");

      // saving history tx
      console.log("Saving tx history.....");
      console.time("Saving tx history: ");

      // check status of tx
      let status = constantsWallet.FailedTx;
      if (response.txId) {
        tx.txId = response.txId
        status = constantsWallet.SuccessTx;

        response.type = tx.type;
        response.fee = tx.fee;
        response.lockTime = tx.lockTime;
        response.amount = amountToSpent;
        response.txStatus = status;
      }

      console.log("Amount number when saving: ", amountToSpent.toNumber());
      this.saveNormalTx(tx, amountToSpent.toNumber() / 100, receiverPaymentAddrStr, null, null, null, status, false);
      console.log("history after saving: ", this.trxHistory);

      console.timeEnd("Saving tx history: ");

      await Wallet.updateProgressTx(100)
      console.log("Progress Tx: ", Wallet.ProgressTx);

      return response;
    } catch (e) {
      await Wallet.updateProgressTx(0)
      console.log(e);
      throw e;
    }
  };

  async createAndSendCustomToken(paymentInfos = null, tokenParams, receiverPaymentAddrStr, fee) {
    await Wallet.updateProgressTx(10);
    let senderSkStr = this.key.base58CheckSerialize(constantsWallet.PriKeyType);
    let paymentAddressStr = this.key.base58CheckSerialize(constantsWallet.PaymentAddressType);

    try {
      console.log("Preparing input for nomal tx ....")
      let inputForTx
      try {
        console.time("Time for preparing input for custom token tx");
        inputForTx = await Wallet.RpcClient.prepareInputForTx(senderSkStr, paymentInfos, new bn(fee), this);
        await Wallet.updateProgressTx(30);
        console.log("Input for fee: ", inputForTx);
        console.timeEnd("Time for preparing input for custom token tx");
      } catch (e) {
        throw e;
      }

      let inputForCustomTokenTx;
      try {
        console.log("Preparing input for custom token tx ....")
        inputForCustomTokenTx = await Wallet.RpcClient.prepareInputForCustomTokenTx(senderSkStr, tokenParams);
      } catch (e) {
        throw e;
      }
      await Wallet.updateProgressTx(50);

      tokenParams.vins = inputForCustomTokenTx.tokenVins;
      tokenParams.vinsAmount = inputForCustomTokenTx.vinsAmount;

      // for (let i = 0; i < tokenParams.vins.length; i++) {
      //   tokenParams.vinsAmount += tokenParams.vins[i].value;
      // }

      console.log("Prepare: token vins: ", inputForCustomTokenTx.tokenVins);
      console.log("Prepare: list custom token: ", inputForCustomTokenTx.listCustomToken);

      let tx = new TxCustomToken(Wallet.RpcClient);

      try {
        await tx.init(this.key.KeySet.PrivateKey, paymentAddressStr, paymentInfos, inputForTx.inputCoins, inputForTx.inputCoinStrs, new bn(fee), tokenParams, inputForCustomTokenTx.listCustomToken, null, false);
      } catch (e) {
        console.log("ERR when creating custom token tx: ", e)
        throw e;
        // return {
        //   txId: null,
        //   err: new Error("ERR when creating custom token tx: " + e.toString())
        // }
      }
      await Wallet.updateProgressTx(80);

      // console.log("Token ID:  ", convertHashToStr(tx.txTokenData.propertyID));

      console.log("Sending custom token tx ....")
      let responseSendTX = await Wallet.RpcClient.sendRawTxCustomToken(tx);
      console.log("SENDING CUSTOM TOKEN DONE!!!!")
      await Wallet.updateProgressTx(90);

      // saving history tx
      // check status of tx


      console.log("Saving custom token tx ....")
      let status = constantsWallet.FailedTx;
      if (responseSendTX.txId) {
        tx.txId = responseSendTX.txId
        status = constantsWallet.SuccessTx;

        responseSendTX.type = tx.type;
        responseSendTX.fee = tx.fee;
        responseSendTX.lockTime = tx.lockTime;
        responseSendTX.amount = tx.txTokenData.amount;
        responseSendTX.txStatus = status;

        responseSendTX.propertyName = tx.txTokenData.propertyName;
        responseSendTX.propertyID = tx.txTokenData.propertyID;
        responseSendTX.propertySymbol = tx.txTokenData.propertySymbol;

        // add to following token list if tx is init token
        if (tx.txTokenData.type == constantsTx.CustomTokenInit) {
          const {txTokenData} = tx
          const followingToken = {
            ID: txTokenData.propertyID,
            Image: this.getTokenImage(txTokenData.propertyID),
            Name: txTokenData.propertyName,
            Symbol: txTokenData.propertySymbol,
            Amount: txTokenData.amount,
            IsPrivacy: false,
            isInit: true
          };
          this.addFollowingToken(followingToken);
          console.log("List following token after adding: ", this.followingTokens);
        }
      }
      // check is init or transfer token
      let isIn;
      let amount = 0;
      if (tx.txTokenData.type == constantsTx.CustomTokenInit) {
        isIn = true;
        amount = tx.txTokenData.amount;
      } else {
        isIn = false;

        for (let i = 0; i < tokenParams.receivers.length; i++) {
          amount += tokenParams.receivers[i].value;
        }
      }

      this.saveCustomTokenTx(tx, receiverPaymentAddrStr, status, isIn, amount);
      console.log("history: ", this.trxHistory);

      console.log("[WEB JS] Account Wallet after create and send token: ", this);
      await Wallet.updateProgressTx(100);

      return responseSendTX;
    } catch (e) {
      throw e
    }
  };

  async createAndSendPrivacyCustomToken(paymentInfos = null, submitParam, fee) {
    await Wallet.updateProgressTx(10);

    // token param
    // get current token to get token param
    let tokenParams = new CustomTokenPrivacyParamTx();
    tokenParams.propertyID = submitParam.TokenID;
    tokenParams.propertyName = submitParam.TokenName;
    tokenParams.propertySymbol = submitParam.TokenSymbol;
    tokenParams.amount = submitParam.TokenAmount;
    tokenParams.tokenTxType = submitParam.TokenTxType;

    let receiverPaymentAddrStr = new Array(1);
    receiverPaymentAddrStr[0] = submitParam.TokenReceivers.PaymentAddress;

    tokenParams.receivers = new Array(1);
    tokenParams.receivers[0] = new PaymentInfo(
      KeyWallet.base58CheckDeserialize(
        submitParam.TokenReceivers.PaymentAddress
      ).KeySet.PaymentAddress,
      new bn(submitParam.TokenReceivers.Amount)
    );

    let senderSkStr = this.key.base58CheckSerialize(constantsWallet.PriKeyType);
    let paymentAddressStr = this.key.base58CheckSerialize(constantsWallet.PaymentAddressType);

    try {
      console.log("Preparing input for normal tx ....")
      let inputForTx;
      try {
        console.time("Time for preparing input for custom token tx");
        inputForTx = await Wallet.RpcClient.prepareInputForTx(senderSkStr, paymentInfos, new bn(fee), this);
        console.timeEnd("Time for preparing input for custom token tx");
      } catch (e) {
        throw e;
      }
      await Wallet.updateProgressTx(30);

      let inputForPrivacyCustomTokenTx;
      try {
        console.log("Preparing input for privacy custom token tx ....")
        console.log("token param before preparing input: ", tokenParams);
        inputForPrivacyCustomTokenTx = await Wallet.RpcClient.prepareInputForTxCustomTokenPrivacy(senderSkStr, tokenParams, this);
      } catch (e) {
        throw e;
      }
      await Wallet.updateProgressTx(50);

      tokenParams.tokenInputs = inputForPrivacyCustomTokenTx.tokenInputs;

      // console.log("Prepare: vins: ", inputForPrivacyCustomTokenTx.tokenInputs);
      // console.log("Prepare: list custom token: ", inputForPrivacyCustomTokenTx.listCustomToken);

      let tx = new TxCustomTokenPrivacy(Wallet.RpcClient);
      try {
        console.log("Creating privacy custom token tx ....")
        await tx.init(this.key.KeySet.PrivateKey, paymentAddressStr, paymentInfos, inputForTx.inputCoins, inputForTx.inputCoinStrs, new bn(fee), tokenParams, inputForPrivacyCustomTokenTx.listCustomToken, null, false);
      } catch (e) {
        throw e;
      }
      await Wallet.updateProgressTx(80);

      let responseSendTX = await Wallet.RpcClient.sendRawTxCustomTokenPrivacy(tx);

      await Wallet.updateProgressTx(90);
      // saving history tx
      // check status of tx

      console.log("Saving privacy custom token tx ....")
      let status = constantsWallet.FailedTx;
      if (responseSendTX.txId) {
        tx.txId = responseSendTX.txId
        status = constantsWallet.SuccessTx;

        responseSendTX.type = tx.type;
        responseSendTX.fee = tx.fee;
        responseSendTX.lockTime = tx.lockTime;
        // responseSendTX.amount = tx.txTokenPrivacyData.amount;
        responseSendTX.txStatus = status;

        responseSendTX.propertyName = tx.txTokenPrivacyData.propertyName;
        responseSendTX.propertyID = tx.txTokenPrivacyData.propertyID;
        responseSendTX.propertySymbol = tx.txTokenPrivacyData.propertySymbol;

        // add to following token list if tx is init token
        if (tx.txTokenPrivacyData.type == constantsTx.CustomTokenInit) {
          const {txTokenPrivacyData} = tx
          this.addFollowingToken({
            ID: txTokenPrivacyData.propertyID,
            Image: this.getTokenImage(txTokenPrivacyData.propertyID),
            Name: txTokenPrivacyData.propertyName,
            Symbol: txTokenPrivacyData.propertySymbol,
            Amount: txTokenPrivacyData.amount,
            IsPrivacy: true,
            isInit: true
          });
          console.log("List following token after adding: ", this.followingTokens);
        }
      }

      // check is init or transfer token
      let isIn;
      let amount;
      if (tx.txTokenPrivacyData.type == constantsTx.CustomTokenInit) {
        isIn = true;
        amount = tx.txTokenPrivacyData.amount;
      } else {
        isIn = false;
        amount = tokenParams.amount;
      }


      this.savePrivacyCustomTokenTx(tx, receiverPaymentAddrStr, status, isIn, amount);
      console.log("history: ", this.trxHistory);
      console.log("response tx: ", responseSendTX);
      await Wallet.updateProgressTx(100);

      return responseSendTX;
    } catch (e) {
      throw e
    }
  };

  getTokenImage(tokenId) {
    return genImageFromStr(tokenId, 40);
  }

  // collect UTXOs have value that less than {amount} mili constant to one UTXO
  async defragment(amount, fee, isPrivacy) {
    console.log("defragmentUTXO ..........: ");
    await Wallet.updateProgressTx(10);
    amount = new bn(amount);
    fee = new bn(fee);

    let senderSkStr = this.key.base58CheckSerialize(constantsWallet.PriKeyType);
    let senderPaymentAddressStr = this.key.base58CheckSerialize(constantsWallet.PaymentAddressType);

    // totalAmount was paid for fee
    let defragmentUTXO, defragmentUTXOStr, totalAmount;
    console.time("getUTXOsToDefragment")
    try {
      let result = await Wallet.RpcClient.getUTXOsToDefragment(senderSkStr, fee, this, amount);

      console.log("getUTXOsToDefragment Done");
      defragmentUTXO = result.defragmentUTXO;
      defragmentUTXOStr = result.defragmentUTXOStr;
      totalAmount = result.totalAmount;
    } catch (e) {
      console.log(e);
      throw e;
    }
    console.timeEnd("getUTXOsToDefragment")

    console.log("defragmentUTXO len: ", defragmentUTXO.length);

    await Wallet.updateProgressTx(40);

    // create paymentInfos
    let paymentInfos = new Array(1);
    paymentInfos[0] = new PaymentInfo(
      this.key.KeySet.PaymentAddress,
      totalAmount
    );
    let receiverPaymentAddrStr = new Array(1);
    receiverPaymentAddrStr[0] = senderPaymentAddressStr

    // init tx
    let tx = new Tx(Wallet.RpcClient);
    try {
      console.time("Time for creating tx");
      await tx.init(this.key.KeySet.PrivateKey, senderPaymentAddressStr, paymentInfos,
        defragmentUTXO, defragmentUTXOStr, fee, isPrivacy, null, null);
      console.timeEnd("Time for creating tx");
    } catch (e) {
      console.timeEnd("Time for creating tx");
      console.log("ERR when creating tx: ", e);
      return {
        txId: null,
        err: new Error("ERR when creating tx: " + e.toString())
      }
    }

    await Wallet.updateProgressTx(70);

    // console.log("*************** CONSTANT TX: ", tx);
    let response = await Wallet.RpcClient.sendRawTx(tx);
    await Wallet.updateProgressTx(90)

    console.log("SENDING CONSTANT DONE!!!!");
    console.timeEnd("Time for create and send tx");

    // check status of tx
    let status = constantsWallet.FailedTx;
    if (response.txId) {
      tx.txId = response.txId
      status = constantsWallet.SuccessTx;

      response.type = tx.type;
      response.fee = tx.fee;
      response.lockTime = tx.lockTime;
      response.amount = amount;
      response.txStatus = status;
    }

    // console.log("Amount number when saving: ", amount.toNumber());
    // this.saveNormalTx(tx, amount.toNumber() / 100, receiverPaymentAddrStr, null, null, null, status, false);
    // console.log("history after saving: ", this.trxHistory);

    // console.timeEnd("Saving tx history: ");

    await Wallet.updateProgressTx(100)

    return response;
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
    this.walletTrx = []
  }

  init(passPhrase, numOfAccount, name, storage, shardID = null) {
    let mnemonicGen = new MnemonicGenerator();
    this.Name = name;
    this.Entropy = mnemonicGen.newEntropy(128);
    this.Mnemonic = mnemonicGen.newMnemonic(this.Entropy);
    console.log("Mnemonic", this.Mnemonic);
    this.Seed = mnemonicGen.newSeed(this.Mnemonic, passPhrase);
    console.log("Seed", this.Seed);
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

    if (shardID != null) {
      // only create account for specific Shard
      for (let i = 0; i < numOfAccount; i++) {
        let newIndex = 0;
        for (let j = this.MasterAccount.child.length - 1; j >= 0; j++) {
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
          let lastByte = childKey.KeySet.PaymentAddress.Pk[childKey.KeySet.PaymentAddress.Pk.length - 1]
          if (lastByte == shardID) {
            break
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
      for (let j = this.MasterAccount.child.length - 1; j >= 0; j++) {
        const temp = this.MasterAccount.child[j] || {};
        if (temp && !temp.isImport) {
          let childNumber = new bn(temp.key.ChildNumber)
          newIndex = childNumber.toNumber() + 1
          break;
        }
      }
      let childKey = null;
      while (true) {
        childKey = this.MasterAccount.key.newChildKey(newIndex);
        let lastByte = childKey.KeySet.PaymentAddress.Pk[childKey.KeySet.PaymentAddress.Pk.length - 1]
        if (lastByte == shardID) {
          break
        }
        newIndex += 1
      }
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
    } else {
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
  }

  create

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
      if (account.key.base58CheckSerialize(constantsWallet.PriKeyType) === privakeyStr) {
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

  setTrxHistory() {
    for (let i = 0; i < this.MasterAccount.child.length; i++) {
      let child = this.MasterAccount.child[i];
      this.walletTrx.push(child.trxHistory)
    }


    console.log("setTrxHistory setTrxHistory setTrxHistory");
    return this.Storage.setItem("Wallet Trx History", this.walletTrx)
  }

  async getHistoryByAccount(accName) {
    // let historicTrxList = await this.Storage.getItem("Wallet Trx History");

    let account = this.getAccountByName(accName);
    let nomalTxHistory = account.getNormalTrx();
    console.log("nomalTxHistory when getHistoryByAccount: ", nomalTxHistory);
    return nomalTxHistory;

    // console.log("historicTrxList when getHistoryByAccount: ", historicTrxList);
    // if (!historicTrxList) return [];
    // let index = 0;
    // for (let i = 0; i < this.MasterAccount.child.length; i++) {
    //   if (this.MasterAccount.child[i].name === accName) {
    //     index = i;
    //     break;
    //   }
    // }
    // return historicTrxList[index]
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

        obj.MasterAccount.loadDerivatorCached();
        obj.MasterAccount.loadInputCoinCached();

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

          obj.MasterAccount.child[i].loadDerivatorCached();
          obj.MasterAccount.child[i].loadInputCoinCached();
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
        "PublicKey": child.key.getPublicKeyByHex(),
        "PublicKeyCheckEncode": child.key.getPublicKeyCheckEncode(),
        "Index": index,
      }
    })
  }

  async updateStatusHistory() {
    for (let i = 0; i < this.MasterAccount.child.length; i++) {
      for (let j = 0; j < this.MasterAccount.child[i].trxHistory.NormalTrx.length; j++) {
        if (this.MasterAccount.child[i].trxHistory.NormalTrx[j].status == SuccessTx) {
          let response = await Wallet.RpcClient.getTransactionByHash(this.MasterAccount.child[i].trxHistory.NormalTrx[j].txID);
          if (response.err === null && response.res) {
            this.MasterAccount.child[i].trxHistory.NormalTrx[j].status = ConfirmedTx;
          }
        }
      }

      for (let j = 0; j < this.MasterAccount.child[i].trxHistory.CustomTokenTrx.length; j++) {
        if (this.MasterAccount.child[i].trxHistory.CustomTokenTrx[j].status == SuccessTx) {
          let response = await Wallet.RpcClient.getTransactionByHash(this.MasterAccount.child[i].trxHistory.CustomTokenTrx[j].txID);
          if (response.err === null && response.res) {
            this.MasterAccount.child[i].trxHistory.CustomTokenTrx[j].status = ConfirmedTx;
          }
        }
      }

      for (let j = 0; j < this.MasterAccount.child[i].trxHistory.PrivacyCustomTokenTrx.length; j++) {
        if (this.MasterAccount.child[i].trxHistory.PrivacyCustomTokenTrx[j].status == SuccessTx) {
          let response = await Wallet.RpcClient.getTransactionByHash(this.MasterAccount.child[i].trxHistory.PrivacyCustomTokenTrx[j].txID);
          if (response.err === null && response.res) {
            this.MasterAccount.child[i].trxHistory.PrivacyCustomTokenTrx[j].status = ConfirmedTx;
          }
        }
      }
    }
  }

  static RpcClient = new RpcClient();
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
  Wallet, AccountWallet, DefaultStorage, TrxHistoryInfo,
  RpcClient, CustomTokenParamTx, CustomTokenPrivacyParamTx, PaymentInfo, KeyWallet, TxTokenVin, TxTokenVout,
  FailedTx,
  SuccessTx,
  ConfirmedTx,
  genImageFromStr,
  AmountStakingBeacon,
  MetaStakingBeacon,
  AmountStakingShard,
  MetaStakingShard,
  checkEncode
}
