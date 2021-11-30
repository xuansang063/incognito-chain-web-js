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
    const walletAddress = this.getPaymentKey();
    let res = await this.rpcApiService.apiEstimatePancakeTradingFee({
      ...data,
      walletAddress,
    });
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
