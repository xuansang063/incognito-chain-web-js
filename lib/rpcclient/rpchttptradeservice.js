import Validator from "@lib/utils/validator";
import createAxiosInstance from "@lib/http/axios";

class RpcHTTPTradeServiceClient {
  constructor(url) {
    this.http = createAxiosInstance({ baseURL: url });
  }

  apiGetTradingVolume24h(poolId) {
    new Validator("apiGetTradingVolume24h-poolId", poolId).required().string();
    return this.http.get(`pdex/v3/tradevolume?poolid=${poolId}`);
  }

  apiGetListPools(pairId) {
    new Validator("apiGetListPools-pairId", pairId).required().string();
    return this.http.get(`pdex/v3/listpools?pair=${pairId}`);
  }

  apiGetListPoolsDetail(poolIDs) {
    new Validator("apiGetListPoolsDetail-poolIDs", poolIDs).required().array();
    return this.http.post(`pdex/v3/poolsdetail`, { PoolIDs: poolIDs });
  }

  apiGetListShare({ nftId }) {
    new Validator("apiGetListShare-nftId", nftId).required().string();
    return this.http.get(`pdex/v3/poolshare?nftid=${nftId}`);
  }

  apiGetListPair() {
    return this.http.get(`pdex/v3/listpairs`);
  }

  apiEstimateTrade(params) {
    const { selltoken, buytoken, amount, feetoken } = params;
    new Validator("getEstimateTrade-selltoken", selltoken).required().string();
    new Validator("getEstimateTrade-buytoken", buytoken).required().string();
    new Validator("getEstimateTrade-amount", amount).required().number();
    new Validator("getEstimateTrade-feetoken", feetoken).required().string();
    return this.http.get(
      `/pdex/v3/estimatetrade?selltoken=${selltoken}&buytoken=${buytoken}&amount=${amount}&feetoken=${feetoken}`
    );
  }

  apiGetPendingOrder(params) {
    const { otakey, poolid } = params;
    new Validator("apiGetOpenOrders-otakey", otakey).required().string();
    new Validator("apiGetOpenOrders-poolid", poolid).required().string();
    return this.http.get(
      `pdex/v3/pendingorder?poolid=${poolid}&otakey=${otakey}`
    );
  }

  apiGetHistory(params) {
    const { queryStr, limit = 1e9, offset = 0 } = params;
    new Validator("apiGetHistory-queryStr", queryStr).required().string();
    return this.http.get(
      `pdex/v3/tradehistory?${queryStr}&limit=${limit}&offset=${offset}`
    );
  }

  apiGetOrderBook(params) {
    const { poolid, decimal } = params;
    new Validator("poolid-poolid", poolid).required().string();
    new Validator("poolid-decimal", decimal).required().amount();
    return this.http.get(
      `pdex/v3/orderbook?poolid=${poolid}&decimal=${decimal}`
    );
  }

  apiGetPriceHistory(params) {
    const { poolid, period, datapoint, fromtime } = params;
    new Validator("apiGetPriceHistory-poolid", poolid).required().string();
    new Validator("apiGetPriceHistory-period", period).required().string();
    new Validator("apiGetPriceHistory-datapoint", datapoint)
      .required()
      .number();
    new Validator("apiGetPriceHistory-fromtime", fromtime).required().number();
    return this.http.get(
      `pdex/v3/pricehistory?poolid=${poolid}&period=${period}&datapoint=${datapoint}&fromtime=${fromtime}`
    );
  }

  apiGetStakingInfo(params) {
    const { nftID } = params;
    new Validator("apiGetStakingInfo-nftID", nftID).required().string();
    return this.http.get(`pdex/v3/stakeinfo?nftid=${nftID}`);
  }

  apiGetStakingHistories(params) {
    const { tokenID, nftID, limit = 1e9, offset = 0 } = params;
    new Validator("apiGetStakingInfo-tokenID", tokenID).required().string();
    new Validator("apiGetStakingInfo-nftID", nftID).required().string();
    this.http.get(
      `pdex/v3/stakehistory?tokenid=${tokenID}&nftid=${nftID}&limit=${limit}&offset=${offset}`
    );
  }

  async apiGetStakingRewardHistories(params) {
    const { tokenID, nftID, limit = 1e9, offset = 0 } = params;
    new Validator("apiGetStakingInfo-tokenID", tokenID).required().string();
    new Validator("apiGetStakingInfo-nftID", nftID).required().string();
    return this.http.get(
      `pdex/v3/stakerewardhistory?tokenid=${tokenID}&nftid=${nftID}&limit=${limit}&offset=${offset}`
    );
  }

  apiGetStakingPool() {
    return this.http.get(`pdex/v3/stakingpools`);
  }

  async apiGetTradeDetail({ txhash }) {
    new Validator("getOrderLimitDetail-txhash", txhash).required().string();
    return this.http.get(`pdex/v3/tradedetail?txhash=${txhash}`);
  }
}

export { RpcHTTPTradeServiceClient };
