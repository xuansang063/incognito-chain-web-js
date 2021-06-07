import StorageServices from "@lib/services/storage";
import { RpcHTTPCoinServiceClient } from "@lib/rpcclient/rpchttpcoinservice";
import { RpcHTTPTxServiceClient } from "@lib/rpcclient/rpchttptxservice";
import Validator from "@lib/utils/validator";
import { RpcClient } from "@lib/rpcclient/rpcclient";
import { RpcHTTPRequestServiceClient } from '@lib/rpcclient/rpchttprequestservice';

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

export default {
  setRPCCoinServices,
  setRPCTxServices,
  setRPCClient,
  setStorageServices,
  setPrivacyVersion,
  setRPCRequestServices,
};
