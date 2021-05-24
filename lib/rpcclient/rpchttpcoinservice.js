import Validator from "@lib/utils/validator";
import { PRVIDSTR } from "../core";
import createAxiosInstance from "../http/axios";

class RpcHTTPCoinServiceClient {
  constructor(url) {
    this.http = createAxiosInstance({ baseURL: url });
  }

  apiGetListOutputCoins = (payload) => {
    const { key, offset, limit, tokenId = PRVIDSTR, version } = payload;
    new Validator("key", key).required().string();
    new Validator("offset", offset).number();
    new Validator("limit", limit).number();
    new Validator("tokenId", tokenId).required().string();
    new Validator("version", version).required().number();
    const params = `getcoins?${key}&limit=${limit}&offset=${offset}&tokenid=${tokenId}&version=${version}`;
    return this.http.get(params).then((response) => {
      const outputs = response?.Outputs || {};
      let allOutputCoinStrs;
      if (outputs) {
        allOutputCoinStrs = outputs[Object.keys(outputs)[0]];
      }
      return allOutputCoinStrs || [];
    });
  };

  apiGetKeyInfo = ({ key, version }) => {
    new Validator("key", key).required().string();
    new Validator("version", version).required().number();
    return this.http.get(`getkeyinfo?key=${key}&version=${version}`);
  };

  apiCheckKeyImages = ({ keyImages, shardId }) => {
    new Validator("keyImages", keyImages).required().array();
    new Validator("shardID", shardId).required().number();
    const payload = {
      KeyImages: keyImages,
      ShardID: shardId,
    };
    return this.http.post("checkkeyimages", payload);
  };

  apiGetSpendingCoinInMemPool = () => {
    return this.http.get("getcoinspending").then((res) => res || []);
  };

  apiSubmitOTAKey = ({ otaKey, shardID, beaconHeight = 0 } = {}) => {
    new Validator("otaKey", otaKey).required().string();
    new Validator("shardID", shardID).required().number();
    new Validator("beaconHeight", beaconHeight).number();
    const payload = {
      OTAKey: otaKey,
      ShardID: shardID,
      BeaconHeight: beaconHeight,
    };
    return this.http.post("submitotakey", payload);
  };

  apiGetRandomCommitments = ({ version, shardID, tokenID, limit }) => {
    new Validator("version", version).required().number();
    new Validator("shardID", shardID).required().number();
    new Validator("tokenID", tokenID).required().string();
    new Validator("limit", limit).required().number();
    const payload = {
      TokenID: tokenID,
      ShardID: shardID,
      Version: version,
      Limit: limit,
    };
    return this.http.post("getrandomcommitments", payload);
  };

  apiGetPDeState = () => {
    return this.http.get("getpdestate");
  };

  apiGetPDexHistories = ({ otakey, offset, limit } = {}) => {
    new Validator("otakey", otakey).required().string();
    new Validator("offset", offset).required().number();
    new Validator("limit", limit).required().number();
    const params = [
      "gettradehistory",
      `?offset=${offset}`,
      `&limit=${limit}`,
      `&otakey=${otakey}`,
    ];
    return this.http.get(params.join(""));
  };

  apiGetTxsByReceiver = ({
    tokenID = PRVIDSTR,
    otaKey,
    limit = 100,
    offset = 0,
  } = {}) => {
    new Validator("tokenID", tokenID).required().string();
    new Validator("otaKey", otaKey).required().string();
    new Validator("limit", limit).required().number();
    new Validator("offset", offset).required().number();
    return this.http.get(
      `gettxsbyreceiver?tokenid=${tokenID}&limit=${limit}&offset=${offset}&otakey=${otaKey}`
    );
  };
}

export { RpcHTTPCoinServiceClient };
