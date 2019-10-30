import bn from 'bn.js';
import { CustomTokenInit, TxNormalType, TxCustomTokenPrivacyType, CustomTokenTransfer } from '../tx/constants';
import { KeyWallet } from "./hdwallet";
import { PaymentInfo } from '../key';
import {
  FailedTx,
  SuccessTx,
  MetaStakingBeacon,
  MetaStakingShard,
  PaymentAddressType,
  ReadonlyKeyType,
  PriKeyType,
  PDETradeRequestMeta,
  PDEWithdrawalRequestMeta,
  PDEContributionMeta,
} from "./constants";
import { checkEncode, checkDecode } from "../base58";
import {
  prepareInputForTx,
  prepareInputForTxPrivacyToken,
  getUnspentCoin,
  newParamInitTx,
  newParamInitPrivacyTokenTx
} from "../tx/utils";
import { ENCODE_VERSION, ED25519_KEY_SIZE } from "../constants";
import { ShardStakingType, BurnAddress, BurningRequestMeta, WithDrawRewardRequestMeta, PRVID } from './constants';
import { Wallet } from "./wallet";
import { TxHistoryInfo } from "./history";
import CryptoJS from "crypto-js";
import JSON from "circular-json";
import { convertHashToStr } from "../common";
import { generateCommitteeKeyFromHashPrivateKey } from "../committeekey";
import { hashSha3BytesToBytes, base64Decode } from "../privacy/utils";
import { CustomError, ErrorObject } from '../errorhandler';
import {
  SK,
  VALUE,
  SND,
  SHARD_ID,
  RAND,
} from "../privacy/constants";

class AccountWallet {
  constructor() {
    this.name = "";
    this.key = new KeyWallet();
    this.child = [];
    this.isImport = false;
    this.followingTokens = [];
    this.txHistory = { NormalTx: [], CustomTokenTx: [], PrivacyTokenTx: [] };

    // derivatorPointCached is used for saving derivator (encoded) with corresponding encoded serial number in bytes array that was calculated before
    this.derivatorToSerialNumberCache = {}
    // spentCoinCached is used for cache spent coin
    this.spentCoinCached = {}
    // list of serial number of coins in tx in mempool
    this.spendingCoins = [];
  };

  // addSpendingCoins adds spending coin object to spending coins list
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
  /**
   * 
   * @param {string} txId 
   */
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
    this.derivatorToSerialNumberCache = {};
    this.spentCoinCached = {};
  }

  // saveAccountCached saves derivatorToSerialNumberCache and spentCoinCached for account
  /**
   * 
   * @param {string} password 
   * @param {object} storage 
   */
  saveAccountCached(password, storage) {
    if (password === "") {
      throw new Error("Password is required");
    }

    let cacheObject = {
      derivatorToSerialNumberCache: this.derivatorToSerialNumberCache,
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

  // loadAccountCached loads cache that includes derivatorToSerialNumberCache, inputCoinJsonCached and spentCoinCached for account
  /**
   * 
   * @param {string} password 
   * @param {object} storage 
   */
  async loadAccountCached(password, storage) {
    if (storage != null) {
      let cipherText = await storage.getItem(`${this.name}-cached`);
      if (!cipherText) return false;

      let data = CryptoJS.AES.decrypt(cipherText, password);
      let jsonStr = data.toString(CryptoJS.enc.Utf8);

      try {
        let cacheObject = JSON.parse(jsonStr);
        this.derivatorToSerialNumberCache = cacheObject.derivatorToSerialNumberCache;
        this.spentCoinCached = cacheObject.spentCoinCached;
      } catch (e) {
        console.log("loadAccountCached error: ", e);
        throw e;
      }
    }
  }

  // analyzeOutputCoinFromCached devides allOutputCoinStrs into list of cached output coins and list of uncached output coins
  /**
   * 
   * @param {[Coin]} allOutputCoinStrs 
   * @param {string} tokenID 
   */
  analyzeOutputCoinFromCached(allOutputCoinStrs, tokenID = null) {
    if (tokenID === null) {
      tokenID = 'PRV';
    }
    this.derivatorToSerialNumberCache = this.derivatorToSerialNumberCache === undefined ? {} : this.derivatorToSerialNumberCache;
    let uncachedOutputCoinStrs = [];
    let cachedOutputCoinStrs = [];

    for (let i = 0; i < allOutputCoinStrs.length; i++) {
      const sndStr = `${tokenID}_${allOutputCoinStrs[i].SNDerivator}`;

      if (this.derivatorToSerialNumberCache[sndStr] !== undefined) {
        allOutputCoinStrs[i].SerialNumber = this.derivatorToSerialNumberCache[sndStr];
        cachedOutputCoinStrs.push(allOutputCoinStrs[i]);
      } else {
        uncachedOutputCoinStrs.push(allOutputCoinStrs[i]);
      }
    }
    return {
      uncachedOutputCoinStrs: uncachedOutputCoinStrs,
      cachedOutputCoinStrs: cachedOutputCoinStrs,
    }
  }

  // mergeSpentCoinCached caches spent input coins to spentCoinCached
  /**
   * 
   * @param {[Coin]} unspentCoinStrs 
   * @param {[Coin]} unspentCoinStrsFromCache 
   * @param {string} tokenID 
   */
  async mergeSpentCoinCached(unspentCoinStrs, unspentCoinStrsFromCache, tokenID = null) {
    if (tokenID === null) {
      tokenID = 'PRV';
    }
    this.spentCoinCached = this.spentCoinCached === undefined ? {} : this.spentCoinCached;
    let chkAll = {};
    for (let i = 0; i < unspentCoinStrsFromCache.length; i++) {
      const sndStr = `${tokenID}_${unspentCoinStrsFromCache[i].SNDerivator}`;
      chkAll[sndStr] = true;
    }
    for (let i = 0; i < unspentCoinStrs.length; i++) {
      const sndStr = `${tokenID}_${unspentCoinStrs[i].SNDerivator}`;
      chkAll[sndStr] = false;
    }
    for (let sndStr in chkAll) {
      if (sndStr != undefined && chkAll[sndStr] === true) {
        this.spentCoinCached[sndStr] = true;
      }
    }
  }

  // analyzeSpentCoinFromCached returns input coins which it not existed in list of cached spent input coins
  /**
   * 
   * @param {[Coin]} inCoinStrs 
   * @param {string} tokenID 
   */
  analyzeSpentCoinFromCached(inCoinStrs, tokenID = null) {
    if (tokenID === null) {
      tokenID = 'PRV';
    }
    this.spentCoinCached = this.spentCoinCached === undefined ? {} : this.spentCoinCached;
    let unspentInputCoinsFromCachedStrs = [];

    for (let i = 0; i < inCoinStrs.length; i++) {
      const sndStr = `${tokenID}_${inCoinStrs[i].SNDerivator}`;
      if (this.spentCoinCached[sndStr] === undefined) {
        unspentInputCoinsFromCachedStrs.push(inCoinStrs[i]);
      }
    }

    return {
      unspentInputCoinsFromCachedStrs: unspentInputCoinsFromCachedStrs,
    };
  }

  // deriveSerialNumbers returns list of serial numbers of input coins
  /**
   * 
   * @param {string} spendingKeyStr 
   * @param {[Coin]} inCoinStrs 
   * @param {string} tokenID 
   */
  async deriveSerialNumbers(spendingKeyStr, inCoinStrs, tokenID = null) {
    if (tokenID === null) {
      tokenID = 'PRV';
    }

    let serialNumberStrs = new Array(inCoinStrs.length);
    let serialNumberBytes = new Array(inCoinStrs.length);
    let snds = new Array(inCoinStrs.length);

    // calculate serial number (Call WASM/gomobile function)
    for (let i = 0; i < inCoinStrs.length; i++) {
      snds[i] = inCoinStrs[i].SNDerivator;
    }

    console.log("deriveSerialNumbers snds list: ", snds);

    let param = {
      "privateKey": spendingKeyStr,
      "snds": snds
    }

    let paramJson = JSON.stringify(param);

    if (typeof deriveSerialNumber === "function") {
      let res = await deriveSerialNumber(paramJson);
      if (res === null || res === "") {
        console.log("Can not derive serial number")
        throw new Error("Can not derive serial number");
      }

      let tmpBytes = base64Decode(res);
      for (let i = 0; i < snds.length; i++) {
        serialNumberBytes[i] = tmpBytes.slice(i * ED25519_KEY_SIZE, (i + 1) * ED25519_KEY_SIZE);
        serialNumberStrs[i] = checkEncode(serialNumberBytes[i], ENCODE_VERSION);
        inCoinStrs[i].SerialNumber = serialNumberStrs[i];

        // cache snd and corressponding serial number
        const sndStr = `${tokenID}_${snds[i]}`;
        this.derivatorToSerialNumberCache[sndStr] = serialNumberStrs[i];
      }
    }

    console.log("deriveSerialNumbers serialNumberStrs list: ", serialNumberStrs);

    return {
      serialNumberStrs: serialNumberStrs,
      inCoinStrs: inCoinStrs
    };
  }

  // listFollowingTokens returns list of following tokens
  listFollowingTokens() {
    return this.followingTokens;
  };

  // addFollowingToken adds token data array to following token list
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
  /**
   * 
   * @param {string} tokenId 
   */
  removeFollowingToken(tokenId) {
    const removedIndex = this.followingTokens.findIndex(token => token.ID === tokenId);
    this.followingTokens.splice(removedIndex, 1);
  }


  // saveNormalTxHistory save history of normal tx to history account
  /**
   * @param {{txId: string, typeTx: string, amountNativeToken: number, feeNativeToken: number, txStatus: number, lockTime: number}} tx
   *  @param {[string]} receivers
   * @param {bool} isIn
   * @param {bool} isPrivacy
   * @param {[string]} listUTXOForPRV
   * @param {string} hashOriginalTx
   */
  saveNormalTxHistory(tx, receivers, isIn, isPrivacyNativeToken, listUTXOForPRV, hashOriginalTx = "") {
    let txHistory = new TxHistoryInfo();

    let historyObj = {
      txID: tx.txId,
      amountNativeToken: tx.amountNativeToken,   // in nano PRV
      amountPToken: 0,
      feeNativeToken: tx.feeNativeToken,      // in nano PRV
      feePToken: 0,     // in nano PRV
      typeTx: tx.typeTx,
      receivers: receivers,
      tokenName: "",
      tokenID: "",
      tokenSymbol: "",
      isIn: isIn,
      time: tx.lockTime * 1000,  // in mili-second
      status: tx.txStatus,
      isPrivacyNativeToken: isPrivacyNativeToken,
      isPrivacyForPToken: false,
      listUTXOForPRV: listUTXOForPRV,
      listUTXOForPToken: [],
      hashOriginalTx: hashOriginalTx,
    }

    txHistory.setHistoryInfo(historyObj);
    this.txHistory.NormalTx.unshift(txHistory);
  };

  // savePrivacyTokenTxHistory save history of privacy token tx to history account
  /**
   * @param {{txId: string, typeTx: string, amountNativeToken: number, amountPToken: number, feeNativeToken: number, feePToken: number,  txStatus: number, lockTime: number}} tx
   *  @param {[string]} receivers
   * @param {bool} isIn
   * @param {bool} isPrivacyNativeToken
   * @param {bool} isPrivacyForPToken
   * @param {[string]} listUTXOForPRV
   * @param {[string]} listUTXOForPToken
   * @param {string} hashOriginalTx
   */
  savePrivacyTokenTxHistory(tx, receivers, isIn, isPrivacyNativeToken, isPrivacyForPToken, listUTXOForPRV, listUTXOForPToken, hashOriginalTx = "") {
    let txHistory = new TxHistoryInfo();

    let historyObj = {
      txID: tx.txId,
      amountNativeToken: tx.amountNativeToken,   // in nano PRV
      amountPToken: tx.amountPToken,
      feeNativeToken: tx.feeNativeToken,        // in nano PRV
      feePToken: tx.feePToken,                  // in nano PRV
      typeTx: tx.typeTx,
      receivers: receivers,
      tokenName: tx.tokenName,
      tokenID: tx.tokenID,
      tokenSymbol: tx.tokenSymbol,
      isIn: isIn,
      time: tx.lockTime * 1000,                 // in mili-second
      status: tx.txStatus,
      isPrivacyNativeToken: isPrivacyNativeToken,
      isPrivacyForPToken: isPrivacyForPToken,
      listUTXOForPRV: listUTXOForPRV,
      listUTXOForPToken: listUTXOForPToken,
      hashOriginalTx: hashOriginalTx,
    }
    txHistory.setHistoryInfo(historyObj);
    this.txHistory.PrivacyTokenTx.unshift(txHistory);
  };

  // getNormalTxHistory return history of normal txs
  getNormalTxHistory() {
    return this.txHistory.NormalTx;
  };

  // getPrivacyTokenTxHistory return history of normal txs
  getPrivacyTokenTxHistory() {
    return this.txHistory.PrivacyTokenTx;
  };

  getCustomTokenTx() {
    return this.txHistory.CustomTokenTx;
  };

  // getTxHistoryByTxID returns tx history for specific tx id
  /**
   * 
   * @param {string} txID 
   */
  getTxHistoryByTxID(txID) {
    return this.txHistory.NormalTx.find(item => item.txID === txID) ||
      this.txHistory.PrivacyTokenTx.find(item => item.txID === txID) ||
      this.txHistory.CustomTokenTx.find(item => item.txID === txID)
  }

  // getPrivacyTokenTxHistoryByTokenID returns privacy token tx history with specific tokenID
  /**
   * 
   * @param {string} id 
   */
  getPrivacyTokenTxHistoryByTokenID(id) {
    let queryResult = new Array();
    for (let i = 0; i < this.txHistory.PrivacyTokenTx.length; i++) {
      if (this.txHistory.PrivacyTokenTx[i].tokenID === id)
        queryResult.push(this.txHistory.PrivacyTokenTx[i]);
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

  // getUnspentToken returns unspent output coins with tokenID
  // for native token: tokenId is null
  /**
   * 
   * @param {string} tokenID 
   * @param {RpcClient} rpcClient 
   */
  async getUnspentToken(tokenID = null, rpcClient) {
    let spendingKeyStr = this.key.base58CheckSerialize(PriKeyType);
    let paymentAddrSerialize = this.key.base58CheckSerialize(PaymentAddressType);
    let readOnlyKeySerialize = this.key.base58CheckSerialize(ReadonlyKeyType);

    // get all output coins of spendingKey
    let response;
    try {
      response = await rpcClient.getOutputCoin(paymentAddrSerialize, readOnlyKeySerialize, tokenID);
    } catch (e) {
      console.log("getUnspentToken Error when get output coins: ", e);
      throw new CustomError(ErrorObject.GetOutputCoinsErr, e.message || "Can not get output coins when get unspent token");
    }

    let allOutputCoinStrs = response.outCoins;

    console.log("getUnspentToken list of output coins: ", allOutputCoinStrs);

    // devide all of output coins into uncached and cached out put coins list
    let { uncachedOutputCoinStrs, cachedOutputCoinStrs } = this.analyzeOutputCoinFromCached(allOutputCoinStrs);
    console.log("getUnspentToken derivatorToSerialNumberCache before caching: ", this.derivatorToSerialNumberCache);
    console.log("getUnspentToken spentCoinCached before caching: ", this.spentCoinCached);
    console.log("getUnspentToken cachedOutputCoinStrs: ", cachedOutputCoinStrs);
    console.log("getUnspentToken uncachedOutputCoinStrs: ", uncachedOutputCoinStrs);

    // calculate serial number uncachedOutputCoinStrs and cache
    if (uncachedOutputCoinStrs.length > 0) {
      let res = await this.deriveSerialNumbers(spendingKeyStr, uncachedOutputCoinStrs, tokenID);
      uncachedOutputCoinStrs = res.inCoinStrs;
      console.log("getUnspentToken this.derivatorToSerialNumberCache after calculate serial number: ", this.derivatorToSerialNumberCache);

      allOutputCoinStrs = cachedOutputCoinStrs.concat(uncachedOutputCoinStrs);
    }
    console.log("getUnspentToken allOutputCoinStrs after: ", allOutputCoinStrs);

    // get unspent output coin from cache
    let { unspentInputCoinsFromCachedStrs } = this.analyzeSpentCoinFromCached(allOutputCoinStrs);
    console.log("getUnspentToken unspentInputCoinsFromCachedStrs: ", unspentInputCoinsFromCachedStrs);

    // check whether unspent coin from cache is spent or not
    let { unspentCoinStrs } = await getUnspentCoin(spendingKeyStr, paymentAddrSerialize, unspentInputCoinsFromCachedStrs, tokenID, rpcClient);
    console.log("getUnspentToken unspentCoinStrs: ", unspentCoinStrs);

    // cache spent output coins
    this.mergeSpentCoinCached(unspentCoinStrs, unspentInputCoinsFromCachedStrs, tokenID);
    console.log("getUnspentToken spentCoinCached after caching:", this.spentCoinCached);

    return unspentCoinStrs;
  }

  // getBalance returns balance for token (native token or privacy token)
  // tokenID default is null: for PRV
  /**
   * 
   * @param {string} tokenID 
   */
  async getBalance(tokenID = null) {
    let unspentCoinStrs = await this.getUnspentToken(tokenID, Wallet.RpcClient);
    console.log("getBalance unspentCoinStrs: ", unspentCoinStrs);

    let accountBalance = 0;
    for (let i = 0; i < unspentCoinStrs.length; i++) {
      accountBalance += parseInt(unspentCoinStrs[i].Value)
    }
    console.log("getBalance Balance: ", accountBalance);
    return accountBalance
  }

  /**
   * 
   * @param {{paymentAddressStr: string (B58checkencode), amount: number}} paramPaymentInfos 
   * @param {number} fee 
   * @param {bool} isPrivacy 
   * @param {string} info 
   */
  async createAndSendNativeToken(paramPaymentInfos, fee, isPrivacy, info = "") {
    await Wallet.updateProgressTx(10);
    let feeBN = new bn(fee);

    let receiverPaymentAddrStr = new Array(paramPaymentInfos.length);
    let totalAmountTransfer = new bn(0);
    for (let i = 0; i < paramPaymentInfos.length; i++) {
      receiverPaymentAddrStr[i] = paramPaymentInfos[i].paymentAddressStr;
      totalAmountTransfer = totalAmountTransfer.add(new bn(paramPaymentInfos[i].amount));
    }

    console.log("createAndSendNativeToken totalAmountTransfer: ", totalAmountTransfer);

    let senderSkStr = this.key.base58CheckSerialize(PriKeyType);
    // let paymentAddressStr = this.key.base58CheckSerialize(PaymentAddressType);
    // let viewingKeyStr = this.key.base58CheckSerialize(ReadonlyKeyType);

    console.time("Time for create and send tx");
    try {
      // prepare input for tx
      console.time("Time for preparing input for privacy tx");
      // console.log("Wallet: ", Wallet.RpcClient);
      let inputForTx;
      try {
        inputForTx = await prepareInputForTx(totalAmountTransfer, feeBN, isPrivacy, null, this, Wallet.RpcClient);
        console.log("input after prepare: ", inputForTx);
      } catch (e) {
        throw e;
      }
      console.log("createAndSendNativeToken inputForTx: ", inputForTx);
      console.timeEnd("Time for preparing input for privacy tx");

      await Wallet.updateProgressTx(30);

      let nOutput = paramPaymentInfos.length;
      if (inputForTx.totalValueInput.cmp(totalAmountTransfer) === 1) {
        nOutput++;
      }

      let sndOutputStrs;
      let sndOutputs = new Array(nOutput);
      if (typeof randomScalars === "function") {
        sndOutputStrs = await randomScalars(nOutput.toString());
        if (sndOutputStrs === null || sndOutputStrs === "") {
          throw new Error("Can not random scalars for output coins")
        }

        console.log("sndOutputStrs: ", sndOutputStrs);
        let sndDecodes = base64Decode(sndOutputStrs);

        for (let i = 0; i < nOutput; i++) {
          let sndBytes = sndDecodes.slice(i * ED25519_KEY_SIZE, (i + 1) * ED25519_KEY_SIZE);
          sndOutputs[i] = checkEncode(sndBytes, ENCODE_VERSION);
        }
      }
      console.log("createAndSendNativeToken sndOutputs: ", sndOutputs);

      let paramInitTx = newParamInitTx(
        senderSkStr, paramPaymentInfos, inputForTx.inputCoinStrs,
        fee, isPrivacy, null, null, info,
        inputForTx.commitmentIndices, inputForTx.myCommitmentIndices, inputForTx.commitmentStrs, sndOutputs);
      console.log("createAndSendNativeToken paramInitTx: ", paramInitTx);

      let resInitTx;
      if (typeof initPrivacyTx === "function") {
        let paramInitTxJson = JSON.stringify(paramInitTx);
        console.log("paramInitTxJson: ", paramInitTxJson);
        resInitTx = await initPrivacyTx(paramInitTxJson);
        if (resInitTx === null || resInitTx === "") {
          throw new CustomError(ErrorObject.InitNormalTxErr, "Can not init transaction tranfering PRV");
        }
      }
      console.log("createAndSendNativeToken resInitTx: ", resInitTx);

      //base64 decode txjson
      let resInitTxBytes = base64Decode(resInitTx);

      // get b58 check encode tx json
      let b58CheckEncodeTx = checkEncode(resInitTxBytes.slice(0, resInitTxBytes.length - 8), ENCODE_VERSION);

      // get lock time tx
      let lockTimeBytes = resInitTxBytes.slice(resInitTxBytes.length - 8);
      let lockTime = new bn(lockTimeBytes).toNumber();

      await Wallet.updateProgressTx(60)
      console.time("Time for sending tx");
      let response;
      let listUTXOForPRV = [];
      try {
        response = await Wallet.RpcClient.sendRawTx(b58CheckEncodeTx);
      } catch (e) {
        console.log("createAndSendNativeToken Error when sending tx: ", e);
        throw new CustomError(ErrorObject.SendTxErr, "Can not send PRV transaction");
      }
      await Wallet.updateProgressTx(90)
      console.timeEnd("Time for sending tx");
      console.timeEnd("Time for create and send tx");

      // saving history tx
      // check status of tx and add coins to spending coins
      let status = FailedTx;
      if (response.txId) {
        // tx.txId = response.txId
        status = SuccessTx;

        response.typeTx = TxNormalType;
        response.feeNativeToken = feeBN.toNumber();
        response.lockTime = lockTime;
        response.amountNativeToken = totalAmountTransfer.toNumber();
        response.txStatus = status;

        // add spending list
        let spendingSNs = [];
        for (let i = 0; i < inputForTx.inputCoinStrs.length; i++) {
          spendingSNs.push(inputForTx.inputCoinStrs[i].SerialNumber);
          listUTXOForPRV.push(inputForTx.inputCoinStrs[i].SNDerivator);
        }
        this.addSpendingCoins({ txID: response.txId, spendingSNs: spendingSNs });
        console.log("createAndSendNativeToken Spending coin list after saving : ", this.spendingCoins);
      }

      // saving history tx
      this.saveNormalTxHistory(response, receiverPaymentAddrStr, false, isPrivacy, listUTXOForPRV, "");
      console.log("createAndSendNativeToken History account after saving: ", this.txHistory.NormalTx);

      await Wallet.updateProgressTx(100);
      return response;
    } catch (e) {
      await Wallet.updateProgressTx(0);
      console.log(e);
      throw e;
    }
  };

  // staking tx always send PRV to burning address with no privacy
  // type: 0 for shard
  // type: 1 for beacon
  /**
   * 
   * @param {{type: number}} param 
   * @param {number} feeNativeToken 
   * @param {string} candidatePaymentAddress 
   * @param {string} candidateMiningSeedKey 
   * @param {string} rewardReceiverPaymentAddress 
   * @param {bool} autoReStaking 
   */
  async createAndSendStakingTx(param, feeNativeToken, candidatePaymentAddress, candidateMiningSeedKey, rewardReceiverPaymentAddress, autoReStaking = true) {
    await Wallet.updateProgressTx(10);

    // get amount staking
    let amount;
    try {
      let response = await Wallet.RpcClient.getStakingAmount(param.type);
      amount = response.res;
    } catch (e) {
      console.log("createAndSendStakingTx Error get staking amount ", e);
      throw new CustomError(ErrorObject.GetStakingAmountErr, "Can not get staking amount before staking");
    }

    let amountBN = new bn(amount);
    let feeBN = new bn(feeNativeToken);

    // generate committee key
    let candidateKeyWallet = KeyWallet.base58CheckDeserialize(candidatePaymentAddress);
    let publicKeyBytes = candidateKeyWallet.KeySet.PaymentAddress.Pk;

    let candidateHashPrivateKeyBytes = checkDecode(candidateMiningSeedKey).bytesDecoded;

    let committeeKey;
    try {
      committeeKey = await generateCommitteeKeyFromHashPrivateKey(candidateHashPrivateKeyBytes, publicKeyBytes);
      console.log("createAndSendStakingTx committeeKey: ", committeeKey);
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

    let paramPaymentInfos = [
      {
        paymentAddressStr: BurnAddress,
        amount: amount
      }
    ]

    console.time("Time for create and send tx");
    try {
      // prepare input for tx
      console.time("Time for preparing input for staking tx");
      let inputForTx;
      try {
        inputForTx = await prepareInputForTx(amountBN, feeBN, false, null, this, Wallet.RpcClient);
        console.log("createAndSendStakingTx inputForTx: ", inputForTx);
      } catch (e) {
        throw e;
      }
      console.timeEnd("Time for preparing input for staking tx");

      await Wallet.updateProgressTx(30);

      let nOutput = paramPaymentInfos.length;
      if (inputForTx.totalValueInput.cmp(amountBN) === 1) {
        nOutput++;
      }

      let sndOutputStrs;
      let sndOutputs = new Array(nOutput);
      if (typeof randomScalars === "function") {
        sndOutputStrs = await randomScalars(nOutput.toString());
        if (sndOutputStrs === null || sndOutputStrs === "") {
          throw new Error("Can not random scalar for output coins");
        }
        let sndDecodes = base64Decode(sndOutputStrs);

        for (let i = 0; i < nOutput; i++) {
          let sndBytes = sndDecodes.slice(i * ED25519_KEY_SIZE, (i + 1) * ED25519_KEY_SIZE);
          sndOutputs[i] = checkEncode(sndBytes, ENCODE_VERSION);
        }
      }
      console.log("createAndSendStakingTx sndOutputs: ", sndOutputs);

      let paramInitTx = newParamInitTx(
        senderSkStr, paramPaymentInfos, inputForTx.inputCoinStrs,
        feeNativeToken, false, null, meta, "",
        inputForTx.commitmentIndices, inputForTx.myCommitmentIndices, inputForTx.commitmentStrs, sndOutputs);

      console.log("createAndSendStakingTx paramInitTx: ", paramInitTx);

      let resInitTx;
      if (typeof staking === "function") {
        let paramInitTxJson = JSON.stringify(paramInitTx);
        resInitTx = await staking(paramInitTxJson);
        if (resInitTx === null || resInitTx === "") {
          throw new CustomError(ErrorObject.InitNormalTxErr, "Can not init transaction tranfering PRV");
        }
      }

      console.log("createAndSendStakingTx resInitTx: ", resInitTx);

      //base64 decode txjson
      let resInitTxBytes = base64Decode(resInitTx);

      // get b58 check encode tx json
      let b58CheckEncodeTx = checkEncode(resInitTxBytes.slice(0, resInitTxBytes.length - 8), ENCODE_VERSION);

      // get lock time tx
      let lockTimeBytes = resInitTxBytes.slice(resInitTxBytes.length - 8);
      let lockTime = new bn(lockTimeBytes).toNumber();


      // await Wallet.updateProgressTx(60);
      // console.time("Time for sending tx");
      // let response;
      // let listUTXOForPRV = [];
      // try {
      //   console.log("Sending staking tx ..... ");
      //   response = await Wallet.RpcClient.sendRawTx(b58CheckEncodeTx);
      // } catch (e) {
      //   console.log("createAndSendStakingTx Error when sending tx: ", e);
      //   throw new CustomError(ErrorObject.SendTxErr, "Can not send PRV transaction");
      // }
      // await Wallet.updateProgressTx(90);
      // console.timeEnd("Time for sending tx");
      // console.timeEnd("Time for create and send tx");

      // // saving history tx
      // // check status of tx and add coins to spending coins
      // let status = FailedTx;
      // if (response.txId) {
      //   status = SuccessTx;
      //   response.typeTx = TxNormalType;
      //   response.feeNativeToken = feeBN.toNumber();
      //   response.lockTime = lockTime;
      //   response.amountNativeToken = amount;
      //   response.txStatus = status;

      //   // add spending list
      //   let spendingSNs = [];
      //   for (let i = 0; i < inputForTx.inputCoinStrs.length; i++) {
      //     spendingSNs.push(inputForTx.inputCoinStrs[i].SerialNumber);
      //     listUTXOForPRV.push(inputForTx.inputCoinStrs[i].SNDerivator);
      //   }
      //   this.addSpendingCoins({ txID: response.txId, spendingSNs: spendingSNs });
      //   console.log("createAndSendStakingTx Spending coin list after saving: ", this.spendingCoins);
      // }

      // // saving history tx
      // this.saveNormalTxHistory(response, BurnAddress, false, false, listUTXOForPRV, "");
      // console.log("createAndSendStakingTx History account after saving: ", this.txHistory.NormalTx);

      // await Wallet.updateProgressTx(100);
      // return response;
    } catch (e) {
      console.log("createAndSendStakingTx Error when create staking tx: ", e);
      throw e;
    }
  }

  /**
   * 
   * @param {{paymentAddressStr: string, amount: number}} paramPaymentInfosForNativeToken 
   * @param {{Privacy: bool, TokenID: string, TokenName: string, TokenSymbol: string, TokenTxType: bool, TokenAmount: number, TokenReceivers : {PaymentAddress: string, Amount: number}}} submitParam 
   * @param {number} feeNativeToken 
   * @param {number} feePToken 
   * @param {bool} hasPrivacyForNativeToken
   * @param {bool} hasPrivacyForPToken 
   * @param {string} info 
   */
  async createAndSendPrivacyToken(paramPaymentInfosForNativeToken = [], submitParam, feeNativeToken, feePToken, hasPrivacyForNativeToken, hasPrivacyForPToken, info = "") {
    await Wallet.updateProgressTx(10);

    let paymentInfoForPRV = new Array(paramPaymentInfosForNativeToken.length);
    let amountTransferPRV = new bn(0);
    for (let i = 0; i < paymentInfoForPRV.length; i++) {
      paymentInfoForPRV[i] = new PaymentInfo(
        KeyWallet.base58CheckDeserialize(paramPaymentInfosForNativeToken[i].paymentAddressStr).KeySet.PaymentAddress,
        new bn(paramPaymentInfosForNativeToken[i].amount)
      );
      amountTransferPRV = amountTransferPRV.add(new bn(paramPaymentInfosForNativeToken[i].amount));
    }

    // token param
    // get current token to get token param
    let tokenParamJson = {
      propertyID: submitParam.TokenID,
      propertyName: submitParam.TokenName,
      propertySymbol: submitParam.TokenSymbol,
      amount: submitParam.TokenAmount,
      tokenTxType: submitParam.TokenTxType,
      fee: feePToken,
      paymentInfoForPToken: [{
        paymentAddressStr: submitParam.TokenReceivers.PaymentAddress,
        amount: submitParam.TokenReceivers.Amount
      }],
      tokenInputs: [],
    };

    console.log("createAndSendPrivacyToken tokenParamJson: ", tokenParamJson);

    let amountTransferPToken = new bn(submitParam.TokenReceivers.Amount)

    let senderSkStr = this.key.base58CheckSerialize(PriKeyType);

    // try {
    console.log("Preparing input for normal tx ....")
    let inputForTx;
    try {
      console.time("Time for preparing input for custom token tx");
      inputForTx = await prepareInputForTx(amountTransferPRV, new bn(feeNativeToken), hasPrivacyForNativeToken, null, this, Wallet.RpcClient);
      console.timeEnd("Time for preparing input for custom token tx");
    } catch (e) {
      throw e;
    }
    await Wallet.updateProgressTx(30);

    let inputForPrivacyTokenTx;
    try {
      console.log("Preparing input for privacy custom token tx ....")
      inputForPrivacyTokenTx = await prepareInputForTxPrivacyToken(tokenParamJson, this, Wallet.RpcClient, new bn(feePToken), hasPrivacyForPToken);
    } catch (e) {
      throw e;
    }
    await Wallet.updateProgressTx(50);
    tokenParamJson.tokenInputs = inputForPrivacyTokenTx.tokenInputs;
    console.log("createAndSendPrivacyToken tokenParamJson: ", tokenParamJson);

    // verify tokenID if transfering token
    let listCustomTokens = inputForPrivacyTokenTx.listPrivacyToken;
    if (submitParam.TokenTxType === CustomTokenTransfer) {
      let i = 0;
      for (i = 0; i < listCustomTokens.length; i++) {
        if (listCustomTokens[i].ID.toLowerCase() === tokenParamJson.propertyID) {
          break;
        }
      }
      if (i === listCustomTokens.length) {
        throw new Error("invalid token ID")
      }
    }

    let nOutputForNativeToken = paramPaymentInfosForNativeToken.length;
    if (inputForTx.totalValueInput.cmp(amountTransferPRV) === 1) {
      nOutputForNativeToken++;
    }

    // random snd for output native token
    let sndOutputStrsForNativeToken;
    let sndOutputsForNativeToken = new Array(nOutputForNativeToken);
    if (typeof randomScalars === "function") {
      sndOutputStrsForNativeToken = await randomScalars(nOutputForNativeToken.toString());
      if (sndOutputStrsForNativeToken === null || sndOutputStrsForNativeToken === "") {
        throw new Error("Can not random scalar for native token outputs");
      }
      let sndDecodes = base64Decode(sndOutputStrsForNativeToken);

      for (let i = 0; i < nOutputForNativeToken; i++) {
        let sndBytes = sndDecodes.slice(i * ED25519_KEY_SIZE, (i + 1) * ED25519_KEY_SIZE);
        sndOutputsForNativeToken[i] = checkEncode(sndBytes, ENCODE_VERSION);
      }
    }
    console.log("createAndSendPrivacyToken sndOutputsForNativeToken: ", sndOutputsForNativeToken);

    // random snd for output native token
    let nOutputForPToken = tokenParamJson.paymentInfoForPToken.length;
    if (inputForPrivacyTokenTx.totalValueInput.cmp(amountTransferPToken) === 1) {
      nOutputForPToken++;
    }

    let sndOutputStrsForPToken;
    let sndOutputsForPToken = new Array(nOutputForPToken);
    if (typeof randomScalars === "function") {
      sndOutputStrsForPToken = await randomScalars(nOutputForPToken.toString());
      if (sndOutputStrsForPToken === null || sndOutputStrsForPToken === "") {
        throw new Error("Can not random scalar for privacy token outputs");
      }
      let sndDecodes = base64Decode(sndOutputStrsForPToken);

      for (let i = 0; i < nOutputForPToken; i++) {
        let sndBytes = sndDecodes.slice(i * ED25519_KEY_SIZE, (i + 1) * ED25519_KEY_SIZE);
        sndOutputsForPToken[i] = checkEncode(sndBytes, ENCODE_VERSION);
      }
    }
    console.log("createAndSendPrivacyToken sndOutputsForPToken: ", sndOutputsForPToken);


    let paramInitTx = newParamInitPrivacyTokenTx(
      senderSkStr, paymentInfoForPRV, inputForTx.inputCoinStrs,
      feeNativeToken, hasPrivacyForNativeToken, hasPrivacyForPToken, tokenParamJson, null, info,
      inputForTx.commitmentIndices, inputForTx.myCommitmentIndices, inputForTx.commitmentStrs, sndOutputsForNativeToken,
      inputForPrivacyTokenTx.commitmentIndices, inputForPrivacyTokenTx.myCommitmentIndices, inputForPrivacyTokenTx.commitmentStrs, sndOutputsForPToken
    );

    console.log("createAndSendPrivacyToken paramInitTx: ", paramInitTx);

    let resInitTx;
    if (typeof initPrivacyTokenTx === "function") {
      let paramInitTxJson = JSON.stringify(paramInitTx);
      resInitTx = await initPrivacyTokenTx(paramInitTxJson);
      if (resInitTx === null || resInitTx === "") {
        throw new CustomError(ErrorObject.InitNormalTxErr, "Can not init transaction tranfering PRV");
      }
    }

    console.log("createAndSendPrivacyToken resInitTx: ", resInitTx);

    //base64 decode txjson
    let resInitTxBytes = base64Decode(resInitTx);

    // get b58 check encode tx json
    let b58CheckEncodeTx = checkEncode(resInitTxBytes.slice(0, resInitTxBytes.length - 40), ENCODE_VERSION);

    // get lock time tx
    let lockTimeBytes = resInitTxBytes.slice(resInitTxBytes.length - 40, resInitTxBytes.length - 32);
    let lockTime = new bn(lockTimeBytes).toNumber();
    let tokenIDBytes = resInitTxBytes.slice(resInitTxBytes.length - 32);
    let tokenID = convertHashToStr(tokenIDBytes).toLowerCase();
    console.log("createAndSendPrivacyToken tokenID: ", tokenID);

    // verify tokenID if initing token
    if (submitParam.TokenTxType === CustomTokenInit) {
      // validate PropertyID is the only one
      for (let i = 0; i < listCustomTokens.length; i++) {
        if (tokenID === listCustomTokens[i].ID.toLowerCase()) {
          throw new Error("privacy token privacy is existed");
        }
      }
    }

    await Wallet.updateProgressTx(80);

    let response;
    try {
      response = await Wallet.RpcClient.sendRawTxCustomTokenPrivacy(b58CheckEncodeTx);
    } catch (e) {
      throw new CustomError(ErrorObject.SendTxErr, "Can not send privacy token tx");
    }

    await Wallet.updateProgressTx(90);
    // saving history tx
    // check status of tx
    let listUTXOForPRV = [];
    let listUTXOForPToken = [];
    // check status of tx and add coins to spending coins
    let status = FailedTx;
    if (response.txId) {
      status = SuccessTx;
      response.typeTx = TxCustomTokenPrivacyType;
      response.feeNativeToken = new bn(feeNativeToken).toNumber();
      response.feePToken = new bn(feePToken).toNumber();
      response.lockTime = lockTime;
      response.amountNativeToken = amountTransferPRV.toNumber();
      response.amountPToken = amountTransferPToken.toNumber();
      response.txStatus = status;
      response.tokenName = tokenParamJson.propertyName;
      response.tokenID = tokenID;
      response.tokenSymbol = tokenParamJson.propertySymbol;

      // add spending list
      let spendingSNs = [];
      for (let i = 0; i < inputForTx.inputCoinStrs.length; i++) {
        spendingSNs.push(inputForTx.inputCoinStrs[i].SerialNumber);
        listUTXOForPRV.push(inputForTx.inputCoinStrs[i].SNDerivator);
      }

      for (let i = 0; i < inputForPrivacyTokenTx.inputCoinStrs.length; i++) {
        listUTXOForPToken.push(inputForPrivacyTokenTx.inputCoinStrs[i].SNDerivator);
      }
      this.addSpendingCoins({ txID: response.txId, spendingSNs: spendingSNs });
      console.log("createAndSendPrivacyToken Spending coin list after saving: ", this.spendingCoins);

      // add to following token list if tx is init token
      if (submitParam.TokenTxType === CustomTokenInit) {
        let identicon = await Wallet.RpcClient.hashToIdenticon([tokenID]);
        this.addFollowingToken({
          ID: tokenID,
          Image: identicon.images[0],
          Name: tokenParamJson.propertyName,
          Symbol: tokenParamJson.propertySymbol,
          Amount: tokenParamJson.amount,
          IsPrivacy: true,
          isInit: true,
          metaData: {},
        });
        console.log("createAndSendPrivacyToken List following token after adding: ", this.followingTokens);
      }
    }

    // check is init or transfer token
    let isIn;
    if (submitParam.TokenTxType === CustomTokenInit) {
      isIn = true;
    } else {
      isIn = false;
    }

    this.savePrivacyTokenTxHistory(response, [submitParam.TokenReceivers.PaymentAddress], isIn, hasPrivacyForNativeToken, hasPrivacyForPToken, listUTXOForPRV, listUTXOForPToken, "");
    await Wallet.updateProgressTx(100);
    return response;
  };

  // TODO: need to update later
  // collect UTXOs have value that less than {amount} mili constant to one UTXO
  // async defragment(amount, fee, isPrivacy) {
  //   await Wallet.updateProgressTx(10);
  //   amount = new bn(amount);
  //   fee = new bn(fee);

  //   let senderSkStr = this.key.base58CheckSerialize(PriKeyType);
  //   let senderPaymentAddressStr = this.key.base58CheckSerialize(PaymentAddressType);

  //   // totalAmount was paid for fee
  //   let defragmentUTXO, defragmentUTXOStr, totalAmount;
  //   console.time("getUTXOsToDefragment")
  //   try {
  //     let result = await getUTXOsToDefragment(senderSkStr, fee, this, amount, Wallet.RpcClient);
  //     console.log("getUTXOsToDefragment Done");
  //     defragmentUTXO = result.defragmentUTXO;
  //     defragmentUTXOStr = result.defragmentUTXOStr;
  //     totalAmount = result.totalAmount;
  //   } catch (e) {
  //     console.log("Error get UTXO to defragment: ", e);
  //     throw new CustomError(ErrorObject.PrepareInputNormalTxErr, "Can not get UTXO to defragment");
  //   }
  //   console.timeEnd("getUTXOsToDefragment");

  //   await Wallet.updateProgressTx(40);

  //   // create paymentInfos
  //   let paymentInfos = new Array(1);
  //   paymentInfos[0] = new PaymentInfo(
  //     this.key.KeySet.PaymentAddress,
  //     totalAmount
  //   );
  //   let receiverPaymentAddrStr = new Array(1);
  //   receiverPaymentAddrStr[0] = senderPaymentAddressStr;

  //   // init tx
  //   let tx = new Tx(Wallet.RpcClient);
  //   try {
  //     console.time("Time for creating tx");
  //     await tx.init(this.key.KeySet.PrivateKey, senderPaymentAddressStr, paymentInfos,
  //       defragmentUTXO, defragmentUTXOStr, fee, isPrivacy, null, null);
  //     console.timeEnd("Time for creating tx");
  //   } catch (e) {
  //     console.timeEnd("Time for creating tx");
  //     console.log("ERR when creating tx: ", e);
  //     throw new CustomError(ErrorObject.InitNormalTxErr, "Can not init defragment tx");
  //   }

  //   await Wallet.updateProgressTx(70);

  //   let response;
  //   try {
  //     response = await Wallet.RpcClient.sendRawTx(tx);
  //   } catch (e) {
  //     console.log("ERR when sending defragment tx: ", e);
  //     throw new CustomError(ErrorObject.SendTxErr, "Can not send defragment tx");
  //   }

  //   await Wallet.updateProgressTx(90)

  //   console.log("SENDING CONSTANT DONE!!!!");
  //   console.timeEnd("Time for create and send tx");

  //   // check status of tx
  //   let status = FailedTx;
  //   if (response.txId) {
  //     tx.txId = response.txId;
  //     status = SuccessTx;

  //     response.type = tx.type;
  //     response.fee = tx.fee;
  //     response.lockTime = tx.lockTime;
  //     response.amount = amount;
  //     response.txStatus = status;

  //     let spendingSNs = [];
  //     for (let i = 0; i < defragmentUTXO.length; i++) {
  //       spendingSNs.push(defragmentUTXO[i].coinDetails.serialNumber.compress())
  //     }
  //     this.addSpendingCoins({ txID: response.txId, spendingSNs: spendingSNs });
  //   }

  //   await Wallet.updateProgressTx(100);
  //   return response;
  // }

  // async cancelTx(txId, newFee, newFeePToken) {
  //   // get tx history by txID
  //   let txHistory = this.getTxHistoryByTxID(txId);

  //   // check type of tx
  //   let isNormalTx = true;
  //   if (txHistory.tokenID !== '') {
  //     isNormalTx = false;
  //   }

  //   let response;
  //   if (isNormalTx) {
  //     try {
  //       response = await this.cancelTxNormal(txHistory, newFee);
  //     } catch (e) {
  //       throw e;
  //     }
  //   } else {
  //     try {
  //       response = await this.cancelTxPToken(txHistory, newFee, newFeePToken);
  //     } catch (e) {
  //       throw e;
  //     }
  //   }
  //   return response;
  // }

  // async cancelTxNormal(txHistory, newFee) {
  //   // check new fee (just for PRV)
  //   if (newFee < txHistory.fee + Math.ceil(PercentFeeToCancelTx * txHistory.fee)) {
  //     throw new error("New fee must be greater than 10% old fee")
  //   }

  //   // get UTXO
  //   let listUTXO = txHistory.listUTXOForPRV;

  //   console.log("listUTXO :", listUTXO)
  //   let tokenID = 'constant';
  //   let listInputCoins = [];
  //   let listInputCoinStrs = [];
  //   for (let i = 0; i < listUTXO.length; i++) {
  //     const sndStr = `${tokenID}_${listUTXO[i]}`;
  //     listInputCoins.push(this.inputCoinCached[sndStr]);
  //     listInputCoinStrs.push(this.inputCoinJsonCached[sndStr])
  //   }

  //   // sender address
  //   let paymentAddressStr = this.key.base58CheckSerialize(PaymentAddressType);

  //   let paymentInfos = new Array(1);
  //   paymentInfos[0] = new PaymentInfo(
  //     KeyWallet.base58CheckDeserialize(txHistory.receivers[0]).KeySet.PaymentAddress,
  //     new bn(txHistory.amount)
  //   );

  //   // init tx
  //   await Wallet.updateProgressTx(30)

  //   // init tx
  //   let tx = new Tx(Wallet.RpcClient);
  //   try {
  //     console.time("Time for creating tx");
  //     await tx.init(this.key.KeySet.PrivateKey, paymentAddressStr, paymentInfos,
  //       listInputCoins, listInputCoinStrs, new bn(newFee), txHistory.isPrivacy, null, null)
  //     console.timeEnd("Time for creating tx");
  //   } catch (e) {
  //     console.log("ERR when creating tx: ", e);
  //     throw e;
  //   }

  //   await Wallet.updateProgressTx(60)

  //   let response;
  //   try {
  //     response = await Wallet.RpcClient.sendRawTx(tx);
  //   } catch (e) {
  //     throw e;
  //   }
  //   await Wallet.updateProgressTx(90)

  //   console.log("SENDING CONSTANT DONE!!!!");
  //   console.timeEnd("Time for create and send tx");

  //   // saving history tx
  //   console.log("Saving tx history.....");
  //   console.time("Saving tx history: ");

  //   // check status of tx and add coins to spending coins
  //   let status = FailedTx;
  //   if (response.txId) {
  //     tx.txId = response.txId
  //     status = SuccessTx;

  //     response.type = tx.type;
  //     response.fee = tx.fee;
  //     response.lockTime = tx.lockTime;
  //     response.amount = txHistory.amount;
  //     response.txStatus = status;

  //     let spendingSNs = [];
  //     for (let i = 0; i < listInputCoins.length; i++) {
  //       spendingSNs.push(listInputCoins[i].coinDetails.serialNumber.compress())
  //     }
  //     this.addSpendingCoins({ txID: response.txId, spendingSNs: spendingSNs });
  //   }

  //   this.saveNormalTxHistory(tx, txHistory.amount, txHistory.receivers, status, false, txHistory.isPrivacy, listUTXO, txHistory.txID);
  //   console.log("history after saving: ", this.txHistory);

  //   console.timeEnd("Saving tx history: ");

  //   await Wallet.updateProgressTx(100);
  //   return response;
  // }

  // async cancelTxPToken(txHistory, newFee, newFeePToken) {
  //   // check new fee
  //   if (newFee < txHistory.fee + Math.ceil(PercentFeeToCancelTx * txHistory.fee) &&
  //     newFeePToken < txHistory.feePToken + Math.ceil(PercentFeeToCancelTx * txHistory.feePToken)) {
  //     throw new error("New fee must be greater than 10% old fee")
  //   }

  //   // get UTXO
  //   let listUTXO = txHistory.listUTXOForPRV;
  //   let listUTXOForPToken = txHistory.listUTXOForPToken;

  //   let tokenID = 'constant';
  //   let listInputCoins = [];
  //   let listInputCoinStrs = [];
  //   for (let i = 0; i < listUTXO.length; i++) {
  //     const sndStr = `${tokenID}_${listUTXO[i]}`;
  //     listInputCoins.push(this.inputCoinCached[sndStr]);
  //     listInputCoinStrs.push(this.inputCoinJsonCached[sndStr])
  //   }

  //   console.log("HHHH listInputCoins: ", listInputCoins);
  //   console.log("HHHH listInputCoinStrs: ", listInputCoinStrs);

  //   let listInputCoinsForPToken = [];
  //   let listInputCoinStrsForPToken = [];
  //   for (let i = 0; i < listUTXOForPToken.length; i++) {
  //     const sndStr = `${txHistory.tokenID}_${listUTXOForPToken[i]}`;
  //     listInputCoinsForPToken.push(this.inputCoinCached[sndStr]);
  //     listInputCoinStrsForPToken.push(this.inputCoinJsonCached[sndStr]);
  //   }

  //   console.log("HHHH listInputCoinsForPToken: ", listInputCoinsForPToken);
  //   console.log("HHHH listInputCoinStrsForPToken: ", listInputCoinStrsForPToken);

  //   // sender address
  //   let paymentAddressStr = this.key.base58CheckSerialize(PaymentAddressType);

  //   let paymentInfos = new Array(1);
  //   paymentInfos[0] = new PaymentInfo(
  //     KeyWallet.base58CheckDeserialize(txHistory.receivers[0]).KeySet.PaymentAddress,
  //     new bn(txHistory.amount)
  //   );

  //   // prepare token param
  //   let tokenParams = new PrivacyTokenParamTx();
  //   tokenParams.propertyID = txHistory.tokenID;
  //   tokenParams.propertyName = txHistory.tokenName;
  //   tokenParams.propertySymbol = txHistory.tokenSymbol;
  //   tokenParams.amount = 0;
  //   tokenParams.tokenInputs = listInputCoinsForPToken;

  //   if (txHistory.isIn) {
  //     tokenParams.tokenTxType = CustomTokenInit;
  //   } else {
  //     tokenParams.tokenTxType = CustomTokenTransfer;
  //   }

  //   // get list privacy tokens
  //   let resp;
  //   try {
  //     resp = await Wallet.RpcClient.listPrivacyCustomTokens();
  //   } catch (e) {
  //     throw e;
  //   }
  //   let listPrivacyToken = resp.listPrivacyToken;

  //   tokenParams.receivers = new Array(1);
  //   tokenParams.receivers[0] = new PaymentInfo(
  //     KeyWallet.base58CheckDeserialize(
  //       txHistory.receivers[0]
  //     ).KeySet.PaymentAddress,
  //     new bn(txHistory.amount)
  //   );

  //   // init tx
  //   await Wallet.updateProgressTx(30)

  //   // init tx
  //   let tx = new TxCustomTokenPrivacy(Wallet.RpcClient);
  //   try {
  //     console.time("Time for creating tx");
  //     await tx.init(this.key.KeySet.PrivateKey, paymentAddressStr, [],
  //       listInputCoins, listInputCoinStrs, new bn(newFee), new bn(newFeePToken), tokenParams, listPrivacyToken, null, txHistory.isPrivacy)
  //     console.timeEnd("Time for creating tx");
  //   } catch (e) {
  //     console.log("ERR when creating tx: ", e);
  //     throw e;
  //   }

  //   await Wallet.updateProgressTx(80);

  //   let response;
  //   try {
  //     response = await Wallet.RpcClient.sendRawTxCustomTokenPrivacy(tx);
  //   } catch (e) {
  //     throw e;
  //   }

  //   await Wallet.updateProgressTx(90);
  //   // saving history tx
  //   // check status of tx
  //   console.log("Saving privacy custom token tx ....")
  //   let status = FailedTx;
  //   if (response.txId) {
  //     tx.txId = response.txId
  //     status = SuccessTx;

  //     response.type = tx.type;
  //     response.fee = tx.fee;
  //     response.lockTime = tx.lockTime;
  //     response.txStatus = status;

  //     response.propertyName = tx.txTokenPrivacyData.propertyName;
  //     response.propertyID = tx.txTokenPrivacyData.propertyID;
  //     response.propertySymbol = tx.txTokenPrivacyData.propertySymbol;

  //     // add to following token list if tx is init token
  //     if (tx.txTokenPrivacyData.type === CustomTokenInit) {
  //       let identicon = await Wallet.RpcClient.hashToIdenticon([tx.txTokenPrivacyData.propertyID]);
  //       const { txTokenPrivacyData } = tx
  //       this.addFollowingToken({
  //         ID: txTokenPrivacyData.propertyID,
  //         Image: identicon.images[0],
  //         Name: txTokenPrivacyData.propertyName,
  //         Symbol: txTokenPrivacyData.propertySymbol,
  //         Amount: txTokenPrivacyData.amount,
  //         IsPrivacy: true,
  //         isInit: true
  //       });
  //       console.log("List following token after adding: ", this.followingTokens);
  //     }

  //     let spendingSNs = [];
  //     for (let i = 0; i < listInputCoins.length; i++) {
  //       spendingSNs.push(listInputCoins[i].coinDetails.serialNumber.compress())
  //     }

  //     let object = {};
  //     object.txID = response.txId;
  //     object.spendingSNs = spendingSNs;

  //     this.addSpendingCoins(object);
  //   }

  //   this.savePrivacyTokenTxHistory(tx, txHistory.receivers, status, txHistory.isIn, txHistory.amount, txHistory.listUTXOForPRV, txHistory.listUTXOForPToken, txHistory.txID);
  //   console.log("History HHHHH: ", this.txHistory);
  //   await Wallet.updateProgressTx(100);
  //   return response;
  // }

  // createAndSendBurningRequestTx create and send tx burning ptoken when withdraw
  // remoteAddress (string) is an ETH/BTC address which users want to receive ETH/BTC (without 0x)
  /**
   * 
   * @param {...{paymentAddressStr: string, amount: number}} paramPaymentInfosForNativeToken 
   * @param {{Privacy: bool, TokenID: string, TokenName: string, TokenSymbol: string, TokenTxType: bool, TokenAmount: number, TokenReceivers : {PaymentAddress: string, Amount: number}}} submitParam 
   * @param {number} feeNativeToken 
   * @param {number} feePToken 
   * @param {string} remoteAddress 
   */
  async createAndSendBurningRequestTx(paramPaymentInfosForNativeToken = [], submitParam, feeNativeToken, feePToken, remoteAddress) {
    if (remoteAddress.startsWith("0x")) {
      remoteAddress = remoteAddress.slice(2);
    }

    await Wallet.updateProgressTx(10);

    let paymentInfoForPRV = new Array(paramPaymentInfosForNativeToken.length);
    let amountTransferPRV = new bn(0);
    for (let i = 0; i < paymentInfoForPRV.length; i++) {
      paymentInfoForPRV[i] = new PaymentInfo(
        KeyWallet.base58CheckDeserialize(paramPaymentInfosForNativeToken[i].paymentAddressStr).KeySet.PaymentAddress,
        new bn(paramPaymentInfosForNativeToken[i].amount)
      );
      amountTransferPRV = amountTransferPRV.add(new bn(paramPaymentInfosForNativeToken[i].amount));
    }

    // token param
    // get current token to get token param
    let tokenParamJson = {
      propertyID: submitParam.TokenID,
      propertyName: submitParam.TokenName,
      propertySymbol: submitParam.TokenSymbol,
      amount: submitParam.TokenAmount,
      tokenTxType: submitParam.TokenTxType,
      fee: feePToken,
      paymentInfoForPToken: [{
        paymentAddressStr: BurnAddress,
        amount: submitParam.TokenReceivers.Amount
      }],
      tokenInputs: [],
    };

    console.log("createAndSendBurningRequestTx tokenParamJson: ", tokenParamJson);

    let amountTransferPToken = new bn(submitParam.TokenReceivers.Amount)

    let senderSkStr = this.key.base58CheckSerialize(PriKeyType);
    let paymentAddressStr = this.key.base58CheckSerialize(PaymentAddressType);

    let inputForTx;
    try {
      console.time("Time for preparing input for custom token tx");
      inputForTx = await prepareInputForTx(amountTransferPRV, new bn(feeNativeToken), false, null, this, Wallet.RpcClient);
      console.timeEnd("Time for preparing input for custom token tx");
    } catch (e) {
      throw e;
    }
    await Wallet.updateProgressTx(30);

    let inputForPrivacyTokenTx;
    try {
      inputForPrivacyTokenTx = await prepareInputForTxPrivacyToken(tokenParamJson, this, Wallet.RpcClient, new bn(feePToken));
    } catch (e) {
      throw e;
    }
    await Wallet.updateProgressTx(50);

    tokenParamJson.tokenInputs = inputForPrivacyTokenTx.tokenInputs;
    console.log("createAndSendBurningRequestTx tokenParamJson: ", tokenParamJson);

    // verify tokenID is valid or not
    let listCustomTokens = inputForPrivacyTokenTx.listPrivacyToken;
    let k = 0;
    for (k = 0; k < listCustomTokens.length; k++) {
      if (listCustomTokens[k].ID.toLowerCase() === tokenParamJson.propertyID) {
        break;
      }
    }
    if (k === listCustomTokens.length) {
      throw new Error("invalid token ID")
    }

    let nOutputForNativeToken = paramPaymentInfosForNativeToken.length;
    if (inputForTx.totalValueInput.cmp(amountTransferPRV) === 1) {
      nOutputForNativeToken++;
    }

    // random snd for output native token
    let sndOutputStrsForNativeToken;
    let sndOutputsForNativeToken = new Array(nOutputForNativeToken);
    if (typeof randomScalars === "function") {
      sndOutputStrsForNativeToken = await randomScalars(nOutputForNativeToken.toString());
      if (sndOutputStrsForNativeToken === null || sndOutputStrsForNativeToken === "") {
        throw new Error("Can not random scalar for native token output");
      }
      let sndDecodes = base64Decode(sndOutputStrsForNativeToken);

      for (let i = 0; i < nOutputForNativeToken; i++) {
        let sndBytes = sndDecodes.slice(i * ED25519_KEY_SIZE, (i + 1) * ED25519_KEY_SIZE);
        sndOutputsForNativeToken[i] = checkEncode(sndBytes, ENCODE_VERSION);
      }
    }
    console.log("createAndSendBurningRequestTx sndOutputsForNativeToken: ", sndOutputsForNativeToken);

    // random snd for output native token
    let nOutputForPToken = tokenParamJson.paymentInfoForPToken.length;
    if (inputForPrivacyTokenTx.totalValueInput.cmp(amountTransferPToken) === 1) {
      nOutputForPToken++;
    }

    let sndOutputStrsForPToken;
    let sndOutputsForPToken = new Array(nOutputForPToken);
    if (typeof randomScalars === "function") {
      sndOutputStrsForPToken = await randomScalars(nOutputForPToken.toString());
      if (sndOutputStrsForPToken === null || sndOutputStrsForPToken === "") {
        throw new Error("Can not random scalar for privacy token output");
      }
      let sndDecodes = base64Decode(sndOutputStrsForPToken);

      for (let i = 0; i < nOutputForPToken; i++) {
        let sndBytes = sndDecodes.slice(i * ED25519_KEY_SIZE, (i + 1) * ED25519_KEY_SIZE);
        sndOutputsForPToken[i] = checkEncode(sndBytes, ENCODE_VERSION);
      }
    }
    console.log("createAndSendBurningRequestTx sndOutputsForPToken: ", sndOutputsForPToken);

    // prepare meta data for tx
    let burningReqMetadata = {
      BurnerAddress: paymentAddressStr,
      BurningAmount: submitParam.TokenReceivers.Amount,
      TokenID: tokenParamJson.propertyID,
      TokenName: tokenParamJson.propertyName,
      RemoteAddress: remoteAddress,
      Type: BurningRequestMeta
    };

    let paramInitTx = newParamInitPrivacyTokenTx(
      senderSkStr, paramPaymentInfosForNativeToken, inputForTx.inputCoinStrs,
      feeNativeToken, false, false, tokenParamJson, burningReqMetadata, "",
      inputForTx.commitmentIndices, inputForTx.myCommitmentIndices, inputForTx.commitmentStrs, sndOutputsForNativeToken,
      inputForPrivacyTokenTx.commitmentIndices, inputForPrivacyTokenTx.myCommitmentIndices, inputForPrivacyTokenTx.commitmentStrs, sndOutputsForPToken
    );

    console.log("createAndSendBurningRequestTx paramInitTx: ", paramInitTx);

    let resInitTx;
    if (typeof initBurningRequestTx === "function") {
      let paramInitTxJson = JSON.stringify(paramInitTx);
      resInitTx = await initBurningRequestTx(paramInitTxJson);
      if (resInitTx === null || resInitTx === "") {
        throw new CustomError(ErrorObject.InitNormalTxErr, "Can not init transaction tranfering PRV");
      }
    }

    console.log("createAndSendBurningRequestTx resInitTx: ", resInitTx);

    //base64 decode txjson
    let resInitTxBytes = base64Decode(resInitTx);

    // get b58 check encode tx json
    let b58CheckEncodeTx = checkEncode(resInitTxBytes.slice(0, resInitTxBytes.length - 40), ENCODE_VERSION);

    // get lock time tx
    let lockTimeBytes = resInitTxBytes.slice(resInitTxBytes.length - 40, resInitTxBytes.length - 32);
    let lockTime = new bn(lockTimeBytes).toNumber();
    let tokenIDBytes = resInitTxBytes.slice(resInitTxBytes.length - 32);
    let tokenID = convertHashToStr(tokenIDBytes).toLowerCase();
    console.log("createAndSendBurningRequestTx tokenID: ", tokenID);

    await Wallet.updateProgressTx(80);

    let response;
    try {
      response = await Wallet.RpcClient.sendRawTxCustomTokenPrivacy(b58CheckEncodeTx);
    } catch (e) {
      throw new CustomError(ErrorObject.SendTxErr, "Can not send privacy token tx");
    }

    await Wallet.updateProgressTx(90);
    // saving history tx
    // check status of tx
    let listUTXOForPRV = [];
    let listUTXOForPToken = [];
    // check status of tx and add coins to spending coins
    let status = FailedTx;
    if (response.txId) {
      status = SuccessTx;
      response.typeTx = TxCustomTokenPrivacyType;
      response.feeNativeToken = new bn(feeNativeToken).toNumber();
      response.feePToken = new bn(feePToken).toNumber();
      response.lockTime = lockTime;
      response.amountNativeToken = amountTransferPRV.toNumber();
      response.amountPToken = amountTransferPToken.toNumber();
      response.txStatus = status;
      response.tokenName = tokenParamJson.propertyName;
      response.tokenID = tokenID;
      response.tokenSymbol = tokenParamJson.propertySymbol;

      // add spending list
      let spendingSNs = [];
      for (let i = 0; i < inputForTx.inputCoinStrs.length; i++) {
        spendingSNs.push(inputForTx.inputCoinStrs[i].SerialNumber);
        listUTXOForPRV.push(inputForTx.inputCoinStrs[i].SNDerivator);
      }

      for (let i = 0; i < inputForPrivacyTokenTx.inputCoinStrs.length; i++) {
        listUTXOForPToken.push(inputForPrivacyTokenTx.inputCoinStrs[i].SNDerivator)
      }
      this.addSpendingCoins({ txID: response.txId, spendingSNs: spendingSNs });
      console.log("createAndSendBurningRequestTx Spending coin list after saving: ", this.spendingCoins);
    }

    let isIn = false;
    this.savePrivacyTokenTxHistory(response, [BurnAddress], isIn, false, false, listUTXOForPRV, listUTXOForPToken, "");
    await Wallet.updateProgressTx(100);
    return response;
  };

  // getRewardAmount returns amount rewards
  // if isGetAll is true: return all of reward types (such as PRV, pToken,..)
  /**
   * 
   * @param {string} paymentAddrStr 
   * @param {bool} isGetAll 
   * @param {string} tokenID 
   * @returns {number} (if isGetAll = false)
   * @returns {map[TokenID] : number} (if isGetAll = true)
   */
  static async getRewardAmount(paymentAddrStr, isGetAll = true, tokenID = "") {
    let resp;
    try {
      resp = await Wallet.RpcClient.getRewardAmount(paymentAddrStr);
    } catch (e) {
      console.log("getRewardAmount Error: ", e);
      throw new CustomError(ErrorObject.GetRewardAmountErr, "Can not get reward amount");
    }

    if (isGetAll) {
      return resp.rewards;
    } else {
      if (tokenID === "") {
        tokenID = "PRV";
      }

      return resp.rewards[tokenID];
    }
  }

  // createAndSendWithdrawRewardTx create and send tx withdraw reward amount
  /**
   * 
   * @param {string} tokenID 
   */
  async createAndSendWithdrawRewardTx(tokenID = "") {
    console.log("AAA tokenID 1: ", tokenID);
    if (tokenID === "") {
      tokenID = convertHashToStr(PRVID)
    }

    let senderSkStr = this.key.base58CheckSerialize(PriKeyType);
    let paymentAddressStr = this.key.base58CheckSerialize(PaymentAddressType);

    let metaData = {
      Type: WithDrawRewardRequestMeta,
      PaymentAddress: paymentAddressStr,
      TokenID: tokenID
    }
    let isPrivacy = false;

    console.time("Time for create and send tx");
    try {
      // prepare input for tx
      console.time("Time for preparing input for tx");
      let inputForTx;
      try {
        inputForTx = await prepareInputForTx(new bn(0), new bn(0), isPrivacy, null, this, Wallet.RpcClient);
      } catch (e) {
        throw e;
      }

      console.log("createAndSendWithdrawRewardTx inputForTx: ", inputForTx);
      console.timeEnd("Time for preparing input for tx");

      await Wallet.updateProgressTx(30)

      let sndOutputs = [];

      let paramInitTx = newParamInitTx(
        senderSkStr, [], inputForTx.inputCoinStrs,
        0, isPrivacy, null, metaData, "",
        inputForTx.commitmentIndices, inputForTx.myCommitmentIndices, inputForTx.commitmentStrs, sndOutputs);

      console.log("createAndSendWithdrawRewardTx paramInitTx: ", paramInitTx);

      let resInitTx;
      if (typeof initWithdrawRewardTx === "function") {
        let paramInitTxJson = JSON.stringify(paramInitTx);
        resInitTx = await initWithdrawRewardTx(paramInitTxJson);
        if (resInitTx === null || resInitTx === "") {
          throw new CustomError(ErrorObject.InitNormalTxErr, "Can not init transaction tranfering PRV");
        }
      }

      console.log("createAndSendWithdrawRewardTx resInitTx: ", resInitTx);

      // //base64 decode txjson
      // let resInitTxBytes = base64Decode(resInitTx);

      // // get b58 check encode tx json
      // let b58CheckEncodeTx = checkEncode(resInitTxBytes.slice(0, resInitTxBytes.length - 8), ENCODE_VERSION);

      // // get lock time tx
      // let lockTimeBytes = resInitTxBytes.slice(resInitTxBytes.length - 8);
      // let lockTime = new bn(lockTimeBytes).toNumber();

      // await Wallet.updateProgressTx(60)
      // console.time("Time for sending tx");
      // let response;
      // try {
      //   response = await Wallet.RpcClient.sendRawTx(b58CheckEncodeTx);
      // } catch (e) {
      //   console.log("createAndSendWithdrawRewardTx Error when sending tx: ", e);
      //   throw new CustomError(ErrorObject.SendTxErr, "Can not send PRV transaction");
      // }
      // await Wallet.updateProgressTx(90)
      // console.timeEnd("Time for sending tx");
      // console.timeEnd("Time for create and send tx");

      // // saving history tx
      // // check status of tx 
      // let status = FailedTx;
      // if (response.txId) {
      //   // tx.txId = response.txId
      //   status = SuccessTx;

      //   response.typeTx = TxNormalType;
      //   response.feeNativeToken = 0;
      //   response.lockTime = lockTime;
      //   response.amountNativeToken = 0;
      //   response.txStatus = status;
      // }

      // await Wallet.updateProgressTx(100);
      // return response;
    } catch (e) {
      await Wallet.updateProgressTx(0);
      console.log(e);
      throw e;
    }
  }

  // toSerializedAccountObj returns account with encoded key set
  toSerializedAccountObj() {
    return {
      "AccountName": this.name,
      "PrivateKey": this.key.base58CheckSerialize(PriKeyType),
      "PaymentAddress": this.key.base58CheckSerialize(PaymentAddressType),
      "ReadonlyKey": this.key.base58CheckSerialize(ReadonlyKeyType),
      "PublicKey": this.key.getPublicKeyByHex(),
      "PublicKeyCheckEncode": this.key.getPublicKeyCheckEncode(),
      "PublicKeyBytes": this.key.KeySet.PaymentAddress.Pk.toString(),
      "ValidatorKey": checkEncode(hashSha3BytesToBytes(hashSha3BytesToBytes(this.key.KeySet.PrivateKey)), ENCODE_VERSION),
    }
  }

  /**
   * 
   */
  // stakerStatus return status of staker
  // return object {{Role: int, ShardID: int}}
  // Role: -1: is not staked, 0: candidate, 1: validator
  // ShardID: beacon: -1, shardID: 0->MaxShardNumber
  async stakerStatus() {
    let blsPubKeyB58CheckEncode = await this.key.getBLSPublicKeyB58CheckEncode();
    console.log("stakerStatus blsPubKeyB58CheckEncode: ", blsPubKeyB58CheckEncode);

    let reps;
    try {
      reps = await Wallet.RpcClient.getPublicKeyRole("bls:" + blsPubKeyB58CheckEncode);
    } catch (e) {
      throw e;
    }

    return reps.status;
  }



  /********************** DEX **********************/
  /**
   * 
   * @param {number} fee 
   * @param {string} pdeContributionPairID
   * @param {number} contributedAmount
   * @param {string} info 
   */
  async createAndSendTxWithNativeTokenContribution(fee, pdeContributionPairID, contributedAmount, info = "") {
    await Wallet.updateProgressTx(10);
    let feeBN = new bn(fee);

    let isPrivacy = false;    // always false

    let paramPaymentInfos = [{
      paymentAddressStr: BurnAddress,
      amount: contributedAmount
    }];

    // let receiverPaymentAddrStr = [BurnAddress];
    let totalAmountTransfer = new bn(contributedAmount);
    console.log("createAndSendTxWithNativeTokenContribution totalAmountTransfer: ", totalAmountTransfer);

    let senderSkStr = this.key.base58CheckSerialize(PriKeyType);
    // let paymentAddressStr = this.key.base58CheckSerialize(PaymentAddressType);
    // let viewingKeyStr = this.key.base58CheckSerialize(ReadonlyKeyType);

    console.time("Time for create and send tx");
    try {
      // prepare input 
      console.time("Time for preparing input for privacy tx");
      // console.log("Wallet: ", Wallet.RpcClient);
      let inputForTx;
      try {
        inputForTx = await prepareInputForTx(totalAmountTransfer, feeBN, isPrivacy, null, this, Wallet.RpcClient);
        console.log("input after prepare: ", inputForTx);
      } catch (e) {
        throw e;
      }
      console.log("createAndSendTxWithNativeTokenContribution inputForTx: ", inputForTx);
      console.timeEnd("Time for preparing input for privacy tx");

      await Wallet.updateProgressTx(30);

      let nOutput = paramPaymentInfos.length;
      if (inputForTx.totalValueInput.cmp(totalAmountTransfer) === 1) {
        nOutput++;
      }

      let sndOutputStrs;
      let sndOutputs = new Array(nOutput);
      if (typeof randomScalars === "function") {
        sndOutputStrs = await randomScalars(nOutput.toString());
        if (sndOutputStrs === null || sndOutputStrs === "") {
          throw new Error("Can not random scalars for output coins")
        }
        let sndDecodes = base64Decode(sndOutputStrs);

        for (let i = 0; i < nOutput; i++) {
          let sndBytes = sndDecodes.slice(i * ED25519_KEY_SIZE, (i + 1) * ED25519_KEY_SIZE);
          sndOutputs[i] = checkEncode(sndBytes, ENCODE_VERSION);
        }
      }
      console.log("createAndSendTxWithNativeTokenContribution sndOutputs: ", sndOutputs);

      let contributorAddressStr = this.key.base58CheckSerialize(PaymentAddressType);

      let tokenIDStr = convertHashToStr(PRVID);

      // prepare meta data for tx
      let metadata = {
        PDEContributionPairID: pdeContributionPairID,
        ContributorAddressStr: contributorAddressStr,
        ContributedAmount: contributedAmount,
        TokenIDStr: tokenIDStr,
        Type: PDEContributionMeta
      };

      let paramInitTx = newParamInitTx(
        senderSkStr, paramPaymentInfos, inputForTx.inputCoinStrs,
        fee, isPrivacy, null, metadata, info,
        inputForTx.commitmentIndices, inputForTx.myCommitmentIndices, inputForTx.commitmentStrs, sndOutputs);
      console.log("createAndSendTxWithNativeTokenContribution paramInitTx: ", paramInitTx);

      let resInitTx;
      if (typeof initPRVContributionTx === "function") {
        let paramInitTxJson = JSON.stringify(paramInitTx);
        console.log("paramInitTxJson: ", paramInitTxJson);
        resInitTx = await initPRVContributionTx(paramInitTxJson);
        if (resInitTx === null || resInitTx === "") {
          throw new CustomError(ErrorObject.InitNormalTxErr, "Can not init transaction tranfering PRV");
        }
      }
      console.log("createAndSendTxWithNativeTokenContribution resInitTx: ", resInitTx);

      //base64 decode txjson
      let resInitTxBytes = base64Decode(resInitTx);

      // get b58 check encode tx json
      let b58CheckEncodeTx = checkEncode(resInitTxBytes.slice(0, resInitTxBytes.length - 8), ENCODE_VERSION);

      // get lock time tx
      let lockTimeBytes = resInitTxBytes.slice(resInitTxBytes.length - 8);
      let lockTime = new bn(lockTimeBytes).toNumber();

      await Wallet.updateProgressTx(60)
      console.time("Time for sending tx");
      let response;
      // let listUTXOForPRV = [];
      try {
        response = await Wallet.RpcClient.sendRawTx(b58CheckEncodeTx);
      } catch (e) {
        console.log("createAndSendTxWithNativeTokenContribution Error when sending tx: ", e);
        throw new CustomError(ErrorObject.SendTxErr, "Can not send PRV transaction");
      }
      await Wallet.updateProgressTx(90)
      console.timeEnd("Time for sending tx");
      console.timeEnd("Time for create and send tx");

      // saving history tx
      // check status of tx and add coins to spending coins
      let status = FailedTx;
      if (response.txId) {
        // tx.txId = response.txId
        status = SuccessTx;

        response.typeTx = TxNormalType;
        response.feeNativeToken = feeBN.toNumber();
        response.lockTime = lockTime;
        response.amountNativeToken = totalAmountTransfer.toNumber();
        response.txStatus = status;
      }

      await Wallet.updateProgressTx(100);
      return response;
    } catch (e) {
      await Wallet.updateProgressTx(0);
      console.log(e);
      throw e;
    }
  };

  // createAndSendPTokenContributionTx
  /**
   * 
   * @param {{Privacy: bool, TokenID: string, TokenName: string, TokenSymbol: string}}} tokenParam 
   * @param {number} feeNativeToken 
   * @param {number} feePToken
   * @param {string} pdeContributionPairID 
   * @param {number} contributedAmount 
   */
  async createAndSendPTokenContributionTx(tokenParam, feeNativeToken, feePToken, pdeContributionPairID, contributedAmount) {
    await Wallet.updateProgressTx(10);

    let paramPaymentInfosForNativeToken = [];
    let amountTransferPRV = new bn(0);

    // token param
    // get current token to get token param
    let tokenParamJson = {
      propertyID: tokenParam.TokenID,
      propertyName: tokenParam.TokenName,
      propertySymbol: tokenParam.TokenSymbol,
      amount: contributedAmount,
      tokenTxType: CustomTokenTransfer,
      fee: feePToken,
      paymentInfoForPToken: [{
        paymentAddressStr: BurnAddress,
        amount: contributedAmount
      }],
      tokenInputs: [],
    };
    console.log("createAndSendPTokenContributionTx tokenParamJson: ", tokenParamJson);

    let amountTransferPToken = new bn(contributedAmount)

    let senderSkStr = this.key.base58CheckSerialize(PriKeyType);
    let contributorAddressStr = this.key.base58CheckSerialize(PaymentAddressType);

    let inputForTx;
    try {
      console.time("Time for preparing input for custom token tx");
      inputForTx = await prepareInputForTx(amountTransferPRV, new bn(feeNativeToken), false, null, this, Wallet.RpcClient);
      console.timeEnd("Time for preparing input for custom token tx");
    } catch (e) {
      throw e;
    }
    await Wallet.updateProgressTx(30);

    let inputForPrivacyTokenTx;
    try {
      inputForPrivacyTokenTx = await prepareInputForTxPrivacyToken(tokenParamJson, this, Wallet.RpcClient, new bn(feePToken));
    } catch (e) {
      throw e;
    }
    await Wallet.updateProgressTx(50);

    tokenParamJson.tokenInputs = inputForPrivacyTokenTx.tokenInputs;
    console.log("createAndSendPTokenContributionTx tokenParamJson: ", tokenParamJson);

    // verify tokenID is valid or not
    let listCustomTokens = inputForPrivacyTokenTx.listPrivacyToken;
    let k = 0;
    for (k = 0; k < listCustomTokens.length; k++) {
      if (listCustomTokens[k].ID.toLowerCase() === tokenParamJson.propertyID) {
        break;
      }
    }
    if (k === listCustomTokens.length) {
      throw new Error("invalid token ID")
    }

    let nOutputForNativeToken = paramPaymentInfosForNativeToken.length;
    if (inputForTx.totalValueInput.cmp(amountTransferPRV) === 1) {
      nOutputForNativeToken++;
    }

    // random snd for output native token
    let sndOutputStrsForNativeToken;
    let sndOutputsForNativeToken = new Array(nOutputForNativeToken);
    if (typeof randomScalars === "function") {
      sndOutputStrsForNativeToken = await randomScalars(nOutputForNativeToken.toString());
      if (sndOutputStrsForNativeToken === null || sndOutputStrsForNativeToken === "") {
        throw new Error("Can not random scalar for native token output");
      }
      let sndDecodes = base64Decode(sndOutputStrsForNativeToken);

      for (let i = 0; i < nOutputForNativeToken; i++) {
        let sndBytes = sndDecodes.slice(i * ED25519_KEY_SIZE, (i + 1) * ED25519_KEY_SIZE);
        sndOutputsForNativeToken[i] = checkEncode(sndBytes, ENCODE_VERSION);
      }
    }
    console.log("createAndSendPTokenContributionTx sndOutputsForNativeToken: ", sndOutputsForNativeToken);

    // random snd for output native token
    let nOutputForPToken = tokenParamJson.paymentInfoForPToken.length;
    if (inputForPrivacyTokenTx.totalValueInput.cmp(amountTransferPToken) === 1) {
      nOutputForPToken++;
    }

    let sndOutputStrsForPToken;
    let sndOutputsForPToken = new Array(nOutputForPToken);
    if (typeof randomScalars === "function") {
      sndOutputStrsForPToken = await randomScalars(nOutputForPToken.toString());
      if (sndOutputStrsForPToken === null || sndOutputStrsForPToken === "") {
        throw new Error("Can not random scalar for privacy token output");
      }
      let sndDecodes = base64Decode(sndOutputStrsForPToken);

      for (let i = 0; i < nOutputForPToken; i++) {
        let sndBytes = sndDecodes.slice(i * ED25519_KEY_SIZE, (i + 1) * ED25519_KEY_SIZE);
        sndOutputsForPToken[i] = checkEncode(sndBytes, ENCODE_VERSION);
      }
    }
    console.log("createAndSendPTokenContributionTx sndOutputsForPToken: ", sndOutputsForPToken);

    // prepare meta data for tx
    let metadata = {
      PDEContributionPairID: pdeContributionPairID,
      ContributorAddressStr: contributorAddressStr,
      ContributedAmount: contributedAmount,
      TokenIDStr: tokenIDStr,
      Type: PDEContributionMeta
    };

    let paramInitTx = newParamInitPrivacyTokenTx(
      senderSkStr, paramPaymentInfosForNativeToken, inputForTx.inputCoinStrs,
      feeNativeToken, false, false, tokenParamJson, metadata, "",
      inputForTx.commitmentIndices, inputForTx.myCommitmentIndices, inputForTx.commitmentStrs, sndOutputsForNativeToken,
      inputForPrivacyTokenTx.commitmentIndices, inputForPrivacyTokenTx.myCommitmentIndices, inputForPrivacyTokenTx.commitmentStrs, sndOutputsForPToken
    );

    console.log("createAndSendPTokenContributionTx paramInitTx: ", paramInitTx);

    let resInitTx;
    if (typeof initPTokenContributionTx === "function") {
      let paramInitTxJson = JSON.stringify(paramInitTx);
      resInitTx = await initPTokenContributionTx(paramInitTxJson);
      if (resInitTx === null || resInitTx === "") {
        throw new CustomError(ErrorObject.InitNormalTxErr, "Can not init transaction tranfering PRV");
      }
    }

    console.log("createAndSendPTokenContributionTx resInitTx: ", resInitTx);

    //base64 decode txjson
    let resInitTxBytes = base64Decode(resInitTx);

    // get b58 check encode tx json
    let b58CheckEncodeTx = checkEncode(resInitTxBytes.slice(0, resInitTxBytes.length - 40), ENCODE_VERSION);

    // get lock time tx
    let lockTimeBytes = resInitTxBytes.slice(resInitTxBytes.length - 40, resInitTxBytes.length - 32);
    let lockTime = new bn(lockTimeBytes).toNumber();
    let tokenIDBytes = resInitTxBytes.slice(resInitTxBytes.length - 32);
    let tokenID = convertHashToStr(tokenIDBytes).toLowerCase();
    console.log("createAndSendPTokenContributionTx tokenID: ", tokenID);

    await Wallet.updateProgressTx(80);

    let response;
    try {
      response = await Wallet.RpcClient.sendRawTxCustomTokenPrivacy(b58CheckEncodeTx);
    } catch (e) {
      throw new CustomError(ErrorObject.SendTxErr, "Can not send privacy token tx");
    }

    await Wallet.updateProgressTx(90);
    // saving history tx
    // check status of tx
    // let listUTXOForPRV = [];
    // let listUTXOForPToken = [];
    // check status of tx and add coins to spending coins
    let status = FailedTx;
    if (response.txId) {
      status = SuccessTx;
      response.typeTx = TxCustomTokenPrivacyType;
      response.feeNativeToken = new bn(feeNativeToken).toNumber();
      response.feePToken = new bn(feePToken).toNumber();
      response.lockTime = lockTime;
      response.amountNativeToken = amountTransferPRV.toNumber();
      response.amountPToken = amountTransferPToken.toNumber();
      response.txStatus = status;
      response.tokenName = tokenParamJson.propertyName;
      response.tokenID = tokenID;
      response.tokenSymbol = tokenParamJson.propertySymbol;

      // add spending list
      // let spendingSNs = [];
      // for (let i = 0; i < inputForTx.inputCoinStrs.length; i++) {
      //   spendingSNs.push(inputForTx.inputCoinStrs[i].SerialNumber);
      //   listUTXOForPRV.push(inputForTx.inputCoinStrs[i].SNDerivator);
      //   listUTXOForPToken.push(inputForPrivacyTokenTx.inputCoinStrs[i].SNDerivator)
      // }
      // this.addSpendingCoins({ txID: response.txId, spendingSNs: spendingSNs });
      // console.log("createAndSendPTokenContributionTx Spending coin list after saving: ", this.spendingCoins);
    }

    // let isIn = false;
    // this.savePrivacyTokenTxHistory(response, [BurnAddress], isIn, false, false, listUTXOForPRV, listUTXOForPToken, "");
    await Wallet.updateProgressTx(100);
    return response;
  };


  /**
   * 
   * @param {number} fee 
   * @param {string} pdeContributionPairID
   * @param {number} sellAmount
   * @param {string} info 
   */
  async createAndSendNativeTokenTradeRequestTx(fee, tokenIDToBuyStr, sellAmount, info = "") {
    await Wallet.updateProgressTx(10);
    let feeBN = new bn(fee);

    let isPrivacy = false;    // always false

    let paramPaymentInfos = [{
      paymentAddressStr: BurnAddress,
      amount: sellAmount
    }];

    // let receiverPaymentAddrStr = [BurnAddress];
    let totalAmountTransfer = new bn(sellAmount);
    console.log("createAndSendTxWithNativeTokenContribution totalAmountTransfer: ", totalAmountTransfer);

    let senderSkStr = this.key.base58CheckSerialize(PriKeyType);
    // let paymentAddressStr = this.key.base58CheckSerialize(PaymentAddressType);
    // let viewingKeyStr = this.key.base58CheckSerialize(ReadonlyKeyType);

    console.time("Time for create and send tx");
    try {
      // prepare input 
      console.time("Time for preparing input for privacy tx");
      // console.log("Wallet: ", Wallet.RpcClient);
      let inputForTx;
      try {
        inputForTx = await prepareInputForTx(totalAmountTransfer, feeBN, isPrivacy, null, this, Wallet.RpcClient);
        console.log("input after prepare: ", inputForTx);
      } catch (e) {
        throw e;
      }
      console.log("createAndSendTxWithNativeTokenContribution inputForTx: ", inputForTx);
      console.timeEnd("Time for preparing input for privacy tx");

      await Wallet.updateProgressTx(30);

      let nOutput = paramPaymentInfos.length;
      if (inputForTx.totalValueInput.cmp(totalAmountTransfer) === 1) {
        nOutput++;
      }

      let sndOutputStrs;
      let sndOutputs = new Array(nOutput);
      if (typeof randomScalars === "function") {
        sndOutputStrs = await randomScalars(nOutput.toString());
        if (sndOutputStrs === null || sndOutputStrs === "") {
          throw new Error("Can not random scalars for output coins")
        }
        let sndDecodes = base64Decode(sndOutputStrs);

        for (let i = 0; i < nOutput; i++) {
          let sndBytes = sndDecodes.slice(i * ED25519_KEY_SIZE, (i + 1) * ED25519_KEY_SIZE);
          sndOutputs[i] = checkEncode(sndBytes, ENCODE_VERSION);
        }
      }
      console.log("createAndSendTxWithNativeTokenContribution sndOutputs: ", sndOutputs);

      let traderAddressStr = this.key.base58CheckSerialize(PaymentAddressType);
      let tokenIDStr = convertHashToStr(PRVID);

      // prepare meta data for tx
      let metadata = {
        TokenIDToBuyStr: tokenIDToBuyStr,
        TokenIDToSellStr: tokenIDStr,
        SellAmount: sellAmount,
        TraderAddressStr: traderAddressStr,
        Type: PDETradeRequestMeta
      };

      let paramInitTx = newParamInitTx(
        senderSkStr, paramPaymentInfos, inputForTx.inputCoinStrs,
        fee, isPrivacy, null, metadata, info,
        inputForTx.commitmentIndices, inputForTx.myCommitmentIndices, inputForTx.commitmentStrs, sndOutputs);
      console.log("createAndSendTxWithNativeTokenContribution paramInitTx: ", paramInitTx);

      let resInitTx;
      if (typeof initPRVTradeTx === "function") {
        let paramInitTxJson = JSON.stringify(paramInitTx);
        console.log("paramInitTxJson: ", paramInitTxJson);
        resInitTx = await initPRVTradeTx(paramInitTxJson);
        if (resInitTx === null || resInitTx === "") {
          throw new CustomError(ErrorObject.InitNormalTxErr, "Can not init transaction tranfering PRV");
        }
      }
      console.log("createAndSendTxWithNativeTokenContribution resInitTx: ", resInitTx);

      //base64 decode txjson
      let resInitTxBytes = base64Decode(resInitTx);

      // get b58 check encode tx json
      let b58CheckEncodeTx = checkEncode(resInitTxBytes.slice(0, resInitTxBytes.length - 8), ENCODE_VERSION);

      // get lock time tx
      let lockTimeBytes = resInitTxBytes.slice(resInitTxBytes.length - 8);
      let lockTime = new bn(lockTimeBytes).toNumber();

      await Wallet.updateProgressTx(60)
      console.time("Time for sending tx");
      let response;
      // let listUTXOForPRV = [];
      try {
        response = await Wallet.RpcClient.sendRawTx(b58CheckEncodeTx);
      } catch (e) {
        console.log("createAndSendTxWithNativeTokenContribution Error when sending tx: ", e);
        throw new CustomError(ErrorObject.SendTxErr, "Can not send PRV transaction");
      }
      await Wallet.updateProgressTx(90)
      console.timeEnd("Time for sending tx");
      console.timeEnd("Time for create and send tx");

      // saving history tx
      // check status of tx and add coins to spending coins
      let status = FailedTx;
      if (response.txId) {
        // tx.txId = response.txId
        status = SuccessTx;

        response.typeTx = TxNormalType;
        response.feeNativeToken = feeBN.toNumber();
        response.lockTime = lockTime;
        response.amountNativeToken = totalAmountTransfer.toNumber();
        response.txStatus = status;
      }

      await Wallet.updateProgressTx(100);
      return response;
    } catch (e) {
      await Wallet.updateProgressTx(0);
      console.log(e);
      throw e;
    }
  };

  // createAndSendPTokenContributionTx
  /**
   * 
   * @param {{Privacy: bool, TokenID: string, TokenName: string, TokenSymbol: string}}} tokenParam 
   * @param {number} feeNativeToken 
   * @param {string} pdeContributionPairID 
   * @param {number} sellAmount 
   */
  async createAndSendPTokenTradeRequestTx(tokenParam, feeNativeToken, feePToken, tokenIDToBuyStr, sellAmount) {
    await Wallet.updateProgressTx(10);

    let paramPaymentInfosForNativeToken = [];
    let amountTransferPRV = new bn(0);

    // token param
    // get current token to get token param
    let tokenParamJson = {
      propertyID: tokenParam.TokenID,
      propertyName: tokenParam.TokenName,
      propertySymbol: tokenParam.TokenSymbol,
      amount: sellAmount,
      tokenTxType: CustomTokenTransfer,
      fee: feePToken,
      paymentInfoForPToken: [{
        paymentAddressStr: BurnAddress,
        amount: sellAmount
      }],
      tokenInputs: [],
    };
    console.log("createAndSendPTokenContributionTx tokenParamJson: ", tokenParamJson);

    let amountTransferPToken = new bn(sellAmount)

    let senderSkStr = this.key.base58CheckSerialize(PriKeyType);
    let traderAddressStr = this.key.base58CheckSerialize(PaymentAddressType);

    let inputForTx;
    try {
      console.time("Time for preparing input for custom token tx");
      inputForTx = await prepareInputForTx(amountTransferPRV, new bn(feeNativeToken), false, null, this, Wallet.RpcClient);
      console.timeEnd("Time for preparing input for custom token tx");
    } catch (e) {
      throw e;
    }
    await Wallet.updateProgressTx(30);

    let inputForPrivacyTokenTx;
    try {
      inputForPrivacyTokenTx = await prepareInputForTxPrivacyToken(tokenParamJson, this, Wallet.RpcClient, new bn(feePToken));
    } catch (e) {
      throw e;
    }
    await Wallet.updateProgressTx(50);

    tokenParamJson.tokenInputs = inputForPrivacyTokenTx.tokenInputs;
    console.log("createAndSendPTokenContributionTx tokenParamJson: ", tokenParamJson);

    // verify tokenID is valid or not
    let listCustomTokens = inputForPrivacyTokenTx.listPrivacyToken;
    let k = 0;
    for (k = 0; k < listCustomTokens.length; k++) {
      if (listCustomTokens[k].ID.toLowerCase() === tokenParamJson.propertyID) {
        break;
      }
    }
    if (k === listCustomTokens.length) {
      throw new Error("invalid token ID")
    }

    let nOutputForNativeToken = paramPaymentInfosForNativeToken.length;
    if (inputForTx.totalValueInput.cmp(amountTransferPRV) === 1) {
      nOutputForNativeToken++;
    }

    // random snd for output native token
    let sndOutputStrsForNativeToken;
    let sndOutputsForNativeToken = new Array(nOutputForNativeToken);
    if (typeof randomScalars === "function") {
      sndOutputStrsForNativeToken = await randomScalars(nOutputForNativeToken.toString());
      if (sndOutputStrsForNativeToken === null || sndOutputStrsForNativeToken === "") {
        throw new Error("Can not random scalar for native token output");
      }
      let sndDecodes = base64Decode(sndOutputStrsForNativeToken);

      for (let i = 0; i < nOutputForNativeToken; i++) {
        let sndBytes = sndDecodes.slice(i * ED25519_KEY_SIZE, (i + 1) * ED25519_KEY_SIZE);
        sndOutputsForNativeToken[i] = checkEncode(sndBytes, ENCODE_VERSION);
      }
    }
    console.log("createAndSendPTokenContributionTx sndOutputsForNativeToken: ", sndOutputsForNativeToken);

    // random snd for output native token
    let nOutputForPToken = tokenParamJson.paymentInfoForPToken.length;
    if (inputForPrivacyTokenTx.totalValueInput.cmp(amountTransferPToken) === 1) {
      nOutputForPToken++;
    }

    let sndOutputStrsForPToken;
    let sndOutputsForPToken = new Array(nOutputForPToken);
    if (typeof randomScalars === "function") {
      sndOutputStrsForPToken = await randomScalars(nOutputForPToken.toString());
      if (sndOutputStrsForPToken === null || sndOutputStrsForPToken === "") {
        throw new Error("Can not random scalar for privacy token output");
      }
      let sndDecodes = base64Decode(sndOutputStrsForPToken);

      for (let i = 0; i < nOutputForPToken; i++) {
        let sndBytes = sndDecodes.slice(i * ED25519_KEY_SIZE, (i + 1) * ED25519_KEY_SIZE);
        sndOutputsForPToken[i] = checkEncode(sndBytes, ENCODE_VERSION);
      }
    }
    console.log("createAndSendPTokenContributionTx sndOutputsForPToken: ", sndOutputsForPToken);

    // prepare meta data for tx

    let metadata = {
      TokenIDToBuyStr: tokenIDToBuyStr,
      TokenIDToSellStr: tokenParam.TokenID,
      SellAmount: sellAmount,
      TraderAddressStr: traderAddressStr,
      Type: PDETradeRequestMeta
    };

    let paramInitTx = newParamInitPrivacyTokenTx(
      senderSkStr, paramPaymentInfosForNativeToken, inputForTx.inputCoinStrs,
      feeNativeToken, false, false, tokenParamJson, metadata, "",
      inputForTx.commitmentIndices, inputForTx.myCommitmentIndices, inputForTx.commitmentStrs, sndOutputsForNativeToken,
      inputForPrivacyTokenTx.commitmentIndices, inputForPrivacyTokenTx.myCommitmentIndices, inputForPrivacyTokenTx.commitmentStrs, sndOutputsForPToken
    );

    console.log("createAndSendPTokenContributionTx paramInitTx: ", paramInitTx);

    let resInitTx;
    if (typeof initPTokenTradeTx === "function") {
      let paramInitTxJson = JSON.stringify(paramInitTx);
      resInitTx = await initPTokenTradeTx(paramInitTxJson);
      if (resInitTx === null || resInitTx === "") {
        throw new CustomError(ErrorObject.InitNormalTxErr, "Can not init transaction tranfering PRV");
      }
    }

    console.log("createAndSendPTokenContributionTx resInitTx: ", resInitTx);

    //base64 decode txjson
    let resInitTxBytes = base64Decode(resInitTx);

    // get b58 check encode tx json
    let b58CheckEncodeTx = checkEncode(resInitTxBytes.slice(0, resInitTxBytes.length - 40), ENCODE_VERSION);

    // get lock time tx
    let lockTimeBytes = resInitTxBytes.slice(resInitTxBytes.length - 40, resInitTxBytes.length - 32);
    let lockTime = new bn(lockTimeBytes).toNumber();
    let tokenIDBytes = resInitTxBytes.slice(resInitTxBytes.length - 32);
    let tokenID = convertHashToStr(tokenIDBytes).toLowerCase();
    console.log("createAndSendPTokenContributionTx tokenID: ", tokenID);

    await Wallet.updateProgressTx(80);

    let response;
    try {
      response = await Wallet.RpcClient.sendRawTxCustomTokenPrivacy(b58CheckEncodeTx);
    } catch (e) {
      throw new CustomError(ErrorObject.SendTxErr, "Can not send privacy token tx");
    }

    await Wallet.updateProgressTx(90);
    // saving history tx
    // check status of tx
    // let listUTXOForPRV = [];
    // let listUTXOForPToken = [];
    // check status of tx and add coins to spending coins
    let status = FailedTx;
    if (response.txId) {
      status = SuccessTx;
      response.typeTx = TxCustomTokenPrivacyType;
      response.feeNativeToken = new bn(feeNativeToken).toNumber();
      response.feePToken = new bn(feePToken).toNumber();
      response.lockTime = lockTime;
      response.amountNativeToken = amountTransferPRV.toNumber();
      response.amountPToken = amountTransferPToken.toNumber();
      response.txStatus = status;
      response.tokenName = tokenParamJson.propertyName;
      response.tokenID = tokenID;
      response.tokenSymbol = tokenParamJson.propertySymbol;

      // add spending list
      // let spendingSNs = [];
      // for (let i = 0; i < inputForTx.inputCoinStrs.length; i++) {
      //   spendingSNs.push(inputForTx.inputCoinStrs[i].SerialNumber);
      //   listUTXOForPRV.push(inputForTx.inputCoinStrs[i].SNDerivator);
      //   listUTXOForPToken.push(inputForPrivacyTokenTx.inputCoinStrs[i].SNDerivator)
      // }
      // this.addSpendingCoins({ txID: response.txId, spendingSNs: spendingSNs });
      // console.log("createAndSendPTokenContributionTx Spending coin list after saving: ", this.spendingCoins);
    }

    // let isIn = false;
    // this.savePrivacyTokenTxHistory(response, [BurnAddress], isIn, false, false, listUTXOForPRV, listUTXOForPToken, "");
    await Wallet.updateProgressTx(100);
    return response;
  };

  /**
   * 
   * @param {number} fee 
   * @param {string} pdeContributionPairID
   * @param {number} sellAmount
   * @param {string} info 
   */
  async createAndSendWithdrawDexTx(fee, withdrawalToken1IDStr, withdrawalShare1Amt, withdrawalToken2IDStr, withdrawalShare2Amt, info = "") {
    await Wallet.updateProgressTx(10);
    let feeBN = new bn(fee);

    let isPrivacy = false;    // always false

    let paramPaymentInfos = [];

    // let receiverPaymentAddrStr = [BurnAddress];
    let totalAmountTransfer = new bn(0);
    console.log("createAndSendTxWithNativeTokenContribution totalAmountTransfer: ", totalAmountTransfer);

    let senderSkStr = this.key.base58CheckSerialize(PriKeyType);
    // let paymentAddressStr = this.key.base58CheckSerialize(PaymentAddressType);
    // let viewingKeyStr = this.key.base58CheckSerialize(ReadonlyKeyType);

    console.time("Time for create and send tx");
    try {
      // prepare input 
      console.time("Time for preparing input for privacy tx");
      // console.log("Wallet: ", Wallet.RpcClient);
      let inputForTx;
      try {
        inputForTx = await prepareInputForTx(totalAmountTransfer, feeBN, isPrivacy, null, this, Wallet.RpcClient);
        console.log("input after prepare: ", inputForTx);
      } catch (e) {
        throw e;
      }
      console.log("createAndSendTxWithNativeTokenContribution inputForTx: ", inputForTx);
      console.timeEnd("Time for preparing input for privacy tx");

      await Wallet.updateProgressTx(30);

      let nOutput = paramPaymentInfos.length;
      if (inputForTx.totalValueInput.cmp(totalAmountTransfer) === 1) {
        nOutput++;
      }

      let sndOutputStrs;
      let sndOutputs = new Array(nOutput);
      if (typeof randomScalars === "function") {
        sndOutputStrs = await randomScalars(nOutput.toString());
        if (sndOutputStrs === null || sndOutputStrs === "") {
          throw new Error("Can not random scalars for output coins")
        }
        let sndDecodes = base64Decode(sndOutputStrs);

        for (let i = 0; i < nOutput; i++) {
          let sndBytes = sndDecodes.slice(i * ED25519_KEY_SIZE, (i + 1) * ED25519_KEY_SIZE);
          sndOutputs[i] = checkEncode(sndBytes, ENCODE_VERSION);
        }
      }
      console.log("createAndSendTxWithNativeTokenContribution sndOutputs: ", sndOutputs);

      let withdrawerAddressStr = this.key.base58CheckSerialize(PaymentAddressType);
      let tokenIDStr = convertHashToStr(PRVID);

      // prepare meta data for tx
      let metadata = {
        WithdrawerAddressStr: withdrawerAddressStr,
        WithdrawalToken1IDStr: withdrawalToken1IDStr,
        WithdrawalShare1Amt: withdrawalShare1Amt,
        WithdrawalToken2IDStr: withdrawalToken2IDStr,
        WithdrawalShare2Amt: withdrawalShare2Amt,
        Type: PDEWithdrawalRequestMeta
      };

      let paramInitTx = newParamInitTx(
        senderSkStr, paramPaymentInfos, inputForTx.inputCoinStrs,
        fee, isPrivacy, null, metadata, info,
        inputForTx.commitmentIndices, inputForTx.myCommitmentIndices, inputForTx.commitmentStrs, sndOutputs);
      console.log("createAndSendTxWithNativeTokenContribution paramInitTx: ", paramInitTx);

      let resInitTx;
      if (typeof withdrawDexTx === "function") {
        let paramInitTxJson = JSON.stringify(paramInitTx);
        console.log("paramInitTxJson: ", paramInitTxJson);
        resInitTx = await withdrawDexTx(paramInitTxJson);
        if (resInitTx === null || resInitTx === "") {
          throw new CustomError(ErrorObject.InitNormalTxErr, "Can not init transaction tranfering PRV");
        }
      }
      console.log("createAndSendTxWithNativeTokenContribution resInitTx: ", resInitTx);

      //base64 decode txjson
      let resInitTxBytes = base64Decode(resInitTx);

      // get b58 check encode tx json
      let b58CheckEncodeTx = checkEncode(resInitTxBytes.slice(0, resInitTxBytes.length - 8), ENCODE_VERSION);

      // get lock time tx
      let lockTimeBytes = resInitTxBytes.slice(resInitTxBytes.length - 8);
      let lockTime = new bn(lockTimeBytes).toNumber();

      await Wallet.updateProgressTx(60)
      console.time("Time for sending tx");
      let response;
      // let listUTXOForPRV = [];
      try {
        response = await Wallet.RpcClient.sendRawTx(b58CheckEncodeTx);
      } catch (e) {
        console.log("createAndSendTxWithNativeTokenContribution Error when sending tx: ", e);
        throw new CustomError(ErrorObject.SendTxErr, "Can not send PRV transaction");
      }
      await Wallet.updateProgressTx(90)
      console.timeEnd("Time for sending tx");
      console.timeEnd("Time for create and send tx");

      // saving history tx
      // check status of tx and add coins to spending coins
      let status = FailedTx;
      if (response.txId) {
        // tx.txId = response.txId
        status = SuccessTx;

        response.typeTx = TxNormalType;
        response.feeNativeToken = feeBN.toNumber();
        response.lockTime = lockTime;
        response.amountNativeToken = totalAmountTransfer.toNumber();
        response.txStatus = status;
      }

      await Wallet.updateProgressTx(100);
      return response;
    } catch (e) {
      await Wallet.updateProgressTx(0);
      console.log(e);
      throw e;
    }
  };


}

export { AccountWallet };