import { RpcHTTPTradeServiceClient } from "@lib/rpcclient/rpchttptradeservice";
import Validator from "@lib/utils/validator";
import { camelCaseKeys } from "../Account/account.utils";

class PDexV3 {
  constructor() {
    this.rpcTradeService = {};
  }

  setRPCTradeService(url) {
    new Validator("setRPCTradeService-url", url).string();
    this.rpcTradeService = new RpcHTTPTradeServiceClient(url);
  }

  async getTradingVolume24h(poolID) {
    new Validator("getTradingVolume24h-poolID", poolID).required().string();
    let volume = 0;
    try {
      const data = await this.rpcTradeService.apiGetTradingVolume24h(poolID);
      if (data && data?.Value) {
        volume = data.Value;
      }
    } catch (error) {
      throw error;
    }
    return volume;
  }

  async getListPools() {
    let list = [];
    try {
      list = await this.rpcTradeService.apiGetListPools();
      list = list.map((pool) => camelCaseKeys(pool));
    } catch (error) {
      throw error;
    }
    return list;
  }

  async getListPoolsDetail(poolIDs) {
    let list = [];
    try {
      new Validator("getListPoolsDetail-poolIDs", poolIDs).array().required();
      list = await this.rpcTradeService.apiGetListPoolsDetail(poolIDs);
      list = list.map((pool) => camelCaseKeys(pool));
    } catch (error) {
      throw error;
    }
    return list;
  }

  async getListShare(otaKey) {
    let list = [];
    try {
      new Validator("getListShare-otaKey", otaKey).required().string();
      const res = await this.rpcTradeService.apiGetListShare(otaKey);
      list = Object.keys(res).map((key) => camelCaseKeys(res[key]));
    } catch (error) {
      throw error;
    }
    return list;
  }
}

export default PDexV3;
