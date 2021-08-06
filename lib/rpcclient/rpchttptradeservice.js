import Validator from "@lib/utils/validator";
import createAxiosInstance from "@lib/http/axios";

class RpcHTTPTradeServiceClient {
  constructor(url) {
    this.http = createAxiosInstance({ baseURL: url });
  }

  apiGetTradingVolume24h(poolID) {
    new Validator("apiGetTradingVolume24h-poolID", poolID).required().string();
    return this.http.get(`pdex/v3/tradevolume?poolid=${poolID}`);
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
}

export { RpcHTTPTradeServiceClient };
