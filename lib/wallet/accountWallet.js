/* eslint-disable no-array-constructor */
/* eslint-disable new-cap */
/* eslint-disable no-useless-catch */
/* eslint-disable comma-dangle */
/* eslint-disable space-before-function-paren */
import bn from 'bn.js';
import _, { isEmpty, uniqBy } from 'lodash';
import {
  CustomTokenInit,
  TxNormalType,
  TxCustomTokenPrivacyType,
  CustomTokenTransfer,
  MaxInputNumberForDefragment,
  MAX_INPUT_PER_TX,
  MAX_DEFRAGMENT_TXS,
} from '../tx/constants';
import { KeyWallet } from './hdwallet';
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
  StopAutoStakingMeta,
  ConfirmedTx,
  ShardStakingType,
  BurningRequestMeta,
  WithDrawRewardRequestMeta,
  PRVID,
  PRVIDSTR,
  PercentFeeToReplaceTx,
} from './constants';
import { checkEncode, checkDecode } from '../base58';
import {
  prepareInputForTx,
  prepareInputForTxPrivacyToken,
  newParamInitTx,
  newParamInitPrivacyTokenTx,
  prepareInputForReplaceTxNormal,
  prepareInputForReplaceTxPrivacyToken,
  prepareInputForDefragments,
} from '../tx/utils';
import { ENCODE_VERSION, ED25519_KEY_SIZE } from '../constants';

import {
  Wallet,
  hybridDecryption,
  getChildIdFromChildNumberArray,
  getShardIDFromLastByte,
} from './wallet';
import { TxHistoryInfo } from './history';
import JSON from 'circular-json';
import { convertHashToStr } from '../common';
import {
  generateBLSPubKeyB58CheckEncodeFromSeed,
  generateCommitteeKeyFromHashPrivateKey,
} from '../committeekey';
import {
  hashSha3BytesToBytes,
  base64Decode,
  base64Encode,
  stringToBytes,
  bytesToString,
} from '../privacy/utils';
import { CustomError, ErrorObject } from '../errorhandler';
import {
  encryptMessageOutCoin,
  decryptMessageOutCoin,
  getBurningAddress,
} from './utils';
import wasmFuncs from '../wasm/wasmfuncwrapper';
import {
  apiGetListOutputCoins,
  apiGetKeyInfo,
  apiCheckKeyImages,
} from '../http/coinsServices';
import { isJsonString } from '../utils/json';
import StorageServices from '../services/storage';

const performance = {
  now() {
    return new Date().getTime();
  },
};

global.timers = {};

const deserializedAccounts = {};

const LIMIT_COINS = 1000;

const TOTAL_COINS_KEY_STORAGE = 'TOTAL-COINS';
const UNSPENT_COINS_STORAGE = 'UNSPENT-COINS';
const SPENDING_COINS_STORAGE = 'SPENDING-COINS-STORAGE';
class AccountWallet {
  constructor() {
    this.name = '';
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
    this.keyInfo = {};
    this.coinUTXOs = {};
  }

  setStorageServices(storage) {
    this.storage = storage || StorageServices;
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
      console.debug('ERROR GET ACCOUNT STORAGE', error?.message);
    }
    return result;
  }

  async setAccountStorage(key, value) {
    try {
      if (this.storage) {
        await this.storage.setItem(
          key,
          typeof value !== 'string' ? JSON.stringify(value) : value
        );
      }
    } catch (error) {
      console.debug('ERROR SET ACCOUNT STORAGE', error?.message);
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
    return `${readonlyKey}-${this.name}-${tokenId}`;
  }

  getKeyListUnspentCoinsByTokenId(tokenId) {
    const keyByTokenId = this.getKeyStorageByTokenId(tokenId);
    const key = `${keyByTokenId}-${UNSPENT_COINS_STORAGE}`;
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
            : uniqBy([...oldListUnspentCoins, ...value], 'SNDerivator');
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
      console.debug('\nGET SPENDING COINS STORAGE BY TOKEN ID', tokenId);
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
      console.debug('SET SPENDING COINS STORAGE', tokenId);
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
            console.debug('COIN SPENDING', item);
            spendingCoins.push(item);
          }
          await this.setAccountStorage(key, spendingCoins);
        });
      await Promise.all(task);
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
    if (res === null || res === '') {
      throw new Error('Can not derive serial number');
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
    hashOriginalTx = '',
    metaData = null,
    info = '',
    messageForNativeToken = '',
    tradeHandler = null,
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
      tokenName: '',
      tokenID: '',
      tokenSymbol: '',
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
      messageForPToken: '',
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
    hashOriginalTx = '',
    metaData = null,
    info = '',
    messageForNativeToken = '',
    messageForPToken = '',
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
    let readOnlyKeySerialize = '';
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
    console.debug('outCoins', outCoins);
    const allOutputCoinStrs = [...outCoins];
    console.debug('allOutputCoinStrs', allOutputCoinStrs);
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

  // getUnspentToken returns unspent output coins with tokenID
  // for native token: tokenId is null
  /**
   *
   * @param {string} tokenID
   * @param {RpcClient} rpcClient
   */
  async getUnspentToken(tokenID) {
    try {
      const tokenId = tokenID || PRVIDSTR;
      let unspentCoins = await this.getListUnspentCoins(tokenId);
      console.debug('GET LIST UNSPENT COINS', unspentCoins?.length);
      if (!unspentCoins) {
        throw new Error('Can not get list unspent coins');
      }
      const spendingCoinsStorage = await this.getSpendingCoinsStorageByTokenId(
        tokenId
      );
      console.debug(
        'GET LIST SPENDING COINS STORAGE',
        spendingCoinsStorage?.length
      );
      unspentCoins = unspentCoins.filter(
        (item) =>
          !spendingCoinsStorage?.find((coin) => coin?.snd === item?.SNDerivator)
      );
      console.debug(
        'LIST UNSPENT COINS FILTER BY LIST SPENDING COINS FROM LOCAL',
        unspentCoins?.length
      );
      const publicKey = this.key.getPublicKeyCheckEncode();
      return unspentCoins.map((item) => {
        const sn64Decode = base64Decode(item?.SerialNumber);
        const SerialNumber = checkEncode(sn64Decode, ENCODE_VERSION);
        return {
          ...item,
          CoinCommitment: item?.Commitment,
          PublicKey: publicKey,
          SerialNumber,
        };
      });
    } catch (error) {
      throw error;
    }
  }
  // async getUnspentToken(tokenID, rpcClient) {
  //   const spendingKeyStr = this.key.base58CheckSerialize(PriKeyType);
  //   const paymentAddrSerialize = this.key.base58CheckSerialize(
  //     PaymentAddressType
  //   );
  //   // const readOnlyKeySerialize = this.key.base58CheckSerialize(ReadonlyKeyType);
  //   const timer = {
  //     getAllOutputCoins: {},
  //     deriveSerialNumbers: {},
  //     getUnspentCoin: {},
  //   };
  //   if (global.timers[paymentAddrSerialize]) {
  //     global.timers[paymentAddrSerialize][tokenID] = timer;
  //   } else {
  //     global.timers[paymentAddrSerialize] = {
  //       [tokenID]: timer,
  //     };
  //   }
  //   timer.getAllOutputCoins.start = performance.now();
  //   console.time(`${tokenID}-getAllOutputCoins`);
  //   // get all output coins of spendingKey
  //   let allOutputCoinStrs;
  //   try {
  //     allOutputCoinStrs = await this.getAllOutputCoins(tokenID, rpcClient);
  //   } catch (e) {
  //     throw new CustomError(
  //       ErrorObject.GetOutputCoinsErr,
  //       e.message || 'Can not get output coins when get unspent token'
  //     );
  //   }
  //   console.timeEnd(`${tokenID}-getAllOutputCoins`);
  //   console.debug('allOutputCoinStrs', allOutputCoinStrs);
  //   // devide all of output coins into uncached and cached out put coins list
  //   console.time(`${tokenID}-analyzeOutputCoinFromCached`);
  //   let {
  //     uncachedOutputCoinStrs,
  //     cachedOutputCoinStrs,
  //   } = this.analyzeOutputCoinFromCached(allOutputCoinStrs, tokenID);
  //   console.timeEnd(`${tokenID}-analyzeOutputCoinFromCached`);
  //   timer.getAllOutputCoins.end = performance.now();
  //   timer.getAllOutputCoins.time =
  //     timer.getAllOutputCoins.end - timer.getAllOutputCoins.start;
  //   timer.getAllOutputCoins.data = allOutputCoinStrs.length;
  //   timer.deriveSerialNumbers.start = performance.now();
  //   console.time(`${tokenID}-deriveSerialNumbers`);
  //   // calculate serial number uncachedOutputCoinStrs and cache
  //   if (uncachedOutputCoinStrs.length > 0) {
  //     const res = await this.deriveSerialNumbers(
  //       spendingKeyStr,
  //       uncachedOutputCoinStrs,
  //       tokenID
  //     );
  //     uncachedOutputCoinStrs = res.inCoinStrs;

  //     allOutputCoinStrs = cachedOutputCoinStrs.concat(uncachedOutputCoinStrs);
  //   }
  //   console.timeEnd(`${tokenID}-deriveSerialNumbers`);

  //   // get unspent output coin from cache
  //   console.time(`${tokenID}-analyzeSpentCoinFromCached`);
  //   const { unspentInputCoinsFromCachedStrs } = this.analyzeSpentCoinFromCached(
  //     allOutputCoinStrs,
  //     tokenID
  //   );
  //   console.timeEnd(`${tokenID}-analyzeSpentCoinFromCached`);
  //   timer.deriveSerialNumbers.end = performance.now();
  //   timer.deriveSerialNumbers.time =
  //     timer.deriveSerialNumbers.end - timer.deriveSerialNumbers.start;
  //   timer.deriveSerialNumbers.data = unspentInputCoinsFromCachedStrs.length;
  //   console.time(`${tokenID}-getUnspentCoin`);
  //   timer.getUnspentCoin.start = performance.now();
  //   // check whether unspent coin from cache is spent or not
  //   const { unspentCoinStrs } = await getUnspentCoin(
  //     spendingKeyStr,
  //     paymentAddrSerialize,
  //     unspentInputCoinsFromCachedStrs,
  //     tokenID,
  //     rpcClient
  //   );
  //   console.timeEnd(`${tokenID}-getUnspentCoin`);
  //   console.time(`${tokenID}-mergeSpentCoinCached`);
  //   // cache spent output coins
  //   this.mergeSpentCoinCached(
  //     unspentCoinStrs,
  //     unspentInputCoinsFromCachedStrs,
  //     tokenID
  //   );
  //   console.timeEnd(`${tokenID}-mergeSpentCoinCached`);
  //   timer.getUnspentCoin.end = performance.now();
  //   timer.getUnspentCoin.time =
  //     timer.getUnspentCoin.end - timer.getUnspentCoin.start;
  //   if (!this.coinUTXOs) {
  //     this.coinUTXOs = {};
  //   }
  //   this.coinUTXOs[tokenID || PRVIDSTR] = unspentCoinStrs.length;
  //   return unspentCoinStrs;
  // }

  // getBalance returns balance for token (native token or privacy token)
  // tokenID default is null: for PRV
  /**
   *
   * @param {string} tokenID
   */
  // async getBalance(tokenID) {
  //   const unspentCoinStrs = await this.getUnspentToken(
  //     tokenID,
  //     Wallet.RpcClient
  //   );
  //   let accountBalance = 0;
  //   for (let i = 0; i < unspentCoinStrs.length; i++) {
  //     accountBalance += parseInt(unspentCoinStrs[i].Value);
  //   }
  //   return accountBalance;
  // }

  // getAllPrivacyTokenBalance returns list of privacy token's balance
  /**
   *
   * @returns [{TokenID: string, Balance: number}]
   */
  async getAllPrivacyTokenBalance() {
    try {
      // get list privacy token
      const privacyTokens = await Wallet.RpcClient.listPrivacyCustomTokens();
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

  /**
   *
   * @param {{paymentAddressStr: string (B58checkencode), amount: number, message: "" }} paramPaymentInfos
   * @param {number} fee
   * @param {bool} isPrivacy
   * @param {string} info
   */
  async createAndSendNativeToken(
    paramPaymentInfos,
    fee,
    isPrivacy,
    info = '',
    isEncryptMessageOutCoin = true,
    txHandler,
    depositId,
    tradeHandler
  ) {
    // check fee
    if (fee < 0) {
      fee = 0;
    }

    let messageForNativeToken = '';
    if (paramPaymentInfos.length > 0) {
      messageForNativeToken = paramPaymentInfos[0].message;
    }

    await Wallet.updateProgressTx(10);
    const feeBN = new bn(fee);

    const receiverPaymentAddrStr = new Array(paramPaymentInfos.length);
    let totalAmountTransfer = new bn(0);
    for (let i = 0; i < paramPaymentInfos.length; i++) {
      receiverPaymentAddrStr[i] = paramPaymentInfos[i].paymentAddressStr;
      totalAmountTransfer = totalAmountTransfer.add(
        new bn(paramPaymentInfos[i].amount)
      );
      paramPaymentInfos[i].amount = new bn(
        paramPaymentInfos[i].amount
      ).toString();
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

    const senderSkStr = this.key.base58CheckSerialize(PriKeyType);
    // let paymentAddressStr = this.key.base58CheckSerialize(PaymentAddressType);
    // let viewingKeyStr = this.key.base58CheckSerialize(ReadonlyKeyType);

    console.time('Time for create and send tx');
    try {
      // prepare input for tx
      console.debug('PREPARE INTPUT FOR TX');
      console.time('Time for preparing input for privacy tx');
      const inputForTx = await prepareInputForTx(
        totalAmountTransfer,
        feeBN,
        isPrivacy,
        null,
        this,
        Wallet.RpcClient,
        this
      );
      console.timeEnd('Time for preparing input for privacy tx');

      if (inputForTx.inputCoinStrs.length > MAX_INPUT_PER_TX) {
        throw new CustomError(ErrorObject.TxSizeExceedErr);
      }

      await Wallet.updateProgressTx(30);

      let nOutput = paramPaymentInfos.length;
      if (
        inputForTx.totalValueInput.cmp(totalAmountTransfer.add(feeBN)) === 1
      ) {
        nOutput++;
      }

      let sndOutputStrs;
      const sndOutputs = new Array(nOutput);
      if (nOutput > 0) {
        sndOutputStrs = await wasmFuncs.randomScalars(nOutput.toString());
        if (sndOutputStrs === null || sndOutputStrs === '') {
          throw new Error('Can not random scalars for output coins');
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
        null,
        info,
        inputForTx.commitmentIndices,
        inputForTx.myCommitmentIndices,
        inputForTx.commitmentStrs,
        sndOutputs
      );

      let resInitTx;
      const paramInitTxJson = JSON.stringify(paramInitTx);
      console.debug('paramInitTxJson', paramInitTxJson);
      resInitTx = await wasmFuncs.initPrivacyTx(paramInitTxJson);
      if (resInitTx === null || resInitTx === '') {
        throw new CustomError(
          ErrorObject.InitNormalTxErr,
          'Can not init transaction tranfering PRV'
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

      await Wallet.updateProgressTx(60);
      console.time('Time for sending tx');
      let response = {};
      let listUTXOForPRV = [];

      const txData = await wasmFuncs.parseNativeRawTx(resInitTx);
      if (txHandler) {
        await txHandler(txData);
      }

      try {
        response.rawData = b58CheckEncodeTx; // Log RawData
        if (tradeHandler) {
          const params = {
            DepositID: depositId,
            RawData: b58CheckEncodeTx,
            TxID: txData,
          };
          await tradeHandler(params);
          response.txId = txData;
        } else {
          response = await Wallet.RpcClient.sendRawTx(b58CheckEncodeTx);
        }
      } catch (e) {
        throw new CustomError(
          ErrorObject.SendTxErr,
          'Can not send PRV transaction',
          e
        );
      }
      await Wallet.updateProgressTx(90);
      console.timeEnd('Time for sending tx');
      console.timeEnd('Time for create and send tx');

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

        // add spending list
        for (let i = 0; i < inputForTx.inputCoinStrs.length; i++) {
          listUTXOForPRV.push(inputForTx.inputCoinStrs[i].SNDerivator);
        }
      }

      // saving history tx
      // don't saving history when trade submit rawdata pdex
      this.saveNormalTxHistory(
        response,
        receiverPaymentAddrStr,
        false,
        isPrivacy,
        listUTXOForPRV,
        '',
        null,
        info,
        messageForNativeToken,
        tradeHandler
      );

      await Wallet.updateProgressTx(100);
      return response;
    } catch (e) {
      await Wallet.updateProgressTx(0);

      throw e;
    }
  }

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
  async createAndSendStakingTx(
    param,
    feeNativeToken,
    candidatePaymentAddress,
    candidateMiningSeedKey,
    rewardReceiverPaymentAddress,
    autoReStaking = true
  ) {
    await Wallet.updateProgressTx(10);
    // check fee
    if (feeNativeToken < 0) {
      feeNativeToken = 0;
    }

    // get amount staking
    let amount;
    try {
      const response = await Wallet.RpcClient.getStakingAmount(param.type);
      amount = response.res;
    } catch (e) {
      throw new CustomError(
        ErrorObject.GetStakingAmountErr,
        'Can not get staking amount before staking'
      );
    }

    const amountBN = new bn(amount);
    const feeBN = new bn(feeNativeToken);

    // generate committee key
    const candidateKeyWallet = KeyWallet.base58CheckDeserialize(
      candidatePaymentAddress
    );
    const publicKeyBytes = candidateKeyWallet.KeySet.PaymentAddress.Pk;

    const candidateHashPrivateKeyBytes = checkDecode(candidateMiningSeedKey)
      .bytesDecoded;

    let committeeKey;
    try {
      committeeKey = await generateCommitteeKeyFromHashPrivateKey(
        candidateHashPrivateKeyBytes,
        publicKeyBytes
      );
    } catch (e) {
      throw e;
    }

    // sender's key
    const senderSkStr = this.key.base58CheckSerialize(PriKeyType);
    const paymentAddressStr = this.key.base58CheckSerialize(PaymentAddressType);

    const type =
      param.type === ShardStakingType ? MetaStakingShard : MetaStakingBeacon;

    const meta = {
      Type: type,
      FunderPaymentAddress: paymentAddressStr,
      RewardReceiverPaymentAddress: rewardReceiverPaymentAddress,
      StakingAmountShard: amountBN.toString(),
      CommitteePublicKey: committeeKey,
      AutoReStaking: autoReStaking,
    };

    const burningAddress = await getBurningAddress(Wallet.RpcClient);
    const paramPaymentInfos = [
      {
        paymentAddressStr: burningAddress,
        amount: amountBN.toString(),
        message: '',
      },
    ];

    const messageForNativeToken = paramPaymentInfos[0].message;

    console.time('Time for create and send tx');
    try {
      // prepare input for tx
      console.time('Time for preparing input for staking tx');
      const inputForTx = await prepareInputForTx(
        amountBN,
        feeBN,
        false,
        null,
        this,
        Wallet.RpcClient
      );
      console.timeEnd('Time for preparing input for staking tx');

      await Wallet.updateProgressTx(30);

      let nOutput = paramPaymentInfos.length;
      if (inputForTx.totalValueInput.cmp(amountBN.add(feeBN)) === 1) {
        nOutput++;
      }

      let sndOutputStrs;
      const sndOutputs = new Array(nOutput);
      if (nOutput > 0) {
        sndOutputStrs = await wasmFuncs.randomScalars(nOutput.toString());
        if (sndOutputStrs === null || sndOutputStrs === '') {
          throw new Error('Can not random scalar for output coins');
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
        false,
        null,
        meta,
        '',
        inputForTx.commitmentIndices,
        inputForTx.myCommitmentIndices,
        inputForTx.commitmentStrs,
        sndOutputs
      );

      let resInitTx;
      const paramInitTxJson = JSON.stringify(paramInitTx);
      resInitTx = await wasmFuncs.staking(paramInitTxJson);
      if (resInitTx === null || resInitTx === '') {
        throw new CustomError(
          ErrorObject.InitNormalTxErr,
          'Can not init transaction tranfering PRV'
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

      await Wallet.updateProgressTx(60);
      console.time('Time for sending tx');
      let response;
      const listUTXOForPRV = [];
      try {
        response = await Wallet.RpcClient.sendRawTx(b58CheckEncodeTx);
      } catch (e) {
        throw new CustomError(
          ErrorObject.SendTxErr,
          'Can not send PRV transaction',
          e
        );
      }
      await Wallet.updateProgressTx(90);
      console.timeEnd('Time for sending tx');
      console.timeEnd('Time for create and send tx');

      // saving history tx
      // check status of tx and add coins to spending coins
      let status = FailedTx;
      if (response.txId) {
        status = SuccessTx;
        response.typeTx = TxNormalType;
        response.feeNativeToken = feeBN.toString();
        response.lockTime = lockTime;
        response.amountNativeToken = amount;
        response.txStatus = status;

        // add spending list
        for (let i = 0; i < inputForTx.inputCoinStrs.length; i++) {
          listUTXOForPRV.push(inputForTx.inputCoinStrs[i].SNDerivator);
        }
      }

      // saving history tx
      this.saveNormalTxHistory(
        response,
        [burningAddress],
        false,
        false,
        listUTXOForPRV,
        '',
        meta,
        '',
        messageForNativeToken
      );

      await Wallet.updateProgressTx(100);
      return response;
    } catch (e) {
      throw e;
    }
  }

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
  async createAndSendStopAutoStakingTx(
    feeNativeToken,
    candidatePaymentAddress,
    candidateMiningSeedKey
  ) {
    await Wallet.updateProgressTx(10);
    // check fee
    if (feeNativeToken < 0) {
      feeNativeToken = 0;
    }

    const amountBN = new bn(0);
    const feeBN = new bn(feeNativeToken);

    // generate committee key
    const candidateKeyWallet = KeyWallet.base58CheckDeserialize(
      candidatePaymentAddress
    );
    const publicKeyBytes = candidateKeyWallet.KeySet.PaymentAddress.Pk;

    const candidateHashPrivateKeyBytes = checkDecode(candidateMiningSeedKey)
      .bytesDecoded;

    const committeeKey = await generateCommitteeKeyFromHashPrivateKey(
      candidateHashPrivateKeyBytes,
      publicKeyBytes
    );

    // sender's key
    const senderSkStr = this.key.base58CheckSerialize(PriKeyType);

    const meta = {
      Type: StopAutoStakingMeta,
      CommitteePublicKey: committeeKey,
    };

    const burningAddress = await getBurningAddress(Wallet.RpcClient);
    const paramPaymentInfos = [
      {
        paymentAddressStr: burningAddress,
        amount: '0',
        message: '',
      },
    ];

    const messageForNativeToken = paramPaymentInfos[0].message;

    console.time('Time for create and send tx');
    try {
      // prepare input for tx
      console.time('Time for preparing input for staking tx');
      const inputForTx = await prepareInputForTx(
        amountBN,
        feeBN,
        false,
        null,
        this,
        Wallet.RpcClient
      );
      console.timeEnd('Time for preparing input for staking tx');

      await Wallet.updateProgressTx(30);

      let nOutput = paramPaymentInfos.length;
      if (inputForTx.totalValueInput.cmp(amountBN.add(feeBN)) === 1) {
        nOutput++;
      }

      let sndOutputStrs;
      const sndOutputs = new Array(nOutput);
      if (nOutput > 0) {
        sndOutputStrs = await wasmFuncs.randomScalars(nOutput.toString());
        if (sndOutputStrs === null || sndOutputStrs === '') {
          throw new Error('Can not random scalar for output coins');
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
        false,
        null,
        meta,
        '',
        inputForTx.commitmentIndices,
        inputForTx.myCommitmentIndices,
        inputForTx.commitmentStrs,
        sndOutputs
      );

      let resInitTx;
      const paramInitTxJson = JSON.stringify(paramInitTx);
      resInitTx = await wasmFuncs.stopAutoStaking(paramInitTxJson);

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

      await Wallet.updateProgressTx(60);
      console.time('Time for sending tx');
      let response;
      const listUTXOForPRV = [];
      try {
        response = await Wallet.RpcClient.sendRawTx(b58CheckEncodeTx);
      } catch (e) {
        throw new CustomError(
          ErrorObject.SendTxErr,
          'Can not send PRV transaction',
          e
        );
      }
      await Wallet.updateProgressTx(90);
      console.timeEnd('Time for sending tx');
      console.timeEnd('Time for create and send tx');

      // saving history tx
      // check status of tx and add coins to spending coins
      let status = FailedTx;
      if (response.txId) {
        status = SuccessTx;
        response.typeTx = TxNormalType;
        response.feeNativeToken = feeBN.toString();
        response.lockTime = lockTime;
        response.amountNativeToken = 0;
        response.txStatus = status;

        // add spending list
        for (let i = 0; i < inputForTx.inputCoinStrs.length; i++) {
          listUTXOForPRV.push(inputForTx.inputCoinStrs[i].SNDerivator);
        }
      }

      // saving history tx
      this.saveNormalTxHistory(
        response,
        [burningAddress],
        false,
        false,
        listUTXOForPRV,
        '',
        meta,
        '',
        messageForNativeToken
      );

      await Wallet.updateProgressTx(100);
      return response;
    } catch (e) {
      throw e;
    }
  }

  // /**
  //  *
  //  * @param {{paymentAddressStr: string, amount: number, message: string}} paramPaymentInfosForNativeToken
  //  * @param {{Privacy: bool, TokenID: string, TokenName: string, TokenSymbol: string, TokenTxType: bool, TokenAmount: number, TokenReceivers : {PaymentAddress: string, Amount: number, Message: string}}} submitParam
  //  * @param {number} feeNativeToken
  //  * @param {number} feePToken
  //  * @param {bool} hasPrivacyForNativeToken
  //  * @param {bool} hasPrivacyForPToken
  //  * @param {string} info
  //  */
  // async createAndSendPrivacyToken(paramPaymentInfosForNativeToken = [], submitParam, feeNativeToken, feePToken,
  //   hasPrivacyForNativeToken, hasPrivacyForPToken, info = "", isEncryptMessageOutCoinNativeToken = true, isEncryptMessageOutCoinPToken = true) {

  //
  //   await Wallet.updateProgressTx(10);
  //   if (feeNativeToken < 0) {
  //     feeNativeToken = 0
  //   }

  //   if (feePToken < 0) {
  //     feePToken = 0
  //   }

  //   let amountTransferPRV = new bn(0);
  //   for (let i = 0; i < paramPaymentInfosForNativeToken.length; i++) {
  //     amountTransferPRV = amountTransferPRV.add(new bn(paramPaymentInfosForNativeToken[i].amount));
  //   }

  //   let messageForNativeToken = "";
  //   if (paramPaymentInfosForNativeToken.length > 0) {
  //     messageForNativeToken = paramPaymentInfosForNativeToken[0].message;
  //   }

  //   // encrypt message for output coins native token
  //   if (isEncryptMessageOutCoinNativeToken) {
  //     try {
  //       paramPaymentInfosForNativeToken = await encryptMessageOutCoin(paramPaymentInfosForNativeToken);
  //
  //     } catch (e) {
  //
  //     }
  //   } else {
  //     for (let i = 0; i < paramPaymentInfosForNativeToken.length; i++) {
  //       paramPaymentInfosForNativeToken[i].message = base64Encode(stringToBytes(paramPaymentInfosForNativeToken[i].message));
  //
  //     }
  //   }

  //   // token param
  //   // get current token to get token param
  //   let tokenParamJson = {
  //     propertyID: submitParam.TokenID,
  //     propertyName: submitParam.TokenName,
  //     propertySymbol: submitParam.TokenSymbol,
  //     amount: submitParam.TokenAmount,
  //     tokenTxType: submitParam.TokenTxType,
  //     fee: feePToken,
  //     paymentInfoForPToken: [{
  //       paymentAddressStr: submitParam.TokenReceivers.PaymentAddress,
  //       amount: submitParam.TokenReceivers.Amount,
  //       message: submitParam.TokenReceivers.Message ? submitParam.TokenReceivers.Message : ""
  //     }],
  //     tokenInputs: [],
  //   };

  //   let messageForPToken = tokenParamJson.paymentInfoForPToken[0].message;

  //   // encrypt message for output coins native token
  //   if (isEncryptMessageOutCoinPToken) {
  //     try {
  //       tokenParamJson.paymentInfoForPToken = await encryptMessageOutCoin(tokenParamJson.paymentInfoForPToken);
  //
  //     } catch (e) {
  //
  //     }
  //   } else {
  //     for (let i = 0; i < tokenParamJson.paymentInfoForPToken.length; i++) {
  //       tokenParamJson.paymentInfoForPToken[i].message = base64Encode(stringToBytes(tokenParamJson.paymentInfoForPToken[i].message));
  //
  //     }
  //   }

  //

  //   let amountTransferPToken = new bn(submitParam.TokenReceivers.Amount)

  //   let senderSkStr = this.key.base58CheckSerialize(PriKeyType);

  //   // try {
  //
  //   let inputForTx;
  //   try {
  //     console.time("Time for preparing input for custom token tx");
  //     inputForTx = await prepareInputForTx(amountTransferPRV, new bn(feeNativeToken), hasPrivacyForNativeToken, null, this, Wallet.RpcClient);
  //     console.timeEnd("Time for preparing input for custom token tx");
  //   } catch (e) {
  //     throw e;
  //   }
  //   await Wallet.updateProgressTx(30);

  //   let inputForPrivacyTokenTx;
  //   try {
  //
  //     inputForPrivacyTokenTx = await prepareInputForTxPrivacyToken(tokenParamJson, this, Wallet.RpcClient, new bn(feePToken), hasPrivacyForPToken);
  //   } catch (e) {
  //     throw e;
  //   }
  //   await Wallet.updateProgressTx(50);
  //   tokenParamJson.tokenInputs = inputForPrivacyTokenTx.tokenInputs;
  //

  //   // verify tokenID if transfering token
  //   let listCustomTokens = inputForPrivacyTokenTx.listPrivacyToken;
  //   if (submitParam.TokenTxType === CustomTokenTransfer) {
  //     let i = 0;
  //     for (i = 0; i < listCustomTokens.length; i++) {
  //       if (listCustomTokens[i].ID.toLowerCase() === tokenParamJson.propertyID) {
  //         break;
  //       }
  //     }
  //     if (i === listCustomTokens.length) {
  //       throw new Error("invalid token ID")
  //     }
  //   }

  //   let nOutputForNativeToken = paramPaymentInfosForNativeToken.length;
  //   if (inputForTx.totalValueInput.cmp(amountTransferPRV) === 1) {
  //     nOutputForNativeToken++;
  //   }

  //   // random snd for output native token
  //   let sndOutputStrsForNativeToken;
  //   let sndOutputsForNativeToken = new Array(nOutputForNativeToken);
  //   if (nOutputForNativeToken > 0) {
  //     if (typeof randomScalars === "function") {
  //       sndOutputStrsForNativeToken = await wasmFuncs.randomScalars(nOutputForNativeToken.toString());
  //       if (sndOutputStrsForNativeToken === null || sndOutputStrsForNativeToken === "") {
  //         throw new Error("Can not random scalar for native token outputs");
  //       }
  //       let sndDecodes = base64Decode(sndOutputStrsForNativeToken);

  //       for (let i = 0; i < nOutputForNativeToken; i++) {
  //         let sndBytes = sndDecodes.slice(i * ED25519_KEY_SIZE, (i + 1) * ED25519_KEY_SIZE);
  //         sndOutputsForNativeToken[i] = checkEncode(sndBytes, ENCODE_VERSION);
  //       }
  //     }
  //   }

  //

  //   // random snd for output native token
  //   let nOutputForPToken = tokenParamJson.paymentInfoForPToken.length;
  //   if (inputForPrivacyTokenTx.totalValueInput.cmp(amountTransferPToken.add(new bn(feePToken))) === 1) {
  //     nOutputForPToken++;
  //   }

  //   let sndOutputStrsForPToken;
  //   let sndOutputsForPToken = new Array(nOutputForPToken);
  //   if (nOutputForPToken > 0) {
  //     if (typeof randomScalars === "function") {
  //       sndOutputStrsForPToken = await wasmFuncs.randomScalars(nOutputForPToken.toString());
  //       if (sndOutputStrsForPToken === null || sndOutputStrsForPToken === "") {
  //         throw new Error("Can not random scalar for privacy token outputs");
  //       }
  //       let sndDecodes = base64Decode(sndOutputStrsForPToken);

  //       for (let i = 0; i < nOutputForPToken; i++) {
  //         let sndBytes = sndDecodes.slice(i * ED25519_KEY_SIZE, (i + 1) * ED25519_KEY_SIZE);
  //         sndOutputsForPToken[i] = checkEncode(sndBytes, ENCODE_VERSION);
  //       }
  //     }
  //   }

  //

  //   let paramInitTx = newParamInitPrivacyTokenTx(
  //     senderSkStr, paramPaymentInfosForNativeToken, inputForTx.inputCoinStrs,
  //     feeNativeToken, hasPrivacyForNativeToken, hasPrivacyForPToken, tokenParamJson, null, info,
  //     inputForTx.commitmentIndices, inputForTx.myCommitmentIndices, inputForTx.commitmentStrs, sndOutputsForNativeToken,
  //     inputForPrivacyTokenTx.commitmentIndices, inputForPrivacyTokenTx.myCommitmentIndices, inputForPrivacyTokenTx.commitmentStrs, sndOutputsForPToken
  //   );

  //

  //   let resInitTx;
  //     let paramInitTxJson = JSON.stringify(paramInitTx);
  //     resInitTx = await wasmFuncs.initPrivacyTokenTx(paramInitTxJson);
  //     if (resInitTx === null || resInitTx === "") {
  //       throw new CustomError(ErrorObject.InitNormalTxErr, "Can not init transaction tranfering PRV");
  //     }

  //

  //   //base64 decode txjson
  //   let resInitTxBytes = base64Decode(resInitTx);

  //   // get b58 check encode tx json
  //   let b58CheckEncodeTx = checkEncode(resInitTxBytes.slice(0, resInitTxBytes.length - 40), ENCODE_VERSION);

  //   // get lock time tx
  //   let lockTimeBytes = resInitTxBytes.slice(resInitTxBytes.length - 40, resInitTxBytes.length - 32);
  //   let lockTime = new bn(lockTimeBytes).toNumber();
  //   let tokenIDBytes = resInitTxBytes.slice(resInitTxBytes.length - 32);
  //   let tokenID = convertHashToStr(tokenIDBytes).toLowerCase();
  //

  //   // verify tokenID if initing token
  //   if (submitParam.TokenTxType === CustomTokenInit) {
  //     // validate PropertyID is the only one
  //     for (let i = 0; i < listCustomTokens.length; i++) {
  //       if (tokenID === listCustomTokens[i].ID.toLowerCase()) {
  //         throw new Error("privacy token privacy is existed");
  //       }
  //     }
  //   }

  //   await Wallet.updateProgressTx(80);

  //   let response;
  //   try {
  //     response = await Wallet.RpcClient.sendRawTxCustomTokenPrivacy(b58CheckEncodeTx);
  //   } catch (e) {
  //     throw new CustomError(ErrorObject.SendTxErr, "Can not send privacy token tx");
  //   }

  //   await Wallet.updateProgressTx(90);
  //   // saving history tx
  //   // check status of tx
  //   let listUTXOForPRV = [];
  //   let listUTXOForPToken = [];
  //   // check status of tx and add coins to spending coins
  //   let status = FailedTx;
  //   if (response.txId) {
  //     status = SuccessTx;
  //     response.typeTx = TxCustomTokenPrivacyType;
  //     response.feeNativeToken = new bn(feeNativeToken).toNumber();
  //     response.feePToken = new bn(feePToken).toNumber();
  //     response.lockTime = lockTime;
  //     response.amountNativeToken = amountTransferPRV.toNumber();
  //     response.amountPToken = amountTransferPToken.toNumber();
  //     response.txStatus = status;
  //     response.tokenName = tokenParamJson.propertyName;
  //     response.tokenID = tokenID;
  //     response.tokenSymbol = tokenParamJson.propertySymbol;
  //     response.tokenTxType = tokenParamJson.tokenTxType;

  //     // add spending list
  //     let spendingSNs = [];
  //     for (let i = 0; i < inputForTx.inputCoinStrs.length; i++) {
  //       spendingSNs.push(inputForTx.inputCoinStrs[i].SerialNumber);
  //       listUTXOForPRV.push(inputForTx.inputCoinStrs[i].SNDerivator);
  //     }

  //     for (let i = 0; i < inputForPrivacyTokenTx.tokenInputs.length; i++) {
  //       listUTXOForPToken.push(inputForPrivacyTokenTx.tokenInputs[i].SNDerivator);
  //     }
  //     this.addSpendingCoins({ txID: response.txId, spendingSNs: spendingSNs });
  //

  //     // add to following token list if tx is init token
  //     if (submitParam.TokenTxType === CustomTokenInit) {
  //       let identicon = await Wallet.RpcClient.hashToIdenticon([tokenID]);
  //       this.addFollowingToken({
  //         ID: tokenID,
  //         Image: identicon.images[0],
  //         Name: tokenParamJson.propertyName,
  //         Symbol: tokenParamJson.propertySymbol,
  //         Amount: tokenParamJson.amount,
  //         IsPrivacy: true,
  //         isInit: true,
  //         metaData: {},
  //       });
  //
  //     }
  //   }

  //   // check is init or transfer token
  //   let isIn;
  //   if (submitParam.TokenTxType === CustomTokenInit) {
  //     isIn = true;
  //   } else {
  //     isIn = false;
  //   }

  //

  //   this.savePrivacyTokenTxHistory(response, [submitParam.TokenReceivers.PaymentAddress], isIn,
  //     hasPrivacyForNativeToken, hasPrivacyForPToken, listUTXOForPRV, listUTXOForPToken, "", null,
  //     info, messageForNativeToken, messageForPToken);

  //

  //
  //   await Wallet.updateProgressTx(100);
  //   return response;
  // };

  /**
   *
   * @param {{paymentAddressStr: string, amount: number, message: string}} paramPaymentInfosForNativeToken
   * @param {{Privacy: bool, TokenID: string, TokenName: string, TokenSymbol: string, TokenTxType: bool, TokenAmount: number, TokenReceivers : [{PaymentAddress: string, Amount: number, Message: string}]}} submitParam
   * @param {number} feeNativeToken
   * @param {number} feePToken
   * @param {bool} hasPrivacyForNativeToken
   * @param {bool} hasPrivacyForPToken
   * @param {string} info
   */
  async createAndSendPrivacyToken(
    paramPaymentInfosForNativeToken = [],
    submitParam,
    feeNativeToken,
    feePToken,
    hasPrivacyForNativeToken,
    hasPrivacyForPToken,
    info = '',
    isEncryptMessageOutCoinNativeToken = true,
    isEncryptMessageOutCoinPToken = true,
    txHandler,
    depositId,
    tradeHandler
  ) {
    await Wallet.updateProgressTx(10);
    if (feeNativeToken < 0) {
      feeNativeToken = 0;
    }

    if (feePToken < 0) {
      feePToken = 0;
    }

    let amountTransferPRV = new bn(0);
    for (let i = 0; i < paramPaymentInfosForNativeToken.length; i++) {
      amountTransferPRV = amountTransferPRV.add(
        new bn(paramPaymentInfosForNativeToken[i].amount)
      );
    }

    let messageForNativeToken = '';
    if (paramPaymentInfosForNativeToken.length > 0) {
      messageForNativeToken = paramPaymentInfosForNativeToken[0].message;
    }

    for (let i = 0; i < paramPaymentInfosForNativeToken.length; i++) {
      paramPaymentInfosForNativeToken[i].amount = new bn(
        paramPaymentInfosForNativeToken[i].amount
      ).toString();
    }

    // encrypt message for output coins native token
    if (isEncryptMessageOutCoinNativeToken) {
      try {
        paramPaymentInfosForNativeToken = await encryptMessageOutCoin(
          paramPaymentInfosForNativeToken
        );
        //
      } catch (e) {
        //
      }
    } else {
      for (let i = 0; i < paramPaymentInfosForNativeToken.length; i++) {
        if (paramPaymentInfosForNativeToken[i].message != null) {
          paramPaymentInfosForNativeToken[i].message = base64Encode(
            stringToBytes(paramPaymentInfosForNativeToken[i].message)
          );
          //
        }
      }
    }

    const paymentInfoForPToken = [];
    let totalAmount = new bn(0);
    for (let i = 0; i < submitParam.TokenReceivers.length; i++) {
      const amountBN = new bn(submitParam.TokenReceivers[i].Amount);
      paymentInfoForPToken[i] = {
        paymentAddressStr: submitParam.TokenReceivers[i].PaymentAddress,
        amount: amountBN.toString(),
        message: '',
      };
      totalAmount = totalAmount.add(amountBN);
    }

    // token param
    // get current token to get token param
    const tokenParamJson = {
      propertyID: submitParam.TokenID,
      propertyName: submitParam.TokenName,
      propertySymbol: submitParam.TokenSymbol,
      amount: new bn(submitParam.TokenAmount).toString(),
      tokenTxType: submitParam.TokenTxType,
      fee: feePToken ? new bn(feePToken).toString() : '0',
      paymentInfoForPToken: paymentInfoForPToken,
      tokenInputs: [],
    };

    const messageForPToken = tokenParamJson.paymentInfoForPToken[0].message;

    // encrypt message for output coins native token
    if (isEncryptMessageOutCoinPToken) {
      try {
        tokenParamJson.paymentInfoForPToken = await encryptMessageOutCoin(
          tokenParamJson.paymentInfoForPToken
        );
        //
      } catch (e) {}
    } else {
      for (let i = 0; i < tokenParamJson.paymentInfoForPToken.length; i++) {
        if (tokenParamJson.paymentInfoForPToken[i].message != null) {
          tokenParamJson.paymentInfoForPToken[i].message = base64Encode(
            stringToBytes(tokenParamJson.paymentInfoForPToken[i].message)
          );
          //
        }
      }
    }

    //

    const amountTransferPToken = new bn(totalAmount);
    const senderSkStr = this.key.base58CheckSerialize(PriKeyType);

    // try {

    let inputForTx;
    try {
      console.time('Time for preparing input for custom token tx');
      inputForTx = await prepareInputForTx(
        amountTransferPRV,
        new bn(feeNativeToken),
        hasPrivacyForNativeToken,
        null,
        this,
        Wallet.RpcClient
      );
      console.timeEnd('Time for preparing input for custom token tx');
    } catch (e) {
      throw e;
    }
    await Wallet.updateProgressTx(30);

    const inputForPrivacyTokenTx = await prepareInputForTxPrivacyToken(
      tokenParamJson,
      this,
      Wallet.RpcClient,
      new bn(feePToken),
      hasPrivacyForPToken
    );
    await Wallet.updateProgressTx(50);
    tokenParamJson.tokenInputs = inputForPrivacyTokenTx.tokenInputs;

    // verify tokenID if transfering token
    const listCustomTokens = inputForPrivacyTokenTx.listPrivacyToken;
    if (submitParam.TokenTxType === CustomTokenTransfer) {
      let i = 0;
      for (i = 0; i < listCustomTokens.length; i++) {
        if (
          listCustomTokens[i].ID.toLowerCase() === tokenParamJson.propertyID
        ) {
          break;
        }
      }
      if (i === listCustomTokens.length) {
        throw new Error('invalid token ID');
      }
    }

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
        sndOutputStrsForNativeToken === ''
      ) {
        throw new Error('Can not random scalar for native token outputs');
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

    //

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
      if (sndOutputStrsForPToken === null || sndOutputStrsForPToken === '') {
        throw new Error('Can not random scalar for privacy token outputs');
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

    //

    const paramInitTx = newParamInitPrivacyTokenTx(
      senderSkStr,
      paramPaymentInfosForNativeToken,
      inputForTx.inputCoinStrs,
      feeNativeToken ? new bn(feeNativeToken).toString() : '0',
      hasPrivacyForNativeToken,
      hasPrivacyForPToken,
      tokenParamJson,
      null,
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
    if (resInitTx === null || resInitTx === '') {
      throw new CustomError(
        ErrorObject.InitNormalTxErr,
        'Can not init transaction tranfering PRV'
      );
    }

    //

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
    const tokenIDBytes = resInitTxBytes.slice(resInitTxBytes.length - 32);
    const tokenID = convertHashToStr(tokenIDBytes).toLowerCase();
    //

    // verify tokenID if initing token
    if (submitParam.TokenTxType === CustomTokenInit) {
      // validate PropertyID is the only one
      for (let i = 0; i < listCustomTokens.length; i++) {
        if (tokenID === listCustomTokens[i].ID.toLowerCase()) {
          throw new Error('privacy token privacy is existed');
        }
      }
    }

    await Wallet.updateProgressTx(80);

    const txData = await wasmFuncs.parsePrivacyTokenRawTx(resInitTx);
    if (txHandler) {
      await txHandler(txData);
    }

    let response = {};
    try {
      response.rawData = b58CheckEncodeTx; // Log RawData
      if (tradeHandler) {
        const params = {
          DepositID: depositId,
          RawData: b58CheckEncodeTx,
          TxID: txData,
        };
        await tradeHandler(params);
        response.txId = txData;
      } else {
        response = await Wallet.RpcClient.sendRawTxCustomTokenPrivacy(
          b58CheckEncodeTx
        );
      }
    } catch (e) {
      throw new CustomError(
        ErrorObject.SendTxErr,
        'Can not send privacy token tx',
        e
      );
    }

    await Wallet.updateProgressTx(90);
    // saving history tx
    // check status of tx
    const listUTXOForPRV = [];
    const listUTXOForPToken = [];
    // check status of tx and add coins to spending coins
    let status = FailedTx;
    if (response.txId) {
      status = SuccessTx;
      response.typeTx = TxCustomTokenPrivacyType;
      response.feeNativeToken = new bn(feeNativeToken).toString();
      response.feePToken = new bn(feePToken).toString();
      response.lockTime = lockTime;
      response.amountNativeToken = amountTransferPRV.toString();
      response.amountPToken = amountTransferPToken.toString();
      response.txStatus = status;
      response.tokenName = tokenParamJson.propertyName;
      response.tokenID = tokenID;
      response.tokenSymbol = tokenParamJson.propertySymbol;
      response.tokenTxType = tokenParamJson.tokenTxType;

      // add spending list
      for (let i = 0; i < inputForTx.inputCoinStrs.length; i++) {
        listUTXOForPRV.push(inputForTx.inputCoinStrs[i].SNDerivator);
      }

      for (let i = 0; i < inputForPrivacyTokenTx.tokenInputs.length; i++) {
        listUTXOForPToken.push(
          inputForPrivacyTokenTx.tokenInputs[i].SNDerivator
        );
      }

      // add to following token list if tx is init token
      if (submitParam.TokenTxType === CustomTokenInit) {
        const identicon = await Wallet.RpcClient.hashToIdenticon([tokenID]);
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
        //
      }
    }

    // check is init or transfer token
    let isIn;
    if (submitParam.TokenTxType === CustomTokenInit) {
      isIn = true;
    } else {
      isIn = false;
    }

    // don't saving history when trade submit rawdata pdex
    this.savePrivacyTokenTxHistory(
      response,
      [submitParam.TokenReceivers[0].PaymentAddress],
      isIn,
      hasPrivacyForNativeToken,
      hasPrivacyForPToken,
      listUTXOForPRV,
      listUTXOForPToken,
      '',
      null,
      info,
      messageForNativeToken,
      messageForPToken,
      tradeHandler
    );
    //

    await Wallet.updateProgressTx(100);
    return response;
  }

  async defragmentNativeCoin(
    fee,
    isPrivacy = true,
    noOfInputPerTx = MaxInputNumberForDefragment,
    maxTxs = MAX_DEFRAGMENT_TXS
  ) {
    Wallet.Debug = 'Starting...';
    await Wallet.updateProgressTx(10);
    const info = 'Defragment';
    const feeBN = new bn(fee);
    const senderSkStr = this.key.base58CheckSerialize(PriKeyType);
    const senderPaymentAddressStr = this.key.base58CheckSerialize(
      PaymentAddressType
    );

    try {
      Wallet.Debug = 'Preparing...';
      const inputForTxs = _.take(
        await prepareInputForDefragments(
          PRVIDSTR,
          this,
          Wallet.RpcClient,
          noOfInputPerTx
        ),
        maxTxs
      );
      await Wallet.updateProgressTx(20);
      const rawTxs = [];
      let index = 0;

      if (!inputForTxs || !inputForTxs.length) {
        throw new CustomError(ErrorObject.NoAvailableUTXO, 'No available UTXO');
      }

      console.time('INIT ALL TX');
      Wallet.Debug = 'INIT ALL TX';
      const initTxProcess = 70;
      const startProcess = 20;
      const totalTxs = inputForTxs.length;
      for (const inputInfo of inputForTxs) {
        console.time('INIT TX');
        console.debug(
          'INIT RAW TX',
          `${index}/${totalTxs}`,
          inputInfo.inputCoinStrs.length
        );
        Wallet.Debug = `INIT RAW TX ${index}/${totalTxs} ${inputInfo.inputCoinStrs.length}`;

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

        if (resInitTx === null || resInitTx === '') {
          throw new CustomError(
            ErrorObject.InitNormalTxErr,
            'Can not init transaction tranfering PRV'
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
        console.timeEnd('INIT TX');
        index++;
        await Wallet.updateProgressTx(
          startProcess + Math.floor((index / totalTxs) * initTxProcess)
        );
      }
      console.timeEnd('INIT ALL TX');
      await Wallet.updateProgressTx(90);

      const responses = [];

      index = 0;
      Wallet.Debug = 'SEND RAW TX BEGIN';
      for (const rawTx of rawTxs) {
        const { lockTimeBytes, inputInfo, raw, totalAmount } = rawTx;

        Wallet.Debug = `SEND RAW TX ${index++}/${totalTxs} ${
          inputInfo.inputCoinStrs.length
        }`;

        const lockTime = new bn(lockTimeBytes).toNumber();
        const response = await Wallet.RpcClient.sendRawTx(raw);
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
          '',
          null,
          info,
          ''
        );
        responses.push(response);
      }
      await Wallet.updateProgressTx(100);

      return responses;
    } catch (e) {
      console.debug('ERROR', e);

      throw new CustomError(
        ErrorObject.SendTxErr,
        'Can not send PRV transaction',
        e
      );
    } finally {
      Wallet.Debug = '';
      await Wallet.updateProgressTx(0);
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
      throw CustomError(ErrorObject.InvalidTypeTXToReplaceErr, '');
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
      throw new error('New fee must be greater than 10% old fee');
    }

    // get UTXO
    const listUTXO = txHistory.listUTXOForPRV;

    await Wallet.updateProgressTx(10);
    const feeBN = new bn(newFee);

    let messageForNativeToken = txHistory.messageForNativeToken || '';
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
    let info = txHistory.info || '';
    if (newInfo != null) {
      info = newInfo;
    }

    const senderSkStr = this.key.base58CheckSerialize(PriKeyType);
    // let paymentAddressStr = this.key.base58CheckSerialize(PaymentAddressType);
    // let viewingKeyStr = this.key.base58CheckSerialize(ReadonlyKeyType);

    console.time('Time for create and send tx');
    try {
      // prepare input for tx
      console.time('Time for preparing input for privacy tx');
      const inputForTx = await prepareInputForReplaceTxNormal(
        listUTXO,
        isPrivacy,
        null,
        this,
        Wallet.RpcClient
      );
      console.timeEnd('Time for preparing input for privacy tx');

      await Wallet.updateProgressTx(30);

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
        if (sndOutputStrs === null || sndOutputStrs === '') {
          throw new Error('Can not random scalars for output coins');
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
      if (resInitTx === null || resInitTx === '') {
        throw new CustomError(
          ErrorObject.InitNormalTxErr,
          'Can not init transaction tranfering PRV'
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

      await Wallet.updateProgressTx(60);
      console.time('Time for sending tx');
      let response;
      try {
        response = await Wallet.RpcClient.sendRawTx(b58CheckEncodeTx);
      } catch (e) {
        throw new CustomError(
          ErrorObject.SendTxErr,
          'Can not send PRV transaction',
          e
        );
      }
      await Wallet.updateProgressTx(90);
      console.timeEnd('Time for sending tx');
      console.timeEnd('Time for create and send tx');

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
        '',
        null,
        info,
        messageForNativeToken
      );

      await Wallet.updateProgressTx(100);
      return response;
    } catch (e) {
      await Wallet.updateProgressTx(0);

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
    await Wallet.updateProgressTx(10);
    // check new fee
    if (
      newFee <
        txHistory.feeNativeToken +
          Math.ceil((PercentFeeToReplaceTx * txHistory.feeNativeToken) / 100) &&
      newFeePToken <
        txHistory.feePToken +
          Math.ceil((PercentFeeToReplaceTx * txHistory.feePToken) / 100)
    ) {
      throw new error('New fee must be greater than 10% old fee');
    }

    const feeNativeToken = newFee;
    const feePToken = newFeePToken;

    const hasPrivacyForNativeToken = txHistory.isPrivacyNativeToken;
    let info = txHistory.info || '';
    if (newInfo != null) {
      info = newInfo;
    }

    let messageForNativeToken = txHistory.messageForNativeToken || '';
    if (newMessageForNativeToken != null) {
      messageForNativeToken = newMessageForNativeToken;
    }
    let messageForPToken = txHistory.messageForPToken || '';
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
      fee: feePToken ? new bn(feePToken).toString() : '0',
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

    console.time('Time for preparing input for custom token tx');
    const inputForTx = await prepareInputForReplaceTxNormal(
      listUTXOForPRV,
      hasPrivacyForNativeToken,
      null,
      this,
      Wallet.RpcClient
    );
    console.timeEnd('Time for preparing input for custom token tx');
    await Wallet.updateProgressTx(30);

    const hasPrivacyForPToken = txHistory.isPrivacyForPToken;
    const tokenID = txHistory.tokenID;
    const inputForPrivacyTokenTx = await prepareInputForReplaceTxPrivacyToken(
      listUTXOForPToken,
      this,
      Wallet.RpcClient,
      hasPrivacyForPToken,
      tokenID
    );
    await Wallet.updateProgressTx(50);
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
        sndOutputStrsForNativeToken === ''
      ) {
        throw new Error('Can not random scalar for native token outputs');
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
      if (sndOutputStrsForPToken === null || sndOutputStrsForPToken === '') {
        throw new Error('Can not random scalar for privacy token outputs');
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
      feeNativeToken ? new bn(feeNativeToken).toString() : '0',
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
    if (resInitTx === null || resInitTx === '') {
      throw new CustomError(
        ErrorObject.InitNormalTxErr,
        'Can not init transaction tranfering PRV'
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

    await Wallet.updateProgressTx(80);

    let response;
    try {
      response = await Wallet.RpcClient.sendRawTxCustomTokenPrivacy(
        b58CheckEncodeTx
      );
    } catch (e) {
      throw new CustomError(
        ErrorObject.SendTxErr,
        'Can not send privacy token tx',
        e
      );
    }

    await Wallet.updateProgressTx(90);
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
      //   let identicon = await Wallet.RpcClient.hashToIdenticon([tokenID]);
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

    await Wallet.updateProgressTx(100);
    return response;
  }

  // createAndSendBurningRequestTx create and send tx burning ptoken when withdraw
  // remoteAddress (string) is an ETH/BTC address which users want to receive ETH/BTC (without 0x)
  /**
   *
   * @param {...{paymentAddressStr: string, amount: number, message: string}} paramPaymentInfosForNativeToken
   * @param {{Privacy: bool, TokenID: string, TokenName: string, TokenSymbol: string, TokenTxType: bool, TokenAmount: number, TokenReceivers : {PaymentAddress: string, Amount: number, Message: string}}} submitParam
   * @param {number} feeNativeToken
   * @param {number} feePToken
   * @param {string} remoteAddress
   */
  async createAndSendBurningRequestTx(
    paramPaymentInfosForNativeToken = [],
    submitParam,
    feeNativeToken,
    feePToken,
    remoteAddress,
    info,
    burningType = BurningRequestMeta,
    isEncryptMessageOutCoinNativeToken = true,
    isEncryptMessageOutCoinPToken = true,
    txHandler
  ) {
    if (remoteAddress.startsWith('0x')) {
      remoteAddress = remoteAddress.slice(2);
    }

    if (feeNativeToken < 0) {
      feeNativeToken = 0;
    }

    if (feePToken < 0) {
      feePToken = 0;
    }

    await Wallet.updateProgressTx(10);

    let amountTransferPRV = new bn(0);
    for (let i = 0; i < paramPaymentInfosForNativeToken.length; i++) {
      paramPaymentInfosForNativeToken[i].amount = new bn(
        paramPaymentInfosForNativeToken[i].amount
      );
      amountTransferPRV = amountTransferPRV.add(
        paramPaymentInfosForNativeToken[i].amount
      );

      paramPaymentInfosForNativeToken[
        i
      ].amount = paramPaymentInfosForNativeToken[i].amount.toString();
    }

    // encrypt message for output coins native token
    if (isEncryptMessageOutCoinNativeToken) {
      paramPaymentInfosForNativeToken = await encryptMessageOutCoin(
        paramPaymentInfosForNativeToken
      );
    } else {
      for (let i = 0; i < paramPaymentInfosForNativeToken.length; i++) {
        paramPaymentInfosForNativeToken[i].message = base64Encode(
          stringToBytes(paramPaymentInfosForNativeToken[i].message)
        );
      }
    }

    const burningAddress = await getBurningAddress(Wallet.RpcClient);
    const paymentInfoForPToken = [
      {
        paymentAddressStr: burningAddress,
        amount: new bn(submitParam.TokenAmount).toString(),
        message: '',
      },
    ];

    submitParam.TokenReceivers.forEach((receiver) => {
      paymentInfoForPToken.push({
        paymentAddressStr: receiver.paymentAddress,
        amount: new bn(receiver.amount).toString(),
        message: receiver.message || '',
      });
    });

    // token param
    // get current token to get token param
    const tokenParamJson = {
      propertyID: submitParam.TokenID,
      propertyName: submitParam.TokenName,
      propertySymbol: submitParam.TokenSymbol,
      amount: new bn(submitParam.TokenAmount).toString(),
      tokenTxType: submitParam.TokenTxType,
      fee: feePToken ? new bn(feePToken).toString() : '0',
      paymentInfoForPToken,
      tokenInputs: [],
    };

    // encrypt message for output coins native token
    if (isEncryptMessageOutCoinPToken) {
      tokenParamJson.paymentInfoForPToken = await encryptMessageOutCoin(
        tokenParamJson.paymentInfoForPToken
      );
    } else {
      for (let i = 0; i < tokenParamJson.paymentInfoForPToken.length; i++) {
        tokenParamJson.paymentInfoForPToken[i].message = base64Encode(
          stringToBytes(tokenParamJson.paymentInfoForPToken[i].message)
        );
      }
    }

    const amountTransferPToken = new bn(tokenParamJson.amount);
    const isPrivacyNativeToken = true;
    const isPrivacyForPToken = false;

    const senderSkStr = this.key.base58CheckSerialize(PriKeyType);
    const paymentAddressStr = this.key.base58CheckSerialize(PaymentAddressType);

    const inputForTx = await prepareInputForTx(
      amountTransferPRV,
      new bn(feeNativeToken),
      isPrivacyNativeToken,
      null,
      this,
      Wallet.RpcClient
    );
    await Wallet.updateProgressTx(30);

    const inputForPrivacyTokenTx = await prepareInputForTxPrivacyToken(
      tokenParamJson,
      this,
      Wallet.RpcClient,
      new bn(feePToken),
      isPrivacyForPToken
    );
    await Wallet.updateProgressTx(50);

    tokenParamJson.tokenInputs = inputForPrivacyTokenTx.tokenInputs;

    // verify tokenID is valid or not
    const listCustomTokens = inputForPrivacyTokenTx.listPrivacyToken;
    let k = 0;
    for (k = 0; k < listCustomTokens.length; k++) {
      if (listCustomTokens[k].ID.toLowerCase() === tokenParamJson.propertyID) {
        break;
      }
    }
    if (k === listCustomTokens.length) {
      throw new Error('invalid token ID');
    }

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
        sndOutputStrsForNativeToken === ''
      ) {
        throw new Error('Can not random scalar for native token output');
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
      if (sndOutputStrsForPToken === null || sndOutputStrsForPToken === '') {
        throw new Error('Can not random scalar for privacy token output');
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

    // prepare meta data for tx
    const burningReqMetadata = {
      BurnerAddress: paymentAddressStr,
      BurningAmount: tokenParamJson.amount,
      TokenID: tokenParamJson.propertyID,
      TokenName: tokenParamJson.propertyName,
      RemoteAddress: remoteAddress,
      Type: burningType,
    };

    const paramInitTx = newParamInitPrivacyTokenTx(
      senderSkStr,
      paramPaymentInfosForNativeToken,
      inputForTx.inputCoinStrs,
      feeNativeToken ? new bn(feeNativeToken).toString() : '0',
      isPrivacyNativeToken,
      isPrivacyForPToken,
      tokenParamJson,
      burningReqMetadata,
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
    resInitTx = await wasmFuncs.initBurningRequestTx(paramInitTxJson);
    if (resInitTx === null || resInitTx === '') {
      throw new CustomError(
        ErrorObject.InitNormalTxErr,
        'Can not init transaction tranfering PRV'
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
    const tokenIDBytes = resInitTxBytes.slice(resInitTxBytes.length - 32);
    const tokenID = convertHashToStr(tokenIDBytes).toLowerCase();

    await Wallet.updateProgressTx(80);

    if (txHandler) {
      const txData = await wasmFuncs.parsePrivacyTokenRawTx(resInitTx);
      await txHandler(txData);
    }

    let response;
    try {
      response = await Wallet.RpcClient.sendRawTxCustomTokenPrivacy(
        b58CheckEncodeTx
      );
    } catch (e) {
      throw new CustomError(
        ErrorObject.SendTxErr,
        'Can not send privacy token tx',
        e
      );
    }

    await Wallet.updateProgressTx(90);
    // saving history tx
    // check status of tx
    const listUTXOForPRV = [];
    const listUTXOForPToken = [];
    // check status of tx and add coins to spending coins
    let status = FailedTx;
    if (response.txId) {
      status = SuccessTx;
      response.typeTx = TxCustomTokenPrivacyType;
      response.feeNativeToken = new bn(feeNativeToken).toString();
      response.feePToken = new bn(feePToken).toString();
      response.lockTime = lockTime;
      response.amountNativeToken = amountTransferPRV.toString();
      response.amountPToken = amountTransferPToken.toString();
      response.txStatus = status;
      response.tokenName = tokenParamJson.propertyName;
      response.tokenID = tokenID;
      response.tokenSymbol = tokenParamJson.propertySymbol;
      response.tokenTxType = tokenParamJson.tokenTxType;

      // add spending list
      for (let i = 0; i < inputForTx.inputCoinStrs.length; i++) {
        listUTXOForPRV.push(inputForTx.inputCoinStrs[i].SNDerivator);
      }

      for (let i = 0; i < inputForPrivacyTokenTx.tokenInputs.length; i++) {
        listUTXOForPToken.push(
          inputForPrivacyTokenTx.tokenInputs[i].SNDerivator
        );
      }
    }

    const isIn = false;
    this.savePrivacyTokenTxHistory(
      response,
      [burningAddress],
      isIn,
      isPrivacyNativeToken,
      isPrivacyForPToken,
      listUTXOForPRV,
      listUTXOForPToken,
      '',
      burningReqMetadata
    );
    await Wallet.updateProgressTx(100);
    return response;
  }

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
  static async getRewardAmount(paymentAddrStr, isGetAll = true, tokenID = '') {
    let resp;
    try {
      resp = await Wallet.RpcClient.getRewardAmount(paymentAddrStr);
    } catch (e) {
      throw new CustomError(
        ErrorObject.GetRewardAmountErr,
        'Can not get reward amount'
      );
    }

    if (isGetAll) {
      return resp.rewards;
    } else {
      if (tokenID === '') {
        tokenID = 'PRV';
      }

      return resp.rewards[tokenID];
    }
  }

  // createAndSendWithdrawRewardTx create and send tx withdraw reward amount
  /**
   *
   * @param {string} tokenID
   */
  async createAndSendWithdrawRewardTx(tokenID = '') {
    if (tokenID === '') {
      tokenID = convertHashToStr(PRVID);
    }

    const senderSkStr = this.key.base58CheckSerialize(PriKeyType);
    const paymentAddressStr = this.key.base58CheckSerialize(PaymentAddressType);

    const metaData = {
      Type: WithDrawRewardRequestMeta,
      PaymentAddress: paymentAddressStr,
      TokenID: tokenID,
    };
    const isPrivacy = false;

    console.time('Time for create and send tx');
    try {
      // prepare input for tx
      console.time('Time for preparing input for tx');
      const inputForTx = await prepareInputForTx(
        new bn(0),
        new bn(0),
        isPrivacy,
        null,
        this,
        Wallet.RpcClient
      );
      console.timeEnd('Time for preparing input for tx');

      await Wallet.updateProgressTx(30);

      const sndOutputs = [];

      const paramInitTx = newParamInitTx(
        senderSkStr,
        [],
        inputForTx.inputCoinStrs,
        '0',
        isPrivacy,
        null,
        metaData,
        '',
        inputForTx.commitmentIndices,
        inputForTx.myCommitmentIndices,
        inputForTx.commitmentStrs,
        sndOutputs
      );

      let resInitTx;
      const paramInitTxJson = JSON.stringify(paramInitTx);
      resInitTx = await wasmFuncs.initWithdrawRewardTx(paramInitTxJson);
      if (resInitTx === null || resInitTx === '') {
        throw new CustomError(
          ErrorObject.InitNormalTxErr,
          'Can not init transaction tranfering PRV'
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

      await Wallet.updateProgressTx(60);
      console.time('Time for sending tx');
      let response;
      try {
        response = await Wallet.RpcClient.sendRawTx(b58CheckEncodeTx);
      } catch (e) {
        throw new CustomError(
          ErrorObject.SendTxErr,
          'Can not send PRV transaction',
          e
        );
      }
      await Wallet.updateProgressTx(90);
      console.timeEnd('Time for sending tx');
      console.timeEnd('Time for create and send tx');

      // saving history tx
      // check status of tx
      let status = FailedTx;
      if (response.txId) {
        // tx.txId = response.txId
        status = SuccessTx;
        response.typeTx = TxNormalType;
        response.feeNativeToken = 0;
        response.lockTime = lockTime;
        response.amountNativeToken = 0;
        response.txStatus = status;
      }

      // saving history tx
      this.saveNormalTxHistory(
        response,
        [],
        false,
        isPrivacy,
        [],
        '',
        metaData,
        ''
      );
      await Wallet.updateProgressTx(100);
      return response;
    } catch (e) {
      await Wallet.updateProgressTx(0);
      throw e;
    }
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
      reps = await Wallet.RpcClient.getPublicKeyRole(
        'bls:' + blsPubKeyB58CheckEncode
      );
    } catch (e) {
      throw e;
    }

    return reps.status;
  }

  /** ******************** DEX **********************/
  /**
   *
   * @param {number} fee
   * @param {string} pdeContributionPairID
   * @param {number} contributedAmount
   * @param {string} info
   */
  async createAndSendTxWithNativeTokenContribution(
    fee,
    pdeContributionPairID,
    contributedAmount,
    info = ''
  ) {
    await Wallet.updateProgressTx(10);
    if (fee < 0) {
      fee = 0;
    }
    const feeBN = new bn(fee);

    const isPrivacy = false; // always false

    const burningAddress = await getBurningAddress(Wallet.RpcClient);
    const paramPaymentInfos = [
      {
        paymentAddressStr: burningAddress,
        amount: new bn(contributedAmount).toString(),
        message: '',
      },
    ];

    const messageForNativeToken = paramPaymentInfos[0].message;

    const totalAmountTransfer = new bn(contributedAmount);

    const senderSkStr = this.key.base58CheckSerialize(PriKeyType);
    // let paymentAddressStr = this.key.base58CheckSerialize(PaymentAddressType);
    // let viewingKeyStr = this.key.base58CheckSerialize(ReadonlyKeyType);

    console.time('Time for create and send tx');
    try {
      // prepare input
      console.time('Time for preparing input for privacy tx');
      const inputForTx = await prepareInputForTx(
        totalAmountTransfer,
        feeBN,
        isPrivacy,
        null,
        this,
        Wallet.RpcClient
      );
      console.timeEnd('Time for preparing input for privacy tx');

      await Wallet.updateProgressTx(30);

      let nOutput = paramPaymentInfos.length;
      if (
        inputForTx.totalValueInput.cmp(totalAmountTransfer.add(feeBN)) === 1
      ) {
        nOutput++;
      }

      let sndOutputStrs;
      const sndOutputs = new Array(nOutput);
      if (nOutput > 0) {
        sndOutputStrs = await wasmFuncs.randomScalars(nOutput.toString());
        if (sndOutputStrs === null || sndOutputStrs === '') {
          throw new Error('Can not random scalars for output coins');
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

      const contributorAddressStr = this.key.base58CheckSerialize(
        PaymentAddressType
      );

      const tokenIDStr = convertHashToStr(PRVID);

      // prepare meta data for tx
      const metadata = {
        PDEContributionPairID: pdeContributionPairID,
        ContributorAddressStr: contributorAddressStr,
        ContributedAmount: new bn(contributedAmount).toString(),
        TokenIDStr: tokenIDStr,
        Type: PDEContributionMeta,
      };

      const paramInitTx = newParamInitTx(
        senderSkStr,
        paramPaymentInfos,
        inputForTx.inputCoinStrs,
        feeBN.toString(),
        isPrivacy,
        null,
        metadata,
        info,
        inputForTx.commitmentIndices,
        inputForTx.myCommitmentIndices,
        inputForTx.commitmentStrs,
        sndOutputs
      );

      let resInitTx;
      const paramInitTxJson = JSON.stringify(paramInitTx);

      resInitTx = await wasmFuncs.initPRVContributionTx(paramInitTxJson);
      if (resInitTx === null || resInitTx === '') {
        throw new CustomError(
          ErrorObject.InitNormalTxErr,
          'Can not init transaction tranfering PRV'
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

      await Wallet.updateProgressTx(60);
      console.time('Time for sending tx');
      let response;
      const listUTXOForPRV = [];
      try {
        response = await Wallet.RpcClient.sendRawTx(b58CheckEncodeTx);
      } catch (e) {
        throw new CustomError(
          ErrorObject.SendTxErr,
          'Can not send PRV transaction',
          e
        );
      }
      await Wallet.updateProgressTx(90);
      console.timeEnd('Time for sending tx');
      console.timeEnd('Time for create and send tx');

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

        // add spending list
        for (let i = 0; i < inputForTx.inputCoinStrs.length; i++) {
          listUTXOForPRV.push(inputForTx.inputCoinStrs[i].SNDerivator);
        }
      }

      // saving history tx
      this.saveNormalTxHistory(
        response,
        [burningAddress],
        false,
        isPrivacy,
        listUTXOForPRV,
        '',
        metadata,
        info,
        messageForNativeToken
      );

      await Wallet.updateProgressTx(100);
      return response;
    } catch (e) {
      await Wallet.updateProgressTx(0);
      throw e;
    }
  }

  // createAndSendPTokenContributionTx
  /**
   *
   * @param {{Privacy: bool, TokenID: string, TokenName: string, TokenSymbol: string}}} tokenParam
   * @param {number} feeNativeToken
   * @param {number} feePToken
   * @param {string} pdeContributionPairID
   * @param {number} contributedAmount
   */
  async createAndSendPTokenContributionTx(
    tokenParam,
    feeNativeToken,
    feePToken,
    pdeContributionPairID,
    contributedAmount
  ) {
    await Wallet.updateProgressTx(10);

    if (feeNativeToken < 0) {
      feeNativeToken = 0;
    }

    if (feePToken < 0) {
      feePToken = 0;
    }

    const amountBNString = new bn(contributedAmount).toString();
    const feePTokenBNString = feePToken ? new bn(feePToken).toString() : '0';
    const feeNativeTokenBNString = feeNativeToken
      ? new bn(feeNativeToken).toString()
      : '0';
    const paramPaymentInfosForNativeToken = [];
    const amountTransferPRV = new bn(0);
    const burningAddress = await getBurningAddress(Wallet.RpcClient);
    // token param
    // get current token to get token param
    const tokenParamJson = {
      propertyID: tokenParam.TokenID,
      propertyName: tokenParam.TokenName,
      propertySymbol: tokenParam.TokenSymbol,
      amount: amountBNString,
      tokenTxType: CustomTokenTransfer,
      fee: feePTokenBNString,
      paymentInfoForPToken: [
        {
          paymentAddressStr: burningAddress,
          amount: amountBNString,
          message: '',
        },
      ],
      tokenInputs: [],
    };

    const messageForPToken = tokenParamJson.paymentInfoForPToken[0].message;

    const amountTransferPToken = new bn(contributedAmount);

    const senderSkStr = this.key.base58CheckSerialize(PriKeyType);
    const contributorAddressStr = this.key.base58CheckSerialize(
      PaymentAddressType
    );

    console.time('Time for preparing input for custom token tx');
    const inputForTx = await prepareInputForTx(
      amountTransferPRV,
      new bn(feeNativeToken),
      false,
      null,
      this,
      Wallet.RpcClient
    );
    console.timeEnd('Time for preparing input for custom token tx');

    await Wallet.updateProgressTx(30);

    const inputForPrivacyTokenTx = await prepareInputForTxPrivacyToken(
      tokenParamJson,
      this,
      Wallet.RpcClient,
      new bn(feePToken)
    );
    await Wallet.updateProgressTx(50);

    tokenParamJson.tokenInputs = inputForPrivacyTokenTx.tokenInputs;

    // verify tokenID is valid or not
    const listCustomTokens = inputForPrivacyTokenTx.listPrivacyToken;
    let k = 0;
    for (k = 0; k < listCustomTokens.length; k++) {
      if (listCustomTokens[k].ID.toLowerCase() === tokenParamJson.propertyID) {
        break;
      }
    }
    if (k === listCustomTokens.length) {
      throw new Error('invalid token ID');
    }

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
        sndOutputStrsForNativeToken === ''
      ) {
        throw new Error('Can not random scalar for native token output');
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
      if (sndOutputStrsForPToken === null || sndOutputStrsForPToken === '') {
        throw new Error('Can not random scalar for privacy token output');
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

    // prepare meta data for tx
    const metadata = {
      PDEContributionPairID: pdeContributionPairID,
      ContributorAddressStr: contributorAddressStr,
      ContributedAmount: amountBNString,
      TokenIDStr: tokenParamJson.propertyID,
      Type: PDEContributionMeta,
    };

    const isPrivacyNativeToken = false;
    const isPrivacyForPToken = false;

    const paramInitTx = newParamInitPrivacyTokenTx(
      senderSkStr,
      paramPaymentInfosForNativeToken,
      inputForTx.inputCoinStrs,
      feeNativeTokenBNString,
      isPrivacyNativeToken,
      isPrivacyForPToken,
      tokenParamJson,
      metadata,
      '',
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
    resInitTx = await wasmFuncs.initPTokenContributionTx(paramInitTxJson);
    if (resInitTx === null || resInitTx === '') {
      throw new CustomError(
        ErrorObject.InitNormalTxErr,
        'Can not init transaction tranfering PRV'
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

    await Wallet.updateProgressTx(80);

    let response;
    try {
      response = await Wallet.RpcClient.sendRawTxCustomTokenPrivacy(
        b58CheckEncodeTx
      );
    } catch (e) {
      throw new CustomError(
        ErrorObject.SendTxErr,
        'Can not send privacy token tx',
        e
      );
    }

    await Wallet.updateProgressTx(90);
    // saving history tx
    // check status of tx
    const listUTXOForPRV = [];
    const listUTXOForPToken = [];
    // check status of tx and add coins to spending coins
    let status = FailedTx;
    if (response.txId) {
      status = SuccessTx;
      response.typeTx = TxCustomTokenPrivacyType;
      response.feeNativeToken = new bn(feeNativeToken).toString();
      response.feePToken = new bn(feePToken).toString();
      response.lockTime = lockTime;
      response.amountNativeToken = amountTransferPRV.toString();
      response.amountPToken = amountTransferPToken.toString();
      response.txStatus = status;
      response.tokenName = tokenParamJson.propertyName;
      response.tokenID = tokenParamJson.propertyID;
      response.tokenSymbol = tokenParamJson.propertySymbol;
      response.tokenTxType = tokenParamJson.tokenTxType;

      // add spending list
      for (let i = 0; i < inputForTx.inputCoinStrs.length; i++) {
        listUTXOForPRV.push(inputForTx.inputCoinStrs[i].SNDerivator);
      }

      for (let i = 0; i < inputForPrivacyTokenTx.tokenInputs.length; i++) {
        listUTXOForPToken.push(
          inputForPrivacyTokenTx.tokenInputs[i].SNDerivator
        );
      }
    }

    const isIn = false;
    this.savePrivacyTokenTxHistory(
      response,
      [burningAddress],
      isIn,
      isPrivacyNativeToken,
      isPrivacyForPToken,
      listUTXOForPRV,
      listUTXOForPToken,
      '',
      metadata,
      '',
      '',
      messageForPToken
    );
    await Wallet.updateProgressTx(100);
    return response;
  }

  /**
   *
   * @param {number} fee
   * @param {string} pdeContributionPairID
   * @param {number} sellAmount
   * @param {number} minimumAcceptableAmount
   * @param {number} tradingFee
   * @param {string} info
   */
  async createAndSendNativeTokenTradeRequestTx(
    fee,
    tokenIDToBuyStr,
    sellAmount,
    minimumAcceptableAmount,
    tradingFee,
    info = ''
  ) {
    await Wallet.updateProgressTx(10);
    if (fee < 0) {
      fee = 0;
    }

    const feeBN = new bn(fee);

    const isPrivacy = false; // always false

    const burningAddress = await getBurningAddress(Wallet.RpcClient);
    const amountBN = new bn(sellAmount + tradingFee);
    const amountBNString = amountBN.toString();
    const paramPaymentInfos = [
      {
        paymentAddressStr: burningAddress,
        amount: amountBNString,
        message: '',
      },
    ];
    const messageForNativeToken = paramPaymentInfos[0].message;

    const totalAmountTransfer = amountBN;

    const senderSkStr = this.key.base58CheckSerialize(PriKeyType);
    // let paymentAddressStr = this.key.base58CheckSerialize(PaymentAddressType);
    // let viewingKeyStr = this.key.base58CheckSerialize(ReadonlyKeyType);

    console.time('Time for create and send tx');
    try {
      console.time('Time for preparing input for privacy tx');
      const inputForTx = await prepareInputForTx(
        totalAmountTransfer,
        feeBN,
        isPrivacy,
        null,
        this,
        Wallet.RpcClient
      );
      console.timeEnd('Time for preparing input for privacy tx');

      await Wallet.updateProgressTx(30);

      let nOutput = paramPaymentInfos.length;
      if (
        inputForTx.totalValueInput.cmp(totalAmountTransfer.add(feeBN)) === 1
      ) {
        nOutput++;
      }

      let sndOutputStrs;
      const sndOutputs = new Array(nOutput);
      if (nOutput > 0) {
        sndOutputStrs = await wasmFuncs.randomScalars(nOutput.toString());
        if (sndOutputStrs === null || sndOutputStrs === '') {
          throw new Error('Can not random scalars for output coins');
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

      const traderAddressStr = this.key.base58CheckSerialize(
        PaymentAddressType
      );
      const tokenIDStr = convertHashToStr(PRVID);

      // prepare meta data for tx
      const metadata = {
        TokenIDToBuyStr: tokenIDToBuyStr,
        TokenIDToSellStr: tokenIDStr,
        SellAmount: new bn(sellAmount).toString(),
        TraderAddressStr: traderAddressStr,
        Type: PDETradeRequestMeta,
        MinAcceptableAmount: new bn(minimumAcceptableAmount).toString(),
        TradingFee: new bn(tradingFee).toString(),
      };

      const paramInitTx = newParamInitTx(
        senderSkStr,
        paramPaymentInfos,
        inputForTx.inputCoinStrs,
        feeBN.toString(),
        isPrivacy,
        null,
        metadata,
        info,
        inputForTx.commitmentIndices,
        inputForTx.myCommitmentIndices,
        inputForTx.commitmentStrs,
        sndOutputs
      );

      let resInitTx;
      const paramInitTxJson = JSON.stringify(paramInitTx);

      resInitTx = await wasmFuncs.initPRVTradeTx(paramInitTxJson);
      if (resInitTx === null || resInitTx === '') {
        throw new CustomError(
          ErrorObject.InitNormalTxErr,
          'Can not init transaction tranfering PRV'
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

      await Wallet.updateProgressTx(60);
      console.time('Time for sending tx');
      let response;
      const listUTXOForPRV = [];
      try {
        response = await Wallet.RpcClient.sendRawTx(b58CheckEncodeTx);
      } catch (e) {
        throw new CustomError(
          ErrorObject.SendTxErr,
          'Can not send PRV transaction',
          e
        );
      }
      await Wallet.updateProgressTx(90);
      console.timeEnd('Time for sending tx');
      console.timeEnd('Time for create and send tx');

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

        // add spending list
        for (let i = 0; i < inputForTx.inputCoinStrs.length; i++) {
          listUTXOForPRV.push(inputForTx.inputCoinStrs[i].SNDerivator);
        }
      }

      // saving history tx
      this.saveNormalTxHistory(
        response,
        [burningAddress],
        false,
        isPrivacy,
        listUTXOForPRV,
        '',
        metadata,
        info,
        messageForNativeToken
      );

      await Wallet.updateProgressTx(100);
      return response;
    } catch (e) {
      await Wallet.updateProgressTx(0);

      throw e;
    }
  }

  /**
   * createAndSendPTokenTradeRequestTx
   * @param tokenParam {{Privacy: bool, TokenID: string, TokenName: string, TokenSymbol: string}}}
   * @param feeNativeToken
   * @param feePToken
   * @param tokenIDToBuyStr
   * @param sellAmount
   * @param minimumAcceptableAmount
   * @param tradingFee
   * @returns {Promise<{txId}>}
   */
  async createAndSendPTokenTradeRequestTx(
    tokenParam,
    feeNativeToken,
    feePToken,
    tokenIDToBuyStr,
    sellAmount,
    minimumAcceptableAmount,
    tradingFee
  ) {
    await Wallet.updateProgressTx(10);

    if (feeNativeToken < 0) {
      feeNativeToken = 0;
    }

    if (feePToken < 0) {
      feePToken = 0;
    }

    const paramPaymentInfosForNativeToken = [];
    const amountTransferPRV = new bn(0);

    const burningAddress = await getBurningAddress(Wallet.RpcClient);
    const amountBN = new bn(sellAmount + tradingFee);
    const amountBNString = amountBN.toString();
    const feeNativeBN = new bn(feeNativeToken || 0);
    const feePTokenBN = new bn(feePToken || 0);
    // token param
    // get current token to get token param
    const tokenParamJson = {
      propertyID: tokenParam.TokenID,
      propertyName: tokenParam.TokenName,
      propertySymbol: tokenParam.TokenSymbol,
      amount: amountBNString,
      tokenTxType: CustomTokenTransfer,
      fee: feePTokenBN.toString(),
      paymentInfoForPToken: [
        {
          paymentAddressStr: burningAddress,
          amount: amountBNString,
          message: '',
        },
      ],
      tokenInputs: [],
    };

    const messageForPToken = tokenParamJson.paymentInfoForPToken[0].message;

    const amountTransferPToken = new bn(sellAmount + tradingFee);

    const senderSkStr = this.key.base58CheckSerialize(PriKeyType);
    const traderAddressStr = this.key.base58CheckSerialize(PaymentAddressType);

    console.time('Time for preparing input for custom token tx');
    const inputForTx = await prepareInputForTx(
      amountTransferPRV,
      feeNativeBN,
      false,
      null,
      this,
      Wallet.RpcClient
    );
    console.timeEnd('Time for preparing input for custom token tx');
    await Wallet.updateProgressTx(30);

    const inputForPrivacyTokenTx = await prepareInputForTxPrivacyToken(
      tokenParamJson,
      this,
      Wallet.RpcClient,
      feePTokenBN
    );
    await Wallet.updateProgressTx(50);

    tokenParamJson.tokenInputs = inputForPrivacyTokenTx.tokenInputs;

    // verify tokenID is valid or not
    const listCustomTokens = inputForPrivacyTokenTx.listPrivacyToken;
    let k = 0;
    for (k = 0; k < listCustomTokens.length; k++) {
      if (listCustomTokens[k].ID.toLowerCase() === tokenParamJson.propertyID) {
        break;
      }
    }
    if (k === listCustomTokens.length) {
      throw new Error('invalid token ID');
    }

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
        sndOutputStrsForNativeToken === ''
      ) {
        throw new Error('Can not random scalar for native token output');
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
      if (sndOutputStrsForPToken === null || sndOutputStrsForPToken === '') {
        throw new Error('Can not random scalar for privacy token output');
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

    // prepare meta data for tx

    const metadata = {
      TokenIDToBuyStr: tokenIDToBuyStr,
      TokenIDToSellStr: tokenParam.TokenID,
      SellAmount: new bn(sellAmount).toString(),
      TraderAddressStr: traderAddressStr,
      Type: PDETradeRequestMeta,
      MinAcceptableAmount: new bn(minimumAcceptableAmount).toString(),
      TradingFee: new bn(tradingFee).toString(),
    };

    const paramInitTx = newParamInitPrivacyTokenTx(
      senderSkStr,
      paramPaymentInfosForNativeToken,
      inputForTx.inputCoinStrs,
      feeNativeBN.toString(),
      false,
      false,
      tokenParamJson,
      metadata,
      '',
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
    resInitTx = await wasmFuncs.initPTokenTradeTx(paramInitTxJson);
    if (resInitTx === null || resInitTx === '') {
      throw new CustomError(
        ErrorObject.InitNormalTxErr,
        'Can not init transaction tranfering PRV'
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

    await Wallet.updateProgressTx(80);

    let response;
    try {
      response = await Wallet.RpcClient.sendRawTxCustomTokenPrivacy(
        b58CheckEncodeTx
      );
    } catch (e) {
      throw new CustomError(
        ErrorObject.SendTxErr,
        'Can not send privacy token tx',
        e
      );
    }

    await Wallet.updateProgressTx(90);
    // saving history tx
    // check status of tx
    const listUTXOForPRV = [];
    const listUTXOForPToken = [];
    // check status of tx and add coins to spending coins
    let status = FailedTx;
    if (response.txId) {
      status = SuccessTx;
      response.typeTx = TxCustomTokenPrivacyType;
      response.feeNativeToken = new bn(feeNativeToken).toString();
      response.feePToken = new bn(feePToken).toString();
      response.lockTime = lockTime;
      response.amountNativeToken = amountTransferPRV.toString();
      response.amountPToken = amountTransferPToken.toString();
      response.txStatus = status;
      response.tokenName = tokenParamJson.propertyName;
      response.tokenID = tokenParamJson.propertyID;
      response.tokenSymbol = tokenParamJson.propertySymbol;
      response.tokenTxType = tokenParamJson.tokenTxType;

      // add spending list
      for (let i = 0; i < inputForTx.inputCoinStrs.length; i++) {
        listUTXOForPRV.push(inputForTx.inputCoinStrs[i].SNDerivator);
      }

      for (let i = 0; i < inputForPrivacyTokenTx.tokenInputs.length; i++) {
        listUTXOForPToken.push(
          inputForPrivacyTokenTx.tokenInputs[i].SNDerivator
        );
      }
    }

    const isIn = false;
    this.savePrivacyTokenTxHistory(
      response,
      [burningAddress],
      isIn,
      false,
      false,
      listUTXOForPRV,
      listUTXOForPToken,
      '',
      metadata,
      '',
      '',
      messageForPToken
    );
    await Wallet.updateProgressTx(100);
    return response;
  }

  /**
   *
   * @param {number} fee
   * @param {string} pdeContributionPairID
   * @param {number} sellAmount
   * @param {string} info
   */
  async createAndSendWithdrawDexTx(
    fee,
    withdrawalToken1IDStr,
    withdrawalToken2IDStr,
    withdrawalShareAmt,
    info = ''
  ) {
    await Wallet.updateProgressTx(10);

    if (fee < 0) {
      fee = 0;
    }

    const feeBN = new bn(fee);
    const isPrivacy = false; // always false
    const paramPaymentInfos = [];
    const totalAmountTransfer = new bn(0);

    const senderSkStr = this.key.base58CheckSerialize(PriKeyType);
    // let paymentAddressStr = this.key.base58CheckSerialize(PaymentAddressType);
    // let viewingKeyStr = this.key.base58CheckSerialize(ReadonlyKeyType);

    console.time('Time for create and send tx');
    try {
      // prepare input
      console.time('Time for preparing input for privacy tx');
      const inputForTx = await prepareInputForTx(
        totalAmountTransfer,
        feeBN,
        isPrivacy,
        null,
        this,
        Wallet.RpcClient
      );
      console.timeEnd('Time for preparing input for privacy tx');

      await Wallet.updateProgressTx(30);

      let nOutput = paramPaymentInfos.length;
      if (
        inputForTx.totalValueInput.cmp(totalAmountTransfer.add(feeBN)) === 1
      ) {
        nOutput++;
      }

      let sndOutputStrs;
      const sndOutputs = new Array(nOutput);
      if (nOutput > 0) {
        sndOutputStrs = await wasmFuncs.randomScalars(nOutput.toString());
        if (sndOutputStrs === null || sndOutputStrs === '') {
          throw new Error('Can not random scalars for output coins');
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

      const withdrawerAddressStr = this.key.base58CheckSerialize(
        PaymentAddressType
      );

      // prepare meta data for tx
      const metadata = {
        WithdrawerAddressStr: withdrawerAddressStr,
        WithdrawalToken1IDStr: withdrawalToken1IDStr,
        WithdrawalToken2IDStr: withdrawalToken2IDStr,
        WithdrawalShareAmt: new bn(withdrawalShareAmt).toString(),
        Type: PDEWithdrawalRequestMeta,
      };

      const paramInitTx = newParamInitTx(
        senderSkStr,
        paramPaymentInfos,
        inputForTx.inputCoinStrs,
        feeBN.toString(),
        isPrivacy,
        null,
        metadata,
        info,
        inputForTx.commitmentIndices,
        inputForTx.myCommitmentIndices,
        inputForTx.commitmentStrs,
        sndOutputs
      );

      let resInitTx;
      const paramInitTxJson = JSON.stringify(paramInitTx);

      resInitTx = await wasmFuncs.withdrawDexTx(paramInitTxJson);
      if (resInitTx === null || resInitTx === '') {
        throw new CustomError(
          ErrorObject.InitNormalTxErr,
          'Can not init transaction tranfering PRV'
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

      await Wallet.updateProgressTx(60);
      console.time('Time for sending tx');
      let response;
      const listUTXOForPRV = [];
      try {
        response = await Wallet.RpcClient.sendRawTx(b58CheckEncodeTx);
      } catch (e) {
        throw new CustomError(
          ErrorObject.SendTxErr,
          'Can not send PRV transaction',
          e
        );
      }
      await Wallet.updateProgressTx(90);
      console.timeEnd('Time for sending tx');
      console.timeEnd('Time for create and send tx');

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

        // add spending list
        for (let i = 0; i < inputForTx.inputCoinStrs.length; i++) {
          listUTXOForPRV.push(inputForTx.inputCoinStrs[i].SNDerivator);
        }
      }

      // saving history tx
      this.saveNormalTxHistory(
        response,
        [],
        false,
        isPrivacy,
        listUTXOForPRV,
        '',
        metadata,
        info
      );

      await Wallet.updateProgressTx(100);
      return response;
    } catch (e) {
      await Wallet.updateProgressTx(0);
      throw e;
    }
  }

  async getReceivedTransaction() {
    const rpcClient = Wallet.RpcClient;
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

      let messageForNativeToken = '';
      let messageForPToken = '';
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
          hashOriginalTx: '',
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
              response = await Wallet.RpcClient.getTransactionByHash(
                this.txHistory.NormalTx[j].txID
              );
            } catch (e) {
              throw new CustomError(
                ErrorObject.GetTxByHashErr,
                e.message || 'Can not get normal transaction by hash'
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
              response = await Wallet.RpcClient.getTransactionByHash(
                this.txHistory.CustomTokenTx[j].txID
              );
            } catch (e) {
              throw new CustomError(
                ErrorObject.GetTxByHashErr,
                e.message || 'Can not get custom token transaction by hash'
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
              response = await Wallet.RpcClient.getTransactionByHash(
                this.txHistory.PrivacyTokenTx[j].txID
              );
            } catch (e) {
              throw new CustomError(
                ErrorObject.GetTxByHashErr,
                e.message || 'Can not get privacy token transaction by hash'
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

  // get balance version 2

  async getListOutputsCoins({ total, tokenId }) {
    try {
      console.time('GET LIST OUTPUTS COINS');
      const viewKey = this.getReadonlyKey();
      let listOutputsCoins = [];
      const oldTotal = await this.getTotalCoinsStorage(tokenId);
      if (total > LIMIT_COINS) {
        const {
          times,
          remainder,
        } = this.getLimitOffSetListOuputCoinsWhenBreakSizeLimit(total);
        const task = [...Array(times)].map((item, index) => {
          const limit = LIMIT_COINS;
          const offset = index * LIMIT_COINS + oldTotal;
          return apiGetListOutputCoins({
            viewKey,
            tokenId,
            limit,
            offset,
          });
        });
        if (remainder > 0) {
          task.push(
            apiGetListOutputCoins({
              viewKey,
              tokenId,
              limit: LIMIT_COINS,
              offset: times * LIMIT_COINS + oldTotal,
            })
          );
        }
        const result = await Promise.all(task);
        listOutputsCoins = result.reduce((prev, curr, index) => {
          const result = [...prev, ...[...curr]];
          return result;
        }, []);
      } else {
        listOutputsCoins = await apiGetListOutputCoins({
          viewKey,
          limit: LIMIT_COINS,
          offset: oldTotal,
          tokenId,
        });
      }
      listOutputsCoins = uniqBy(listOutputsCoins, 'SNDerivator');
      console.timeEnd('GET LIST OUTPUTS COINS');
      return (
        listOutputsCoins.filter(
          (item) => item?.Value !== '0' || !item?.Value
        ) || []
      );
    } catch (e) {
      throw new CustomError(
        ErrorObject.GetOutputCoinsErr,
        e.message ||
          `Can not get output coins when get unspent token ${tokenId}`
      );
    }
  }

  async getListSerialsNumber({ listOutputsCoins }) {
    try {
      console.time('GET LIST SN BY PRIVATE KEY');
      const privateKey = this.key.base58CheckSerialize(PriKeyType);
      const snds = listOutputsCoins.map((item) => item?.SNDerivator);
      const param = {
        privateKey,
        snds,
      };
      const result = await wasmFuncs.deriveSerialNumber(JSON.stringify(param));
      console.timeEnd('GET LIST SN BY PRIVATE KEY');
      return result || [];
    } catch (error) {
      throw error;
    }
  }

  getListSerialsNumberDecode({ listSerialsNumberEncode, size }) {
    console.time('GET LIST SN DECODE');
    const serialNumberStrs = new Array(size);
    const serialNumberBytes = new Array(size);
    const tmpBytes = base64Decode(listSerialsNumberEncode);
    [...Array(size)].forEach((item, i) => {
      serialNumberBytes[i] = tmpBytes.slice(
        i * ED25519_KEY_SIZE,
        (i + 1) * ED25519_KEY_SIZE
      );
      // serialNumberStrs[i] = checkEncode(serialNumberBytes[i], ENCODE_VERSION);
      serialNumberStrs[i] = base64Encode(serialNumberBytes[i]);
    });
    console.timeEnd('GET LIST SN DECODE');
    return serialNumberStrs || [];
  }

  async getKeyInfo(tokenId) {
    try {
      console.time('GET KEY INFO');
      let keyInfo = this.keyInfo;
      if (isEmpty(keyInfo)) {
        const readOnlyKeySerialize = this.getReadonlyKey();
        keyInfo = await apiGetKeyInfo({ viewKey: readOnlyKeySerialize });
      }
      console.timeEnd('GET KEY INFO');
      const total = keyInfo?.v1startindex[tokenId]?.Total || 0;
      return {
        total,
      };
    } catch (error) {
      throw error;
    }
  }

  async checkKeyImages({ listOutputsCoins, shardId }) {
    console.time('CHECK KEY IMAGES');
    const listSerialsNumberEncode = await this.getListSerialsNumber({
      listOutputsCoins,
    });
    const listSerialNumberDecode = this.getListSerialsNumberDecode({
      listSerialsNumberEncode,
      size: listOutputsCoins.length,
    });
    const listOutputsCoinsWithSNDecode = listOutputsCoins.map(
      (item, index) => ({
        ...item,
        SerialNumber: listSerialNumberDecode[index],
        PublicKey: this.key.getPublicKeyByHex(),
        CoinCommitment: item?.Commitment,
      })
    );
    let listUnspentCoinsFiltered = [];
    if (listSerialNumberDecode.length !== 0) {
      const listSerialNumberStatus = await apiCheckKeyImages({
        keyImages: listSerialNumberDecode,
        shardId,
      });
      listUnspentCoinsFiltered = listOutputsCoinsWithSNDecode?.filter(
        (coin, index) => !listSerialNumberStatus[index]
      );
    }
    console.timeEnd('CHECK KEY IMAGES');
    return listUnspentCoinsFiltered;
  }

  getLimitOffSetListOuputCoinsWhenBreakSizeLimit(size) {
    const times = Math.floor(size / LIMIT_COINS);
    const remainder = size % LIMIT_COINS;
    return {
      times,
      remainder,
    };
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
      console.debug('CHECK STATUS LIST UNSPENT COINS STORAGE', tokenId);
      console.time('CHECK STATUS LIST UNSPENT COIN FROM STORAGE');
      const total = await this.getTotalCoinsStorage(tokenId);
      if (total === 0) {
        return;
      }
      const listUnspentCoins = await this.getListUnspentCoinsStorage(tokenId);
      const shardId = this.getShardId();
      const listOutputsCoins = [...listUnspentCoins];
      const listSerialNumberDecode = listOutputsCoins.map(
        (item) => item?.SerialNumber
      );
      if (listSerialNumberDecode.length !== 0) {
        const listSerialNumberStatus = await apiCheckKeyImages({
          keyImages: listSerialNumberDecode,
          shardId,
        });
        const listUnspentCoinsFiltered = listOutputsCoins?.filter(
          (coin, index) => !listSerialNumberStatus[index]
        );
        await this.updateListUnspentCoinsStorage({
          listUnspentCoins: listUnspentCoinsFiltered,
          tokenId,
        });
      }
      console.timeEnd('CHECK STATUS LIST UNSPENT COIN FROM STORAGE');
    } catch (error) {
      throw error;
    }
  }

  async getListUnspentCoins(tokenId) {
    try {
      console.debug('GET LIST UNSPENT COINS OF TOKEN ID', tokenId);
      console.time(`GET LIST UNSPENT COINS ${tokenId}`);
      const keyInfo = await this.getKeyInfo(tokenId);
      let listOutputsCoins = [];
      const { total } = keyInfo;
      const oldTotal = await this.getTotalCoinsStorage(tokenId);
      console.debug('OLD TOTAL', oldTotal);
      console.debug('NEW TOTAL ', total);
      await this.checkStatusListUnspentCoinsStorage(tokenId);
      let calcTotal = 0;
      if (total !== oldTotal) {
        calcTotal = total - oldTotal;
      }
      if (calcTotal > 0) {
        listOutputsCoins = await this.getListOutputsCoins({
          total: calcTotal,
          tokenId,
        });
        const shardId = this.getShardId();
        const listUnspentCoinsFiltered = await this.checkKeyImages({
          listOutputsCoins,
          shardId,
        });
        await this.setListUnspentCoinsStorage({
          value: listUnspentCoinsFiltered,
          tokenId,
        });
        await this.setTotalCoinsStorage({ value: total, tokenId });
      }
      const listUnspentCoinsMerged = await this.getListUnspentCoinsStorage(
        tokenId
      );
      console.timeEnd(`GET LIST UNSPENT COINS ${tokenId}`);
      if (!this.coinUTXOs) {
        this.coinUTXOs = {};
      }
      this.coinUTXOs[tokenId] = listUnspentCoinsMerged.length;
      return listUnspentCoinsMerged;
    } catch (error) {
      throw error;
    }
  }

  async getBalance(tokenID) {
    let accountBalance = '0';
    try {
      const tokenId = tokenID || PRVIDSTR;
      console.debug('GET BALANCE V2', tokenId);
      const listUnspentCoins = await this.getListUnspentCoins(tokenId);
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
