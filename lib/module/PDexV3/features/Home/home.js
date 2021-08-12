import { cachePromise } from "@lib/module/Account/features/Cache/cache";
import { camelCaseKeys } from "@lib/utils/camelCaseKeys";
import Validator from "@lib/utils/validator";

async function getTradingVolume24h(poolId) {
  new Validator("getTradingVolume24h-poolId", poolId).required().string();
  let volume = 0;
  try {
    const data = await cachePromise("TRADING_VOLUME_24H", () =>
      this.rpcTradeService.apiGetTradingVolume24h(poolId)
    );
    if (data && data?.Value) {
      volume = data.Value;
    }
  } catch (error) {
    throw error;
  }
  return volume;
}

async function getListPools() {
  let list = [];
  try {
    list = await cachePromise("LIST_POOLS", () =>
      this.rpcTradeService.apiGetListPools()
    );
    list = list.map((pool) => camelCaseKeys(pool));
  } catch (error) {
    throw error;
  }
  return list;
}

async function getListPoolsDetail(poolIDs) {
  let list = [];
  try {
    new Validator("getListPoolsDetail-poolIDs", poolIDs).array().required();
    list = await cachePromise("LIST_POOLS_DETAIL", () =>
      this.rpcTradeService.apiGetListPoolsDetail(poolIDs)
    );
    list = list.map((pool) => camelCaseKeys(pool));
  } catch (error) {
    throw error;
  }
  return list;
}

async function getListShare(otaKey) {
  let list = [];
  try {
    new Validator("getListShare-otaKey", otaKey).required().string();
    const res = await cachePromise("LIST_SHARE", () =>
      this.rpcTradeService.apiGetListShare(otaKey)
    );
    list = Object.keys(res).map((key) => camelCaseKeys(res[key]));
  } catch (error) {
    throw error;
  }
  return list;
}

export default {
  getListPools,
  getListPoolsDetail,
  getListShare,
  getTradingVolume24h,
};
