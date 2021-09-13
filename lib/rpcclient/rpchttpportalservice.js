import Validator from "@lib/utils/validator";
import createAxiosInstance from "../http/axios";

class RpcHTTPPortalServiceClient {
  constructor(url) {
    this.http = createAxiosInstance({ baseURL: url });
  }

  apiCheckPortalShieldingAddresssExisted = ({ incAddress, shieldingAddress }) => {
    new Validator("shieldingAddress", shieldingAddress).required().string();
    new Validator("incAddress", incAddress).required().string();
    return this.http.get(`checkportalshieldingaddressexisted?incaddress=${incAddress}&btcaddress=${shieldingAddress}`);
  };

  apiAddPortalShieldingAddresss = ({ incAddress, shieldingAddress }) => {
    new Validator("shieldingAddress", shieldingAddress).required().string();
    new Validator("incAddress", incAddress).required().string();
    return this.http.post("addportalshieldingaddress", { IncAddress: incAddress, BTCAddress: shieldingAddress });
  };

  apiGetEstimateUnshieldFee = () => {
    return this.http.get("getestimatedunshieldingfee");
  };

  apiGetPortalShieldingHistory = ({ incAddress, tokenID }) => {
    new Validator("tokenID", tokenID).required().string();
    new Validator("incAddress", incAddress).required().string();
    return this.http.get(`getshieldhistory?incaddress=${incAddress}&tokenid=${tokenID}`);
  };

  apiGetPortalShieldingHistoryByExternalTxID = ({ externalTxID, tokenID }) => {
    new Validator("tokenID", tokenID).required().string();
    new Validator("externalTxID", externalTxID).required().string();
    return this.http.get(`getshieldhistorybyexternaltxid?externaltxid=${externalTxID}&tokenid=${tokenID}`);
  };
}

export { RpcHTTPPortalServiceClient };
