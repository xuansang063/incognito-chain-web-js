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

  apiGetListPools() {
    return this.http.get(`pdex/v3/listpools?pair=bt`);
  }

  apiGetListPoolsDetail(poolIDs) {
    new Validator("apiGetListPoolsDetail-poolIDs", poolIDs).required().array();
    return this.http.post(`pdex/v3/poolsdetail`, { PoolIDs: poolIDs });
  }

  apiGetListShare(otaKey) {
    new Validator("apiGetListShare-otaKey", otaKey).required().string();
    return this.http.get(`pdex/v3/share?otakey=${otaKey}`);
  }

  apiGetListState() {
    return this.http.get(`pdex/v3/state`);
  }

  apiEstimateTrade(params) {
    const { selltoken, buytoken, amount, feetoken, poolid, rate } = params;
    new Validator("getEstimateTrade-selltoken", selltoken).required().string();
    new Validator("getEstimateTrade-buytoken", buytoken).required().string();
    new Validator("getEstimateTrade-amount", amount).required().number();
    new Validator("getEstimateTrade-feetoken", feetoken).required().string();
    new Validator("getEstimateTrade-poolid", poolid).required().string();
    new Validator("getEstimateTrade-rate", rate).number();
    return this.http.get(
      `/pdex/v3/estimatetrade?selltoken=${selltoken}&buytoken=${buytoken}&amount=${amount}&feetoken=${feetoken}&poolid=${poolid}&rate=${rate}`
    );
  }

  apiGetOpenOrders(params) {
    const { otakey, poolid } = params;
    new Validator("apiGetOpenOrders-otakey", otakey).required().string();
    new Validator("apiGetOpenOrders-poolid", poolid).required().string();
    return this.http.post(
      `pdex/v3/pendingorder?poolid=${poolid}&otakey=${otakey}`
    );
  }

  apiGetHistory(params) {
    const { poolid = "", paymentkey, limit = 1e9, offset = 0 } = params;
    new Validator("apiGetHistory-paymentkey", paymentkey).required().string();
    new Validator("apiGetHistory-poolid", poolid).string();
    return this.http.post(
      `pdex/v3/tradehistory?pair=${poolid}&paymentkey=${paymentkey}&limit=${limit}&offset=${offset}`
    );
  }
}

export { RpcHTTPTradeServiceClient };
