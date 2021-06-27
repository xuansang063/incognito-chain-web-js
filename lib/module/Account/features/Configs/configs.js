import StorageServices from "@lib/services/storage";
import { RpcHTTPCoinServiceClient } from "@lib/rpcclient/rpchttpcoinservice";
import { RpcHTTPTxServiceClient } from "@lib/rpcclient/rpchttptxservice";
import Validator from "@lib/utils/validator";
import { RpcClient } from "@lib/rpcclient/rpcclient";
import { RpcHTTPRequestServiceClient } from "@lib/rpcclient/rpchttprequestservice";
import { RpcHTTPApiServiceClient } from "@lib/rpcclient/rpchttpapiservice";
import { delay } from "@lib/utils/delay";
import { PrivacyVersion } from "@lib/core/constants";
import set from "lodash/set";

const performance = {
  now() {
    return new Date().getTime();
  },
};

/** ========================= */
/** Init configs for Account instance */

/**
 * setRPCCoinServices - Set rpc coin services
 * @param {string} url
 */
function setRPCCoinServices(url) {
  new Validator("rpcCoinServicel", url).required().string();
  this.rpcCoinService = new RpcHTTPCoinServiceClient(url);
}

/**
 * setRPCTxServices - Set rpc tx services
 * @param {string} url
 */
function setRPCTxServices(url) {
  new Validator("rpcTxService", url).required().string();
  this.rpcTxService = new RpcHTTPTxServiceClient(url);
}

/**
 * setRPCClient - Set rpc client
 * @param {string} url
 */
function setRPCClient(url) {
  new Validator("rpc client url", url).required().string();
  this.rpc = new RpcClient(url);
}

/**
 * setStorageServices - Set storage services
 * @param {any} storage
 */
function setStorageServices(storage) {
  new Validator("Storage services", storage).required();
  this.storage = storage || new StorageServices();
}

/**
 * setRPCClient - Set rpc request service
 * @param {string} url
 */
function setRPCRequestServices(url) {
  new Validator("rpc request url", url).required().string();
  this.rpcRequestService = new RpcHTTPRequestServiceClient(url);
}

/**
 * setAuthToken - Set auth token
 * @param {string} token
 */
function setAuthToken(token) {
  new Validator("setAuthToken-token", token).required().string();
  this.authToken = token;
}

/**
 * setRPCApiServices - Set api service
 * @param {string} url
 */
function setRPCApiServices(url, token) {
  new Validator("setRPCApiServices-api services url", url).required().string();
  const authToken = token || this.authToken;
  new Validator("setRPCApiServices-authToken", authToken).required().string();
  this.rpcApiService = new RpcHTTPApiServiceClient(url, authToken);
}

async function updateProgressTx(progress, debugMsg) {
  this.progressTx = progress;
  this.debug = debugMsg;
  await delay(100);
}

async function resetProgressTx() {
  this.progressTx = 0;
  this.debug = "";
}

async function getProgressTx() {
  return this.progressTx;
}

async function getDebugMessage() {
  return this.debug;
}

async function measureAsyncFn(fn, key, args) {
  try {
    const t = performance.now();
    console.log("\nFN", fn, "key", key);
    const { version } = args || {};
    console.log("version", version);
    new Validator("measureAsyncFn-version", version).number().required();
    let result;
    if (typeof fn === "function") {
      result = await fn.call(this, args);
    }
    const e = performance.now() - t;
    const value =
      version === PrivacyVersion.ver1 ? this.coinsV1Storage : this.coinsStorage;
    set(value, key, `${e / 1000}s`);
    return result;
  } catch (error) {
    console.log("measureAsyncFn FAILED", error);
    console.log("FN NAME", fn, key, args);
  }
}

function measureFn(fn, key, args) {
  const t = performance.now();
  let result;
  if (typeof fn === "function") {
    result = fn.call(this, args);
  }
  const e = performance.now() - t;
  set(this.coinsStorage, key, `${e / 1000}s`);
  return result;
}

function initTrackingGetOutCoins() {
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
      tokenID: null,
      otaKey: this.getOTAKey(),
    };
  }
}

/**
 * setRPCCoinServices - Set rpc coin services
 * @param {string} url
 */
// Todo: Remove when merge to coinservice
 function setRPCCoinServices2(url) {
  new Validator("rpcCoinService 2", url).required().string();
  this.rpcCoinService2 = new RpcHTTPCoinServiceClient(url);
}

export default {
  setRPCCoinServices,
  setRPCTxServices,
  setRPCClient,
  setStorageServices,
  setRPCRequestServices,
  setRPCApiServices,
  setAuthToken,
  measureAsyncFn,
  measureFn,
  updateProgressTx,
  resetProgressTx,
  getProgressTx,
  getDebugMessage,
  initTrackingGetOutCoins,
  setRPCCoinServices2,
};
