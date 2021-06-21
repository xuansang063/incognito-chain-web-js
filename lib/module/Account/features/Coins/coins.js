import { PriKeyType, PrivacyVersion } from "@lib/core/constants";
import Validator from "@lib/utils/validator";
import { wasm as wasmFuncs } from "@lib/wasm";
import { cachePromise } from "../Cache/cache";

export const COINS_STORAGE = "COINS_STORAGE";
export const SUBMITTED_OTA_KEY = "SUBMITTED_OTA_KEY";
export const KEY_INFO_CACHE = "KEY_INFO_CACHE";

function getKeyParamOfCoins(params) {
  try {
    const { key, version } = params;
    new Validator("getKeyParamOfCoins-key", key).required().string();
    new Validator(`getKeyParamOfCoins-version`, version).required().number();
    let keyName = "";
    switch (version) {
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
  } catch (error) {
    throw error;
  }
}

async function decryptCoins({ coins }) {
  try {
    new Validator(`decryptCoins-coins`, coins).required().array();
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

function getKeyImagesBase64Encode({ coinsDecrypted }) {
  new Validator(`getKeyImagesBase64Encode-coinsDecrypted`, coinsDecrypted)
    .required()
    .array();
  return coinsDecrypted.map((coin) => coin.KeyImage);
}

async function getKeyInfo({ version }) {
  try {
    new Validator(`getKeyInfo-version`, version).required().number();
    const otaKey = this.getOTAKey();
    const cacheKeyInfo = `${KEY_INFO_CACHE}-${version}-${otaKey}`;
    console.time(KEY_INFO_CACHE);
    const result = await cachePromise(cacheKeyInfo, () =>
      this.rpcCoinService.apiGetKeyInfo({
        key: otaKey,
        version,
      })
    );
    console.timeEnd(KEY_INFO_CACHE);
    return result;
  } catch (error) {
    throw error;
  }
}

// COIN STORAGE TO TRACK / MEASURE

function getKeyCoinsStorageByTokenId(params) {
  try {
    const { tokenID, version } = params;
    new Validator("setCoinsStorage-tokenID", tokenID).required().string();
    new Validator(`setCoinsStorage-version`, version).required().number();
    const keyByTokenId = this.getKeyStorageByTokenId(params);
    const key = `${keyByTokenId}-${COINS_STORAGE}`;
    return key;
  } catch (error) {
    throw error;
  }
}

async function getCoinsStorage(params) {
  try {
    const { tokenID, version } = params;
    new Validator("getCoinsStorage-tokenID", tokenID).required().string();
    new Validator("getCoinsStorage-version", version).required().number();
    const key = this.getKeyCoinsStorageByTokenId(params);
    return this.getAccountStorage(key);
  } catch (error) {
    throw error;
  }
}

async function setCoinsStorage(params) {
  try {
    const { value, tokenID, version } = params;
    new Validator("setCoinsStorage-value", value).required().object();
    new Validator("setCoinsStorage-tokenID", tokenID).required().string();
    new Validator(`setCoinsStorage-version`, version).required().number();
    const key = this.getKeyCoinsStorageByTokenId(params);
    const data = (await this.getAccountStorage(key)) || [];
    const newData = [value, ...data];
    await this.setAccountStorage(key, newData);
  } catch (error) {
    throw error;
  }
}

// SUBMIT OTA KEY
async function getFlagSubmittedOTAKey() {
  let submitted = false;
  try {
    const key = this.getOTAKey();
    submitted = await this.getAccountStorage(key);
  } catch (error) {
    console.log("error", error);
  }
  return !!submitted;
}

async function submitOTAKey() {
  const otaKey = this.getOTAKey();
  try {
    const submitted = await this.getFlagSubmittedOTAKey();
    if (!submitted) {
      const shardID = this.getShardID();
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

export default {
  //ota key
  getFlagSubmittedOTAKey,
  submitOTAKey,

  getKeyParamOfCoins,

  decryptCoins,

  getKeyInfo,
  getKeyImagesBase64Encode,

  //coin storage to track
  getKeyCoinsStorageByTokenId,
  setCoinsStorage,
  getCoinsStorage,
};
