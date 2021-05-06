/* eslint-disable eqeqeq */
/* eslint-disable no-array-constructor */
/* eslint-disable new-cap */
/* eslint-disable no-useless-catch */
/* eslint-disable comma-dangle */
/* eslint-disable space-before-function-paren */
import bn from "bn.js";
import _, { isEmpty, set, uniqBy } from "lodash";
import {
  CustomTokenInit,
  TxNormalType,
  TxCustomTokenPrivacyType,
  CustomTokenTransfer,
  MaxInputNumberForDefragment,
  MAX_INPUT_PER_TX,
  MAX_DEFRAGMENT_TXS,
  DEFAULT_INPUT_PER_TX,
} from "../tx/constants";
import { KeyWallet } from "./hdwallet";
import {
  FailedTx,
  SuccessTx,
  MetaStakingBeacon,
  MetaStakingShard,
  PaymentAddressType,
  ReadonlyKeyType,
  PriKeyType,
  OTAKeyType,
  PDETradeRequestMeta,
  PDEWithdrawalRequestMeta,
  PDEContributionMeta,
  StopAutoStakingMeta,
  ConfirmedTx,
  ShardStakingType,
  BurningRequestMeta,
  WithDrawRewardRequestMeta,
  PRVID,
  PRVIDSTR,
  PercentFeeToReplaceTx,
  PrivacyVersion,
} from "./constants";
import { checkEncode, checkDecode } from "../common/base58";
import {
  prepareInputForTx,
  prepareInputForTxPrivacyToken,
  newParamInitTx,
  newParamInitPrivacyTokenTx,
  prepareInputForReplaceTxNormal,
  prepareInputForReplaceTxPrivacyToken,
  prepareInputForDefragments,
} from "../tx/utils";
import { ENCODE_VERSION, ED25519_KEY_SIZE } from "../common/constants";

import {
  getChildIdFromChildNumberArray,
  getShardIDFromLastByte,
  convertHashToStr,
} from "../common/common";
import { TxHistoryInfo } from "./history";
import {
  generateBLSPubKeyB58CheckEncodeFromSeed,
  generateCommitteeKeyFromHashPrivateKey,
} from "../common/committeekey";
import {
  hashSha3BytesToBytes,
  base64Decode,
  base64Encode,
  stringToBytes,
  bytesToString,
} from "../privacy/utils";
import { hybridDecryption } from "../privacy/hybridEncryption";
import { CustomError, ErrorObject } from "../common/errorhandler";
import {
  encryptMessageOutCoin,
  decryptMessageOutCoin,
  getBurningAddress,
} from "./utils";
import { isJsonString } from "../utils/json";
import StorageServices from "../services/storage";
import { wasm as wasmFuncs } from "../wasm";
import { RpcHTTPCoinServiceClient } from "../rpcclient/rpchttpcoinservice";

const performance = {
  now() {
    return new Date().getTime();
  },
};

const delay = (ms) => new Promise((resolve, reject) => setTimeout(resolve, ms));

global.timers = {};

const deserializedAccounts = {};

const LIMIT_COINS = 100;

const TOTAL_COINS_KEY_STORAGE = "TOTAL-COINS";
const UNSPENT_COINS_STORAGE = "UNSPENT-COINS";
const SPENDING_COINS_STORAGE = "SPENDING-COINS-STORAGE";
const COINS_STORAGE = "COINS_STORAGE";
const SPENT_COINS_STORAGE = "SPENT_COINS_STORAGE";

class AccountWallet {
  constructor() {
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
    // derivatorPointCached is used for saving derivator (encoded) with corresponding encoded serial number in bytes array that was calculated before
    this.derivatorToSerialNumberCache = {};
    // spentCoinCached is used for cache spent coin
    this.spentCoinCached = {};
    // list of serial number of coins in tx in mempool
    this.spendingCoins = [];
    // isRevealViewKeyToGetCoins is true: reveal private viewing key when request for getting all output coins
    this.isRevealViewKeyToGetCoins = false;
    // account cached
    this.storage = StorageServices;
    this.coinUTXOs = {};
    this.rpc = null;
    this.rpcCoinService = null;
    this.privacyVersion = "";
    this.updateProgressTx = async () => {};
    this.keyInfo = {};
    this.allKeyInfoV1 = {};
    this.setPrivacyVersion = async () => {};
    this.coinsStorage = null;
    this.coinsV1Storage = {};
  }

  setRPCCoinServices(url) {
    this.rpcCoinService = new RpcHTTPCoinServiceClient(url);
  }

  setStorageServices(storage) {
    this.storage = storage || StorageServices;
  }

  setPrivacyVersion(privacyVersion) {
    this.privacyVersion = privacyVersion;
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
    const readonlyKey = this.getReadonlyKey();
    const prefix = this.getPrefixKeyStorage();
    return `${prefix}${readonlyKey}-${this.name}-${tokenId}`;
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
        const listUnspentCoins =
          !oldListUnspentCoins || oldListUnspentCoins.length === 0
            ? value
            : uniqBy([...oldListUnspentCoins, ...value], "SNDerivator");
        await this.setAccountStorage(key, listUnspentCoins);
      }
    } catch (error) {
      throw error;
    }
  }

  async getTotalCoinsStorage(tokenId) {
    try {
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

  async setSpendingCoinsStorage({ value, tokenId: tokenIdFromProps }) {
    try {
      const tokenId = tokenIdFromProps || PRVIDSTR;
      return [];
      const task = value
        .map((snd) => ({
          snd,
          createdAt: new Date().getTime(),
        }))
        .map(async (item) => {
          const key = this.getKeySpendingCoinsStorageByTokenId(tokenId);
          const spendingCoins = await this.getSpendingCoinsStorageByTokenId(
            tokenId
          );
          const isExist = spendingCoins.find((coin) => coin?.snd === item?.snd);
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
                (item) => item?.SNDerivator
              );
        await this.setAccountStorage(keyStorage, newListSpentCoins);
      }
    } catch (error) {
      throw error;
    }
  }

  // ========

  /**
   * setIsRevealViewKeyToGetCoins updates isRevealViewKeyToGetCoins of AccountWallet
   * @param {bool} isRevealViewKeyToGetCoins
   */
  setIsRevealViewKeyToGetCoins(isRevealViewKeyToGetCoins) {
    this.isRevealViewKeyToGetCoins = isRevealViewKeyToGetCoins;
  }

  // clearCached clears all caches
  clearCached(storage, key) {
    this.derivatorToSerialNumberCache = {};
    this.spentCoinCached = {};

    if (storage !== null && storage.removeItem) {
      return storage.removeItem(key || `${this.name}-cached`);
    }
  }

  // saveAccountCached saves derivatorToSerialNumberCache and spentCoinCached for account
  /**
   *
   * @param {object} storage
   */
  saveAccountCached(storage, key) {
    const cacheObject = {
      derivatorToSerialNumberCache: this.derivatorToSerialNumberCache,
      spentCoinCached: this.spentCoinCached,
    };

    const data = JSON.stringify(cacheObject);

    // storage
    if (storage != null) {
      return storage.setItem(key || `${this.name}-cached`, data);
    }
  }

  // loadAccountCached loads cache that includes derivatorToSerialNumberCache, inputCoinJsonCached and spentCoinCached for account
  /**
   *
   * @param {string} password
   * @param {object} storage
   */
  // eslint-disable-next-line space-before-function-paren
  async loadAccountCached(storage, key) {
    if (storage != null) {
      const text = await storage.getItem(key || `${this.name}-cached`);
      if (!text) return false;
      const data = JSON.parse(text);
      this.derivatorToSerialNumberCache = data.derivatorToSerialNumberCache;
      this.spentCoinCached = data.spentCoinCached;
    }
  }

  // analyzeOutputCoinFromCached devides allOutputCoinStrs into list of cached output coins and list of uncached output coins
  /**
   *
   * @param {[Coin]} allOutputCoinStrs
   * @param {string} tokenID
   */
  analyzeOutputCoinFromCached(allOutputCoinStrs, tokenID) {
    if (!tokenID) {
      tokenID = PRVIDSTR;
    }
    this.derivatorToSerialNumberCache =
      this.derivatorToSerialNumberCache === undefined
        ? {}
        : this.derivatorToSerialNumberCache;
    const uncachedOutputCoinStrs = [];
    const cachedOutputCoinStrs = [];
    for (let i = 0; i < allOutputCoinStrs.length; i++) {
      const sndStr = `${tokenID}_${allOutputCoinStrs[i].SNDerivator}`;

      if (this.derivatorToSerialNumberCache[sndStr] !== undefined) {
        allOutputCoinStrs[i].SerialNumber = this.derivatorToSerialNumberCache[
          sndStr
        ];
        cachedOutputCoinStrs.push(allOutputCoinStrs[i]);
      } else {
        uncachedOutputCoinStrs.push(allOutputCoinStrs[i]);
      }
    }
    return {
      uncachedOutputCoinStrs: uncachedOutputCoinStrs,
      cachedOutputCoinStrs: cachedOutputCoinStrs,
    };
  }

  // mergeSpentCoinCached caches spent input coins to spentCoinCached
  /**
   *
   * @param {[Coin]} unspentCoinStrs
   * @param {[Coin]} unspentCoinStrsFromCache
   * @param {string} tokenID
   */
  async mergeSpentCoinCached(
    unspentCoinStrs,
    unspentCoinStrsFromCache,
    tokenID
  ) {
    if (!tokenID) {
      tokenID = PRVIDSTR;
    }
    this.spentCoinCached =
      this.spentCoinCached === undefined ? {} : this.spentCoinCached;
    const chkAll = {};
    for (let i = 0; i < unspentCoinStrsFromCache.length; i++) {
      const sndStr = `${tokenID}_${unspentCoinStrsFromCache[i].SNDerivator}`;
      chkAll[sndStr] = true;
    }
    for (let i = 0; i < unspentCoinStrs.length; i++) {
      const sndStr = `${tokenID}_${unspentCoinStrs[i].SNDerivator}`;
      chkAll[sndStr] = false;
    }
    for (const sndStr in chkAll) {
      if (sndStr !== undefined && chkAll[sndStr] === true) {
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
  analyzeSpentCoinFromCached(inCoinStrs, tokenID) {
    if (!tokenID) {
      tokenID = PRVIDSTR;
    }
    this.spentCoinCached =
      this.spentCoinCached === undefined ? {} : this.spentCoinCached;
    const unspentInputCoinsFromCachedStrs = [];

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
    if (!tokenID) {
      tokenID = PRVIDSTR;
    }

    const serialNumberStrs = new Array(inCoinStrs.length);
    const serialNumberBytes = new Array(inCoinStrs.length);
    const snds = new Array(inCoinStrs.length);

    // calculate serial number (Call WASM/gomobile function)
    for (let i = 0; i < inCoinStrs.length; i++) {
      snds[i] = inCoinStrs[i].SNDerivator;
    }

    const param = {
      privateKey: spendingKeyStr,
      snds: snds,
    };

    const paramJson = JSON.stringify(param);

    const res = await wasmFuncs.deriveSerialNumber(paramJson);
    if (res === null || res === "") {
      throw new Error("Can not derive serial number");
    }

    const tmpBytes = base64Decode(res);
    for (let i = 0; i < snds.length; i++) {
      serialNumberBytes[i] = tmpBytes.slice(
        i * ED25519_KEY_SIZE,
        (i + 1) * ED25519_KEY_SIZE
      );
      serialNumberStrs[i] = checkEncode(serialNumberBytes[i], ENCODE_VERSION);
      inCoinStrs[i].SerialNumber = serialNumberStrs[i];

      // cache snd and corressponding serial number
      const sndStr = `${tokenID}_${snds[i]}`;
      this.derivatorToSerialNumberCache[sndStr] = serialNumberStrs[i];
    }

    return {
      serialNumberStrs: serialNumberStrs,
      inCoinStrs: inCoinStrs,
    };
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

  getCustomTokenTx() {
    return this.txHistory.CustomTokenTx;
  }

  // getTxHistoryByTxID returns tx history for specific tx id
  /**
   *
   * @param {string} txID
   */
  getTxHistoryByTxID(txID) {
    return (
      this.txHistory.NormalTx.find((item) => item.txID === txID) ||
      this.txHistory.PrivacyTokenTx.find((item) => item.txID === txID) ||
      this.txHistory.CustomTokenTx.find((item) => item.txID === txID)
    );
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

  getCustomTokenTxByTokenID(id) {
    const queryResult = new Array();
    for (let i = 0; i < this.txHistory.CustomTokenTx.length; i++) {
      if (this.txHistory.CustomTokenTx[i].tokenID === id) {
        queryResult.push(this.txHistory.CustomTokenTx[i]);
      }
    }
    return queryResult;
  }

  // getAllOutputCoins returns all output coins with tokenID
  // for native token: tokenId is null
  /**
   *
   * @param {string} tokenID
   * @param {RpcClient} rpcClient
   */
  async getAllOutputCoins(tokenID, rpcClient) {
    const paymentAddrSerialize = this.key.base58CheckSerialize(
      PaymentAddressType
    );
    let readOnlyKeySerialize = "";
    if (this.isRevealViewKeyToGetCoins) {
      readOnlyKeySerialize = this.key.base58CheckSerialize(ReadonlyKeyType);
    }
    // get all output coins of spendingKey
    console.time(`${tokenID}-getOutputCoin`);
    let response;
    try {
      response = await rpcClient.getOutputCoin(
        paymentAddrSerialize,
        readOnlyKeySerialize,
        tokenID
      );
    } catch (e) {
      throw new CustomError(
        ErrorObject.GetOutputCoinsErr,
        e.message ||
          `Can not get output coins when get unspent token ${tokenID}`
      );
    }
    console.timeEnd(`${tokenID}-getOutputCoin`);
    const outCoins = response.outCoins;
    console.time(`${tokenID}-decrypt`);
    const allOutputCoinStrs = [...outCoins];
    // decrypt ciphertext in each outcoin to get randomness and value
    if (!this.isRevealViewKeyToGetCoins) {
      for (let i = 0; i < allOutputCoinStrs.length; i++) {
        const value = parseInt(allOutputCoinStrs[i].Value);
        if (value === 0) {
          const ciphertext = allOutputCoinStrs[i].CoinDetailsEncrypted;
          const ciphertextBytes = checkDecode(ciphertext).bytesDecoded;
          if (ciphertextBytes.length > 0) {
            const plaintextBytes = await hybridDecryption(
              this.key.KeySet.ReadonlyKey.Rk,
              ciphertextBytes
            );
            const randomnessBytes = plaintextBytes.slice(0, ED25519_KEY_SIZE);
            const valueBytes = plaintextBytes.slice(ED25519_KEY_SIZE);
            const valueBN = new bn(valueBytes);

            allOutputCoinStrs[i].Randomness = checkEncode(
              randomnessBytes,
              ENCODE_VERSION
            );
            allOutputCoinStrs[i].Value = valueBN.toString();
          }
        }
      }
    }
    console.timeEnd(`${tokenID}-decrypt`);
    return allOutputCoinStrs;
  }

  // getAllPrivacyTokenBalance returns list of privacy token's balance
  /**
   *
   * @returns [{TokenID: string, Balance: number}]
   */
  async getAllPrivacyTokenBalance() {
    try {
      // get list privacy token
      const privacyTokens = await this.rpc.listPrivacyCustomTokens();
      const pTokenList = privacyTokens.listPrivacyToken;

      // get balance for each privacy token
      const tasks = [];
      for (let i = 0; i < pTokenList.length; i++) {
        const tokenID = pTokenList[i].ID;

        const tokenBalanceItemPromise = new Promise((resolve) => {
          this.getBalance(tokenID)
            .then((balance) => {
              resolve({
                TokenID: tokenID,
                Balance: balance,
              });
            })
            .catch(() => null);
        });
        tasks.push(tokenBalanceItemPromise);
      }

      const allResult = await Promise.all(tasks);
      const hasBalanceResult =
        allResult && allResult.filter((r) => r && r.Balance > 0);

      return hasBalanceResult;
    } catch (e) {
      throw e;
    }
  }

  async defragmentNativeCoin(
    fee,
    isPrivacy = true,
    noOfInputPerTx = MaxInputNumberForDefragment,
    maxTxs = MAX_DEFRAGMENT_TXS
  ) {
    this.Debug = "Starting...";
    await this.updateProgressTx(10);
    const info = "Defragment";
    const feeBN = new bn(fee);
    const senderSkStr = this.key.base58CheckSerialize(PriKeyType);
    const senderPaymentAddressStr = this.key.base58CheckSerialize(
      PaymentAddressType
    );

    try {
      this.Debug = "Preparing...";
      const inputForTxs = _.take(
        await prepareInputForDefragments(
          PRVIDSTR,
          this,
          this.rpc,
          noOfInputPerTx
        ),
        maxTxs
      );
      await this.updateProgressTx(20);
      const rawTxs = [];
      let index = 0;

      if (!inputForTxs || !inputForTxs.length) {
        throw new CustomError(ErrorObject.NoAvailableUTXO, "No available UTXO");
      }

      console.time("INIT ALL TX");
      this.Debug = "INIT ALL TX";
      const initTxProcess = 70;
      const startProcess = 20;
      const totalTxs = inputForTxs.length;
      for (const inputInfo of inputForTxs) {
        console.time("INIT TX");
        console.debug(
          "INIT RAW TX",
          `${index}/${totalTxs}`,
          inputInfo.inputCoinStrs.length
        );
        this.Debug = `INIT RAW TX ${index}/${totalTxs} ${inputInfo.inputCoinStrs.length}`;

        const paymentInfos = [
          {
            paymentAddressStr: senderPaymentAddressStr,
            amount: inputInfo.totalValueInput.sub(feeBN).toString(),
          },
        ];

        const nOutput = 1;
        const sndOutputs = new Array(nOutput);
        const sndOutputStrs = await wasmFuncs.randomScalars(nOutput.toString());
        const sndDecodes = base64Decode(sndOutputStrs);
        for (let i = 0; i < nOutput; i++) {
          const sndBytes = sndDecodes.slice(
            i * ED25519_KEY_SIZE,
            (i + 1) * ED25519_KEY_SIZE
          );
          sndOutputs[i] = checkEncode(sndBytes, ENCODE_VERSION);
        }

        const paramInitTx = newParamInitTx(
          senderSkStr,
          paymentInfos,
          inputInfo.inputCoinStrs,
          feeBN.toString(),
          isPrivacy,
          PRVIDSTR,
          null,
          info,
          inputInfo.commitmentIndices,
          inputInfo.myCommitmentIndices,
          inputInfo.commitmentStrs,
          sndOutputs
        );

        const paramInitTxJson = JSON.stringify(paramInitTx);
        const resInitTx = await wasmFuncs.initPrivacyTx(paramInitTxJson);

        if (resInitTx === null || resInitTx === "") {
          throw new CustomError(
            ErrorObject.InitNormalTxErr,
            "Can not init transaction tranfering PRV"
          );
        }

        const resInitTxBytes = base64Decode(resInitTx);
        const b58CheckEncodeTx = checkEncode(
          resInitTxBytes.slice(0, resInitTxBytes.length - 8),
          ENCODE_VERSION
        );

        // get lock time tx
        const lockTimeBytes = resInitTxBytes.slice(resInitTxBytes.length - 8);

        rawTxs.push({
          raw: b58CheckEncodeTx,
          totalAmount: inputInfo.totalValueInput,
          lockTimeBytes,
          inputInfo,
          totalAmountString: inputInfo.totalValueInput.toString(),
          totalInput: inputInfo.inputCoinStrs.length,
        });
        console.timeEnd("INIT TX");
        index++;
        await this.updateProgressTx(
          startProcess + Math.floor((index / totalTxs) * initTxProcess)
        );
      }
      console.timeEnd("INIT ALL TX");
      await this.updateProgressTx(90);

      const responses = [];

      index = 0;
      this.Debug = "SEND RAW TX BEGIN";
      for (const rawTx of rawTxs) {
        const { lockTimeBytes, inputInfo, raw, totalAmount } = rawTx;

        this.Debug = `SEND RAW TX ${index++}/${totalTxs} ${
          inputInfo.inputCoinStrs.length
        }`;

        const lockTime = new bn(lockTimeBytes).toNumber();
        const response = await this.rpc.sendRawTx(raw);
        const listUTXOForPRV = [];

        // saving history tx
        // check status of tx and add coins to spending coins
        let status = FailedTx;
        if (response.txId) {
          // tx.txId = response.txId
          status = SuccessTx;
          response.typeTx = TxNormalType;
          response.feeNativeToken = feeBN.toString();
          response.lockTime = lockTime;
          response.amountNativeToken = totalAmount.toString();
          response.txStatus = status;

          // add spending list
          for (let i = 0; i < inputInfo.inputCoinStrs.length; i++) {
            listUTXOForPRV.push(inputInfo.inputCoinStrs[i].SNDerivator);
          }
        }
        this.saveNormalTxHistory(
          response,
          [senderPaymentAddressStr],
          false,
          isPrivacy,
          listUTXOForPRV,
          "",
          null,
          info,
          ""
        );
        responses.push(response);
      }
      await this.updateProgressTx(100);

      return responses;
    } catch (e) {
      console.debug("ERROR", e);

      throw new CustomError(
        ErrorObject.SendTxErr,
        "Can not send PRV transaction",
        e
      );
    } finally {
      this.Debug = "";
      await this.updateProgressTx(0);
    }
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
    const blsPubKeyB58CheckEncode = await this.key.getBLSPublicKeyB58CheckEncode();

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
        const {
          times,
          remainder,
        } = this.getLimitOffSetListOuputCoinsWhenBreakSizeLimit(total);
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
      listOutputsCoins = uniqBy(listOutputsCoins, "SNDerivator");
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
      const otaKey = this.getOTAKey();
      const version = this.privacyVersion;
      let listOutputsCoins = [];
      const oldTotal = await this.getTotalCoinsStorage(tokenId);
      const key = this.getKeyParamOfCoins(otaKey);
      if (total > LIMIT_COINS) {
        const {
          times,
          remainder,
        } = this.getLimitOffSetListOuputCoinsWhenBreakSizeLimit(total);
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

  // get balance version 2
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

  async getKeyInfo(tokenId) {
    try {
      let keyInfo = this.keyInfo;
      const version = this.privacyVersion;
      if (isEmpty(keyInfo)) {
        const otaKey = this.getOTAKey();
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

  // return new list coins with key image (SerialNumber) base 58 encode + amount decrypt (SNDerivator will not be used)
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
        const keyImage = coin.KeyImage;
        const decodeKeyImage = checkDecode(keyImage).bytesDecoded;
        const keyImageBase64 = base64Encode(decodeKeyImage);
        return {
          ...coin,
          CoinCommitment: coin?.Commitment,
          KeyImageBase64: keyImageBase64,
        };
      });
      return result || [];
    } catch (error) {
      throw error;
    }
  }

  getKeyImagesBase64Encode({ coinsDecrypted }) {
    return coinsDecrypted.map((coin) => coin.KeyImageBase64);
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
    set(this.coinsStorage, key, `${e / 1000}s`);
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
      const total = await this.getTotalCoinsStorage(tokenId);
      this.coinsStorage.checkStatusListUnspentCoinsFromStorage.oldTotalFromKeyInfo = total;
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
          }
        );
        const unspentCoins = coins?.filter(
          (coin, index) => !keyImagesStatus[index]
        );
        const spentCoins = coins?.filter(
          (coin, index) => keyImagesStatus[index]
        );
        this.coinsStorage.checkStatusListUnspentCoinsFromStorage.sizeListSNStatus =
          keyImagesStatus.length;
        this.coinsStorage.checkStatusListUnspentCoinsFromStorage.spentSize =
          spentCoins.length;
        this.coinsStorage.checkStatusListUnspentCoinsFromStorage.unspentSize =
          unspentCoins.length;
        await this.measureAsyncFn(
          this.updateListUnspentCoinsStorage,
          "timeCheckStatusListUnspentCoinsFromLocal.timeUpdateListUnspentCoinsFromLocal",
          {
            listUnspentCoins: unspentCoins,
            tokenId,
          }
        );
        await this.measureAsyncFn(
          this.storeListSpentCoins,
          "timeCheckStatusListUnspentCoinsFromLocal.timeStoreListSpentCoins",
          { spentCoins, tokenId }
        );
      }
    } catch (error) {
      throw error;
    }
  }

  setAllKeyInfoV1(keys) {
    this.allKeyInfoV1 = keys;
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
    this.setAllKeyInfoV1(allKeyInfoV1);
    return allKeyInfoV1;
  }

  /** Get List unspent coins by TokenId */
  async getUnspentCoinsV1ByTokenId({ tokenId, total }) {
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

    // Todo: When convert success => storage inputTx, compare with @listUnspentCoinsFiltered

    return {
      tokenId,
      unspentCoins: listUnspentCoinsFiltered,
    };
  }

  async saveListUnspentCoinsV1() {
    try {
      if (this.storage) {
        const data = await this.storage.getItem(key);
        // result = data;
        // if (isJsonString(data)) {
        //   result = JSON.parse(data);
        // }
      }
    } catch (error) {
      console.debug("ERROR GET ACCOUNT STORAGE", error?.message);
    }
  }

  async getListUnspentCoinsV1() {
    try {
      if (this.storage) {
        const data = await this.storage.getItem(key);
        // result = data;
        // if (isJsonString(data)) {
        //   result = JSON.parse(data);
        // }
      }
    } catch (error) {
      console.debug("ERROR GET ACCOUNT STORAGE", error?.message);
    }
  }

  /** Load unspent coins PRV and PTokens */
  async getAllUnspentCoinsV1() {
    if (!this.coinsV1Storage) {
      this.coinsV1Storage = {};
    }

    /** Get All KeyInfo */
    const allKeyInfoV1 = await this.measureAsyncFn(
      this.getAllKeyInfoV1,
      "timeGetAllKeyInfoV1"
    );

    /** Get All Unspent Coins By Token Id */
    const task = Object.keys(allKeyInfoV1).map((tokenId) => {
      return this.getUnspentCoinsV1ByTokenId({
        tokenId,
        total: allKeyInfoV1[tokenId].total,
      });
    });

    const listUnspentCoinsV1 = await Promise.all(task);

    return listUnspentCoinsV1;
  }

  async getUnspentCoinsV2(tokenId) {
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
      };
    }
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
      this.coinsStorage.totalCoinsSize = listOutputsCoins.length;
      console.log("listOutputsCoins", listOutputsCoins);
      const shardId = this.getShardId();
      const listUnspentCoinsFiltered = await this.checkKeyImages({
        listOutputsCoins,
        shardId,
        tokenId,
      });
      await this.measureAsyncFn(
        this.setListUnspentCoinsStorage,
        "timeSetListUnspentCoinsStorage",
        {
          value: listUnspentCoinsFiltered,
          tokenId,
        }
      );

      await this.measureAsyncFn(
        this.setTotalCoinsStorage,
        "timeSetTotalCoinsStorage",
        {
          value: listOutputsCoins.length !== calcTotal ? oldTotal : total,
          tokenId,
        }
      );
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

  async getUnspentCoins(tokenId) {
    try {
      const version = this.privacyVersion;
      switch (version) {
        case PrivacyVersion.ver1:
          // return this.getUnspentCoinsV1({ tokenId });
          return null;
        default:
          return this.getUnspentCoinsV2(tokenId);
      }
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
      console.log("listUnspentCoins", listUnspentCoins);
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

export { AccountWallet };
