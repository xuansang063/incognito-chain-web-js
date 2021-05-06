import { PRVIDSTR } from "../core";
import createAxiosInstance from "../http/axios";
import { PrivacyVersion } from '../core/constants';

class RpcHTTPCoinServiceClient {
  constructor(url) {
    this.http = createAxiosInstance({ baseURL: url });
  }

  apiGetListOutputCoins = (payload) => {
    const { key, offset, limit, tokenId = PRVIDSTR, version } = payload;
    const keyParam = `${version === PrivacyVersion.ver1 ? 'viewkey' : 'otakey'}=` + key
    const params = `getcoins?${keyParam}&limit=${limit}&offset=${offset}&tokenid=${tokenId}&version=${version}`;
    return this.http
      .get(params)
      .then((response) => {
        const outputs = response?.Outputs || {};
        let allOutputCoinStrs;
        if (outputs) {
          allOutputCoinStrs = outputs[Object.keys(outputs)[0]];
        }
        return allOutputCoinStrs || [];
      });
  };

  apiGetKeyInfo = ({ key, version }) => {
    return this.http.get(`getkeyinfo?key=${key}&version=${version}`);
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
