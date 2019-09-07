import bn from 'bn.js';
import { CustomTokenInit, CustomTokenTransfer } from '../tx/constants';
import { KeyWallet } from "./hdwallet";
import { PaymentInfo } from '../key';
import { Tx } from "../tx/txprivacy";
import { TxCustomToken } from "../tx/txcustomtoken";
import { TxCustomTokenPrivacy } from "../tx/txprivacytoken";
import { CustomTokenPrivacyParamTx } from "../tx/txprivacytokendata";
import {
  FailedTx,
  SuccessTx,
  MetaStakingBeacon,
  MetaStakingShard,
  PaymentAddressType,
  ReadonlyKeyType,
  PriKeyType,
  PercentFeeToCancelTx,
  NoStakeStatus,
  CandidatorStatus,
  ValidatorStatus,
} from "./constants";
import { toPRV } from "./utils";
import { checkEncode, checkDecode } from "../base58";
import { P256 } from "privacy-js-lib/lib/ec";
import { InputCoin } from '../coin';
import {
  prepareInputForTx,
  prepareInputForCustomTokenTx,
  prepareInputForTxCustomTokenPrivacy,
  getUnspentCoin,
  parseInputCoinFromEncodedObject,
  getUTXOsToDefragment,
  parseInputCoinToEncodedObject
} from "../tx/utils";
import { ENCODE_VERSION } from "../constants";
import { ShardStakingType, PrivacyUnit, BurnAddress, BurningRequestMeta, WithDrawRewardRequestMeta, PRVID } from './constants';
import { Wallet, getShardIDFromLastByte } from "./wallet";
import { TxHistoryInfo } from "./history";
import CryptoJS from "crypto-js";
import JSON from "circular-json";
import { newHashFromStr, convertHashToStr } from "../common";
import { generateCommitteeKeyFromHashPrivateKey } from "../committeekey";
import { hashSha3BytesToBytes } from "privacy-js-lib/lib/privacy_utils"
import { CustomError, ErrorObject } from '../errorhandler';
import { PedCom } from 'privacy-js-lib/lib/pedersen';
import {SK,
  VALUE,
  SND,
  SHARD_ID,
  RAND,} from "privacy-js-lib/lib/constants";


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

    // spentCoinCached is used for saving derivator 
    this.spentCoinCached = {}

    // inputCoinCached is used for saving derivator (encoded) with corresponding input coin in struct that was calculated before
    this.inputCoinCached = {}
    // inputCoinCached is used for saving derivator (encoded) with corresponding encoded input coin that was calculated before
    this.inputCoinJsonCached = {}

    // list of serial number of coins in tx in mempool
    this.spendingCoins = [];
  };

  /**
   * @param {txID: string, spendingSNs: array} spendingCoinObj 
   */
  addSpendingCoins(spendingCoinObj) {
    if (!this.spendingCoins) {
      this.spendingCoins = [];
    }

    this.spendingCoins.push(spendingCoinObj);
  }

  // removeObjectFromSpendingCoins removes spending coins in txId from list of spending coins
  removeObjectFromSpendingCoins(txId) {
    for (let i = 0; i < this.spendingCoins.length; i++) {
      if (this.spendingCoins[i].txID === txId) {
        this.spendingCoins.splice(i, 1);
        break;
      }
    }
  }

  // clearCached clears all caches 
  clearCached() {
    this.derivatorPointCached = {};
    this.derivatorJsonCached = {};
    this.spentCoinCached = {};
    this.inputCoinCached = {};
    this.inputCoinJsonCached = {};
  }

  // saveAccountCached saves derivatorJsonCached, inputCoinJsonCached and spentCoinCached for account
  saveAccountCached(password, storage) {
    if (password == "") {
      throw new Error("Password is required");
    }

    let cacheObject = {
      derivatorJsonCached: this.derivatorJsonCached,
      inputCoinJsonCached: this.inputCoinJsonCached,
      spentCoinCached: this.spentCoinCached
    };

    let data = JSON.stringify(cacheObject);

    // encrypt data using AES scheme
    let cipherText = CryptoJS.AES.encrypt(data, password)

    // storage 
    if (storage != null) {
      return storage.setItem(`${this.name}-cached`, cipherText.toString());
    }
  }

  // loadAccountCached loads cache that includes derivatorJsonCached, inputCoinJsonCached and spentCoinCached for account
  async loadAccountCached(password, storage) {
    if (storage != null) {
      let cipherText = await storage.getItem(`${this.name}-cached`);
      console.log("Ciphertext: ", cipherText);
      if (!cipherText) return false;

      let data = CryptoJS.AES.decrypt(cipherText, password);
      let jsonStr = data.toString(CryptoJS.enc.Utf8);
      console.log("jsonStr: ", jsonStr);

      try {
        let cacheObject = JSON.parse(jsonStr);
        this.derivatorJsonCached = cacheObject.derivatorJsonCached;
        this.inputCoinJsonCached = cacheObject.inputCoinJsonCached;
        this.spentCoinCached = cacheObject.spentCoinCached;

        console.log("this.derivatorJsonCached: ", this.derivatorJsonCached);
        console.log("this.inputCoinJsonCached: ", this.inputCoinJsonCached);
        console.log("this.spentCoinCached: ", this.spentCoinCached);

        await this.loadDerivatorCached();
        await this.loadInputCoinCached();
      } catch (e) {
        throw e;
      }
    }
  }

  // mergeDerivatorCached encode derivator cached in elliptic point to json
  mergeDerivatorCached() {
    this.derivatorJsonCached = this.derivatorJsonCached == undefined ? {} : this.derivatorJsonCached;
    this.derivatorPointCached = this.derivatorPointCached == undefined ? {} : this.derivatorPointCached;

    for (let k in this.derivatorPointCached) {
      if (k != undefined && this.derivatorJsonCached[k] == undefined) {
        this.derivatorJsonCached[k] = checkEncode(this.derivatorPointCached[k].compress(), ENCODE_VERSION);
      }
    }
  }

  // loadDerivatorCached calculates derivatorPointCached from derivatorJsonCached
  async loadDerivatorCached() {
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

  // mergeInputCoinJsonCached receives list of input coins and check whether inputCoinCached contains input coins or not
  // It helps us don't need re-calculate serial number for input coins which is derived serial number before
  async mergeInputCoinJsonCached(allOutputCoinStrs, inputCoins, tokenID = 'constant') {
    this.inputCoinCached = this.inputCoinCached == undefined ? {} : this.inputCoinCached;
    this.inputCoinJsonCached = this.inputCoinJsonCached == undefined ? {} : this.inputCoinJsonCached;

    for (let i = 0; i < allOutputCoinStrs.length; i++) {
      const sndStr = `${tokenID}_${allOutputCoinStrs[i].SNDerivator}`;
      const inputCoinTmp = inputCoins[i];

      if (this.inputCoinCached[sndStr] == undefined) {
        this.inputCoinCached[sndStr] = inputCoinTmp;

        const encodedCoin = {
          PublicKey: checkEncode(inputCoinTmp.coinDetails.publicKey.compress(), ENCODE_VERSION),
          CoinCommitment: checkEncode(inputCoinTmp.coinDetails.coinCommitment.compress(), ENCODE_VERSION),
          SNDerivator: inputCoinTmp.coinDetails.snderivator.toString(),
          Value: inputCoinTmp.coinDetails.value.toString(),
          Info: checkEncode(inputCoinTmp.coinDetails.info, ENCODE_VERSION),
          SerialNumber: checkEncode(inputCoinTmp.coinDetails.serialNumber.compress(), ENCODE_VERSION)
        };

        this.inputCoinJsonCached[sndStr] = encodedCoin;
      }
    }
  }

  // loadInputCoinCached calculates inputCoinCached from inputCoinJsonCached
  async loadInputCoinCached() {
    this.inputCoinCached = this.inputCoinCached == undefined ? {} : this.inputCoinCached
    this.inputCoinJsonCached = this.inputCoinJsonCached == undefined ? {} : this.inputCoinJsonCached

    const tasks = [];
    for (let sndStr in this.inputCoinJsonCached) {
      if (sndStr != undefined && this.inputCoinCached[sndStr] == undefined) {
        tasks.push(new Promise(resolve => {
          setTimeout(() => {
            const jsonObject = this.inputCoinJsonCached[sndStr];

            const oObject = new InputCoin();
            oObject.coinDetails.publicKey = P256.decompress(checkDecode(jsonObject.PublicKey).bytesDecoded);
            oObject.coinDetails.coinCommitment = P256.decompress(checkDecode(jsonObject.CoinCommitment).bytesDecoded);
            oObject.coinDetails.snderivator = new bn(jsonObject.SNDerivator);
            oObject.coinDetails.randomness = new bn(jsonObject.Randomness);
            oObject.coinDetails.value = new bn(jsonObject.Value);
            oObject.coinDetails.info = checkDecode(jsonObject.Info).bytesDecoded;
            oObject.coinDetails.serialNumber = P256.decompress(checkDecode(jsonObject.SerialNumber).bytesDecoded);

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

  // mergeSpentCoinCached caches spent input coins to spentCoinCached
  async mergeSpentCoinCached(unspentCoinStrs, inputCoins, tokenID = 'constant') {
    this.spentCoinCached = this.spentCoinCached == undefined ? {} : this.spentCoinCached
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
  }

  // analyzeSpentCoinFromCached returns input coins which it not existed in list of cached spent input coins
  analyzeSpentCoinFromCached(inputCoins, allOutputCoinStrs, tokenID = 'constant') {
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

    return {
      unspentInputCoinsFromCached: unspentInputCoinsFromCached,
      unspentInputCoinsFromCachedStrs: unspentInputCoinsFromCachedStrs,
    };
  }

  // listFollowingTokens returns list of following tokens
  listFollowingTokens() {
    return this.followingTokens;
  };

  /**
   * @param {...{ID: string, Image: string, Name: string, Symbol: string, Amount: number, IsPrivacy: boolean, isInit: boolean, metaData: object}} tokenData - tokens to follow
   */
  addFollowingToken(...tokenData) {
    if (tokenData.constructor === Array) {
      const addedTokenIds = this.followingTokens.map(t => t.ID);
      const tokenDataSet = {};
      tokenData.forEach(t => {
        if (!addedTokenIds.includes(t.ID)) {
          tokenDataSet[t.ID] = t;
        }
      });

      const tokens = Object.values(tokenDataSet);
      this.followingTokens.unshift(...tokens);
    }
  };

  // removeFollowingToken removes token which has tokenId from list of following tokens
  removeFollowingToken(tokenId) {
    const removedIndex = this.followingTokens.findIndex(token => token.ID === tokenId);
    this.followingTokens.splice(removedIndex, 1);
  }

  saveNormalTx(tx, amount, receivers, status, isIn, isPrivacy, listUTXOForPRV, hashOriginalTx = "") {
    let txHistory = new TxHistoryInfo();

    let historyObj = {
      amount: amount,
      fee: toPRV(tx.fee),
      feePToken: 0,
      txID: tx.txId,
      type: tx.type,
      receivers: receivers,
      tokenName: "",
      tokenID: "",
      tokenSymbol: "",
      isIn: isIn,
      time: tx.lockTime * 1000,
      status: status,
      isPrivacy: isPrivacy,
      listUTXOForPRV: listUTXOForPRV,
      listUTXOForPToken: [],
      hashOriginalTx: hashOriginalTx,
    }

    txHistory.setHistoryInfo(historyObj);
    this.txHistory.NormalTx.unshift(txHistory);
  };

  saveCustomTokenTx(tx, amount, receivers, status, isIn) {
    let txHistory = new TxHistoryInfo();

    let historyObj = {
      amount: amount,
      fee: toPRV(tx.fee),
      feePToken: 0,
      txID: tx.txId,
      type: tx.type,
      receivers: receivers,
      tokenName: tx.txTokenData.propertyName,
      tokenID: tx.txTokenData.propertyID,
      tokenSymbol: tx.txTokenData.propertySymbol,
      isIn: isIn,
      time: tx.lockTime * 1000,
      status: status,
      isPrivacy: isPrivacy,
      listUTXOForPRV: [],
      listUTXOForPToken: [],
      hashOriginalTx: hashOriginalTx,
    }

    txHistory.setHistoryInfo(historyObj);
    this.txHistory.CustomTokenTx.unshift(txHistory);
  };

  savePrivacyCustomTokenTx(tx, receivers, status, isIn, amount, listUTXOForPRV, listUTXOForPToken, hashOriginalTx = "") {
    let txHistory = new TxHistoryInfo();

    let historyObj = {
      amount: amount,
      fee: toPRV(tx.fee),
      feePToken: tx.txTokenPrivacyData.txNormal.fee,
      txID: tx.txId,
      type: tx.type,
      receivers: receivers,
      tokenName: tx.txTokenPrivacyData.propertyName,
      tokenID: tx.txTokenPrivacyData.propertyID,
      tokenSymbol: tx.txTokenPrivacyData.propertySymbol,
      isIn: isIn,
      time: tx.lockTime * 1000,
      status: status,
      isPrivacy: true,
      listUTXOForPRV: listUTXOForPRV,
      listUTXOForPToken: listUTXOForPToken,
      hashOriginalTx: hashOriginalTx,
    }
    txHistory.setHistoryInfo(historyObj);
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

  getTxHistoryByTxID(txID) {
    return this.txHistory.NormalTx.find(item => item.txID === txID) ||
      this.txHistory.PrivacyCustomTokenTx.find(item => item.txID === txID) ||
      this.txHistory.CustomTokenTx.find(item => item.txID === txID)
  }

  getPrivacyCustomTokenTxByTokenID(id) {
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

  // getBalance returns PRV balance 
  async getBalance() {
    console.time("Get balance: ");
    let paymentAddrSerialize = this.key.base58CheckSerialize(PaymentAddressType);
    let readOnlyKeySerialize = this.key.base58CheckSerialize(ReadonlyKeyType);

    // get all of output coins
    let response;
    try {
      response = await Wallet.RpcClient.getOutputCoin(paymentAddrSerialize, readOnlyKeySerialize);
    } catch (e) {
      console.log("Error when get balance: ", e);
      throw new CustomError(ErrorObject.GetOutputCoinsErr, "Can not get list of output coins when getting balance");
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

    console.timeEnd("Get balance: ");
    console.log("Balance: ", accountBalance);
    return accountBalance
  }

  async getPrivacyCustomTokenBalance(privacyCustomTokenID) {
    let paymentAddrSerialize = this.key.base58CheckSerialize(PaymentAddressType);
    let readOnlyKeySerialize = this.key.base58CheckSerialize(ReadonlyKeyType);

    let response;
    try {
      response = await Wallet.RpcClient.getOutputCoin(paymentAddrSerialize, readOnlyKeySerialize, privacyCustomTokenID);
    } catch (e) {
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

  async getCustomTokenBalance(customTokenIDStr) {
    let res;
    try {
      res = await Wallet.RpcClient.getUnspentCustomToken(
        this.key.base58CheckSerialize(PaymentAddressType),
        customTokenIDStr
      );
    } catch (e) {
      throw e;
    }

    let vins = res.listUnspentCustomToken;
    let accountBalance = 0;
    for (let i = 0; i < vins.length; i++) {
      accountBalance += parseInt(vins[i].Value)
    }
    return accountBalance
  };

  /**
   * 
   * @param {{paymentAddressStr: string, amount: number}} paramPaymentInfos 
   * @param {number} fee 
   * @param {bool} isPrivacy 
   * @param {string} info 
   */
  async createAndSendConstant(paramPaymentInfos, fee, isPrivacy, info = "") {
    await Wallet.updateProgressTx(10)
    // create paymentInfos
    let paymentInfos = new Array(paramPaymentInfos.length);
    let receiverPaymentAddrStr = new Array(paramPaymentInfos.length);

    let totalAmountTransfer = new bn(0);

    for (let i = 0; i < paymentInfos.length; i++) {
      let keyWallet = KeyWallet.base58CheckDeserialize(
        paramPaymentInfos[i].paymentAddressStr
      );
      receiverPaymentAddrStr[i] = paramPaymentInfos[i].paymentAddressStr;
      paymentInfos[i] = new PaymentInfo(
        keyWallet.KeySet.PaymentAddress,
        new bn(paramPaymentInfos[i].amount)
      );

      totalAmountTransfer = totalAmountTransfer.add(paymentInfos[i].Amount);
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
          inputForTx.inputCoins, inputForTx.inputCoinStrs, new bn(fee), isPrivacy, null, null, info);

        console.timeEnd("Time for creating tx");
      } catch (e) {
        console.log("ERR when creating tx: ", e);
        throw new CustomError(ErrorObject.InitNormalTxErr, "Can not init transaction tranfering PRV");
      }

      await Wallet.updateProgressTx(60)

      // console.log("*************** CONSTANT TX: ", tx);
      let response;
      let listUTXOForPRV = [];
      try {
        response = await Wallet.RpcClient.sendRawTx(tx);
      } catch (e) {
        console.log("ERR when sending tx: ", e);
        throw new CustomError(ErrorObject.SendTxErr, "Can not send PRV transaction");;
      }
      await Wallet.updateProgressTx(90)

      console.log("CREATE AND SEND NORMAL TX DONE!!!!");
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
        response.amount = totalAmountTransfer;
        response.txStatus = status;

        let spendingSNs = [];
        for (let i = 0; i < inputForTx.inputCoins.length; i++) {
          spendingSNs.push(inputForTx.inputCoins[i].coinDetails.serialNumber.compress())
          listUTXOForPRV.push(inputForTx.inputCoinStrs[i].SNDerivator)
        }
        this.addSpendingCoins({ txID: response.txId, spendingSNs: spendingSNs });
      }

      this.saveNormalTx(tx, totalAmountTransfer.toString(), receiverPaymentAddrStr, status, false, isPrivacy, listUTXOForPRV, "");

      console.timeEnd("Saving tx history: ");

      await Wallet.updateProgressTx(100)
      return response;
    } catch (e) {
      await Wallet.updateProgressTx(0)
      console.log(e);
      throw e;
    }
  };

  // staking tx always send constant to burning address
  // param.type: 0 : shard, 1: beacon
  // fee in Number
  async createAndSendStakingTx(param, fee, candidatePaymentAddress,  candidateMiningSeedKey, rewardReceiverPaymentAddress, autoReStaking = false) {
    await Wallet.updateProgressTx(10);

    // get amount staking
    let amount;
    try {
      let response = await Wallet.RpcClient.getStakingAmount(param.type);
      // console.log("response getStakingAmount: ", response);
      amount = response.res;
    } catch (e) {
      console.log("ERR get staking amount ", e);
      throw new CustomError(ErrorObject.GetStakingAmountErr, "Can not get staking amount before staking");
    }

    // generate committee key
    let candidateKeyWallet = KeyWallet.base58CheckDeserialize(candidatePaymentAddress);
    let publicKeyBytes = candidateKeyWallet.KeySet.PaymentAddress.Pk;

    let candidateHashPrivateKeyBytes = checkDecode(candidateMiningSeedKey).bytesDecoded;

    let committeeKey;
    try {
      committeeKey = await generateCommitteeKeyFromHashPrivateKey(candidateHashPrivateKeyBytes, publicKeyBytes);
      console.log("committeeKey: ", committeeKey);
    } catch (e) {
      throw e;
    }

    // sender's key
    let senderSkStr = this.key.base58CheckSerialize(PriKeyType);
    let paymentAddressStr = this.key.base58CheckSerialize(PaymentAddressType);

    let type = param.type === ShardStakingType ? MetaStakingShard : MetaStakingBeacon;

    let meta = {
      Type: type,
      FunderPaymentAddress: paymentAddressStr,
      RewardReceiverPaymentAddress: rewardReceiverPaymentAddress,
      StakingAmountShard: amount,
      CommitteePublicKey: committeeKey,
      AutoReStaking: autoReStaking,
    };

    // create paymentInfos
    let paymentInfos = new Array(1);
    let receiverPaymentAddrStr = new Array(1);
    receiverPaymentAddrStr[0] = BurnAddress;

    let keyWallet = KeyWallet.base58CheckDeserialize(
      receiverPaymentAddrStr[0]
    );
    paymentInfos[0] = new PaymentInfo(
      keyWallet.KeySet.PaymentAddress,
      new bn(amount)
    );

    console.time("Time for create and send tx");
    try {
      // prepare input for tx
      console.time("Time for preparing input for staking tx");
      let inputForTx;
      try {
        inputForTx = await prepareInputForTx(senderSkStr, paymentInfos, new bn(fee), this, Wallet.RpcClient);
        console.log("input after prepare: ", inputForTx);
      } catch (e) {
        console.log("Err when prepare input for staking tx: ", e);
        throw e;
      }
      console.timeEnd("Time for preparing input for staking tx");

      await Wallet.updateProgressTx(30)

      // init tx
      let tx = new Tx(Wallet.RpcClient);
      try {
        console.time("Time for creating tx");
        await tx.init(this.key.KeySet.PrivateKey, paymentAddressStr, paymentInfos,
          inputForTx.inputCoins, inputForTx.inputCoinStrs, new bn(fee), false, null, meta);
        console.timeEnd("Time for creating tx");
      } catch (e) {
        console.timeEnd("Time for creating tx");
        console.log("ERR when creating tx: ", e);
        throw new CustomError(ErrorObject.InitNormalTxErr, "Can not init staking tx");
      }
      await Wallet.updateProgressTx(60);

      let response;
      try {
        response = await Wallet.RpcClient.sendRawTx(tx);
      } catch (e) {
        console.log("ERR when sending staking tx: ", e);
        throw new CustomError(ErrorObject.SendTxErr, "Can not send staking tx");
      }

      await Wallet.updateProgressTx(90)

      console.log("CREATE AND SEND STAKING TX DONE!!!!");
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
        response.amount = amount;
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

      this.saveNormalTx(tx, toPRV(amount), receiverPaymentAddrStr, status, false, false);
      console.timeEnd("Saving tx history: ");

      await Wallet.updateProgressTx(100);
      return response;
    } catch (e) {
      await Wallet.updateProgressTx(0);
      console.log("Err something when create staking tx: ", e);
      throw new CustomError(ErrorObject.UnexpectedErr, "Can not create staking tx");
    }
  };

  async createAndSendCustomToken(paymentInfos = null, tokenParams, receiverPaymentAddrStr, fee) {
    await Wallet.updateProgressTx(10);
    let senderSkStr = this.key.base58CheckSerialize(PriKeyType);
    let paymentAddressStr = this.key.base58CheckSerialize(PaymentAddressType);

    try {
      let inputForTx
      try {
        console.time("Time for preparing input for custom token tx");
        inputForTx = await prepareInputForTx(senderSkStr, paymentInfos, new bn(fee), this, Wallet.RpcClient);
        await Wallet.updateProgressTx(30);
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

      let tx = new TxCustomToken(Wallet.RpcClient);
      try {
        await tx.init(this.key.KeySet.PrivateKey, paymentAddressStr, paymentInfos, inputForTx.inputCoins, inputForTx.inputCoinStrs, new bn(fee), tokenParams, inputForCustomTokenTx.listCustomToken, null, false);
      } catch (e) {
        console.log("ERR when creating custom token tx: ", e)
        throw new CustomError(ErrorObject.InitCustomTokenTxErr, e.message || e.Message || "Can not init custom token tx");
      }
      await Wallet.updateProgressTx(80);

      console.log("Sending custom token tx ....")
      let response;
      try {
        response = await Wallet.RpcClient.sendRawTxCustomToken(tx);
      } catch (e) {
        throw new CustomError(ErrorObject.SendTxErr, "Can not send custom token tx");
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
          let identicon = await Wallet.RpcClient.hashToIdenticon([tx.txTokenData.propertyID]);
          const { txTokenData } = tx
          const followingToken = {
            ID: txTokenData.propertyID,
            Image: identicon.images[0],
            Name: txTokenData.propertyName,
            Symbol: txTokenData.propertySymbol,
            Amount: txTokenData.amount,
            IsPrivacy: false,
            isInit: true,
            metaData: {},
          };
          this.addFollowingToken(followingToken);
          // console.log("List following token after adding: ", this.followingTokens);
        }

        let spendingSNs = [];
        for (let i = 0; i < inputForTx.inputCoins.length; i++) {
          spendingSNs.push(inputForTx.inputCoins[i].coinDetails.serialNumber.compress())
        }
        this.addSpendingCoins({ txID: response.txId, spendingSNs: spendingSNs });
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

      this.saveCustomTokenTx(tx, amount, receiverPaymentAddrStr, status, isIn);
      await Wallet.updateProgressTx(100);

      return response;
    } catch (e) {
      throw new CustomError(ErrorObject.UnexpectedErr, "Can not create custom token tx");
    }
  };

  /**
   * 
   * @param {{paymentAddressStr: string, amount: number}} paymentInfos 
   * @param {{Privacy: bool, TokenID: string, TokenName: string, TokenSymbol: string, TokenTxType: bool, TokenAmount: number, TokenReceivers : {PaymentAddress: string, Amount: number}}} submitParam 
   * @param {number} feePRV 
   * @param {number} feeToken 
   * @param {bool} hasPrivacyForToken 
   * @param {string} info 
   */
  async createAndSendPrivacyCustomToken(paymentInfos = [], submitParam, feePRV, feeToken, hasPrivacyForToken, info = "") {
    await Wallet.updateProgressTx(10);

    let paymentInfoForPRV = new Array(paymentInfos.length);
    for (let i = 0; i < paymentInfoForPRV.length; i++) {
      paymentInfoForPRV[i] = new PaymentInfo(
        KeyWallet.base58CheckDeserialize(
          paymentInfos[i].paymentAddressStr
        ).KeySet.PaymentAddress,
        new bn(paymentInfos[i].amount)
      );
    }

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
        inputForTx = await prepareInputForTx(senderSkStr, paymentInfoForPRV, new bn(feePRV), this, Wallet.RpcClient);
        console.timeEnd("Time for preparing input for custom token tx");
      } catch (e) {
        throw e;
      }
      await Wallet.updateProgressTx(30);

      let inputForPrivacyCustomTokenTx;
      try {
        console.log("Preparing input for privacy custom token tx ....")
        inputForPrivacyCustomTokenTx = await prepareInputForTxCustomTokenPrivacy(senderSkStr, tokenParams, this, Wallet.RpcClient, new bn(feeToken));
      } catch (e) {
        throw e;
      }
      await Wallet.updateProgressTx(50);

      tokenParams.tokenInputs = inputForPrivacyCustomTokenTx.tokenInputs;

      console.log("HHHH tokenParams.tokenInputs : ", tokenParams.tokenInputs)

      // console.log("Prepare: vins: ", inputForPrivacyCustomTokenTx.tokenInputs);
      // console.log("Prepare: list custom token: ", inputForPrivacyCustomTokenTx.listCustomToken);

      let tx = new TxCustomTokenPrivacy(Wallet.RpcClient);
      try {
        console.log("Creating privacy custom token tx ....")
        await tx.init(this.key.KeySet.PrivateKey,
          paymentAddressStr, paymentInfoForPRV,
          inputForTx.inputCoins, inputForTx.inputCoinStrs,
          new bn(feePRV),
          new bn(feeToken),
          tokenParams, inputForPrivacyCustomTokenTx.listPrivacyToken, null,
          hasPrivacyForToken,
          info
        );
      } catch (e) {
        throw new CustomError(ErrorObject.InitPrivacyTokenTxErr, e.message || e.Message || "Can not init privacy token");
      }
      await Wallet.updateProgressTx(80);

      let response;
      try {
        response = await Wallet.RpcClient.sendRawTxCustomTokenPrivacy(tx);
      } catch (e) {
        throw new CustomError(ErrorObject.SendTxErr, "Can not send privacy token tx");
      }

      await Wallet.updateProgressTx(90);
      // saving history tx
      // check status of tx

      console.log("Saving privacy custom token tx ....")
      let status = FailedTx;
      let listUTXOForPRV = [];
      let listUTXOForPToken = [];
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
          let identicon = await Wallet.RpcClient.hashToIdenticon([tx.txTokenPrivacyData.propertyID]);
          const { txTokenPrivacyData } = tx
          this.addFollowingToken({
            ID: txTokenPrivacyData.propertyID,
            Image: identicon.images[0],
            Name: txTokenPrivacyData.propertyName,
            Symbol: txTokenPrivacyData.propertySymbol,
            Amount: txTokenPrivacyData.amount,
            IsPrivacy: true,
            isInit: true,
            metaData: {},
          });
          console.log("List following token after adding: ", this.followingTokens);
        }

        let spendingSNs = [];
        for (let i = 0; i < inputForTx.inputCoins.length; i++) {
          spendingSNs.push(inputForTx.inputCoins[i].coinDetails.serialNumber.compress())
          listUTXOForPRV.push(inputForTx.inputCoinStrs[i].SNDerivator);
        }

        // console.log("spendingSNs: ", spendingSNs);
        let object = {};
        object.txID = response.txId;
        object.spendingSNs = spendingSNs;

        this.addSpendingCoins(object);

        if (inputForPrivacyCustomTokenTx.tokenInputs != null) {
          let tokenInputStrs = parseInputCoinToEncodedObject(inputForPrivacyCustomTokenTx.tokenInputs);

          for (let i = 0; i < tokenInputStrs.length; i++) {
            listUTXOForPToken.push(tokenInputStrs[i].SNDerivator);
          }
        }
      }

      // check is init or transfer token
      let isIn;
      let amount;
      if (tx.txTokenPrivacyData.type == CustomTokenInit) {
        isIn = true;
        amount = tx.txTokenPrivacyData.amount;
      } else {
        isIn = false;
        amount = submitParam.TokenReceivers.Amount;
      }

      this.savePrivacyCustomTokenTx(tx, receiverPaymentAddrStr, status, isIn, amount, listUTXOForPRV, listUTXOForPToken, "");
      await Wallet.updateProgressTx(100);
      return response;
    } catch (e) {
      throw new CustomError(ErrorObject.UnexpectedErr, "Can not create privacy token tx");
    }
  };

  // collect UTXOs have value that less than {amount} mili constant to one UTXO
  async defragment(amount, fee, isPrivacy) {
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
      console.log("Error get UTXO to defragment: ", e);
      throw new CustomError(ErrorObject.PrepareInputNormalTxErr, "Can not get UTXO to defragment");
    }
    console.timeEnd("getUTXOsToDefragment");

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
      throw new CustomError(ErrorObject.InitNormalTxErr, "Can not init defragment tx");
    }

    await Wallet.updateProgressTx(70);

    let response;
    try {
      response = await Wallet.RpcClient.sendRawTx(tx);
    } catch (e) {
      console.log("ERR when sending defragment tx: ", e);
      throw new CustomError(ErrorObject.SendTxErr, "Can not send defragment tx");
    }

    await Wallet.updateProgressTx(90)

    console.log("SENDING CONSTANT DONE!!!!");
    console.timeEnd("Time for create and send tx");

    // check status of tx
    let status = FailedTx;
    if (response.txId) {
      tx.txId = response.txId;
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
      this.addSpendingCoins({ txID: response.txId, spendingSNs: spendingSNs });
    }

    await Wallet.updateProgressTx(100);
    return response;
  }

  async cancelTx(txId, newFee, newFeePToken) {
    // get tx history by txID
    let txHistory = this.getTxHistoryByTxID(txId);

    // check type of tx
    let isNormalTx = true;
    if (txHistory.tokenID !== '') {
      isNormalTx = false;
    }

    let response;
    if (isNormalTx) {
      try {
        response = await this.cancelTxNormal(txHistory, newFee);
      } catch (e) {
        throw e;
      }
    } else {
      try {
        response = await this.cancelTxPToken(txHistory, newFee, newFeePToken);
      } catch (e) {
        throw e;
      }
    }
    return response;
  }

  async cancelTxNormal(txHistory, newFee) {
    // check new fee (just for PRV)
    if (newFee < txHistory.fee + Math.ceil(PercentFeeToCancelTx * txHistory.fee)) {
      throw new error("New fee must be greater than 10% old fee")
    }

    // get UTXO
    let listUTXO = txHistory.listUTXOForPRV;

    console.log("listUTXO :", listUTXO)
    let tokenID = 'constant';
    let listInputCoins = [];
    let listInputCoinStrs = [];
    for (let i = 0; i < listUTXO.length; i++) {
      const sndStr = `${tokenID}_${listUTXO[i]}`;
      listInputCoins.push(this.inputCoinCached[sndStr]);
      listInputCoinStrs.push(this.inputCoinJsonCached[sndStr])
    }

    // sender address
    let paymentAddressStr = this.key.base58CheckSerialize(PaymentAddressType);

    let paymentInfos = new Array(1);
    paymentInfos[0] = new PaymentInfo(
      KeyWallet.base58CheckDeserialize(txHistory.receivers[0]).KeySet.PaymentAddress,
      new bn(txHistory.amount)
    );

    // init tx
    await Wallet.updateProgressTx(30)

    // init tx
    let tx = new Tx(Wallet.RpcClient);
    try {
      console.time("Time for creating tx");
      await tx.init(this.key.KeySet.PrivateKey, paymentAddressStr, paymentInfos,
        listInputCoins, listInputCoinStrs, new bn(newFee), txHistory.isPrivacy, null, null)
      console.timeEnd("Time for creating tx");
    } catch (e) {
      console.log("ERR when creating tx: ", e);
      throw e;
    }

    await Wallet.updateProgressTx(60)

    let response;
    try {
      response = await Wallet.RpcClient.sendRawTx(tx);
    } catch (e) {
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
      response.amount = txHistory.amount;
      response.txStatus = status;

      let spendingSNs = [];
      for (let i = 0; i < listInputCoins.length; i++) {
        spendingSNs.push(listInputCoins[i].coinDetails.serialNumber.compress())
      }
      this.addSpendingCoins({ txID: response.txId, spendingSNs: spendingSNs });
    }

    this.saveNormalTx(tx, txHistory.amount, txHistory.receivers, status, false, txHistory.isPrivacy, listUTXO, txHistory.txID);
    console.log("history after saving: ", this.txHistory);

    console.timeEnd("Saving tx history: ");

    await Wallet.updateProgressTx(100);
    return response;
  }

  async cancelTxPToken(txHistory, newFee, newFeePToken) {
    // check new fee
    if (newFee < txHistory.fee + Math.ceil(PercentFeeToCancelTx * txHistory.fee) &&
      newFeePToken < txHistory.feePToken + Math.ceil(PercentFeeToCancelTx * txHistory.feePToken)) {
      throw new error("New fee must be greater than 10% old fee")
    }

    // get UTXO
    let listUTXO = txHistory.listUTXOForPRV;
    let listUTXOForPToken = txHistory.listUTXOForPToken;

    let tokenID = 'constant';
    let listInputCoins = [];
    let listInputCoinStrs = [];
    for (let i = 0; i < listUTXO.length; i++) {
      const sndStr = `${tokenID}_${listUTXO[i]}`;
      listInputCoins.push(this.inputCoinCached[sndStr]);
      listInputCoinStrs.push(this.inputCoinJsonCached[sndStr])
    }

    console.log("HHHH listInputCoins: ", listInputCoins);
    console.log("HHHH listInputCoinStrs: ", listInputCoinStrs);

    let listInputCoinsForPToken = [];
    let listInputCoinStrsForPToken = [];
    for (let i = 0; i < listUTXOForPToken.length; i++) {
      const sndStr = `${txHistory.tokenID}_${listUTXOForPToken[i]}`;
      listInputCoinsForPToken.push(this.inputCoinCached[sndStr]);
      listInputCoinStrsForPToken.push(this.inputCoinJsonCached[sndStr]);
    }

    console.log("HHHH listInputCoinsForPToken: ", listInputCoinsForPToken);
    console.log("HHHH listInputCoinStrsForPToken: ", listInputCoinStrsForPToken);

    // sender address
    let paymentAddressStr = this.key.base58CheckSerialize(PaymentAddressType);

    let paymentInfos = new Array(1);
    paymentInfos[0] = new PaymentInfo(
      KeyWallet.base58CheckDeserialize(txHistory.receivers[0]).KeySet.PaymentAddress,
      new bn(txHistory.amount)
    );

    // prepare token param
    let tokenParams = new CustomTokenPrivacyParamTx();
    tokenParams.propertyID = txHistory.tokenID;
    tokenParams.propertyName = txHistory.tokenName;
    tokenParams.propertySymbol = txHistory.tokenSymbol;
    tokenParams.amount = 0;
    tokenParams.tokenInputs = listInputCoinsForPToken;

    if (txHistory.isIn) {
      tokenParams.tokenTxType = CustomTokenInit;
    } else {
      tokenParams.tokenTxType = CustomTokenTransfer;
    }

    // get list privacy tokens
    let resp;
    try {
      resp = await Wallet.RpcClient.listPrivacyCustomTokens();
    } catch (e) {
      throw e;
    }
    let listPrivacyToken = resp.listPrivacyToken;

    tokenParams.receivers = new Array(1);
    tokenParams.receivers[0] = new PaymentInfo(
      KeyWallet.base58CheckDeserialize(
        txHistory.receivers[0]
      ).KeySet.PaymentAddress,
      new bn(txHistory.amount)
    );

    // init tx
    await Wallet.updateProgressTx(30)

    // init tx
    let tx = new TxCustomTokenPrivacy(Wallet.RpcClient);
    try {
      console.time("Time for creating tx");
      await tx.init(this.key.KeySet.PrivateKey, paymentAddressStr, [],
        listInputCoins, listInputCoinStrs, new bn(newFee), new bn(newFeePToken), tokenParams, listPrivacyToken, null, txHistory.isPrivacy)
      console.timeEnd("Time for creating tx");
    } catch (e) {
      console.log("ERR when creating tx: ", e);
      throw e;
    }

    await Wallet.updateProgressTx(80);

    let response;
    try {
      response = await Wallet.RpcClient.sendRawTxCustomTokenPrivacy(tx);
    } catch (e) {
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
        let identicon = await Wallet.RpcClient.hashToIdenticon([tx.txTokenPrivacyData.propertyID]);
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
      for (let i = 0; i < listInputCoins.length; i++) {
        spendingSNs.push(listInputCoins[i].coinDetails.serialNumber.compress())
      }

      let object = {};
      object.txID = response.txId;
      object.spendingSNs = spendingSNs;

      this.addSpendingCoins(object);
    }

    this.savePrivacyCustomTokenTx(tx, txHistory.receivers, status, txHistory.isIn, txHistory.amount, txHistory.listUTXOForPRV, txHistory.listUTXOForPToken, txHistory.txID);
    console.log("History HHHHH: ", this.txHistory);
    await Wallet.updateProgressTx(100);
    return response;
  }

  // hasPrivacyForToken be always true
  // remoteAddress (string) is an ETH/BTC address which users want to receive ETH/BTC (without 0x)
  async createAndSendBurningRequestTx(paymentInfos = [], submitParam, feePRV, feeToken, remoteAddress) {
    if (remoteAddress.startsWith("0x")) {
      remoteAddress = remoteAddress.slice(2);
    }

    await Wallet.updateProgressTx(10);

    let paymentInfoForPRV = new Array(paymentInfos.length);
    for (let i = 0; i < paymentInfoForPRV.length; i++) {
      paymentInfoForPRV[i] = new PaymentInfo(
        KeyWallet.base58CheckDeserialize(
          paymentInfos[i].paymentAddressStr
        ).KeySet.PaymentAddress,
        new bn(paymentInfos[i].amount)
      );
    }

    // token param
    // get current token to get token param
    let tokenParams = new CustomTokenPrivacyParamTx();
    tokenParams.propertyID = submitParam.TokenID;
    tokenParams.propertyName = submitParam.TokenName;
    tokenParams.propertySymbol = submitParam.TokenSymbol;
    tokenParams.amount = submitParam.TokenAmount;
    tokenParams.tokenTxType = submitParam.TokenTxType;

    let receiverPaymentAddrStr = new Array(1);
    receiverPaymentAddrStr[0] = BurnAddress;

    tokenParams.receivers = new Array(1);
    tokenParams.receivers[0] = new PaymentInfo(
      KeyWallet.base58CheckDeserialize(
        BurnAddress
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
        inputForTx = await prepareInputForTx(senderSkStr, paymentInfoForPRV, new bn(feePRV), this, Wallet.RpcClient);
        console.timeEnd("Time for preparing input for custom token tx");
      } catch (e) {
        throw e;
      }
      await Wallet.updateProgressTx(30);

      let inputForPrivacyCustomTokenTx;
      try {
        inputForPrivacyCustomTokenTx = await prepareInputForTxCustomTokenPrivacy(senderSkStr, tokenParams, this, Wallet.RpcClient, new bn(feeToken));
      } catch (e) {
        throw e;
      }
      await Wallet.updateProgressTx(50);

      tokenParams.tokenInputs = inputForPrivacyCustomTokenTx.tokenInputs;

      // prepare meta data for tx
      let burningReq = {
        BurnerAddress: this.key.KeySet.PaymentAddress,
        BurningAmount: submitParam.TokenReceivers.Amount,
        TokenID: tokenParams.propertyID,
        TokenName: tokenParams.propertyName,
        RemoteAddress: remoteAddress,
        Type: BurningRequestMeta
      };

      let tx = new TxCustomTokenPrivacy(Wallet.RpcClient);
      try {
        console.log("Creating privacy custom token tx ....")
        await tx.init(this.key.KeySet.PrivateKey,
          paymentAddressStr, paymentInfoForPRV,
          inputForTx.inputCoins, inputForTx.inputCoinStrs,
          new bn(feePRV),
          new bn(feeToken),
          tokenParams, inputForPrivacyCustomTokenTx.listPrivacyToken, burningReq,
          false,
        );
      } catch (e) {
        throw new CustomError(ErrorObject.InitPrivacyTokenTxErr, e.message || e.Message || "Can not init burning request tx");
      }
      await Wallet.updateProgressTx(80);

      let response;
      try {
        response = await Wallet.RpcClient.sendRawTxCustomTokenPrivacy(tx);
      } catch (e) {
        throw new CustomError(ErrorObject.SendTxErr, "Can not send burning request tx");
      }

      await Wallet.updateProgressTx(90);
      // saving history tx
      // check status of tx
      console.log("Saving privacy custom token tx ....")
      let status = FailedTx;
      let listUTXOForPRV = [];
      let listUTXOForPToken = [];
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

        let spendingSNs = [];
        for (let i = 0; i < inputForTx.inputCoins.length; i++) {
          spendingSNs.push(inputForTx.inputCoins[i].coinDetails.serialNumber.compress())
          listUTXOForPRV.push(inputForTx.inputCoinStrs[i].SNDerivator);
        }

        // console.log("spendingSNs: ", spendingSNs);
        let object = {};
        object.txID = response.txId;
        object.spendingSNs = spendingSNs;

        this.addSpendingCoins(object);

        if (inputForPrivacyCustomTokenTx.tokenInputs != null) {
          let tokenInputStrs = parseInputCoinToEncodedObject(inputForPrivacyCustomTokenTx.tokenInputs);

          for (let i = 0; i < tokenInputStrs.length; i++) {
            listUTXOForPToken.push(tokenInputStrs[i].SNDerivator);
          }
        }
      }

      this.savePrivacyCustomTokenTx(tx, receiverPaymentAddrStr, status, false, submitParam.TokenReceivers.Amount, listUTXOForPRV, listUTXOForPToken, "");
      await Wallet.updateProgressTx(100);
      return response;
    } catch (e) {
      throw new CustomError(ErrorObject.UnexpectedErr, "Can not create burning request tx");
    }
  };

  /**
   * 
   * @param {bool} isGetAll 
   * @param {string} tokenID 
   * @returns {number} (if isGetAll = false)
   * @returns {map[TokenID] : number} (if isGetAll = true)
   */
  async getRewardAmount(isGetAll = true, tokenID = "") {
    let paymentAddrStr = this.key.base58CheckSerialize(PaymentAddressType);
    let resp;
    try {
      resp = await Wallet.RpcClient.getRewardAmount(paymentAddrStr);
    } catch (e) {
      console.log("Error get reward amount: ", e);
      throw new CustomError(ErrorObject.GetRewardAmountErr, "Can not get reward amount");
    }

    if (isGetAll) {
      return resp.rewards; 
    } else {
      if (tokenID == "") {
        tokenID = "PRV";
      }

      return resp.rewards[tokenID];
    }
  }

  async createAndSendWithdrawRewardTx(tokenID = "") {
    let paymentAddrStr = this.key.base58CheckSerialize(PaymentAddressType);

    if (tokenID == "") {
      tokenID = convertHashToStr(PRVID)
    }

    let metaData = {
      Type: WithDrawRewardRequestMeta,
      PaymentAddress: this.key.KeySet.PaymentAddress,
      TokenID: newHashFromStr(tokenID)
    }

    await Wallet.updateProgressTx(10)
    // create paymentInfos
    let paymentInfos = [];

    // init tx
    let tx = new Tx(Wallet.RpcClient);
    try {
      console.time("Time for creating tx");
      await tx.init(this.key.KeySet.PrivateKey, paymentAddrStr, paymentInfos,
        [], [], new bn(0), true, null, metaData, "");
      console.timeEnd("Time for creating tx");
    } catch (e) {
      console.log("ERR when creating tx: ", e);
      throw new CustomError(ErrorObject.InitWithrawRewardTxErr, "Can not init withdraw reward transaction");
    }

    await Wallet.updateProgressTx(60)

    let response;
    try {
      response = await Wallet.RpcClient.sendRawTx(tx);
    } catch (e) {
      throw e;
    }
    await Wallet.updateProgressTx(90)
    console.timeEnd("Time for create and send tx");

    // saving history tx
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
    }

    await Wallet.updateProgressTx(100);
    return response;
  }

  toSerializedAccountObj() {
    return {
      "AccountName": this.name,
      "PrivateKey": this.key.base58CheckSerialize(PriKeyType),
      "PaymentAddress": this.key.base58CheckSerialize(PaymentAddressType),
      "ReadonlyKey": this.key.base58CheckSerialize(ReadonlyKeyType),
      "PublicKey": this.key.getPublicKeyByHex(),
      "PublicKeyCheckEncode": this.key.getPublicKeyCheckEncode(),
      "PublicKeyBytes": this.key.KeySet.PaymentAddress.Pk.toString(),
      "BlockProducerKey": checkEncode(hashSha3BytesToBytes(hashSha3BytesToBytes(this.key.KeySet.PrivateKey)), ENCODE_VERSION),
    }
  }

  // isStaked return -1 : is not staked
  // 0: candidator
  // 1: validator
  async stakerStatus() {
    let reps;
    try {
      reps = await Wallet.RpcClient.getBeaconBestState();
    } catch (e) {
      throw e;
    }

    let bestState = reps.bestState;

    let publicKeyB58CheckEncode = this.key.getPublicKeyCheckEncode();

    // check BeaconCommittee
    if (bestState.BeaconCommittee.includes(publicKeyB58CheckEncode)) {
      return ValidatorStatus;
    }

    // check BeaconPendingValidator
    if (bestState.BeaconPendingValidator.includes(publicKeyB58CheckEncode)) {
      return CandidatorStatus;
    }

    // check CandidateShardWaitingForCurrentRandom
    if (bestState.CandidateShardWaitingForCurrentRandom.includes(publicKeyB58CheckEncode)) {
      return CandidatorStatus;
    }

    // check CandidateBeaconWaitingForCurrentRandom
    if (bestState.CandidateBeaconWaitingForCurrentRandom.includes(publicKeyB58CheckEncode)) {
      return CandidatorStatus;
    }

    // check CandidateShardWaitingForNextRandom
    if (bestState.CandidateShardWaitingForNextRandom.includes(publicKeyB58CheckEncode)) {
      return CandidatorStatus;
    }

    // check CandidateBeaconWaitingForNextRandom
    if (bestState.CandidateBeaconWaitingForNextRandom.includes(publicKeyB58CheckEncode)) {
      return CandidatorStatus;
    }

    // check ShardCommittee
    for (let i = 0; i < Wallet.ShardNumber; i++) {
      if (bestState.ShardCommittee[i].includes(publicKeyB58CheckEncode)) {
        return ValidatorStatus;
      }
    }

    // check ShardPendingValidator
    for (let i = 0; i < Wallet.ShardNumber; i++) {
      if (bestState.ShardPendingValidator[i].includes(publicKeyB58CheckEncode)) {
        return CandidatorStatus;
      }
    }

    return NoStakeStatus;
  }
}

export { AccountWallet };


