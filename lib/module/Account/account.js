import bn from "bn.js";
import { RpcHTTPRequestServiceClient } from "@lib/rpcclient/rpchttprequestservice";
import _, { uniq } from "lodash";
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
  PrivacyVersion,
} from "@lib/core/constants";
import { checkEncode } from "@lib/common/base58";
import { ENCODE_VERSION } from "@lib/common/constants";

import {
  getChildIdFromChildNumberArray,
  getShardIDFromLastByte,
} from "@lib/common/common";
import { generateBLSPubKeyB58CheckEncodeFromSeed } from "@lib/common/committeekey";
import { hashSha3BytesToBytes } from "@lib/privacy/utils";
import { CustomError, ErrorObject } from "@lib/common/errorhandler";
import { isJsonString } from "@lib/utils/json";
import { wasm as wasmFuncs } from "@lib/wasm";
import { RpcHTTPCoinServiceClient } from "@lib/rpcclient/rpchttpcoinservice";
import { RpcHTTPTxServiceClient } from "@lib/rpcclient/rpchttptxservice";
import Validator from "@lib/utils/validator";
import { LIMIT, TX_STATUS } from "./account.constants";
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
import send from "@lib/module/Account/account.send";
import provide from "@lib/module/Account/account.provide";
import historyReceiver from "@lib/module/Account/account.historyReceiver";
import historyTransactor from "@lib/module/Account/account.historyTransactor";
import addLiquidity from "@lib/module/Account/account.addLiquidity";
import { pagination } from "./account.utils";

const performance = {
  now() {
    return new Date().getTime();
  },
};

global.timers = {};

const deserializedAccounts = {};

export const TOTAL_COINS_KEY_STORAGE = "TOTAL-COINS";
export const UNSPENT_COINS_STORAGE = "UNSPENT-COINS";
export const SPENDING_COINS_STORAGE = "SPENDING-COINS-STORAGE";
export const COINS_STORAGE = "COINS_STORAGE";
export const SPENT_COINS_STORAGE = "SPENT_COINS_STORAGE";
export const TOTAL_UNSPENT_COINS = "TOTAL_UNSPENT_COINS";
export const SUBMITTED_OTA_KEY = "SUBMITTED_OTA_KEY";

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
    this.storage = w.Storage ? w.Storage : new StorageServices();
    this.coinUTXOs = {};
    this.rpc = w.RpcClient ? new RpcClient(w.RpcClient) : null;
    this.rpcCoinService = w.RpcCoinService
      ? new RpcHTTPCoinServiceClient(w.RpcCoinService)
      : null;
    this.rpcTxService = w.RpcTxService
      ? new RpcHTTPTxServiceClient(w.RpcTxService)
      : null;
    this.rpcRequestService = w.RpcRequestService
      ? new RpcHTTPRequestServiceClient(w.RpcRequestService)
      : null;
    this.privacyVersion = w.PrivacyVersion || PrivacyVersion.ver2;
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
      new Validator("key", key).required().string();
      new Validator("value", value).required();
      new Validator("storage", this.storage).required().object();
      if (this.storage) {
        await this.storage.setItem(
          key,
          typeof value !== "string" ? JSON.stringify(value) : value
        );
      }
    } catch (error) {
      throw error;
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
      new Validator(`getListUnspentCoinsStorage-tokenId`, tokenId)
        .required()
        .string();
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
            : uniqBy([...oldListUnspentCoins, ...value], "KeyImage");
        await this.setAccountStorage(key, listUnspentCoins);
      }
    } catch (error) {
      throw error;
    }
  }

  async getTotalCoinsStorage(tokenId) {
    try {
      new Validator("getTotalCoinsStorage-tokenId", tokenId)
        .required()
        .string();
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
      const txIds = uniq(spendingCoins.map((coin) => coin.txId));
      const tasks = txIds.map((txId) =>
        this.rpcTxService.apiGetTxStatus({ txId })
      );
      let statuses = [];
      try {
        statuses = await Promise.all(tasks);
      } catch (e) {
        throw new CustomError(
          ErrorObject.GetStatusTransactionErr,
          "Message is too large",
          e
        );
      }
      statuses = txIds.map((txId, index) => ({
        txId,
        status: statuses[index],
      }));

      const spendingCoinsFilterByTime = spendingCoins.filter((item) => {
        const timeExist = new Date().getTime() - item?.createdAt;
        const timeExpired = 2 * 60 * 1000;
        const { status } = statuses.find((status) => status.txId === item.txId);
        return (
          (status === TX_STATUS.TXSTATUS_UNKNOWN && timeExist < timeExpired) ||
          status === TX_STATUS.TXSTATUS_PENDING ||
          status === TX_STATUS.PROCESSING
        );
      });
      await this.setAccountStorage(key, spendingCoinsFilterByTime);
      return spendingCoinsFilterByTime || [];
    } catch (error) {
      throw error;
    }
  }

  async setSpendingCoinsStorage({ coins, tokenId = PRVIDSTR, txId } = {}) {
    try {
      new Validator("tokenId", tokenId).required().string();
      new Validator("coins", coins).required().array();
      if (!coins) {
        return;
      }
      const key = this.getKeySpendingCoinsStorageByTokenId(tokenId);
      const spendingCoins = await this.getSpendingCoinsStorageByTokenId(
        tokenId
      );
      const mapCoins = coins.map((item) => ({
        keyImage: item.KeyImage,
        createdAt: new Date().getTime(),
        txId,
        tokenId,
      }));
      mapCoins.forEach((item) => {
        const isExist = spendingCoins.some(
          (coin) => coin?.keyImage === item?.keyImage
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

  async getCoinsStorage(tokenId) {
    try {
      new Validator("getCoinsStorage-tokenId", tokenId).required().string();
      const key = this.getKeyCoinsStorageByTokenId(tokenId);
      return this.getAccountStorage(key);
    } catch (error) {
      throw error;
    }
  }

  async setCoinsStorage({ value, tokenId }) {
    try {
      new Validator("setCoinsStorage-value", value).required().object();
      new Validator("setCoinsStorage-tokenId", tokenId).required().string();
      const key = this.getKeyCoinsStorageByTokenId(tokenId);
      const data = (await this.getAccountStorage(key)) || [];
      const newData = [value, ...data];
      await this.setAccountStorage(key, newData);
    } catch (error) {
      throw error;
    }
  }

  async getListSpentCoinsStorage(tokenID) {
    try {
      new Validator("getListSpentCoinsStorage-tokenID", tokenID)
        .required()
        .string();
      if (this.storage) {
        const key = this.getKeyListSpentCoinsByTokenId(tokenID);
        return (await this.getAccountStorage(key)) || [];
      }
    } catch (error) {
      throw error;
    }
  }

  async setListSpentCoinsStorage({ spentCoins, tokenId }) {
    try {
      new Validator("spentCoins", spentCoins).required().array();
      new Validator("tokenId", tokenId).required().string();
      if (this.storage) {
        const key = this.getKeyListSpentCoinsByTokenId(tokenId);
        const oldSpentCoins = await this.getListSpentCoinsStorage(tokenId);
        const value =
          oldSpentCoins?.length === 0
            ? [...spentCoins]
            : uniqBy(
                [...oldSpentCoins, ...spentCoins],
                (item) => item?.KeyImage
              );
        await this.setAccountStorage(key, value);
      }
    } catch (error) {
      throw error;
    }
  }

  async getListOutputCoinsStorage({ tokenID }) {
    try {
      new Validator("getListOutputCoinsStorage-tokenID", tokenID)
        .required()
        .string();
      let task = [
        this.getListSpentCoinsStorage(tokenID),
        this.getListUnspentCoinsStorage(tokenID),
      ];
      const [spentCoins, unspentCoins] = await Promise.all(task);
      return [...spentCoins, ...unspentCoins];
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

  getPaymentAddress() {
    return this.key.base58CheckSerialize(PaymentAddressType);
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
      if (total > LIMIT) {
        const { times, remainder } = pagination(total);
        const task = [...Array(times)].map((item, index) => {
          const limit = LIMIT;
          const offset = index * LIMIT + oldTotal;
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
              limit: LIMIT,
              offset: times * LIMIT + oldTotal,
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
        return this.getOutputCoinsV1({ tokenId, total });
      default:
        return this.getListOutputCoinsV2({ tokenId, total });
    }
  }

  async storeListSpentCoins({ tokenId, spentCoins }) {
    new Validator("storeListSpentCoins-tokenId", tokenId).required().string();
    new Validator("storeListSpentCoins-spentCoins", spentCoins)
      .array()
      .required();
    await this.setListSpentCoinsStorage({
      spentCoins,
      tokenId,
    });
  }

  async getKeyInfo(tokenId) {
    try {
      new Validator(`getKeyInfo-${VALIDATOR.tokenId}`, tokenId)
        .required()
        .string();
      let keyInfo = this.keyInfo;
      const version = this.privacyVersion;
      const otaKey = this.getOTAKey();
      keyInfo = await this.rpcCoinService.apiGetKeyInfo({
        key: otaKey,
        version,
      });
      return keyInfo;
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
      new Validator(
        "updateListUnspentCoinsStorage-listUnspentCoins",
        listUnspentCoins
      )
        .required()
        .array();
      new Validator("updateListUnspentCoinsStorage-tokenId", tokenId)
        .required()
        .string();
      const key = this.getKeyListUnspentCoinsByTokenId(tokenId);
      await this.setAccountStorage(key, listUnspentCoins);
    } catch (error) {
      throw error;
    }
  }

  async checkStatusListUnspentCoinsStorage(tokenId) {
    try {
      new Validator("checkStatusListUnspentCoinsStorage-tokenId", tokenId)
        .required()
        .string();
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

  async getKeyListUnspentCoins() {
    const viewkey = this.getReadonlyKey();
    return this.getPrefixKeyStorage() + `-${TOTAL_UNSPENT_COINS}-${viewkey}`;
  }

  initTrackingGetOutCoins() {
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
        timeGetKeyInfo: -1,
        timeCheckStatusListUnspentCoinsFromLocal: {
          timeCheckKeyImages: -1,
          timeUpdateListUnspentCoinsFromLocal: -1,
          timeStoreListSpentCoins: -1,
        },
        timeGetListOutputsCoins: -1,
        timeCheckKeyImages: {
          timeGetDecryptCoins: -1,
          timeCheckKeyImages: -1,
          timeStoreListSpentCoins: -1,
        },
        timeSetListUnspentCoinsStorage: -1,
        timeSetTotalCoinsStorage: -1,
        totalTimeGetUnspentCoins: -1,
        tokenId: null,
        otaKey: this.getOTAKey(),
      };
    }
  }

  async getUnspentCoinsV2(tokenId) {
    new Validator(`getUnspentCoinsV2-${VALIDATOR.tokenId}`, tokenId)
      .required()
      .string();
    this.initTrackingGetOutCoins();
    this.coinsStorage.tokenId = tokenId;
    const keyInfo = await this.measureAsyncFn(
      this.getKeyInfo,
      "timeGetKeyInfo",
      tokenId
    );
    let listOutputsCoins = [];
    let total = 0;
    if (keyInfo && keyInfo.coinindex && keyInfo.coinindex[tokenId]) {
      total = keyInfo.coinindex[tokenId].Total || 0;
    }
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
    await this.setCoinsStorage({ value: this.coinsStorage, tokenId });
    return listUnspentCoinsMerged;
  }

  async getFlagSubmittedOTAKey() {
    let submitted = false;
    try {
      const key = this.getOTAKey();
      submitted = await this.getAccountStorage(key);
    } catch (error) {
      console.log("error", error);
    }
    return !!submitted;
  }

  async submitOTAKey() {
    const otaKey = this.getOTAKey();
    try {
      const submitted = await this.getFlagSubmittedOTAKey();
      if (!submitted) {
        const shardID = this.getShardId();
        const result = await this.rpcCoinService.apiSubmitOTAKey({
          otaKey,
          shardID,
        });
        if (!!result) {
          await this.setAccountStorage(otaKey, true);
        }
      }
    } catch {
      console.log("Submit failed!");
    }
  }

  async getOutputCoins(tokenID) {
    let spentCoins = [];
    let unspentCoins = [];
    try {
      const tokenId = tokenID || PRVIDSTR;
      const version = this.privacyVersion;
      new Validator(VALIDATOR.tokenId, tokenId).required().string();
      new Validator(VALIDATOR.privacyVersion, version).required().number();
      await this.submitOTAKey();
      switch (version) {
        case PrivacyVersion.ver1: {
          const { unspentCoins: _unspentCoins } =
            await this.getUnspentCoinsByTokenIdV1({ tokenId });
          unspentCoins = [...unspentCoins];
          break;
        }
        case PrivacyVersion.ver2: {
          try {
            unspentCoins = await this.getUnspentCoinsV2(tokenId);
            spentCoins = await this.getListSpentCoinsStorage(tokenId);
          } catch (error) {
            await this.clearCacheStorage({ tokenID });
            throw error;
          }
          break;
        }
        default:
          break;
      }
    } catch (error) {
      throw error;
    }
    const result = {
      spentCoins,
      unspentCoins,
      outputCoins: [...unspentCoins, ...spentCoins],
    };
    console.log("=======================================");
    console.log("PRIVACY VERSION", this.privacyVersion);
    console.log("ACCOUNT", this.name, this.getOTAKey());
    console.log("TOKEN ID", tokenID);
    console.log("UNSPENT COINS", unspentCoins.length);
    console.log("SPENT COINS", spentCoins.length);
    console.log("OUTPUTS COINS", result.outputCoins.length);
    console.log("=======================================");
    return result;
  }

  async getSpendingCoins(tokenId) {
    new Validator(`getSpendingCoins-${VALIDATOR.tokenId}`, tokenId)
      .required()
      .string();
    try {
      let { unspentCoins: coins } = await this.getOutputCoins(tokenId);
      try {
        const spendingCoinsStorage =
          await this.getSpendingCoinsStorageByTokenId(tokenId);
        coins = coins.filter(
          (item) =>
            !spendingCoinsStorage?.find(
              (coin) => coin?.keyImage === item?.KeyImage
            )
        );
        const spendingCoins =
          await this.rpcCoinService.apiGetSpendingCoinInMemPool();
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
    new Validator("tokenID", tokenID).required().string();
    let accountBalance = "0";
    try {
      const { unspentCoins: listUnspentCoins } = await this.measureAsyncFn(
        this.getOutputCoins,
        "totalTimeGetUnspentCoins",
        tokenID
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

  async clearCacheStorage({ tokenID }) {
    try {
      new Validator("tokenID", tokenID).required().string();
      const totalCoinsKey = this.getKeyTotalCoinsStorageByTokenId(tokenID);
      const unspentCoinsKey = this.getKeyListUnspentCoinsByTokenId(tokenID);
      const spendingCoinsKey =
        this.getKeySpendingCoinsStorageByTokenId(tokenID);
      const storageCoins = this.getKeyCoinsStorageByTokenId(tokenID);
      const spentCoinsKey = this.getKeyListSpentCoinsByTokenId(tokenID);
      const otaKey = this.getOTAKey();

      await Promise.all([
        this.clearAccountStorage(totalCoinsKey),
        this.clearAccountStorage(unspentCoinsKey),
        this.clearAccountStorage(spendingCoinsKey),
        this.clearAccountStorage(storageCoins),
        this.clearAccountStorage(spentCoinsKey),
        this.clearAccountStorage(otaKey),
        this.clearTxsHistory({ tokenID }),
      ]);
    } catch (error) {
      console.log("ERROR CLEAR LIST OUT COINS", error);
    }
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
  unshield,
  send,
  historyReceiver,
  historyTransactor,
  provide,
  addLiquidity
);
export default Account;
