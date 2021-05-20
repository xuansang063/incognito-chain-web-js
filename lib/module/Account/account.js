import bn from "bn.js";
import _ from "lodash";
import isEmpty from "lodash/isEmpty";
import set from "lodash/set";
import uniqBy from "lodash/uniqBy";
import { KeyWallet } from "@lib/core/hdwallet";
import StorageServices from "@lib/services/storage";
import {
  FailedTx,
  SuccessTx,
  PaymentAddressType,
  ReadonlyKeyType,
  PriKeyType,
  OTAKeyType,
  ConfirmedTx,
  PRVIDSTR,
  PercentFeeToReplaceTx,
  PrivacyVersion,
} from "@lib/core/constants";
import { checkEncode, checkDecode } from "@lib/common/base58";
import {
  newParamInitTx,
  newParamInitPrivacyTokenTx,
  prepareInputForReplaceTxNormal,
  prepareInputForReplaceTxPrivacyToken,
} from "@lib/tx/utils";
import { ENCODE_VERSION, ED25519_KEY_SIZE } from "@lib/common/constants";

import {
  getChildIdFromChildNumberArray,
  getShardIDFromLastByte,
} from "@lib/common/common";
import { TxHistoryInfo } from "@lib/core/history";
import { generateBLSPubKeyB58CheckEncodeFromSeed } from "@lib/common/committeekey";
import {
  hashSha3BytesToBytes,
  base64Decode,
  base64Encode,
  stringToBytes,
  bytesToString,
} from "@lib/privacy/utils";
import { CustomError, ErrorObject } from "@lib/common/errorhandler";
import { encryptMessageOutCoin, decryptMessageOutCoin } from "@lib/core/utils";
import { isJsonString } from "@lib/utils/json";
import { wasm as wasmFuncs } from "@lib/wasm";
import { RpcHTTPCoinServiceClient } from "@lib/rpcclient/rpchttpcoinservice";
import { RpcHTTPTxServiceClient } from "@lib/rpcclient/rpchttptxservice";
import Validator from "@lib/utils/validator";
import { TxNormalType, TxCustomTokenPrivacyType } from "./account.constants";
import transactor from "@lib/module/Account/account.transactor";
import history from "@lib/module/Account/account.history";
import progress from "@lib/module/Account/account.progress";
import { RpcClient } from "@lib/rpcclient/rpcclient";
import transactorConvert from "@lib/module/Account/account.transactorConvert";
import pDex from "@lib/module/Account/account.pDex";
import node from "@lib/module/Account/account.node";
import initToken from "@lib/module/Account/account.initToken";
import configs from "@lib/module/Account/account.configs";
import unshield from "@lib/module/Account/account.unshield";

const performance = {
  now() {
    return new Date().getTime();
  },
};

global.timers = {};

const deserializedAccounts = {};

const LIMIT_COINS = 100;

const TOTAL_COINS_KEY_STORAGE = "TOTAL-COINS";
const UNSPENT_COINS_STORAGE = "UNSPENT-COINS";
const SPENDING_COINS_STORAGE = "SPENDING-COINS-STORAGE";
const COINS_STORAGE = "COINS_STORAGE";
const SPENT_COINS_STORAGE = "SPENT_COINS_STORAGE";
const TOTAL_UNSPENT_COINS = "TOTAL_UNSPENT_COINS";
const SUBMITTED_OTA_KEY = "SUBMITTED_OTA_KEY";

export const VALIDATOR = {
  privacyVersion: "Privacy version",
  tokenId: "Token ID",
  otaKey: "OTA key",
  rpcCoinService: "RPC coin service",
  version: "Version",
  fee: "Fee",
};

class Account {
  constructor(w = null) {
    this.name = "";
    this.key = new KeyWallet();
    this.child = [];
    this.isImport = false;
    this.followingTokens = [];
    this.txHistory = { NormalTx: [], CustomTokenTx: [], PrivacyTokenTx: [] };
    this.txReceivedHistory = {
      NormalTx: [],
      CustomTokenTx: [],
      PrivacyTokenTx: [],
    };
    this.storage = w.Storage ? w.Storage : StorageServices;
    this.coinUTXOs = {};
    this.rpc = w.RpcClient ? new RpcClient(w.RpcClient) : null;
    this.rpcCoinService = w.RpcCoinService
      ? new RpcHTTPCoinServiceClient(w.RpcCoinService)
      : null;
    this.rpcTxService = w.RpcTxService
      ? new RpcHTTPTxServiceClient(w.RpcTxService)
      : null;
    this.privacyVersion = w.PrivacyVersion || -1;
    this.keyInfo = {};
    this.allKeyInfoV1 = {};
    this.coinsStorage = null;
    this.progressTx = 0;
    this.debug = "";
    this.coinsV1Storage = null;
  }

  async setKey(privateKey) {
    new Validator("privateKey", privateKey).required();
    // transactor needs private key to sign TXs. Read key in encoded or raw form
    if (typeof privateKey == "string") {
      this.key = KeyWallet.base58CheckDeserialize(privateKey);
    } else if (privateKey.length && privateKey.length == 32) {
      this.key = KeyWallet.deserialize(privateKey);
    } else {
      this.key = new KeyWallet();
      return this.key;
    }
    let result = await this.key.KeySet.importFromPrivateKey(
      this.key.KeySet.PrivateKey
    );
    return result;
  }

  getReadonlyKey() {
    return this.key.base58CheckSerialize(ReadonlyKeyType);
  }

  getShardId() {
    const shardId =
      getShardIDFromLastByte(
        this.key.KeySet.PaymentAddress.Pk[
          this.key.KeySet.PaymentAddress.Pk.length - 1
        ]
      ) || 0;
    return shardId;
  }

  getOTAKey() {
    return this.key.base58CheckSerialize(OTAKeyType);
  }

  // storage services

  async getAccountStorage(key) {
    let result;
    try {
      if (this.storage) {
        const data = await this.storage.getItem(key);
        result = data;
        if (isJsonString(data)) {
          result = JSON.parse(data);
        }
      }
    } catch (error) {
      console.debug("ERROR GET ACCOUNT STORAGE", error?.message);
    }
    return result;
  }

  async setAccountStorage(key, value) {
    try {
      if (this.storage) {
        await this.storage.setItem(
          key,
          typeof value !== "string" ? JSON.stringify(value) : value
        );
      }
    } catch (error) {
      console.debug("ERROR SET ACCOUNT STORAGE", error?.message);
    }
  }

  async clearAccountStorage(key) {
    try {
      if (this.storage) {
        return this.storage.removeItem(key);
      }
    } catch (error) {
      throw error;
    }
  }

  getKeyStorageByTokenId(tokenId) {
    new Validator(VALIDATOR.tokenId, tokenId).required().string();
    const otaKey = this.getOTAKey();
    const prefix = this.getPrefixKeyStorage();
    return `${tokenId}-${prefix}-${otaKey}-${this.name}`;
  }

  getKeyListUnspentCoinsByTokenId(tokenId) {
    const keyByTokenId = this.getKeyStorageByTokenId(tokenId);
    const key = `${keyByTokenId}-${UNSPENT_COINS_STORAGE}`;
    return key;
  }

  getKeyListSpentCoinsByTokenId(tokenId) {
    const keyByTokenId = this.getKeyStorageByTokenId(tokenId);
    const key = `${keyByTokenId}-${SPENT_COINS_STORAGE}`;
    return key;
  }

  getKeyTotalCoinsStorageByTokenId(tokenId) {
    const keyByTokenId = this.getKeyStorageByTokenId(tokenId);
    const key = `${keyByTokenId}-${TOTAL_COINS_KEY_STORAGE}`;
    return key;
  }

  getKeySpendingCoinsStorageByTokenId(tokenId) {
    const keyByTokenId = this.getKeyStorageByTokenId(tokenId);
    const key = `${keyByTokenId}-${SPENDING_COINS_STORAGE}`;
    return key;
  }

  getPrefixKeyStorage() {
    return `PRIVACY-${this.privacyVersion || PrivacyVersion.ver2}`;
  }

  getKeyCoinsStorageByTokenId(tokenId) {
    const keyByTokenId = this.getKeyStorageByTokenId(tokenId);
    const key = `${keyByTokenId}-${COINS_STORAGE}`;
    return key;
  }

  async getListUnspentCoinsStorage(tokenId) {
    try {
      if (this.storage) {
        const key = this.getKeyListUnspentCoinsByTokenId(tokenId);
        const listUnspentCoins = await this.getAccountStorage(key);
        return listUnspentCoins || [];
      }
    } catch (error) {
      throw error;
    }
  }

  async setListUnspentCoinsStorage({ value, tokenId }) {
    try {
      if (this.storage) {
        const key = this.getKeyListUnspentCoinsByTokenId(tokenId);
        const oldListUnspentCoins = await this.getListUnspentCoinsStorage(
          tokenId
        );
        console.log("LIST UNSPENT COINS CHANGE");
        console.log("oldListUnspentCoins", oldListUnspentCoins.length);
        const listUnspentCoins =
          !oldListUnspentCoins || oldListUnspentCoins.length === 0
            ? value
            : uniqBy([...oldListUnspentCoins, ...value], "KeyImage");
        console.log("listUnspentCoins", listUnspentCoins.length);
        console.log("LIST UNSPENT COINS CHANGE");
        await this.setAccountStorage(key, listUnspentCoins);
      }
    } catch (error) {
      throw error;
    }
  }

  async getTotalCoinsStorage(tokenId) {
    try {
      new Validator("tokenId", tokenId).required().string();
      if (this.storage) {
        const key = this.getKeyTotalCoinsStorageByTokenId(tokenId);
        const total = await this.getAccountStorage(key);
        return total || 0;
      }
    } catch (error) {
      throw error;
    }
  }

  async setTotalCoinsStorage({ value, tokenId }) {
    try {
      if (this.storage) {
        const key = this.getKeyTotalCoinsStorageByTokenId(tokenId);
        await this.setAccountStorage(key, value);
      }
    } catch (error) {
      throw error;
    }
  }

  getKeySpendingCoinsV1ByTokenId({ tokenId }) {
    this.setPrivacyVersion(PrivacyVersion.ver1);
    return this.getPrefixKeyStorage() + `-${tokenId}-${SPENDING_COINS_STORAGE}`;
  }

  async getSpendingCoinsV1ByTokenId({ tokenId }) {
    const key = await this.getKeySpendingCoinsV1ByTokenId({ tokenId });
    const spendingCoins = (await this.getAccountStorage(key)) || [];
    const spendingCoinsFilterByTime = spendingCoins.filter((item) => {
      const timeExist = new Date().getTime() - item?.createdAt;
      if (timeExist > 5 * 60 * 1000) {
        return false;
      }
      return true;
    });
    await this.setAccountStorage(key, spendingCoinsFilterByTime);
    return spendingCoinsFilterByTime || [];
  }

  async setSpendingCoinsV1ByTokenId({ tokenId, value }) {
    try {
      tokenId = tokenId || PRVIDSTR;
      const key = await this.getKeySpendingCoinsV1ByTokenId({ tokenId });
      let spendingCoins = await this.getSpendingCoinsV1ByTokenId({
        tokenId,
      });
      const mapCoins = value.map((item) => ({
        keyImage: item.KeyImage,
        keyImageBase64: item.KeyImageBase64,
        createdAt: new Date().getTime(),
      }));
      mapCoins.forEach((item) => {
        const isExist = spendingCoins.some(
          (coin) => coin?.KeyImage === item?.keyImage
        );
        if (!isExist) {
          spendingCoins.push(item);
        }
      });
      await this.setAccountStorage(key, spendingCoins);
    } catch (error) {
      throw error;
    }
  }

  async getSpendingCoinsStorageByTokenId(tokenId) {
    try {
      const key = await this.getKeySpendingCoinsStorageByTokenId(tokenId);
      const spendingCoins = (await this.getAccountStorage(key)) || [];
      const spendingCoinsFilterByTime = spendingCoins.filter((item) => {
        const timeExist = new Date().getTime() - item?.createdAt;
        if (timeExist > 5 * 60 * 1000) {
          return false;
        }
        return true;
      });
      await this.setAccountStorage(key, spendingCoinsFilterByTime);
      return spendingCoinsFilterByTime || [];
    } catch (error) {
      throw error;
    }
  }

  async setSpendingCoinsStorage({ coins, tokenId = PRVIDSTR } = {}) {
    try {
      new Validator("tokenId", tokenId).required().string();
      new Validator("coins", coins).required().array();
      if (!coins) {
        return;
      }
      const task = coins
        .map((item) => ({
          keyImage: item.KeyImage,
          createdAt: new Date().getTime(),
        }))
        .map(async (item) => {
          const key = this.getKeySpendingCoinsStorageByTokenId(tokenId);
          const spendingCoins = await this.getSpendingCoinsStorageByTokenId(
            tokenId
          );
          const isExist = spendingCoins.find(
            (coin) => coin?.KeyImage === item?.KeyImage
          );
          if (!isExist) {
            spendingCoins.push(item);
          }
          await this.setAccountStorage(key, spendingCoins);
        });
      await Promise.all(task);
    } catch (error) {
      throw error;
    }
  }

  async getCoinsStorage(tokenId) {
    try {
      const key = this.getKeyCoinsStorageByTokenId(tokenId);
      return this.getAccountStorage(key);
    } catch (error) {
      throw error;
    }
  }

  async setCoinsStorage({ value, tokenId }) {
    try {
      const key = this.getKeyCoinsStorageByTokenId(tokenId);
      const data = (await this.getAccountStorage(key)) || [];
      const newData = [value, ...data];
      await this.setAccountStorage(key, newData);
    } catch (error) {
      throw error;
    }
  }

  async getListSpentCoinsStorage(tokenId) {
    try {
      if (this.storage) {
        const key =
          this.getPrefixKeyStorage() +
          this.getKeyListSpentCoinsByTokenId(tokenId);
        const listUnspentCoins = await this.getAccountStorage(key);
        return listUnspentCoins || [];
      }
    } catch (error) {
      throw error;
    }
  }

  async setListSpentCoinsStorage({ spentCoins, tokenId }) {
    try {
      if (this.storage) {
        const keyStorage = this.getKeyListSpentCoinsByTokenId(tokenId);
        const oldListUnspentCoins = await this.getListSpentCoinsStorage(
          tokenId
        );
        const newListSpentCoins =
          oldListUnspentCoins?.length === 0
            ? [...spentCoins]
            : uniqBy(
                [...oldListUnspentCoins, ...spentCoins],
                (item) => item?.KeyImage
              );
        await this.setAccountStorage(keyStorage, newListSpentCoins);
      }
    } catch (error) {
      throw error;
    }
  }

  // listFollowingTokens returns list of following tokens
  listFollowingTokens() {
    return this.followingTokens;
  }

  // addFollowingToken adds token data array to following token list
  /**
   * @param {...{ID: string, Image: string, Name: string, Symbol: string, Amount: number, IsPrivacy: boolean, isInit: boolean, metaData: object}} tokenData - tokens to follow
   */
  addFollowingToken(...tokenData) {
    if (tokenData.constructor === Array) {
      const addedTokenIds = this.followingTokens.map((t) => t.ID);
      const tokenDataSet = {};
      tokenData.forEach((t) => {
        if (!addedTokenIds.includes(t.ID)) {
          tokenDataSet[t.ID] = t;
        }
      });

      const tokens = Object.values(tokenDataSet);
      this.followingTokens.unshift(...tokens);
    }
  }

  // removeFollowingToken removes token which has tokenId from list of following tokens
  /**
   *
   * @param {string} tokenId
   */
  removeFollowingToken(tokenId) {
    const removedIndex = this.followingTokens.findIndex(
      (token) => token.ID === tokenId
    );
    if (removedIndex !== -1) {
      this.followingTokens.splice(removedIndex, 1);
    }
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
  async saveNormalTxHistory(
    tx,
    receivers,
    isIn,
    isPrivacyNativeToken,
    listUTXOForPRV,
    hashOriginalTx = "",
    metaData = null,
    info = "",
    messageForNativeToken = "",
    tradeHandler = null
  ) {
    await this.setSpendingCoinsStorage({
      value: listUTXOForPRV,
      tokenId: PRVIDSTR,
    });
    if (tradeHandler) return;
    const txHistory = new TxHistoryInfo();
    const historyObj = {
      txID: tx.txId,
      amountNativeToken: tx.amountNativeToken, // in nano PRV
      amountPToken: 0,
      feeNativeToken: tx.feeNativeToken, // in nano PRV
      feePToken: 0, // in nano PRV
      typeTx: tx.typeTx,
      receivers: receivers,
      tokenName: "",
      tokenID: "",
      tokenSymbol: "",
      isIn: isIn,
      time: tx.lockTime * 1000, // in mili-second
      status: tx.txStatus,
      isPrivacyNativeToken: isPrivacyNativeToken,
      isPrivacyForPToken: false,
      listUTXOForPRV: listUTXOForPRV,
      listUTXOForPToken: [],
      hashOriginalTx: hashOriginalTx,
      metaData: metaData,
      info: info,
      messageForNativeToken: messageForNativeToken,
      messageForPToken: "",
    };

    txHistory.setHistoryInfo(historyObj);
    this.txHistory.NormalTx.unshift(txHistory);
  }

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
  async savePrivacyTokenTxHistory(
    tx,
    receivers,
    isIn,
    isPrivacyNativeToken,
    isPrivacyForPToken,
    listUTXOForPRV,
    listUTXOForPToken,
    hashOriginalTx = "",
    metaData = null,
    info = "",
    messageForNativeToken = "",
    messageForPToken = "",
    tradeHandler = null
  ) {
    await Promise.all([
      this.setSpendingCoinsStorage({
        value: listUTXOForPRV,
        tokenId: PRVIDSTR,
      }),
      this.setSpendingCoinsStorage({
        value: listUTXOForPToken,
        tokenId: tx?.tokenID,
      }),
    ]);
    if (tradeHandler) return;
    const txHistory = new TxHistoryInfo();
    const historyObj = {
      txID: tx.txId,
      amountNativeToken: tx.amountNativeToken, // in nano PRV
      amountPToken: tx.amountPToken,
      feeNativeToken: tx.feeNativeToken, // in nano PRV
      feePToken: tx.feePToken, // in nano PRV
      typeTx: tx.typeTx,
      receivers: receivers,
      tokenName: tx.tokenName,
      tokenID: tx.tokenID,
      tokenSymbol: tx.tokenSymbol,
      tokenTxType: tx.tokenTxType,
      isIn: isIn,
      time: tx.lockTime * 1000, // in mili-second
      status: tx.txStatus,
      isPrivacyNativeToken: isPrivacyNativeToken,
      isPrivacyForPToken: isPrivacyForPToken,
      listUTXOForPRV: listUTXOForPRV,
      listUTXOForPToken: listUTXOForPToken,
      hashOriginalTx: hashOriginalTx,
      metaData: metaData,
      info: info,
      messageForNativeToken: messageForNativeToken,
      messageForPToken: messageForPToken,
    };
    txHistory.setHistoryInfo(historyObj);
    this.txHistory.PrivacyTokenTx.unshift(txHistory);
  }

  // getNormalTxHistory return history of normal txs
  getNormalTxHistory() {
    return this.txHistory.NormalTx;
  }

  // getPrivacyTokenTxHistory return history of normal txs
  getPrivacyTokenTxHistory() {
    return this.txHistory.PrivacyTokenTx;
  }

  // getPrivacyTokenTxHistoryByTokenID returns privacy token tx history with specific tokenID
  /**
   *
   * @param {string} id
   */
  getPrivacyTokenTxHistoryByTokenID(id) {
    const queryResult = new Array();
    for (let i = 0; i < this.txHistory.PrivacyTokenTx.length; i++) {
      if (this.txHistory.PrivacyTokenTx[i].tokenID === id) {
        queryResult.push(this.txHistory.PrivacyTokenTx[i]);
      }
    }
    return queryResult;
  }

  async replaceTx(
    txId,
    newFee,
    newFeePToken,
    newInfo = null,
    newMessageForNativeToken = null,
    isEncryptMessageOutCoinNativeToken = true,
    newMessageForPToken = null,
    isEncryptMessageOutCoinPToken = true
  ) {
    // get tx history by txID
    const txHistory = this.getTxHistoryByTxID(txId);

    // check type of tx
    const txType = txHistory.typeTx;

    let response;

    if (txType == TxNormalType) {
      try {
        response = await this.replaceTxNormal(
          txHistory,
          newFee,
          newInfo,
          newMessageForNativeToken,
          isEncryptMessageOutCoinNativeToken
        );
      } catch (e) {
        throw e;
      }
    } else if (txType == TxCustomTokenPrivacyType) {
      try {
        response = await this.replaceTxPToken(
          txHistory,
          newFee,
          newFeePToken,
          newInfo,
          newMessageForNativeToken,
          isEncryptMessageOutCoinNativeToken,
          newMessageForPToken,
          isEncryptMessageOutCoinPToken
        );
      } catch (e) {
        throw e;
      }
    } else {
      throw CustomError(ErrorObject.InvalidTypeTXToReplaceErr, "");
    }
    return response;
  }

  /**
   *
   * @param {TxHistory} txHistory
   * @param {number} newFee
   */
  async replaceTxNormal(
    txHistory,
    newFee,
    newInfo = null,
    newMessage = null,
    isEncryptMessageOutCoin = true
  ) {
    // check new fee (just for PRV)
    if (
      newFee <
      txHistory.feeNativeToken +
        Math.ceil((PercentFeeToReplaceTx * txHistory.feeNativeToken) / 100)
    ) {
      throw new error("New fee must be greater than 10% old fee");
    }

    // get UTXO
    const listUTXO = txHistory.listUTXOForPRV;

    await this.updateProgressTx(10);
    const feeBN = new bn(newFee);

    let messageForNativeToken = txHistory.messageForNativeToken || "";
    if (newMessage != null) {
      messageForNativeToken = newMessage;
    }

    let paramPaymentInfos = new Array(txHistory.receivers.length);
    for (let i = 0; i < paramPaymentInfos.length; i++) {
      paramPaymentInfos[i] = {
        paymentAddressStr: txHistory.receivers[i],
        amount: new bn(txHistory.amountNativeToken).toString(),
        message: messageForNativeToken,
      };
    }

    // encrypt message for output coins
    if (isEncryptMessageOutCoin) {
      try {
        paramPaymentInfos = await encryptMessageOutCoin(paramPaymentInfos);
      } catch (e) {}
    } else {
      for (let i = 0; i < paramPaymentInfos.length; i++) {
        if (paramPaymentInfos[i].message != null) {
          paramPaymentInfos[i].message = base64Encode(
            stringToBytes(paramPaymentInfos[i].message)
          );
        }
      }
    }

    const receiverPaymentAddrStr = txHistory.receivers;
    const totalAmountTransfer = new bn(txHistory.amountNativeToken);
    const isPrivacy = txHistory.isPrivacyNativeToken;
    let info = txHistory.info || "";
    if (newInfo != null) {
      info = newInfo;
    }

    const senderSkStr = this.key.base58CheckSerialize(PriKeyType);
    // let paymentAddressStr = this.key.base58CheckSerialize(PaymentAddressType);
    // let viewingKeyStr = this.key.base58CheckSerialize(ReadonlyKeyType);

    console.time("Time for create and send tx");
    try {
      // prepare input for tx
      console.time("Time for preparing input for privacy tx");
      const inputForTx = await prepareInputForReplaceTxNormal(
        listUTXO,
        isPrivacy,
        null,
        this,
        this.rpc
      );
      console.timeEnd("Time for preparing input for privacy tx");

      await this.updateProgressTx(30);

      let nOutput = receiverPaymentAddrStr.length;
      if (
        inputForTx.totalValueInput.cmp(totalAmountTransfer.add(feeBN)) === 1
      ) {
        nOutput++;
      }

      let sndOutputStrs;
      const sndOutputs = new Array(nOutput);
      if (nOutput > 0) {
        sndOutputStrs = await wasmFuncs.randomScalars(nOutput.toString());
        if (sndOutputStrs === null || sndOutputStrs === "") {
          throw new Error("Can not random scalars for output coins");
        }

        const sndDecodes = base64Decode(sndOutputStrs);

        for (let i = 0; i < nOutput; i++) {
          const sndBytes = sndDecodes.slice(
            i * ED25519_KEY_SIZE,
            (i + 1) * ED25519_KEY_SIZE
          );
          sndOutputs[i] = checkEncode(sndBytes, ENCODE_VERSION);
        }
      }

      const paramInitTx = newParamInitTx(
        senderSkStr,
        paramPaymentInfos,
        inputForTx.inputCoinStrs,
        feeBN.toString(),
        isPrivacy,
        null,
        txHistory.metaData,
        info,
        inputForTx.commitmentIndices,
        inputForTx.myCommitmentIndices,
        inputForTx.commitmentStrs,
        sndOutputs
      );

      let resInitTx;
      const paramInitTxJson = JSON.stringify(paramInitTx);

      resInitTx = await wasmFuncs.initPrivacyTx(paramInitTxJson);
      if (resInitTx === null || resInitTx === "") {
        throw new CustomError(
          ErrorObject.InitNormalTxErr,
          "Can not init transaction tranfering PRV"
        );
      }

      // base64 decode txjson
      const resInitTxBytes = base64Decode(resInitTx);

      // get b58 check encode tx json
      const b58CheckEncodeTx = checkEncode(
        resInitTxBytes.slice(0, resInitTxBytes.length - 8),
        ENCODE_VERSION
      );

      // get lock time tx
      const lockTimeBytes = resInitTxBytes.slice(resInitTxBytes.length - 8);
      const lockTime = new bn(lockTimeBytes).toNumber();

      await this.updateProgressTx(60);
      console.time("Time for sending tx");
      let response;
      try {
        response = await this.rpc.sendRawTx(b58CheckEncodeTx);
      } catch (e) {
        throw new CustomError(
          ErrorObject.SendTxErr,
          "Can not send PRV transaction",
          e
        );
      }
      await this.updateProgressTx(90);
      console.timeEnd("Time for sending tx");
      console.timeEnd("Time for create and send tx");

      // saving history tx
      // check status of tx and add coins to spending coins
      let status = FailedTx;
      if (response.txId) {
        // tx.txId = response.txId
        status = SuccessTx;

        response.typeTx = TxNormalType;
        response.feeNativeToken = feeBN.toString();
        response.lockTime = lockTime;
        response.amountNativeToken = totalAmountTransfer.toString();
        response.txStatus = status;
      }

      // saving history tx
      this.saveNormalTxHistory(
        response,
        receiverPaymentAddrStr,
        false,
        isPrivacy,
        listUTXO,
        "",
        null,
        info,
        messageForNativeToken
      );

      await this.updateProgressTx(100);
      return response;
    } catch (e) {
      await this.updateProgressTx(0);

      throw e;
    }
  }

  async replaceTxPToken(
    txHistory,
    newFee,
    newFeePToken,
    newInfo = null,
    newMessageForNativeToken = null,
    isEncryptMessageOutCoinNativeToken = true,
    newMessageForPToken = null,
    isEncryptMessageOutCoinPToken = true
  ) {
    await this.updateProgressTx(10);
    // check new fee
    if (
      newFee <
        txHistory.feeNativeToken +
          Math.ceil((PercentFeeToReplaceTx * txHistory.feeNativeToken) / 100) &&
      newFeePToken <
        txHistory.feePToken +
          Math.ceil((PercentFeeToReplaceTx * txHistory.feePToken) / 100)
    ) {
      throw new error("New fee must be greater than 10% old fee");
    }

    const feeNativeToken = newFee;
    const feePToken = newFeePToken;

    const hasPrivacyForNativeToken = txHistory.isPrivacyNativeToken;
    let info = txHistory.info || "";
    if (newInfo != null) {
      info = newInfo;
    }

    let messageForNativeToken = txHistory.messageForNativeToken || "";
    if (newMessageForNativeToken != null) {
      messageForNativeToken = newMessageForNativeToken;
    }
    let messageForPToken = txHistory.messageForPToken || "";
    if (newMessageForPToken != null) {
      messageForPToken = newMessageForPToken;
    }

    let paramPaymentInfosForNativeToken = [];
    if (txHistory.amountNativeToken > 0) {
      paramPaymentInfosForNativeToken = new Array(txHistory.receivers.length);

      for (let i = 0; i < paramPaymentInfosForNativeToken.length; i++) {
        paramPaymentInfosForNativeToken[i] = {
          paymentAddressStr: txHistory.receivers[i],
          amount: new bn(txHistory.amountNativeToken).toString(),
          message: messageForNativeToken,
        };
      }
    }

    const amountTransferPRV = new bn(txHistory.amountNativeToken);

    // encrypt message for output coins native token
    if (isEncryptMessageOutCoinNativeToken) {
      try {
        paramPaymentInfosForNativeToken = await encryptMessageOutCoin(
          paramPaymentInfosForNativeToken
        );
      } catch (e) {}
    } else {
      for (let i = 0; i < paramPaymentInfosForNativeToken.length; i++) {
        if (paramPaymentInfosForNativeToken[i].message != null) {
          paramPaymentInfosForNativeToken[i].message = base64Encode(
            stringToBytes(paramPaymentInfosForNativeToken[i].message)
          );
        }
      }
    }

    // token param
    // get current token to get token param
    const tokenParamJson = {
      propertyID: txHistory.tokenID,
      propertyName: txHistory.tokenName,
      propertySymbol: txHistory.tokenSymbol,
      amount: new bn(txHistory.amountPToken).toString(),
      tokenTxType: txHistory.tokenTxType,
      fee: feePToken ? new bn(feePToken).toString() : "0",
      paymentInfoForPToken: [
        {
          paymentAddressStr: txHistory.receivers[0],
          amount: new bn(txHistory.amountPToken).toString(),
          message: messageForPToken,
        },
      ],
      tokenInputs: [],
    };

    // encrypt message for output coins native token
    if (isEncryptMessageOutCoinPToken) {
      try {
        tokenParamJson.paymentInfoForPToken = await encryptMessageOutCoin(
          tokenParamJson.paymentInfoForPToken
        );
      } catch (e) {}
    } else {
      for (let i = 0; i < tokenParamJson.paymentInfoForPToken.length; i++) {
        if (tokenParamJson.paymentInfoForPToken[i].message != null) {
          tokenParamJson.paymentInfoForPToken[i].message = base64Encode(
            stringToBytes(tokenParamJson.paymentInfoForPToken[i].message)
          );
        }
      }
    }

    const amountTransferPToken = new bn(txHistory.amountPToken);

    const senderSkStr = this.key.base58CheckSerialize(PriKeyType);

    const listUTXOForPRV = txHistory.listUTXOForPRV;
    const listUTXOForPToken = txHistory.listUTXOForPToken;

    // try {

    console.time("Time for preparing input for custom token tx");
    const inputForTx = await prepareInputForReplaceTxNormal(
      listUTXOForPRV,
      hasPrivacyForNativeToken,
      null,
      this,
      this.rpc
    );
    console.timeEnd("Time for preparing input for custom token tx");
    await this.updateProgressTx(30);

    const hasPrivacyForPToken = txHistory.isPrivacyForPToken;
    const tokenID = txHistory.tokenID;
    const inputForPrivacyTokenTx = await prepareInputForReplaceTxPrivacyToken(
      listUTXOForPToken,
      this,
      this.rpc,
      hasPrivacyForPToken,
      tokenID
    );
    await this.updateProgressTx(50);
    tokenParamJson.tokenInputs = inputForPrivacyTokenTx.tokenInputs;

    // verify tokenID if transfering token
    // let listCustomTokens = inputForPrivacyTokenTx.listPrivacyToken;
    // if (submitParam.TokenTxType === CustomTokenTransfer) {
    //   let i = 0;
    //   for (i = 0; i < listCustomTokens.length; i++) {
    //     if (listCustomTokens[i].ID.toLowerCase() === tokenParamJson.propertyID) {
    //       break;
    //     }
    //   }
    //   if (i === listCustomTokens.length) {
    //     throw new Error("invalid token ID")
    //   }
    // }

    let nOutputForNativeToken = paramPaymentInfosForNativeToken.length;
    if (inputForTx.totalValueInput.cmp(amountTransferPRV) === 1) {
      nOutputForNativeToken++;
    }

    // random snd for output native token
    let sndOutputStrsForNativeToken;
    const sndOutputsForNativeToken = new Array(nOutputForNativeToken);
    if (nOutputForNativeToken > 0) {
      sndOutputStrsForNativeToken = await wasmFuncs.randomScalars(
        nOutputForNativeToken.toString()
      );
      if (
        sndOutputStrsForNativeToken === null ||
        sndOutputStrsForNativeToken === ""
      ) {
        throw new Error("Can not random scalar for native token outputs");
      }
      const sndDecodes = base64Decode(sndOutputStrsForNativeToken);

      for (let i = 0; i < nOutputForNativeToken; i++) {
        const sndBytes = sndDecodes.slice(
          i * ED25519_KEY_SIZE,
          (i + 1) * ED25519_KEY_SIZE
        );
        sndOutputsForNativeToken[i] = checkEncode(sndBytes, ENCODE_VERSION);
      }
    }

    // random snd for output native token
    let nOutputForPToken = tokenParamJson.paymentInfoForPToken.length;
    if (
      inputForPrivacyTokenTx.totalValueInput.cmp(
        amountTransferPToken.add(new bn(feePToken))
      ) === 1
    ) {
      nOutputForPToken++;
    }

    let sndOutputStrsForPToken;
    const sndOutputsForPToken = new Array(nOutputForPToken);
    if (nOutputForPToken > 0) {
      sndOutputStrsForPToken = await wasmFuncs.randomScalars(
        nOutputForPToken.toString()
      );
      if (sndOutputStrsForPToken === null || sndOutputStrsForPToken === "") {
        throw new Error("Can not random scalar for privacy token outputs");
      }
      const sndDecodes = base64Decode(sndOutputStrsForPToken);

      for (let i = 0; i < nOutputForPToken; i++) {
        const sndBytes = sndDecodes.slice(
          i * ED25519_KEY_SIZE,
          (i + 1) * ED25519_KEY_SIZE
        );
        sndOutputsForPToken[i] = checkEncode(sndBytes, ENCODE_VERSION);
      }
    }

    const paramInitTx = newParamInitPrivacyTokenTx(
      senderSkStr,
      paramPaymentInfosForNativeToken,
      inputForTx.inputCoinStrs,
      feeNativeToken ? new bn(feeNativeToken).toString() : "0",
      hasPrivacyForNativeToken,
      hasPrivacyForPToken,
      tokenParamJson,
      txHistory.metaData,
      info,
      inputForTx.commitmentIndices,
      inputForTx.myCommitmentIndices,
      inputForTx.commitmentStrs,
      sndOutputsForNativeToken,
      inputForPrivacyTokenTx.commitmentIndices,
      inputForPrivacyTokenTx.myCommitmentIndices,
      inputForPrivacyTokenTx.commitmentStrs,
      sndOutputsForPToken
    );

    let resInitTx;
    const paramInitTxJson = JSON.stringify(paramInitTx);
    resInitTx = await wasmFuncs.initPrivacyTokenTx(paramInitTxJson);
    if (resInitTx === null || resInitTx === "") {
      throw new CustomError(
        ErrorObject.InitNormalTxErr,
        "Can not init transaction tranfering PRV"
      );
    }

    // base64 decode txjson
    const resInitTxBytes = base64Decode(resInitTx);

    // get b58 check encode tx json
    const b58CheckEncodeTx = checkEncode(
      resInitTxBytes.slice(0, resInitTxBytes.length - 40),
      ENCODE_VERSION
    );

    // get lock time tx
    const lockTimeBytes = resInitTxBytes.slice(
      resInitTxBytes.length - 40,
      resInitTxBytes.length - 32
    );
    const lockTime = new bn(lockTimeBytes).toNumber();
    // let tokenIDBytes = resInitTxBytes.slice(resInitTxBytes.length - 32);
    // let tokenID = convertHashToStr(tokenIDBytes).toLowerCase();
    //

    // // verify tokenID if initing token
    // if (submitParam.TokenTxType === CustomTokenInit) {
    //   // validate PropertyID is the only one
    //   for (let i = 0; i < listCustomTokens.length; i++) {
    //     if (tokenID === listCustomTokens[i].ID.toLowerCase()) {
    //       throw new Error("privacy token privacy is existed");
    //     }
    //   }
    // }

    await this.updateProgressTx(80);

    let response;
    try {
      response = await this.rpc.sendRawTxCustomTokenPrivacy(b58CheckEncodeTx);
    } catch (e) {
      throw new CustomError(
        ErrorObject.SendTxErr,
        "Can not send privacy token tx",
        e
      );
    }

    await this.updateProgressTx(90);
    // saving history tx
    // check status of tx
    // check status of tx and add coins to spending coins
    let status = FailedTx;
    if (response.txId) {
      status = SuccessTx;
      response.typeTx = TxCustomTokenPrivacyType;
      response.feeNativeToken = feeNativeToken;
      response.feePToken = feePToken;
      response.lockTime = lockTime;
      response.amountNativeToken = amountTransferPRV.toString();
      response.amountPToken = amountTransferPToken.toString();
      response.txStatus = status;
      response.tokenName = tokenParamJson.propertyName;
      response.tokenID = tokenID;
      response.tokenSymbol = tokenParamJson.propertySymbol;
      response.tokenTxType = tokenParamJson.tokenTxType;

      // add to following token list if tx is init token
      // if (submitParam.TokenTxType === CustomTokenInit) {
      //   let identicon = await this.rpc.hashToIdenticon([tokenID]);
      //   this.addFollowingToken({
      //     ID: tokenID,
      //     Image: identicon.images[0],
      //     Name: tokenParamJson.propertyName,
      //     Symbol: tokenParamJson.propertySymbol,
      //     Amount: tokenParamJson.amount,
      //     IsPrivacy: true,
      //     isInit: true,
      //     metaData: {},
      //   });
      //
      // }
    }

    // check is init or transfer token
    const isIn = false;
    // if (submitParam.TokenTxType === CustomTokenInit) {
    //   isIn = true;
    // } else {
    //   isIn = false;
    // }

    this.savePrivacyTokenTxHistory(
      response,
      txHistory.receivers,
      isIn,
      hasPrivacyForNativeToken,
      hasPrivacyForPToken,
      listUTXOForPRV,
      listUTXOForPToken,
      txHistory.txID,
      null,
      info,
      messageForNativeToken,
      messageForPToken
    );

    await this.updateProgressTx(100);
    return response;
  }

  // toSerializedAccountObj returns account with encoded key set
  toSerializedAccountObj() {
    return {
      AccountName: this.name,
      PrivateKey: this.key.base58CheckSerialize(PriKeyType),
      PaymentAddress: this.key.base58CheckSerialize(PaymentAddressType),
      ReadonlyKey: this.key.base58CheckSerialize(ReadonlyKeyType),
      PublicKey: this.key.getPublicKeyByHex(),
      PublicKeyCheckEncode: this.key.getPublicKeyCheckEncode(),
      PublicKeyBytes: this.key.KeySet.PaymentAddress.Pk.toString(),
      ValidatorKey: checkEncode(
        hashSha3BytesToBytes(hashSha3BytesToBytes(this.key.KeySet.PrivateKey)),
        ENCODE_VERSION
      ),
    };
  }

  /**
   *
   */
  // stakerStatus return status of staker
  // return object {{Role: int, ShardID: int}}
  // Role: -1: is not staked, 0: candidate, 1: validator
  // ShardID: beacon: -1, shardID: 0->MaxShardNumber
  async stakerStatus() {
    const blsPubKeyB58CheckEncode =
      await this.key.getBLSPublicKeyB58CheckEncode();

    let reps;
    try {
      reps = await this.rpc.getPublicKeyRole("bls:" + blsPubKeyB58CheckEncode);
    } catch (e) {
      throw e;
    }

    return reps.status;
  }

  async getReceivedTransaction() {
    const rpcClient = this.rpc;
    // call api to get info from node
    const paymentAddress = this.key.base58CheckSerialize(PaymentAddressType);
    const viewingKey = this.key.base58CheckSerialize(ReadonlyKeyType);

    // cal rpc to get data
    let txs = await rpcClient.getTransactionByReceiver(
      paymentAddress,
      viewingKey
    );
    txs = txs.receivedTransactions;
    if (txs.length > 0) {
      this.txReceivedHistory.NormalTx = [];
      this.txReceivedHistory.PrivacyTokenTx = [];
      this.txReceivedHistory.CustomTokenTx = [];
    }
    for (let i = 0; i < txs.length; i++) {
      // loop and parse into history tx object
      const tx = txs[i];

      let messageForNativeToken = "";
      let messageForPToken = "";
      if (tx.ReceivedAmounts[PRVIDSTR]) {
        //
        messageForNativeToken = await decryptMessageOutCoin(
          this,
          tx.ReceivedAmounts[PRVIDSTR].CoinDetails.Info
        );
      }
      if (tx.ReceivedAmounts[tx.PrivacyCustomTokenID]) {
        //
        messageForPToken = await decryptMessageOutCoin(
          this,
          tx.ReceivedAmounts[tx.PrivacyCustomTokenID].CoinDetails.Info
        );
      }

      let infoDecode = checkDecode(tx.Info).bytesDecoded;
      infoDecode = bytesToString(infoDecode);

      try {
        const historyObj = {
          txID: tx.Hash,
          amountNativeToken: tx.ReceivedAmounts[PRVIDSTR]
            ? tx.ReceivedAmounts[PRVIDSTR].CoinDetails.Value
            : 0, // in nano PRV
          amountPToken: tx.ReceivedAmounts[tx.PrivacyCustomTokenID]
            ? tx.ReceivedAmounts[tx.PrivacyCustomTokenID].CoinDetails.Value
            : 0,
          feeNativeToken: tx.Fee, // in nano PRV
          feePToken: tx.PrivacyCustomTokenFee,
          typeTx: tx.Type,
          receivers: null,
          tokenName: tx.PrivacyCustomTokenName,
          tokenID: tx.PrivacyCustomTokenID,
          tokenSymbol: tx.PrivacyCustomTokenIDSymbol,
          isIn: true,
          time: new Date(tx.LockTime).getTime(), // in mili-second
          status: null,
          isPrivacyNativeToken: null,
          isPrivacyForPToken: null,
          listUTXOForPRV: [],
          listUTXOForPToken: [],
          hashOriginalTx: "",
          metaData: tx.Metadata,
          info: infoDecode,
          messageForNativeToken: messageForNativeToken,
          messageForPToken: messageForPToken,
        };

        const txHistoryInfo = new TxHistoryInfo();
        txHistoryInfo.setHistoryInfo(historyObj);
        switch (tx.Type) {
          case TxNormalType: {
            this.txReceivedHistory.NormalTx.push(txHistoryInfo);
          }
          case TxCustomTokenPrivacyType: {
            this.txReceivedHistory.PrivacyTokenTx.push(txHistoryInfo);
          }
        }
      } catch (e) {}
    }
    return this.txReceivedHistory;
  }

  async getDeserializeInformation() {
    const privateKey = this.key.base58CheckSerialize(PriKeyType);
    if (deserializedAccounts[privateKey]) {
      return {
        ...deserializedAccounts[privateKey],
        AccountName: this.name,
      };
    }
    const miningSeedKey = hashSha3BytesToBytes(
      hashSha3BytesToBytes(this.key.KeySet.PrivateKey)
    );
    const blsPublicKey = await generateBLSPubKeyB58CheckEncodeFromSeed(
      miningSeedKey
    );
    const information = {
      ID: getChildIdFromChildNumberArray(this.key.ChildNumber),
      AccountName: this.name,
      PrivateKey: privateKey,
      PaymentAddress: this.key.base58CheckSerialize(PaymentAddressType),
      ReadonlyKey: this.key.base58CheckSerialize(ReadonlyKeyType),
      PublicKey: this.key.getPublicKeyByHex(),
      PublicKeyCheckEncode: this.key.getPublicKeyCheckEncode(),
      ValidatorKey: checkEncode(miningSeedKey, ENCODE_VERSION),
      BLSPublicKey: blsPublicKey,
      PublicKeyBytes: this.key.KeySet.PaymentAddress.Pk.toString(),
      OTAKey: this.getOTAKey(),
    };
    deserializedAccounts[privateKey] = information;
    return information;
  }

  getPrivateKey() {
    return this.key.base58CheckSerialize(PriKeyType);
  }

  async updateAllTransactionsStatus() {
    if (this.txHistory) {
      if (this.txHistory.NormalTx) {
        for (let j = 0; j < this.txHistory.NormalTx.length; j++) {
          // get transaction was sended successfully
          if (this.txHistory.NormalTx[j].status === SuccessTx) {
            let response;
            try {
              response = await this.rpc.getTransactionByHash(
                this.txHistory.NormalTx[j].txID
              );
            } catch (e) {
              throw new CustomError(
                ErrorObject.GetTxByHashErr,
                e.message || "Can not get normal transaction by hash"
              );
            }

            if (response.isInBlock) {
              // transaction was confirmed
              this.txHistory.NormalTx[j].status = ConfirmedTx;
            } else if (
              !response.isInBlock &&
              !response.isInMempool &&
              response.err !== null
            ) {
              // transaction is not existed in mempool and block
              this.txHistory.NormalTx[j].status = FailedTx;
            }
          }
        }
      }

      if (this.txHistory.CustomTokenTx) {
        for (let j = 0; j < this.txHistory.CustomTokenTx.length; j++) {
          // get transaction was sended successfully
          if (this.txHistory.CustomTokenTx[j].status === SuccessTx) {
            let response;
            try {
              response = await this.rpc.getTransactionByHash(
                this.txHistory.CustomTokenTx[j].txID
              );
            } catch (e) {
              throw new CustomError(
                ErrorObject.GetTxByHashErr,
                e.message || "Can not get custom token transaction by hash"
              );
            }

            if (response.isInBlock) {
              // transaction was confirmed
              this.txHistory.CustomTokenTx[j].status = ConfirmedTx;
            } else if (
              !response.isInBlock &&
              !response.isInMempool &&
              response.err !== null
            ) {
              // transaction is not existed in mempool and block
              this.txHistory.CustomTokenTx[j].status = FailedTx;
            }
          }
        }
      }

      if (this.txHistory.PrivacyTokenTx) {
        for (let j = 0; j < this.txHistory.PrivacyTokenTx.length; j++) {
          // get transaction was sended successfully
          if (this.txHistory.PrivacyTokenTx[j].status === SuccessTx) {
            let response;
            try {
              response = await this.rpc.getTransactionByHash(
                this.txHistory.PrivacyTokenTx[j].txID
              );
            } catch (e) {
              throw new CustomError(
                ErrorObject.GetTxByHashErr,
                e.message || "Can not get privacy token transaction by hash"
              );
            }

            if (response.isInBlock) {
              // transaction was confirmed
              this.txHistory.PrivacyTokenTx[j].status = ConfirmedTx;
            } else if (
              !response.isInBlock &&
              !response.isInMempool &&
              response.err !== null
            ) {
              // transaction is not existed in mempool and block
              this.txHistory.PrivacyTokenTx[j].status = FailedTx;
            }
          }
        }
      }
    }
  }

  async getListOutputCoinsV1({ tokenId, total }) {
    try {
      const viewKey = this.getReadonlyKey();
      const version = this.privacyVersion;
      const key = this.getKeyParamOfCoins(viewKey);
      let listOutputsCoins = [];
      if (total > LIMIT_COINS) {
        const { times, remainder } =
          this.getLimitOffSetListOuputCoinsWhenBreakSizeLimit(total);
        const task = [...Array(times)].map((item, index) => {
          const limit = LIMIT_COINS;
          const offset = index * LIMIT_COINS;
          return this.rpcCoinService.apiGetListOutputCoins({
            key,
            tokenId,
            limit,
            offset,
            version,
          });
        });
        if (remainder > 0) {
          task.push(
            this.rpcCoinService.apiGetListOutputCoins({
              key,
              tokenId,
              limit: LIMIT_COINS,
              offset: times * LIMIT_COINS,
              version,
            })
          );
        }
        const result = await Promise.all(task);
        listOutputsCoins = result.reduce((prev, curr, index) => {
          return [...prev, ...[...curr]];
        }, []);
      } else {
        listOutputsCoins = await this.rpcCoinService.apiGetListOutputCoins({
          key,
          limit: total,
          offset: 0,
          tokenId,
          version,
        });
      }
      listOutputsCoins = uniqBy(listOutputsCoins, "KeyImage");
      return listOutputsCoins;
    } catch (e) {
      throw new CustomError(
        ErrorObject.GetOutputCoinsErr,
        e.message ||
          `Can not get output coins v1 when get unspent token ${tokenId}`
      );
    }
  }

  getKeyParamOfCoins(key) {
    let keyName = "";
    switch (this.privacyVersion) {
      case PrivacyVersion.ver1:
        keyName = "viewkey";
        break;
      case PrivacyVersion.ver2:
        keyName = "otakey";
        break;
      default:
        break;
    }
    const result = `${keyName}=${key}`;
    return result;
  }

  async getListOutputCoinsV2({ tokenId, total }) {
    try {
      new Validator("tokenId", tokenId).required().string();
      new Validator("total", total).required().number();
      const otaKey = this.getOTAKey();
      const version = this.privacyVersion;
      let listOutputsCoins = [];
      const oldTotal = await this.getTotalCoinsStorage(tokenId);
      const key = this.getKeyParamOfCoins(otaKey);
      if (total > LIMIT_COINS) {
        const { times, remainder } =
          this.getLimitOffSetListOuputCoinsWhenBreakSizeLimit(total);
        const task = [...Array(times)].map((item, index) => {
          const limit = LIMIT_COINS;
          const offset = index * LIMIT_COINS + oldTotal;
          return this.rpcCoinService.apiGetListOutputCoins({
            key,
            tokenId,
            limit,
            offset,
            version,
          });
        });
        if (remainder > 0) {
          task.push(
            this.rpcCoinService.apiGetListOutputCoins({
              key,
              tokenId,
              limit: LIMIT_COINS,
              offset: times * LIMIT_COINS + oldTotal,
              version,
            })
          );
        }
        const result = await Promise.all(task);
        listOutputsCoins = result.reduce((prev, curr, index) => {
          const result = [...prev, ...[...curr]];
          return result;
        }, []);
      } else {
        listOutputsCoins = await this.rpcCoinService.apiGetListOutputCoins({
          key,
          limit: total,
          offset: oldTotal,
          tokenId,
          version,
        });
      }
      this.coinsStorage.totalCoinsSize = listOutputsCoins.length;
      listOutputsCoins = uniqBy(listOutputsCoins, "PublicKey");
      return listOutputsCoins;
    } catch (e) {
      throw new CustomError(
        ErrorObject.GetOutputCoinsErr,
        e.message ||
          `Can not get output coins when get unspent token ${tokenId}`
      );
    }
  }

  async getListOutputsCoins({ tokenId, total }) {
    switch (this.privacyVersion) {
      case PrivacyVersion.ver1:
        return this.getListOutputCoinsV1({ tokenId, total });
      default:
        return this.getListOutputCoinsV2({ tokenId, total });
    }
  }

  async storeListSpentCoins({ tokenId, spentCoins }) {
    await this.setListSpentCoinsStorage({
      spentCoins: spentCoins?.map((item) => ({
        TxRandom: item.TxRandom,
        KeyImage: item.KeyImage,
        Value: item.Value,
        KeyImageBase64: item.keyImageBase64,
      })),
      tokenId,
    });
  }

  /**
   * @param tokenId
   */
  async getKeyInfo(tokenId) {
    try {
      new Validator(VALIDATOR.tokenId, tokenId).required().string();
      let keyInfo = this.keyInfo;
      const version = this.privacyVersion;
      const otaKey = this.getOTAKey();
      if (isEmpty(keyInfo)) {
        keyInfo = await this.rpcCoinService.apiGetKeyInfo({
          key: otaKey,
          version,
        });
      }
      let total = 0;
      if (keyInfo && keyInfo.coinindex && keyInfo.coinindex[tokenId]) {
        total = keyInfo.coinindex[tokenId].Total || 0;
      }
      return {
        total,
      };
    } catch (error) {
      throw error;
    }
  }

  async decryptCoins({ coins }) {
    try {
      const privateKey = this.key.base58CheckSerialize(PriKeyType);
      let task = coins.map((coin) => {
        const param = {
          KeySet: privateKey,
          Coin: coin,
        };
        return wasmFuncs.decryptCoin(JSON.stringify(param));
      });
      let result = await Promise.all(task);
      result = [...result.map((coin) => JSON.parse(coin))];
      result = result.map((coin) => {
        return {
          ...coin,
          CoinCommitment: coin?.Commitment,
        };
      });
      return result || [];
    } catch (error) {
      throw error;
    }
  }

  getKeyImagesBase64Encode({ coinsDecrypted }) {
    return coinsDecrypted.map((coin) => coin.KeyImage);
  }

  async checkKeyImageV1({ listOutputsCoins, shardId, tokenId }) {
    const coinsDecrypted = await this.measureAsyncFn(
      this.decryptCoins,
      "timeCheckKeyImages.timeGetDecryptCoinsV1",
      { coins: listOutputsCoins }
    );
    const keyImages = this.getKeyImagesBase64Encode({ coinsDecrypted });
    let unspentCoins = [];
    let spentCoins = [];
    if (keyImages.length !== 0) {
      const keyImagesStatus = await this.measureAsyncFn(
        this.rpcCoinService.apiCheckKeyImages,
        "timeCheckKeyImages.timeCheckKeyImagesV1",
        {
          keyImages,
          shardId,
        }
      );
      unspentCoins = coinsDecrypted?.filter(
        (coin, index) => !keyImagesStatus[index]
      );
      spentCoins = coinsDecrypted?.filter(
        (coin, index) => keyImagesStatus[index]
      );
      this.coinsV1Storage.totalKeyImagesSize = keyImagesStatus.length;
    }
    this.coinsV1Storage.totalCoinsUnspentSize = unspentCoins.length;
    this.coinsV1Storage.totalCoinsSpentSize = spentCoins.length;
    return unspentCoins;
  }

  async checkKeyImageV2({ listOutputsCoins, shardId, tokenId }) {
    const coinsDecrypted = await this.measureAsyncFn(
      this.decryptCoins,
      "timeCheckKeyImages.timeGetDecryptCoins",
      { coins: listOutputsCoins }
    );
    const keyImages = this.getKeyImagesBase64Encode({ coinsDecrypted });
    let unspentCoins = [];
    let spentCoins = [];
    if (keyImages.length !== 0) {
      const keyImagesStatus = await this.measureAsyncFn(
        this.rpcCoinService.apiCheckKeyImages,
        "timeCheckKeyImages.timeCheckKeyImages",
        {
          keyImages,
          shardId,
        }
      );
      unspentCoins = coinsDecrypted?.filter(
        (coin, index) => !keyImagesStatus[index]
      );
      spentCoins = coinsDecrypted?.filter(
        (coin, index) => keyImagesStatus[index]
      );
      await this.measureAsyncFn(
        this.storeListSpentCoins,
        "timeCheckKeyImages.timeStoreListSpentCoins",
        {
          tokenId,
          spentCoins,
        }
      );
      this.coinsStorage.totalKeyImagesSize = keyImagesStatus.length;
    }
    this.coinsStorage.totalCoinsUnspentSize = unspentCoins.length;
    this.coinsStorage.totalCoinsSpentSize = spentCoins.length;
    return unspentCoins;
  }

  async checkKeyImages({ listOutputsCoins, shardId, tokenId }) {
    switch (this.privacyVersion) {
      case PrivacyVersion.ver1:
        return this.checkKeyImageV1({ listOutputsCoins, shardId, tokenId });
      default:
        return this.checkKeyImageV2({ listOutputsCoins, shardId, tokenId });
    }
  }

  getLimitOffSetListOuputCoinsWhenBreakSizeLimit(size) {
    const times = Math.floor(size / LIMIT_COINS);
    const remainder = size % LIMIT_COINS;
    return {
      times,
      remainder,
    };
  }

  async measureAsyncFn(fn, key, args) {
    const t = performance.now();
    let result;
    if (typeof fn === "function") {
      result = await fn.call(this, args);
    }
    const e = performance.now() - t;
    const value =
      this.privacyVersion === PrivacyVersion.ver1
        ? this.coinsV1Storage
        : this.coinsStorage;
    set(value, key, `${e / 1000}s`);
    return result;
  }

  measureFn(fn, key, args) {
    const t = performance.now();
    let result;
    if (typeof fn === "function") {
      result = fn.call(this, args);
    }
    const e = performance.now() - t;
    set(this.coinsStorage, key, `${e / 1000}s`);
    return result;
  }

  async updateListUnspentCoinsStorage({ listUnspentCoins, tokenId }) {
    try {
      const key = this.getKeyListUnspentCoinsByTokenId(tokenId);
      await this.setAccountStorage(key, listUnspentCoins);
    } catch (error) {
      throw error;
    }
  }

  async checkStatusListUnspentCoinsStorage(tokenId) {
    try {
      new Validator("tokenId", tokenId).required().string();
      const total = await this.getTotalCoinsStorage(tokenId);
      this.coinsStorage.checkStatusListUnspentCoinsFromStorage.oldTotalFromKeyInfo =
        total;
      if (total === 0) {
        return;
      }
      const coins = await this.getListUnspentCoinsStorage(tokenId);
      this.coinsStorage.checkStatusListUnspentCoinsFromStorage.oldTotalListUnspentCoinsSize =
        coins.length;
      const keyImages = this.getKeyImagesBase64Encode({
        coinsDecrypted: coins,
      });
      if (keyImages.length !== 0) {
        const shardId = this.getShardId();
        const keyImagesStatus = await this.measureAsyncFn(
          this.rpcCoinService.apiCheckKeyImages,
          "timeCheckStatusListUnspentCoinsFromLocal.timeCheckKeyImages",
          {
            keyImages,
            shardId,
          },
          this.rpcCoinService
        );
        const unspentCoins = coins?.filter(
          (coin, index) => !keyImagesStatus[index]
        );
        const spentCoins = coins?.filter(
          (coin, index) => keyImagesStatus[index]
        );
        console.log(
          "unspentCoins",
          unspentCoins.length,
          "spentCoins",
          spentCoins.length
        );
        this.coinsStorage.checkStatusListUnspentCoinsFromStorage.sizeListSNStatus =
          keyImagesStatus.length;
        this.coinsStorage.checkStatusListUnspentCoinsFromStorage.spentSize =
          spentCoins.length;
        this.coinsStorage.checkStatusListUnspentCoinsFromStorage.unspentSize =
          unspentCoins.length;
        await Promise.all([
          this.measureAsyncFn(
            this.updateListUnspentCoinsStorage,
            "timeCheckStatusListUnspentCoinsFromLocal.timeUpdateListUnspentCoinsFromLocal",
            {
              listUnspentCoins: unspentCoins,
              tokenId,
            }
          ),
          this.measureAsyncFn(
            this.storeListSpentCoins,
            "timeCheckStatusListUnspentCoinsFromLocal.timeStoreListSpentCoins",
            { spentCoins, tokenId }
          ),
        ]);
      }
    } catch (error) {
      throw error;
    }
  }

  async getAllKeyInfoV1() {
    const key = this.getOTAKey();
    let allKeyInfoV1 = {};
    const result = await this.rpcCoinService.apiGetKeyInfo({
      key,
      version: PrivacyVersion.ver1,
    });
    const coinsIndex = result?.coinindex || {};
    if (
      typeof coinsIndex === "object" &&
      coinsIndex &&
      Object.keys(coinsIndex).length > 0
    ) {
      Object.keys(coinsIndex).forEach((tokenId) => {
        allKeyInfoV1[tokenId] = { total: coinsIndex[tokenId].Total || 0 };
      });
    }
    return allKeyInfoV1;
  }

  async getUnspentCoinsByTokenIdV1({ tokenId, total } = {}) {
    if (!isEmpty(this.coinsV1Storage?.unspentCoinV1)) {
      return this.coinsV1Storage?.unspentCoinV1.find(
        (coin) => coin.tokenId === tokenId
      );
    }

    if (!total) {
      const keyInfo = await this.getKeyInfo(tokenId);
      total = keyInfo.total;
    }
    const listOutputsCoins = await this.measureAsyncFn(
      this.getListOutputsCoins,
      `timeGetUnspentCoinsV1ByTokenId${tokenId}`,
      { tokenId, total }
    );

    const shardId = this.getShardId();

    const listUnspentCoinsFiltered = await this.checkKeyImages({
      listOutputsCoins,
      shardId,
      tokenId,
    });

    let { balance, unspentCoinsFiltered } = listUnspentCoinsFiltered?.reduce(
      (prev, coin) => {
        let { balance, unspentCoinsFiltered } = prev;
        const amount = new bn(coin.Value);
        if (tokenId === PRVIDSTR && amount.toNumber() <= 5) {
          return prev;
        }
        return {
          balance: balance.add(amount),
          unspentCoinsFiltered: unspentCoinsFiltered.concat([coin]),
        };
      },
      { balance: new bn(0), unspentCoinsFiltered: [] }
    );

    if (balance.toNumber() <= 100 && tokenId === PRVIDSTR) {
      balance = new bn(0);
      unspentCoinsFiltered = [];
    }

    console.debug("Unspent Coins V1: ", {
      tokenId,
      balance: balance.toNumber(),
      total: unspentCoinsFiltered.length,
      keyInfo: total,
      listOutputsCoins: listOutputsCoins.length,
      listUnspentCoinsFiltered: listUnspentCoinsFiltered.length,
    });
    console.log(`\n`);

    return {
      tokenId,
      unspentCoins: unspentCoinsFiltered,
      balance: balance.toNumber(),
      total: unspentCoinsFiltered.length,
    };
  }

  async getKeyListUnspentCoins() {
    const viewkey = await this.getReadonlyKey();
    return this.getPrefixKeyStorage() + `-${TOTAL_UNSPENT_COINS}-${viewkey}`;
  }

  async getListUnspentCoinsV1() {
    try {
      if (this.storage) {
        this.setPrivacyVersion(PrivacyVersion.ver1);
        const key = await this.getKeyListUnspentCoins();
        return (await this.getAccountStorage(key)) || [];
      }
    } catch (error) {
      console.debug("ERROR GET ACCOUNT STORAGE", error?.message);
    }
  }

  async setListUnspentCoinsV1({ value }) {
    if (isEmpty(value)) return;
    try {
      if (this.storage) {
        const key = await this.getKeyListUnspentCoins();
        await this.setAccountStorage(key, value);
      }
      this.coinsV1Storage.unspentCoinV1 = value;
    } catch (error) {
      console.debug("ERROR GET ACCOUNT STORAGE", error?.message);
    }
  }

  async getAllUnspentCoinsV1({ forceGetCoins = true } = {}) {
    /** Set privacy version */
    await this.submitOTAKey();
    this.setPrivacyVersion(PrivacyVersion.ver1);
    if (forceGetCoins) {
      this.coinsV1Storage = {
        unspentCoinV1: [],
      };
    } else {
      let unspentCoins = await this.getListUnspentCoinsV1();
      unspentCoins = unspentCoins.filter((coin) => !!coin);
      if (!isEmpty(unspentCoins)) return unspentCoins;
    }
    /** Get All KeyInfo */
    const allKeyInfoV1 = await this.measureAsyncFn(
      this.getAllKeyInfoV1,
      "timeGetAllKeyInfoV1"
    );
    console.log("allKeyInfoV1: ", allKeyInfoV1);

    /** Get All Unspent Coins By Token Id */
    const task = Object.keys(allKeyInfoV1).map((tokenId) => {
      return this.getUnspentCoinsByTokenIdV1({
        tokenId,
        total: allKeyInfoV1[tokenId].total,
      });
    });

    const unspentCoinsV1 = await Promise.all(task);

    /** set list unspent coins V1 */
    await this.measureAsyncFn(
      this.setListUnspentCoinsV1,
      "timeSetListUnspentCoinsV1",
      {
        value: unspentCoinsV1,
      }
    );

    return unspentCoinsV1;
  }

  async getUnspentCoinsV2(tokenId = PRVIDSTR) {
    new Validator(VALIDATOR.tokenId, tokenId).required().string();
    if (!this.coinsStorage) {
      this.coinsStorage = {
        oldTotalCoinsFromKeyInfo: -1,
        newTotalCoinsFromKeyInfo: -1,
        calcTotalCoinsDiff: -1,
        totalCoinsSize: -1,
        totalKeyImagesSize: -1,
        totalCoinsUnspentSize: -1,
        totalCoinsSpentSize: -1,
        coinsFromZeroToInfinity: {
          unspentSize: -1,
          spentSize: -1,
          totalCoinsSize: -1,
          unspentCoinsSize: -1,
          listCoinsNotExistInUnspentCoinsFromStorage: [],
        },
        checkStatusListUnspentCoinsFromStorage: {
          oldTotalFromKeyInfo: -1,
          oldTotalListUnspentCoinsSize: -1,
          sizeListSNStatus: -1,
          unspentSize: -1,
          spentSize: -1,
        },
        timeGetKeyInfo: 0,
        timeCheckStatusListUnspentCoinsFromLocal: {
          timeCheckKeyImages: 0,
          timeUpdateListUnspentCoinsFromLocal: 0,
          timeStoreListSpentCoins: 0,
        },
        timeGetListOutputsCoins: 0,
        timeCheckKeyImages: {
          timeGetDecryptCoins: 0,
          timeCheckKeyImages: 0,
          timeStoreListSpentCoins: 0,
        },
        timeSetListUnspentCoinsStorage: 0,
        timeSetTotalCoinsStorage: 0,
        totalTimeGetUnspentCoins: 0,
        tokenId: "",
      };
    }
    this.coinsStorage.tokenId = tokenId;
    const keyInfo = await this.measureAsyncFn(
      this.getKeyInfo,
      "timeGetKeyInfo",
      tokenId
    );
    let listOutputsCoins = [];
    const { total } = keyInfo;
    this.coinsStorage.newTotalCoinsFromKeyInfo = total;
    const oldTotal = await this.getTotalCoinsStorage(tokenId);
    this.coinsStorage.oldTotalCoinsFromKeyInfo = oldTotal;
    await this.checkStatusListUnspentCoinsStorage(tokenId);
    let calcTotal = 0;
    if (total !== oldTotal) {
      calcTotal = total - oldTotal;
    }
    if (calcTotal > 0) {
      this.coinsStorage.calcTotalCoinsDiff = calcTotal;
      listOutputsCoins = await this.measureAsyncFn(
        this.getListOutputsCoins,
        "timeGetListOutputsCoins",
        {
          total: calcTotal,
          tokenId,
        }
      );
      const shardId = this.getShardId();
      const listUnspentCoinsFiltered = await this.checkKeyImages({
        listOutputsCoins,
        shardId,
        tokenId,
      });
      await Promise.all([
        this.measureAsyncFn(
          this.setListUnspentCoinsStorage,
          "timeSetListUnspentCoinsStorage",
          {
            value: listUnspentCoinsFiltered,
            tokenId,
          }
        ),
        this.measureAsyncFn(
          this.setTotalCoinsStorage,
          "timeSetTotalCoinsStorage",
          {
            value: listOutputsCoins.length !== calcTotal ? oldTotal : total,
            tokenId,
          }
        ),
      ]);
    }
    const listUnspentCoinsMerged = await this.getListUnspentCoinsStorage(
      tokenId
    );
    if (!this.coinUTXOs) {
      this.coinUTXOs = {};
    }
    this.coinUTXOs[tokenId] = listUnspentCoinsMerged.length;
    // tracking
    await this.setCoinsStorage({ value: this.coinsStorage, tokenId });
    return listUnspentCoinsMerged;
  }

  async getFlagSubmittedOTAKey() {
    let submitted = false;
    try {
      const key = this.getOTAKey();
      submitted = await this.getAccountStorage(key);
    } catch (error) {
      throw error;
    }
    return !!submitted;
  }

  async submitOTAKey() {
    try {
      const submitted = await this.getFlagSubmittedOTAKey();
      if (!submitted) {
        const otaKey = this.getOTAKey();
        const shardID = this.getShardId();
        const result = await this.rpcCoinService.apiSubmitOTAKey({
          otaKey,
          shardID,
        });
        console.log(result);
        if (!!result) {
          await this.setAccountStorage(otaKey, true);
        }
      }
    } catch (error) {
      console.log("error", error);
      throw error;
    }
  }

  async getUnspentCoins(tokenID) {
    try {
      const tokenId = tokenID || PRVIDSTR;
      const version = this.privacyVersion;
      new Validator(VALIDATOR.tokenId, tokenId).required().string();
      new Validator(VALIDATOR.privacyVersion, version).required().number();
      await this.submitOTAKey();
      switch (version) {
        case PrivacyVersion.ver1:
          const { unspentCoins } = this.getUnspentCoinsByTokenIdV1({ tokenId });
          return unspentCoins;
        case PrivacyVersion.ver2:
          return this.getUnspentCoinsV2(tokenId);
        default:
          return null;
      }
    } catch (error) {
      throw error;
    }
  }

  async getSpendingCoins(tokenId = PRVIDSTR) {
    new Validator(VALIDATOR.tokenId, tokenId).required().string();
    try {
      let coins = await this.getUnspentCoins(tokenId);
      try {
        const spendingCoinsStorage =
          await this.getSpendingCoinsStorageByTokenId(tokenId);
        coins = coins.filter(
          (item) =>
            !spendingCoinsStorage?.find(
              (coin) => coin?.KeyImage === item?.KeyImage
            )
        );
        console.log("spendingCoinsStorage size", spendingCoinsStorage.length);
        const spendingCoins =
          await this.rpcCoinService.apiGetSpendingCoinInMemPool();
        console.log("spendingCoins from csv ", spendingCoins.length);
        if (!!spendingCoins) {
          coins = coins.filter(
            (coin) => !spendingCoins.includes(coin.KeyImage)
          );
        }
      } catch (error) {
        throw error;
      }
      return coins || [];
    } catch (error) {
      throw error;
    }
  }

  async getBalance(tokenID) {
    let accountBalance = "0";
    try {
      const tokenId = tokenID || PRVIDSTR;
      const listUnspentCoins = await this.measureAsyncFn(
        this.getUnspentCoins,
        "totalTimeGetUnspentCoins",
        tokenId
      );
      accountBalance =
        listUnspentCoins?.reduce(
          (totalAmount, coin) => totalAmount.add(new bn(coin.Value)),
          new bn(0)
        ) || new bn(0);
    } catch (error) {
      throw error;
    }
    return accountBalance.toString();
  }
}

Object.assign(
  Account.prototype,
  transactor,
  history,
  progress,
  transactorConvert,
  pDex,
  node,
  initToken,
  configs,
  unshield
);
export default Account;
