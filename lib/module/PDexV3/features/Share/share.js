import { cachePromise } from "@lib/utils/cache";
import { camelCaseKeys } from "@lib/utils/camelCaseKeys";
import Validator from "@lib/utils/validator";
import flatten from "lodash/flatten";

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

async function getListPools(pairId) {
  let list = [];
  try {
    new Validator("getListPools-pairId", pairId).string().required();
    list = await cachePromise(`LIST_POOLS${pairId}`, () =>
      this.rpcTradeService.apiGetListPools(pairId)
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
    const key = poolIDs.join("-");
    list =
      (await cachePromise(`LIST_POOLS_DETAIL-${key}`, () =>
        this.rpcTradeService.apiGetListPoolsDetail(poolIDs)
      )) || [];
    if (list.length > 0) {
      list = list.map((pool) => camelCaseKeys(pool));
    }
  } catch (error) {
    list = [];
    throw error;
  }
  return list;
}

async function getListShare() {
  let list = [];
  try {
    const nftIds = (await this.getNFTTokenIDs()) || [];
    const tasks = nftIds.map(async (nftId) => {
      const res =
        (await cachePromise(`LIST_SHARE-${nftId}`, () =>
          this.rpcTradeService.apiGetListShare({ nftId })
        )) || [];
      return res.map((item) => ({
        ...camelCaseKeys(item),
        nftId,
      }));
    });
    list = flatten(await Promise.all(tasks));
  } catch (error) {
    throw error;
  }
  return list;
}

async function getListPair() {
  let list = [];
  try {
    list =
      (await cachePromise("LIST_PAIR", () =>
        this.rpcTradeService.apiGetListPair()
      )) || [];
    list = camelCaseKeys(list);
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
