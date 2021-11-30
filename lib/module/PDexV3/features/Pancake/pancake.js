import { BurningPBSCForDepositToSCRequestMeta } from "@lib/core";
import { MAX_FEE_PER_TX } from "@lib/module/Account";
import { camelCaseKeys } from "@lib/utils/camelCaseKeys";
import { PrivacyVersion, Validator } from "@lib/wallet";

async function getPancakeTokens() {
  let tokens = [];
  try {
    tokens = await this.rpcApiService.apiGetPancakeTokens();
    tokens = tokens.map((t) => {
      const token = camelCaseKeys(t);
      return {
        ...token,
        tokenID: t?.ID,
      };
    });
  } catch (error) {
    throw error;
  }
  return tokens;
}

async function estimatePancakeTradingFee(data) {
  let result = {};
  try {
    // let res = await this.rpcApiService.apiEstimatePancakeTradingFee(data);
    const res = {
      id: 11,
      feeAddress:
        "12svfkP6w5UDJDSCwqH978PvqiqBxKmUnA9em9yAYWYJVRv7wuXY1qhhYpPAm4BDz2mLbFrRmdK3yRhnTqJCZXKHUmoi7NV83HCH2YFpctHNaDdkSiQshsjw2UFUuwdEvcidgaKmF3VJpY5f8RdN",
      signAddress: "0x15E3c20B5557CDD2D3a8283B71d50257DcF8d501",
      tokenFees: { level1: "9000000" },
      privacyFees: { level1: String(1e9) },
    };
    if (!res) {
      return result;
    }
    result = camelCaseKeys(res);
    console.log("result", result);
    const { privacyFees, id } = result;
    result = {
      ...result,
      tradeID: id,
      originalTradeFee: privacyFees?.level1,
    };
  } catch (error) {
    throw error;
  }
  return result;
}

async function createAndSendBurningRequestPancakeTx(payload) {
  let tx;
  try {
    const { originalBurnAmount, tokenID, signKey, feeAddress, tradeFee, info } =
      payload;
    new Validator(
      "createAndSendBurningRequestPancakeTx-originalBurnAmount",
      originalBurnAmount
    )
      .required()
      .amount();

    new Validator("createAndSendBurningRequestPancakeTx-tokenID", tokenID)
      .required()
      .string();
    new Validator("createAndSendBurningRequestPancakeTx-signKey", signKey)
      .required()
      .string();
    new Validator("createAndSendBurningRequestPancakeTx-feeAddress", feeAddress)
      .required()
      .string();
    new Validator("createAndSendBurningRequestPancakeTx-tradeFee", tradeFee)
      .required()
      .amount();
    new Validator("createAndSendBurningRequestPancakeTx-info", info).string();
    tx = await this.account.createAndSendBurningRequestTx({
      transfer: {
        fee: MAX_FEE_PER_TX,
        tokenID,
        prvPayments: [
          {
            paymentAddress: feeAddress,
            amount: tradeFee,
          },
        ],
        info,
      },
      extra: {
        remoteAddress: signKey,
        burnAmount: originalBurnAmount,
        burningType: BurningPBSCForDepositToSCRequestMeta,
        version: PrivacyVersion.ver2,
      },
    });
  } catch (error) {
    throw error;
  }
  return tx;
}

async function submitPancakeTradingTx(payload) {
  let result;
  try {
    result = await this.rpcApiService.apiSubmitPancakeTradingTx(payload);
  } catch (error) {
    throw error;
  }
  return result;
}

export default {
  getPancakeTokens,
  estimatePancakeTradingFee,
  createAndSendBurningRequestPancakeTx,
  submitPancakeTradingTx,
};
