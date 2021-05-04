import { PRVIDSTR } from "../core";
import createAxiosInstance from "../http/axios";

class RpcHTTPCoinServiceClient {
  constructor(url) {
    console.debug("COIN SERVICES URL", url);
    this.http = createAxiosInstance({ baseURL: url });
  }

  apiGetListOutputCoins = (payload) => {
    const { viewKey, offset, limit, tokenId = PRVIDSTR } = payload;
    console.debug("CALL API GET COINS", JSON.stringify(payload));
    return this.http
      .get(
        `getcoins?viewkey=${viewKey}&limit=${limit}&offset=${offset}&tokenid=${tokenId}`
      )
      .then((response) => {
        const outputs = response?.Outputs || {};
        let allOutputCoinStrs;
        if (outputs) {
          allOutputCoinStrs = outputs[Object.keys(outputs)[0]];
        }
        return allOutputCoinStrs || [];
      });
  };

  apiGetListOutputCoinsV2 = (payload) => {
    const { otaKey, offset, limit, tokenId = PRVIDSTR } = payload;
    console.debug("CALL API GET COINS V2", JSON.stringify(payload));
    return this.http
      .get(
        `getcoins?otakey=${otaKey}&limit=${limit}&offset=${offset}&tokenid=${tokenId}&version=2`
      )
      .then((response) => {
        const outputs = response?.Outputs || {};
        let allOutputCoinStrs;
        if (outputs) {
          allOutputCoinStrs = outputs[Object.keys(outputs)[0]];
        }
        return allOutputCoinStrs || [];
      });
  };

  apiGetKeyInfo = ({ otaKey, version }) => {
    console.debug("CALL API GET KEY INFO", otaKey, version);
    return this.http.get(`getkeyinfo?key=${otaKey}&version=${version}`);
  };

  apiCheckKeyImages = ({ keyImages, shardId }) => {
    const payload = {
      KeyImages: keyImages,
      ShardID: shardId,
    };
    return this.http.post("checkkeyimages", payload);
  };

  apiGetSpendingCoinInMemPool = () => {
    return this.http.get("getcoinspending").then((res) => res || []);
  };
}

export { RpcHTTPCoinServiceClient };
