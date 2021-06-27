import { camelCaseKeys } from "@lib/module/Account/account.utils";
const { default: createAxiosInstance } = require("@lib/http/axios");
const { default: Validator } = require("@lib/utils/validator");

class RpcHTTPApiServiceClient {
  constructor(url, token) {
    this.http = createAxiosInstance({ baseURL: url, token });
  }

  apiGetMinAmountToShield = async ({ tokenID }) => {
    let min = "";
    try {
      new Validator("apiGetMinMaxAmountToShield-tokenID", tokenID)
        .required()
        .string();
      const result = await this.http.get("service/min-max-amount");
      const foundToken = result.find((t) => t.TokenID === tokenID);
      if (foundToken) {
        min = foundToken?.MinAmount || "";
      }
    } catch (error) {
      console.log("apiGetMinAmountToShield", error);
    }
    return min;
  };

  apiGetAuthToken = async ({ deviceID, deviceToken } = {}) => {
    new Validator("deviceID", deviceID).required().string();
    new Validator("deviceToken", deviceToken).string();
    let _deviceToken = deviceToken || deviceID;
    return await this.http.post("auth/new-token", {
      DeviceID: deviceID,
      DeviceToken: _deviceToken,
    });
  };

  apiGetPTokenHistory = async ({
    tokenID,
    paymentAddress,
    signPublicKeyEncode,
  }) => {
    new Validator("apiGetPTokenHistory-tokenID", tokenID).required().string();
    new Validator("apiGetPTokenHistory-paymentAddress", paymentAddress)
      .required()
      .string();
    new Validator(
      "apiGetPTokenHistory-signPublicKeyEncode",
      signPublicKeyEncode
    )
      .required()
      .string();
    const data = {
      WalletAddress: paymentAddress,
      PrivacyTokenAddress: tokenID,
      SignPublicKeyEncode: signPublicKeyEncode,
    };
    return this.http
      .post("eta/history", data)
      .then((res) => res || [])
      .catch((err) =>
        console.log("ERROR apiGetPTokenHistory", JSON.stringify(err))
      );
  };

  apiGetPTokens = () => {
    const url = "ptoken/list";
    return this.http
      .get(url)
      .then((res) => res.map((ptoken) => camelCaseKeys(ptoken)));
  };

  apiGetTokenInfoById = ({ tokenId }) => {
    new Validator("tokenId", tokenId).required().string();
    const endpoint = "pcustomtoken/get";
    return this.http
      .get(endpoint, { params: { TokenID: tokenId } })
      .then((token) => camelCaseKeys(token));
  };

  apiGetCustomTokens = () => {
    const endpoint = "pcustomtoken/list";
    return this.http.get(endpoint).then((tokens) => {
      return tokens.map((token) => camelCaseKeys(token));
    });
  };
  
  apiRetryExpiredShield = async ({
    id,
    decentralized,
    walletAddress,
    addressType,
    currencyType,
    userPaymentAddress,
    privacyTokenAddress,
    signPublicKeyEncode,
  }) => {
    new Validator("apiRetryExpiredShield-id", id).required().number();
    new Validator("apiRetryExpiredShield-decentralized", decentralized)
      .required()
      .number();
    new Validator("apiRetryExpiredShield-walletAddress", walletAddress)
      .required()
      .string();
    new Validator("apiRetryExpiredShield-addressType", addressType)
      .required()
      .number();
    new Validator("apiRetryExpiredShield-currencyType", currencyType)
      .required()
      .number();
    new Validator(
      "apiRetryExpiredShield-userPaymentAddress",
      userPaymentAddress
    )
      .required()
      .string();
    new Validator(
      "apiRetryExpiredShield-privacyTokenAddress",
      privacyTokenAddress
    )
      .required()
      .string();
    new Validator(
      "apiRetryExpiredShield-signPublicKeyEncode",
      signPublicKeyEncode
    )
      .required()
      .string();
    const payload = {
      ID: id,
      Decentralized: decentralized,
      WalletAddress: walletAddress,
      AddressType: addressType,
      CurrencyType: currencyType,
      PaymentAddress: userPaymentAddress,
      PrivacyTokenAddress: privacyTokenAddress,
      SignPublicKeyEncode: signPublicKeyEncode,
    };
    return this.http.post("eta/retry", payload);
  };

  apiGetPTokenHistoryById = ({
    id,
    currencyType,
    signPublicKeyEncode,
    decentralized,
    newShieldDecentralized,
  }) => {
    const payload = {
      ID: id,
      CurrencyType: currencyType,
      SignPublicKeyEncode: signPublicKeyEncode,
      Decentralized: decentralized,
      NewShieldDecentralized: newShieldDecentralized,
    };
    new Validator("apiGetPTokenHistoryById-id", id).required().number();
    new Validator("apiGetPTokenHistoryById-currencyType", currencyType)
      .required()
      .number();
    new Validator("apiGetPTokenHistoryById-decentralized", decentralized)
      .required()
      .number();
    new Validator(
      "apiGetPTokenHistoryById-signPublicKeyEncode",
      signPublicKeyEncode
    )
      .required()
      .string();
    new Validator(
      "apiGetPTokenHistoryById-newShieldDecentralized",
      newShieldDecentralized
    ).number();
    return this.http.post(`eta/history/detail`, payload);
  };
}

export { RpcHTTPApiServiceClient };
