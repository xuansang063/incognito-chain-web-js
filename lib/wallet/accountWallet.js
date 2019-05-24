import bn from 'bn.js';
import { CustomTokenInit } from '../tx/constants';
import { KeyWallet } from "./hdwallet";
import { PaymentInfo } from '../key';
import { Tx } from "../tx/txprivacy";
import { TxCustomToken } from "../tx/txcustomtoken";
import { TxCustomTokenPrivacy } from "../tx/txcustomtokenprivacy";
import { CustomTokenPrivacyParamTx } from "../tx/txcustomkenprivacydata";
import {
  FailedTx,
  SuccessTx,
  MetaStakingBeacon,
  MetaStakingShard,
  PaymentAddressType,
  ReadonlyKeyType,
  PriKeyType
} from "./constants";
import { toConstant } from "./utils";
import { checkEncode, checkDecode } from "../base58";
import { P256 } from "privacy-js-lib/lib/ec";
import { InputCoin } from '../coin';
import { 
  prepareInputForTx, 
  prepareInputForCustomTokenTx, 
  prepareInputForTxCustomTokenPrivacy,
  getUnspentCoin,
  parseInputCoinFromEncodedObject,
  getUTXOsToDefragment
 } from "../tx/utils";
 import { ENCODE_VERSION } from "../constants";
 import { Wallet } from "./wallet";
 import { TxHistoryInfo } from "./history";

class AccountWallet {
    constructor() {
      this.name = "";
      this.key = new KeyWallet();
      this.child = [];
      this.isImport = false;
      this.followingTokens = [];
      this.txHistory = { NormalTx: [], CustomTokenTx: [], PrivacyCustomTokenTx: [] };
  
      // derivatorPointCached is used for saving derivator (encoded) with corresponding serial number in elliptic point that was calculated before
      this.derivatorPointCached = {}
      // derivatorPointCached is used for saving derivator (encoded) with corresponding encoded serial number in bytes array that was calculated before
      this.derivatorJsonCached = {}
  
      this.spentCoinCached = {}
  
      // inputCoinCached is used for saving derivator (encoded) with corresponding input coin in struct that was calculated before
      this.inputCoinCached = {}
      // inputCoinCached is used for saving derivator (encoded) with corresponding encoded input coin that was calculated before
      this.inputCoinJsonCached = {}
  
      // list of serial number of coins in tx in mempool
      this.spendingCoins = [];
      this.getBalance = this.getBalance.bind(this);
      this.mergeDerivatorCached = this.mergeDerivatorCached.bind(this);
      this.analyzeOutputCoinFromCached = this.analyzeOutputCoinFromCached.bind(this);
      this.loadInputCoinCached = this.loadInputCoinCached.bind(this);
      this.loadDerivatorCached = this.loadDerivatorCached.bind(this);
      this.removeObjectFromSpendingCoins = this.removeObjectFromSpendingCoins.bind(this);
      this.mergeInputCoinJsonCached = this.mergeInputCoinJsonCached.bind(this);
      this.analyzeSpentCoinFromCached = this.analyzeSpentCoinFromCached.bind(this);
      this.mergeSpentCoinCached = this.mergeSpentCoinCached.bind(this);

      this.createAndSendConstant = this.createAndSendConstant.bind(this);
      this.createAndSendCustomToken = this.createAndSendCustomToken.bind(this);
      this.createAndSendPrivacyCustomToken = this.createAndSendPrivacyCustomToken.bind(this);
      this.getCustomTokenBalance = this.getCustomTokenBalance.bind(this);
      this.getPrivacyCustomTokenBalance = this.getPrivacyCustomTokenBalance.bind(this);
      this.listFollowingTokens = this.listFollowingTokens.bind(this);
      this.addFollowingToken = this.addFollowingToken.bind(this);
      this.removeFollowingToken = this.removeFollowingToken.bind(this);
      this.getPrivacyCustomTokenTx = this.getPrivacyCustomTokenTx.bind(this);
      this.getCustomTokenTx = this.getCustomTokenTx.bind(this);
      this.getPrivacyCustomTokenTxByTokenID = this.getPrivacyCustomTokenTxByTokenID.bind(this);
      this.defragment = this.defragment.bind(this);
    };

    /**
     * @param {txID: string, spendingSNs: array} spendingCoinObj 
     */
    addSpendingCoins(spendingCoinObj){
      if (!this.spendingCoins) {
        this.spendingCoins = [];
      }

      this.spendingCoins.push(spendingCoinObj);
    }
  
    removeObjectFromSpendingCoins(txId) {
      for (let i = 0; i < this.spendingCoins.length; i++) {
        if (this.spendingCoins[i].txID === txId) {
          console.log("Remove spending list");
          this.spendingCoins.splice(i, 1);
          break;
        }
      }
    }
  
    clearCached(){
      this.derivatorPointCached = {};
      this.derivatorJsonCached = {};
      this.spentCoinCached = {};
      this.inputCoinCached = {};
      this.inputCoinJsonCached = {};
    }
  
    listFollowingTokens(){
      return this.followingTokens;
    };
  
    /**
     * @param {...{ID: string, Image: string, Name: string, Symbol: string, Amount: number, IsPrivacy: boolean, isInit: boolean}} tokenData - tokens to follow
     */
    addFollowingToken(...tokenData){
      this.followingTokens.unshift(...tokenData);
    };
  
    removeFollowingToken(tokenId) {
      const removedIndex = this.followingTokens.findIndex(token => token.ID === tokenId);
      this.followingTokens.splice(removedIndex, 1);
    }
  
    saveNormalTx(tx, amount, receivers, status, isIn, isPrivacy){
      let txHistory = new TxHistoryInfo();
      txHistory.setHistoryInfo(tx.txId, tx.type, amount, toConstant(tx.fee), receivers, tx.lockTime * 1000, isIn, isPrivacy);
      txHistory.updateStatus(status);
      this.txHistory.NormalTx.unshift(txHistory);
    };
  
    saveCustomTokenTx(tx, receivers, status, isIn, amount){
      let txHistory = new TxHistoryInfo();
      txHistory.setHistoryInfo(tx.txId, tx.type, amount, toConstant(tx.fee), receivers, tx.lockTime * 1000, isIn, false, 
        tx.txTokenData.propertyName, tx.txTokenData.propertyID, tx.txTokenData.propertySymbol
      );
      txHistory.updateStatus(status);
      this.txHistory.CustomTokenTx.unshift(txHistory);
    };
  
    savePrivacyCustomTokenTx(tx, receivers, status, isIn, amount) {
      let txHistory = new TxHistoryInfo();
      txHistory.setHistoryInfo(tx.txId, tx.type, amount, toConstant(tx.fee), receivers, tx.lockTime * 1000, isIn, true, 
        tx.txTokenPrivacyData.propertyName, tx.txTokenPrivacyData.propertyID, tx.txTokenPrivacyData.propertySymbol
      );
      txHistory.updateStatus(status);
      this.txHistory.PrivacyCustomTokenTx.unshift(txHistory);
    };
  
    getNormalTx() {
      return this.txHistory.NormalTx;
    };
  
    getPrivacyCustomTokenTx() {
      return this.txHistory.PrivacyCustomTokenTx;
    };
  
    getCustomTokenTx() {
      return this.txHistory.CustomTokenTx;
    };
  
    getPrivacyCustomTokenTxByTokenID(id){
      let queryResult = new Array();
      for (let i = 0; i < this.txHistory.PrivacyCustomTokenTx.length; i++) {
        if (this.txHistory.PrivacyCustomTokenTx[i].tokenID === id)
          queryResult.push(this.txHistory.PrivacyCustomTokenTx[i]);
      }
      return queryResult;
    }
  
    getCustomTokenTxByTokenID(id) {
      let queryResult = new Array();
      for (let i = 0; i < this.txHistory.CustomTokenTx.length; i++) {
        if (this.txHistory.CustomTokenTx[i].tokenID === id)
          queryResult.push(this.txHistory.CustomTokenTx[i]);
      }
      return queryResult;
    }
  
    // mergeDerivatorCached encode derivator cached in elliptic point to json
    mergeDerivatorCached () {
      this.derivatorJsonCached = this.derivatorJsonCached == undefined ? {} : this.derivatorJsonCached;
      this.derivatorPointCached = this.derivatorPointCached == undefined ? {} : this.derivatorPointCached;

      for (let k in this.derivatorPointCached) {
        if (k != undefined && this.derivatorJsonCached[k] == undefined) {
          this.derivatorJsonCached[k] = checkEncode(this.derivatorPointCached[k].compress(), ENCODE_VERSION);
        }
      }
    }
  
    async loadDerivatorCached () {
      const tasks = [];
      this.derivatorJsonCached = this.derivatorJsonCached == undefined ? {} : this.derivatorJsonCached;
      this.derivatorPointCached = this.derivatorPointCached == undefined ? {} : this.derivatorPointCached;
      for (let k in this.derivatorJsonCached) {
        if (k != undefined && this.derivatorPointCached[k] == undefined) {
          tasks.push(new Promise(resolve => {
            setTimeout(() => {
              this.derivatorPointCached[k] = P256.decompress(checkDecode(this.derivatorJsonCached[k]).bytesDecoded);
              resolve();
            }, 0);
          }));
        }
      }
  
      return Promise.all(tasks);
    }
  
    async mergeInputCoinJsonCached(allOutputCoinStrs, inputCoins, tokenID = 'constant') {
      // console.log(`${this.name} mergeInputCoinJsonCached allOutputCoinStrs`, allOutputCoinStrs);
      // console.log(`${this.name} mergeInputCoinJsonCached inputCoins`, inputCoins);
      // console.log(`${this.name} mergeInputCoinJsonCached tokenID`, tokenID);
      this.inputCoinCached = this.inputCoinCached == undefined ? {} : this.inputCoinCached;
      this.inputCoinJsonCached = this.inputCoinJsonCached == undefined ? {} : this.inputCoinJsonCached;
  
      for (let i = 0; i < allOutputCoinStrs.length; i++) {
        const sndStr = `${tokenID}_${allOutputCoinStrs[i].SNDerivator}`;
        const inputCoinTmp = inputCoins[i];
  
        if (this.inputCoinCached[sndStr] == undefined) {
          this.inputCoinCached[sndStr] = inputCoinTmp;
  
          const encodedCoin = {};
          encodedCoin.publicKey = checkEncode(inputCoinTmp.coinDetails.publicKey.compress(), ENCODE_VERSION);
          encodedCoin.coinCommitment = checkEncode(inputCoinTmp.coinDetails.coinCommitment.compress(), ENCODE_VERSION);
          encodedCoin.snderivator = inputCoinTmp.coinDetails.snderivator.toString();
          encodedCoin.randomness = inputCoinTmp.coinDetails.randomness.toString();
          encodedCoin.value = inputCoinTmp.coinDetails.value.toString();
          encodedCoin.info = checkEncode(inputCoinTmp.coinDetails.info, ENCODE_VERSION);
          encodedCoin.serialNumber = checkEncode(inputCoinTmp.coinDetails.serialNumber.compress(), ENCODE_VERSION);
          this.inputCoinJsonCached[sndStr] = encodedCoin;
        }
      }
      // console.log(`${this.name} mergeInputCoinJsonCached`, this.inputCoinCached);
    }
  
    async loadInputCoinCached () {
      this.inputCoinCached = this.inputCoinCached == undefined ? {} : this.inputCoinCached
      this.inputCoinJsonCached = this.inputCoinJsonCached == undefined ? {} : this.inputCoinJsonCached
  
      const tasks = [];
      for (let sndStr in this.inputCoinJsonCached) {
        if (sndStr != undefined && this.inputCoinCached[sndStr] == undefined) {
          tasks.push(new Promise(resolve => {
            setTimeout(() => {
              const jsonObject = this.inputCoinJsonCached[sndStr];
  
              const oObject = new InputCoin();
              oObject.coinDetails.publicKey = P256.decompress(checkDecode(jsonObject.publicKey).bytesDecoded);
              oObject.coinDetails.coinCommitment = P256.decompress(checkDecode(jsonObject.coinCommitment).bytesDecoded);
              oObject.coinDetails.snderivator = new bn(jsonObject.snderivator);
              oObject.coinDetails.randomness = new bn(jsonObject.randomness);
              oObject.coinDetails.value = new bn(jsonObject.value);
              oObject.coinDetails.info = checkDecode(jsonObject.info).bytesDecoded;
              oObject.coinDetails.serialNumber = P256.decompress(checkDecode(jsonObject.serialNumber).bytesDecoded);
  
              this.inputCoinCached[sndStr] = oObject
              resolve();
            }, 0);
          }))
        }
      }
      console.log(`${this.name} loadInputCoinCached`, this.inputCoinCached);
  
      return Promise.all(tasks);
    }
  
    // analyzeOutputCoinFromCached devides allOutputCoinStrs into list of cached output coins and list of uncached output coins
    analyzeOutputCoinFromCached(allOutputCoinStrs, tokenID = 'constant') {
      this.inputCoinCached = this.inputCoinCached === undefined ? {} : this.inputCoinCached
      // console.log(`${this.name} analyzeOutputCoinFromCached allOutputCoinStrs`, allOutputCoinStrs);
      // console.log(`${this.name} analyzeOutputCoinFromCached tokenID`, tokenID);
      let uncachedOutputCoinStrs = [];
      let cachedOutputCoinStrs = [];
      let cachedInputCoins = [];
  
      for (let i = 0; i < allOutputCoinStrs.length; i++) {
        const sndStr = `${tokenID}_${allOutputCoinStrs[i].SNDerivator}`;
  
        if (this.inputCoinCached[sndStr] !== undefined) {
          cachedOutputCoinStrs.push(allOutputCoinStrs[i]);
          cachedInputCoins.push(this.inputCoinCached[sndStr]);
        } else {
          uncachedOutputCoinStrs.push(allOutputCoinStrs[i]);
        }
      }
      // console.log(`${this.name} analyzeOutputCoinFromCached leftOutputCoinStrs`, leftOutputCoinStrs);
      // console.log(`${this.name} analyzeOutputCoinFromCached cachedOutputCoinStrs`, cachedOutputCoinStrs);
      // console.log(`${this.name} analyzeOutputCoinFromCached cachedInputCoins`, cachedInputCoins);
      return {
        uncachedOutputCoinStrs: uncachedOutputCoinStrs,
        cachedOutputCoinStrs: cachedOutputCoinStrs,
        cachedInputCoins: cachedInputCoins,
      }
    }
  
    async mergeSpentCoinCached (unspentCoinStrs, inputCoins, tokenID = 'constant') {
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
        let sndDecode = checkDecode(unspentCoinStrs[i].SNDerivator).bytesDecoded;
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
  
    // analyzeSpentCoinFromCached returns input coins which it not existed in list of cached spent input coins
    analyzeSpentCoinFromCached(inputCoins, allOutputCoinStrs, tokenID = 'constant') {
      // console.log(`${this.name} analyzeSpentCoinFromCached inputCoins`, inputCoins);
      // console.log(`${this.name} analyzeSpentCoinFromCached allOutputCoinStrs`, allOutputCoinStrs);
      // console.log(`${this.name} analyzeSpentCoinFromCached tokenID`, tokenID);
      this.spentCoinCached = this.spentCoinCached == undefined ? {} : this.spentCoinCached;
      let unspentInputCoinsFromCached = [];
      let unspentInputCoinsFromCachedStrs = [];
  
      for (let i = 0; i < inputCoins.length; i++) {
        const sndStr = `${tokenID}_${inputCoins[i].coinDetails.snderivator}`;
        if (this.spentCoinCached[sndStr] == undefined) {
          unspentInputCoinsFromCached.push(inputCoins[i]);
          unspentInputCoinsFromCachedStrs.push(allOutputCoinStrs[i]);
        }
      }
      // console.log(`${this.name} analyzeSpentCoinFromCached inputCoinsRet`, inputCoinsRet);
      // console.log(`${this.name} analyzeSpentCoinFromCached allOutputCoinStrsRet`, allOutputCoinStrsRet);
      return {
        unspentInputCoinsFromCached: unspentInputCoinsFromCached,
        unspentInputCoinsFromCachedStrs: unspentInputCoinsFromCachedStrs,
      };
    }
  
    async getBalance (){
      console.time("Get balance: ");
      let paymentAddrSerialize = this.key.base58CheckSerialize(PaymentAddressType);
      let readOnlyKeySerialize = this.key.base58CheckSerialize(ReadonlyKeyType);

      let response;
      try{
        response = await Wallet.RpcClient.getOutputCoin(paymentAddrSerialize, readOnlyKeySerialize);
      } catch(e){
        throw e;
      }
      
      let allOutputCoinStrs = response.outCoins;
      if (allOutputCoinStrs.length == 0) {
        return 0;
      }
  
      // parse input coin from encoded object
      const { uncachedOutputCoinStrs, cachedOutputCoinStrs, cachedInputCoins } = this.analyzeOutputCoinFromCached(allOutputCoinStrs);
      let inputCoins = cachedInputCoins;
      if (uncachedOutputCoinStrs.length > 0) {
        let uncachedInputCoins = parseInputCoinFromEncodedObject(uncachedOutputCoinStrs, this.key, this.derivatorPointCached);
        this.mergeDerivatorCached();
        this.mergeInputCoinJsonCached(uncachedOutputCoinStrs, uncachedInputCoins);
        inputCoins = inputCoins.concat(uncachedInputCoins);
        allOutputCoinStrs = cachedOutputCoinStrs.concat(uncachedOutputCoinStrs);
      }

      // analyze from cache
      let { unspentInputCoinsFromCached, unspentInputCoinsFromCachedStrs } = this.analyzeSpentCoinFromCached(inputCoins, allOutputCoinStrs);
      let { unspentCoins, unspentCoinStrs } = await getUnspentCoin(unspentInputCoinsFromCached, paymentAddrSerialize, unspentInputCoinsFromCachedStrs, null, Wallet.RpcClient);
  
      // update cache
      this.mergeSpentCoinCached(unspentCoinStrs, inputCoins);
  
      let accountBalance = 0;
      for (let i = 0; i < unspentCoinStrs.length; i++) {
        accountBalance += parseInt(unspentCoinStrs[i].Value)
      }
  
      // console.log(this.name , " inputCoinCached after getbalance : ", this.inputCoinCached);
      console.timeEnd("Get balance: ");
      console.log("Balance: ", accountBalance);
      return accountBalance
    }
  
    async getPrivacyCustomTokenBalance(privacyCustomTokenID){
      let paymentAddrSerialize = this.key.base58CheckSerialize(PaymentAddressType);
      let readOnlyKeySerialize = this.key.base58CheckSerialize(ReadonlyKeyType);

      let response;
      try{
        response = await Wallet.RpcClient.getOutputCoin(paymentAddrSerialize, readOnlyKeySerialize, privacyCustomTokenID);
      } catch(e){
        throw e;
      }
      
      let allOutputCoinStrs = response.outCoins;
      if (allOutputCoinStrs.length == 0) {
        return 0;
      }

      // parse input coin from string
      const { uncachedOutputCoinStrs, cachedOutputCoinStrs, cachedInputCoins } = this.analyzeOutputCoinFromCached(allOutputCoinStrs, privacyCustomTokenID);
      let inputCoins = cachedInputCoins;
      if (uncachedOutputCoinStrs.length > 0) {
        let uncachedInputCoins = parseInputCoinFromEncodedObject(uncachedOutputCoinStrs, this.key, this.derivatorPointCached, privacyCustomTokenID);
        this.mergeDerivatorCached();
        this.mergeInputCoinJsonCached(uncachedOutputCoinStrs, uncachedInputCoins, privacyCustomTokenID);
        inputCoins = inputCoins.concat(uncachedInputCoins);
        allOutputCoinStrs = cachedOutputCoinStrs.concat(uncachedOutputCoinStrs);
      }

      let { unspentInputCoinsFromCached, unspentInputCoinsFromCachedStrs } = this.analyzeSpentCoinFromCached(inputCoins, allOutputCoinStrs, privacyCustomTokenID);
      let unspentCoinList = await getUnspentCoin(unspentInputCoinsFromCached, paymentAddrSerialize, unspentInputCoinsFromCachedStrs, privacyCustomTokenID, Wallet.RpcClient);
      this.mergeSpentCoinCached(unspentCoinList.unspentCoinStrs, inputCoins, privacyCustomTokenID);
      var unspentCoinString = unspentCoinList.unspentCoinStrs;
      let accountBalance = 0;
      for (let i = 0; i < unspentCoinString.length; i++) {
        accountBalance += parseInt(unspentCoinString[i].Value)
      }
      return accountBalance
    }
  
    async getCustomTokenBalance (customTokenIDStr) {
      let res;
      try{
        res = await Wallet.RpcClient.getUnspentCustomToken(this.key.base58CheckSerialize(PaymentAddressType),
        customTokenIDStr);
      } catch(e){
        throw e;
      }
      
      let vins = res.listUnspentCustomToken;
      let accountBalance = 0;
      for (let i = 0; i < vins.length; i++) {
        accountBalance += parseInt(vins[i].Value)
      }
      // console.log('\t accountBalance', accountBalance)
      return accountBalance
    };
  
    async createAndSendConstant(param, fee, isPrivacy){
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

      let amount = new bn(0);
        for (let i = 0; i < paymentInfos.length; i++) {
          amount = amount.add(paymentInfos[i].Amount);
        }
  
      let senderSkStr = this.key.base58CheckSerialize(PriKeyType);
      let paymentAddressStr = this.key.base58CheckSerialize(PaymentAddressType);
  
      console.time("Time for create and send tx");
      try {
        // prepare input for tx
        console.time("Time for preparing input for constant tx");
        // console.log("Wallet: ", Wallet.RpcClient);
        let inputForTx;
        try {
          inputForTx = await prepareInputForTx(senderSkStr, paymentInfos, new bn(fee), this, Wallet.RpcClient);
          console.log("input after prepare: ", inputForTx);
        } catch (e) {
          throw e;
        }
        console.timeEnd("Time for preparing input for constant tx");
  
        await Wallet.updateProgressTx(30)
  
        // init tx
        let tx = new Tx(Wallet.RpcClient);
        try {
          console.time("Time for creating tx");
          await tx.init(this.key.KeySet.PrivateKey, paymentAddressStr, paymentInfos,
            inputForTx.inputCoins, inputForTx.inputCoinStrs, new bn(fee), isPrivacy, null, null);
          console.timeEnd("Time for creating tx");
        } catch (e) {
          console.log("ERR when creating tx: ", e);
          throw e;
        }
  
        await Wallet.updateProgressTx(60)
  
        // console.log("*************** CONSTANT TX: ", tx);
        let response;
        try{
          response = await Wallet.RpcClient.sendRawTx(tx);
        } catch(e){
          throw e;
        }
        await Wallet.updateProgressTx(90)
  
        console.log("SENDING CONSTANT DONE!!!!");
        console.timeEnd("Time for create and send tx");
  
        // saving history tx
        console.log("Saving tx history.....");
        console.time("Saving tx history: ");
  
        // check status of tx and add coins to spending coins
        let status = FailedTx;
        if (response.txId) {
          tx.txId = response.txId
          status = SuccessTx;
  
          response.type = tx.type;
          response.fee = tx.fee;
          response.lockTime = tx.lockTime;
          response.amount = amount;
          response.txStatus = status;
  
          let spendingSNs = [];
          for (let i = 0; i < inputForTx.inputCoins.length; i++) {
            spendingSNs.push(inputForTx.inputCoins[i].coinDetails.serialNumber.compress())
          }
          this.addSpendingCoins({ txID: response.txId, spendingSNs: spendingSNs});
        }
  
        console.log("Amount number when saving: ", amount.toNumber());
        this.saveNormalTx(tx, amount.toNumber(), receiverPaymentAddrStr, status, false, isPrivacy);
        console.log("history after saving: ", this.txHistory);
  
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
  
  
    // staking tx always send constant to burning address
    // param.type: 0 : shard, 1: beacon
    // param.burningAddress: burningAddress
    // fee in Number
    async createAndSendStakingTx (param, fee) {
      await Wallet.updateProgressTx(10)

      // get amount staking
      let amount;
      try {
        let response = await Wallet.RpcClient.getStakingAmount(param.type);
        // console.log("response getStakingAmount: ", response);
        amount = response.res;
      } catch (e) {
        throw e;
      }
  
      let meta;
      if (param.type == ShardStakingType) {
        meta = { Type: MetaStakingShard };
      } else {
        meta = { Type: MetaStakingBeacon };
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
      let senderSkStr = this.key.base58CheckSerialize(PriKeyType);
      let paymentAddressStr = this.key.base58CheckSerialize(PaymentAddressType);
  
      console.time("Time for create and send tx");
      try {
        // prepare input for tx
        console.time("Time for preparing input for staking tx");
        let inputForTx;
        try {
          inputForTx = await prepareInputForTx(senderSkStr, paymentInfos, new bn(fee), this, Wallet.RpcClient);
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
          throw e;
        }
        await Wallet.updateProgressTx(60);

        let response;
        try{
          response = await Wallet.RpcClient.sendRawTx(tx);
        } catch(e){
          throw e;
        }
  
        await Wallet.updateProgressTx(90)
  
        console.log("SENDING STAKING TX DONE!!!!");
        console.timeEnd("Time for create and send tx");
  
        // saving history tx
        console.log("Saving tx history.....");
        console.time("Saving tx history: ");
  
        // check status of tx
        let status = FailedTx;
        if (response.txId) {
          tx.txId = response.txId
          status = SuccessTx;
  
          response.type = tx.type;
          response.fee = tx.fee;
          response.lockTime = tx.lockTime;
          response.amount = amountToSpent;
          response.txStatus = status;
  
          let spendingSNs = [];
          for (let i = 0; i < inputForTx.inputCoins.length; i++) {
            spendingSNs.push(inputForTx.inputCoins[i].coinDetails.serialNumber.compress())
          }
  
          // console.log("spendingSNs: ", spendingSNs);
          let object = {};
          object.txID = response.txId;
          object.spendingSNs = spendingSNs;
  
          this.addSpendingCoins({ txID: response.txId, spendingSNs: spendingSNs });
        }
  
        // console.log("Amount number when saving: ", amountToSpent.toNumber());
        // console.log("Amount number when saving: ", amountToSpent.toNumber() / 100);
        this.saveNormalTx(tx, amountToSpent.toNumber() / 100, receiverPaymentAddrStr, status, false, false);
        console.log("history after saving: ", this.txHistory);
  
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
  
    async createAndSendCustomToken(paymentInfos = null, tokenParams, receiverPaymentAddrStr, fee){
      await Wallet.updateProgressTx(10);
      let senderSkStr = this.key.base58CheckSerialize(PriKeyType);
      let paymentAddressStr = this.key.base58CheckSerialize(PaymentAddressType);
  
      try {
        console.log("Preparing input for nomal tx ....")
        let inputForTx
        try {
          console.time("Time for preparing input for custom token tx");
          inputForTx = await prepareInputForTx(senderSkStr, paymentInfos, new bn(fee), this, Wallet.RpcClient);
          await Wallet.updateProgressTx(30);
          console.log("Input for fee: ", inputForTx);
          console.timeEnd("Time for preparing input for custom token tx");
        } catch (e) {
          throw e;
        }
  
        let inputForCustomTokenTx;
        try {
          console.log("Preparing input for custom token tx ....")
          inputForCustomTokenTx = await prepareInputForCustomTokenTx(senderSkStr, tokenParams, Wallet.RpcClient);
        } catch (e) {
          throw e;
        }
        await Wallet.updateProgressTx(50);
  
        tokenParams.vins = inputForCustomTokenTx.tokenVins;
        tokenParams.vinsAmount = inputForCustomTokenTx.vinsAmount;
  
        // console.log("Prepare: token vins: ", inputForCustomTokenTx.tokenVins);
        // console.log("Prepare: list custom token: ", inputForCustomTokenTx.listCustomToken);
  
        let tx = new TxCustomToken(Wallet.RpcClient);
  
        try {
          await tx.init(this.key.KeySet.PrivateKey, paymentAddressStr, paymentInfos, inputForTx.inputCoins, inputForTx.inputCoinStrs, new bn(fee), tokenParams, inputForCustomTokenTx.listCustomToken, null, false);
        } catch (e) {
          console.log("ERR when creating custom token tx: ", e)
          throw e;
        }
        await Wallet.updateProgressTx(80);
  
        // console.log("Token ID:  ", convertHashToStr(tx.txTokenData.propertyID));
  
        console.log("Sending custom token tx ....")

        let response;
        try {
          response = await Wallet.RpcClient.sendRawTxCustomToken(tx);
        } catch(e){
          throw e;
        }

        console.log("SENDING CUSTOM TOKEN DONE!!!!")
        await Wallet.updateProgressTx(90);
  
        // saving history tx
        // check status of tx
  
  
        console.log("Saving custom token tx ....")
        let status = FailedTx;
        if (response.txId) {
          tx.txId = response.txId
          status = SuccessTx;
  
          response.type = tx.type;
          response.fee = tx.fee;
          response.lockTime = tx.lockTime;
          response.amount = tx.txTokenData.amount;
          response.txStatus = status;
  
          response.propertyName = tx.txTokenData.propertyName;
          response.propertyID = tx.txTokenData.propertyID;
          response.propertySymbol = tx.txTokenData.propertySymbol;
  
          // add to following token list if tx is init token
          if (tx.txTokenData.type == CustomTokenInit) {
            let identicon = await Wallet.RpcClient.hashToIdenticon([tokenId]);
            const { txTokenData } = tx
            const followingToken = {
              ID: txTokenData.propertyID,
              Image: identicon.images[0],
              Name: txTokenData.propertyName,
              Symbol: txTokenData.propertySymbol,
              Amount: txTokenData.amount,
              IsPrivacy: false,
              isInit: true
            };
            this.addFollowingToken(followingToken);
            // console.log("List following token after adding: ", this.followingTokens);
          }
  
          let spendingSNs = [];
          for (let i = 0; i < inputForTx.inputCoins.length; i++) {
            spendingSNs.push(inputForTx.inputCoins[i].coinDetails.serialNumber.compress())
          }
          this.addSpendingCoins({ txID: response.txId, spendingSNs: spendingSNs});
        }

        // check is init or transfer token
        let isIn;
        let amount = 0;
        if (tx.txTokenData.type == CustomTokenInit) {
          isIn = true;
          amount = tx.txTokenData.amount;
        } else {
          isIn = false;
  
          for (let i = 0; i < tokenParams.receivers.length; i++) {
            amount += tokenParams.receivers[i].value;
          }
        }
  
        this.saveCustomTokenTx(tx, receiverPaymentAddrStr, status, isIn, amount);
        await Wallet.updateProgressTx(100);
  
        return response;
      } catch (e) {
        throw e
      }
    };
  
    async createAndSendPrivacyCustomToken (paymentInfos = null, submitParam, fee) {
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
  
      let senderSkStr = this.key.base58CheckSerialize(PriKeyType);
      let paymentAddressStr = this.key.base58CheckSerialize(PaymentAddressType);
  
      try {
        console.log("Preparing input for normal tx ....")
        let inputForTx;
        try {
          console.time("Time for preparing input for custom token tx");
          inputForTx = await prepareInputForTx(senderSkStr, paymentInfos, new bn(fee), this, Wallet.RpcClient);
          console.timeEnd("Time for preparing input for custom token tx");
        } catch (e) {
          throw e;
        }
        await Wallet.updateProgressTx(30);
  
        let inputForPrivacyCustomTokenTx;
        try {
          console.log("Preparing input for privacy custom token tx ....")
          inputForPrivacyCustomTokenTx = await prepareInputForTxCustomTokenPrivacy(senderSkStr, tokenParams, this, Wallet.RpcClient);
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
          await tx.init(this.key.KeySet.PrivateKey, paymentAddressStr, paymentInfos, inputForTx.inputCoins, inputForTx.inputCoinStrs, new bn(fee), tokenParams, inputForPrivacyCustomTokenTx.listPrivacyToken, null, false);
        } catch (e) {
          throw e;
        }
        await Wallet.updateProgressTx(80);
        
        let response;
        try{
          response = await Wallet.RpcClient.sendRawTxCustomTokenPrivacy(tx);
        } catch(e){
          throw e;
        }
  
        
  
        await Wallet.updateProgressTx(90);
        // saving history tx
        // check status of tx
  
        console.log("Saving privacy custom token tx ....")
        let status = FailedTx;
        if (response.txId) {
          tx.txId = response.txId
          status = SuccessTx;
  
          response.type = tx.type;
          response.fee = tx.fee;
          response.lockTime = tx.lockTime;
          response.txStatus = status;
  
          response.propertyName = tx.txTokenPrivacyData.propertyName;
          response.propertyID = tx.txTokenPrivacyData.propertyID;
          response.propertySymbol = tx.txTokenPrivacyData.propertySymbol;
  
          // add to following token list if tx is init token
          if (tx.txTokenPrivacyData.type == CustomTokenInit) {
            let identicon = await Wallet.RpcClient.hashToIdenticon([tokenId]);
            const { txTokenPrivacyData } = tx
            this.addFollowingToken({
              ID: txTokenPrivacyData.propertyID,
              Image: identicon.images[0],
              Name: txTokenPrivacyData.propertyName,
              Symbol: txTokenPrivacyData.propertySymbol,
              Amount: txTokenPrivacyData.amount,
              IsPrivacy: true,
              isInit: true
            });
            console.log("List following token after adding: ", this.followingTokens);
          }
  
          let spendingSNs = [];
          for (let i = 0; i < inputForTx.inputCoins.length; i++) {
            spendingSNs.push(inputForTx.inputCoins[i].coinDetails.serialNumber.compress())
          }
  
          // console.log("spendingSNs: ", spendingSNs);
          let object = {};
          object.txID = response.txId;
          object.spendingSNs = spendingSNs;
  
          this.addSpendingCoins(object);
        }
  
        // check is init or transfer token
        let isIn;
        let amount;
        if (tx.txTokenPrivacyData.type == CustomTokenInit) {
          isIn = true;
          amount = tx.txTokenPrivacyData.amount;
        } else {
          isIn = false;
          amount = tokenParams.amount;
        }
  
        this.savePrivacyCustomTokenTx(tx, receiverPaymentAddrStr, status, isIn, amount);
        await Wallet.updateProgressTx(100);
        return response;
      } catch (e) {
        throw e
      }
    };
  
    // collect UTXOs have value that less than {amount} mili constant to one UTXO
    async defragment(amount, fee, isPrivacy){
      await Wallet.updateProgressTx(10);
      amount = new bn(amount);
      fee = new bn(fee);
  
      let senderSkStr = this.key.base58CheckSerialize(PriKeyType);
      let senderPaymentAddressStr = this.key.base58CheckSerialize(PaymentAddressType);
  
      // totalAmount was paid for fee
      let defragmentUTXO, defragmentUTXOStr, totalAmount;
      console.time("getUTXOsToDefragment")
      try {
        let result = await getUTXOsToDefragment(senderSkStr, fee, this, amount, Wallet.RpcClient);
        console.log("getUTXOsToDefragment Done");
        defragmentUTXO = result.defragmentUTXO;
        defragmentUTXOStr = result.defragmentUTXOStr;
        totalAmount = result.totalAmount;
      } catch (e) {
        console.log(e);
        throw e;
      }
      console.timeEnd("getUTXOsToDefragment");
      console.log("defragmentUTXO len: ", defragmentUTXO.length);
      console.log("defragmentUTXO len: ", defragmentUTXO);
  
      await Wallet.updateProgressTx(40);
  
      // create paymentInfos
      let paymentInfos = new Array(1);
      paymentInfos[0] = new PaymentInfo(
        this.key.KeySet.PaymentAddress,
        totalAmount
      );
      let receiverPaymentAddrStr = new Array(1);
      receiverPaymentAddrStr[0] = senderPaymentAddressStr;
  
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
        throw e;
      }
  
      await Wallet.updateProgressTx(70);

      let response;
      try {
        response = await Wallet.RpcClient.sendRawTx(tx);
      } catch(e){
        throw e;
      }

      await Wallet.updateProgressTx(90)
  
      console.log("SENDING CONSTANT DONE!!!!");
      console.timeEnd("Time for create and send tx");
  
      // check status of tx
      let status = FailedTx;
      if (response.txId) {
        tx.txId = response.txId
        status = SuccessTx;
  
        response.type = tx.type;
        response.fee = tx.fee;
        response.lockTime = tx.lockTime;
        response.amount = amount;
        response.txStatus = status;
  
        let spendingSNs = [];
        for (let i = 0; i < defragmentUTXO.length; i++) {
          spendingSNs.push(defragmentUTXO[i].coinDetails.serialNumber.compress())
        }
        this.addSpendingCoins({ txID: response.txId, spendingSNs: spendingSNs});
      }
  
      // console.log("Amount number when saving: ", amount.toNumber());
      // this.saveNormalTx(tx, amount.toNumber() / 100, receiverPaymentAddrStr, null, null, null, status, false);
      // console.log("history after saving: ", this.txHistory);
  
      // console.timeEnd("Saving tx history: ");
  
      await Wallet.updateProgressTx(100)
  
      return response;
    }
}

export { AccountWallet };


