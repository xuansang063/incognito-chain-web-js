import Validator from "@lib/utils/validator";
import createAxiosInstance from "../http/axios";

class RpcHTTPPortalServiceClient {
  constructor(url) {
    this.http = createAxiosInstance({ baseURL: url });
  }
  //TODO:
  apiGetMinShieldAmount = ({ tokenID }) => {
    return 10;
  };

  apiCheckPortalShieldingAddresssExisted = ({ shieldingAddress }) => {
    new Validator("shieldingAddress", shieldingAddress).required().string();
    return this.http.get(`checkportalshieldingaddressexisted?incaddress=${shieldingAddress}`);
  };

  apiAddPortalShieldingAddresss = ({ incAddress, shieldingAddress }) => {
    new Validator("shieldingAddress", shieldingAddress).required().string();
    new Validator("incAddress", incAddress).required().string();
    return this.http.post("addportalshieldingaddress", { IncAddress: incAddress, BTCAddress: shieldingAddress });
  };

  apiGetEstimateUnshieldFee = () => {
    return this.http.get("getestimatedunshieldingfee");
  };
}

export { RpcHTTPPortalServiceClient };
