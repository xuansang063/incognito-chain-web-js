import StorageServices from "@lib/services/storage";
import { RpcHTTPCoinServiceClient } from "@lib/rpcclient/rpchttpcoinservice";
import { RpcHTTPTxServiceClient } from "@lib/rpcclient/rpchttptxservice";
import Validator from "@lib/utils/validator";
import { RpcClient } from "@lib/rpcclient/rpcclient";
import { RpcHTTPRequestServiceClient } from "@lib/rpcclient/rpchttprequestservice";
import { RpcHTTPApiServiceClient } from "@lib/rpcclient/rpchttpapiservice";

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
 * setPrivacyVersion - Set privacy version
 * @param {string} privacyVersion
 */
function setPrivacyVersion(privacyVersion) {
  new Validator("privacyVersion", privacyVersion).required().number();
  this.privacyVersion = privacyVersion;
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

/**
 * setRPCCoinServices - Set rpc coin services
 * @param {string} url
 */
function setRPCCoinServices2(url) {
  new Validator("rpcCoinService 2", url).required().string();
  this.rpcCoinService2 = new RpcHTTPCoinServiceClient(url);
}


export default {
  setRPCCoinServices,
  setRPCTxServices,
  setRPCClient,
  setStorageServices,
  setPrivacyVersion,
  setRPCRequestServices,
  setRPCApiServices,
  setAuthToken,
  setRPCCoinServices2,
};
