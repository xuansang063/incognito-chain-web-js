import { cachePromise } from "@lib/utils/cache";
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

async function getListShare() {
  let list = [];
  try {
    const otaKey = this.getOTAKey();
    const res = await cachePromise("LIST_SHARE", () =>
      this.rpcTradeService.apiGetListShare(otaKey)
    );
    list = Object.keys(res).map((key) => camelCaseKeys(res[key]));
  } catch (error) {
    throw error;
  }
  return list;
}

async function getListPair() {
  let list = [];
  try {
    let res = await cachePromise("LIST_PAIR", () =>
      this.rpcTradeService.apiGetListPair()
    );
    res = res[0];
    list = Object.keys(res).map((key) => ({
      ...camelCaseKeys(res[key]),
      poolid: key,
    }));
  } catch (error) {
    throw error;
  }
  return list;
}

async function getEstimateTrade(params) {
  try {
    const { selltoken, buytoken, amount, feetoken } = params;
    new Validator("getEstimateTrade-selltoken", selltoken).required().string();
    new Validator("getEstimateTrade-buytoken", buytoken).required().string();
    new Validator("getEstimateTrade-amount", amount).required().number();
    new Validator("getEstimateTrade-feetoken", feetoken).required().string();
    const res = await this.rpcTradeService.apiEstimateTrade(params);
    return camelCaseKeys(res);
  } catch (error) {
    throw error;
  }
}

async function getOrderBook(params) {
  let data = {};
  try {
    const { poolid, decimal } = params;
    console.log(params);
    new Validator("getOrderBook-poolid", poolid).required().string();
    new Validator("getOrderBook-decimal", decimal).required().amount();
    let res = await this.rpcTradeService.apiGetOrderBook(params);
    data = camelCaseKeys(res);
  } catch (error) {
    throw error;
  }
  return data;
}

async function getPriceHistory(params) {
  let list = [];
  try {
    const { poolid, period, datapoint, fromtime } = params;
    new Validator("getPriceHistory-poolid", poolid).required().string();
    new Validator("getPriceHistory-period", period).required().string();
    new Validator("getPriceHistory-datapoint", datapoint).required().number();
    new Validator("getPriceHistory-fromtime", fromtime).required().number();
    let res = await this.rpcTradeService.apiGetPriceHistory(params);
    list = res.map((item) => ({
      ...camelCaseKeys(item),
    }));
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
  getListPair,
  getEstimateTrade,
  getPriceHistory,
  getOrderBook,
};
