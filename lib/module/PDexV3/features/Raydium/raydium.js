import { BurningSOLForDepositToSCRequestMeta } from "@lib/core";
import { MAX_FEE_PER_TX } from "@lib/module/Account";
import { camelCaseKeys } from "@lib/utils/camelCaseKeys";
import { PrivacyVersion, Validator } from "@lib/wallet";
import raydiumHistory from "./raydium.history";

async function getRaydiumTokens() {
  let tokens = [];
  try {
    tokens = (await this.rpcApiService.apiGetRaydiumTokens()) || [];
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

async function getQuoteRaydium(data) {
  let result = {};
  try {
    let res = await this.rpcApiService.apiGetQuoteRaydium({
      ...data,
    });
    if (!res) {
      return result;
    }
    result = camelCaseKeys(res);
  } catch (error) {
    throw error;
  }
  return result;
}

async function estimateRaydiumTradingFee(data) {
  let result = {};
  try {
    const walletAddress = this.getPaymentKey();
    let res = await this.rpcApiService.apiEstimateRaydiumTradingFee({
      ...data,
      walletAddress,
    });
    if (!res) {
      return result;
    }
    result = camelCaseKeys(res);
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

async function createAndSendTradeRequestRaydiumTx({
  burningPayload,
  tradePayload,
}) {
  let tx;
  try {
    const {
      originalBurnAmount,
      tokenID,
      signKey,
      feeAddress,
      tradeFee,
      feeToken,
      info,
    } = burningPayload;
    const {
      tradeID,
      srcTokenID,
      destTokenID,
      srcQties,
      expectedDestAmt,
    } = tradePayload;
    new Validator("createAndSendBurningRequestRaydiumTx-feeToken", feeToken)
      .required()
      .string();
    new Validator("createAndSendBurningRequestRaydiumTx-tradeID", tradeID)
      .required()
      .number();
    new Validator("createAndSendBurningRequestRaydiumTx-srcTokenID", srcTokenID)
      .required()
      .string();
    new Validator("createAndSendBurningRequestRaydiumTx-destTokenID", destTokenID)
      .required()
      .string();
    new Validator("createAndSendBurningRequestRaydiumTx-srcQties", srcQties)
      .required()
      .string();
    new Validator(
      "createAndSendBurningRequestRaydiumTx-expectedDestAmt",
      expectedDestAmt
    )
      .required()
      .string();
    new Validator(
      "createAndSendBurningRequestRaydiumTx-originalBurnAmount",
      originalBurnAmount
    )
      .required()
      .amount();
    new Validator("createAndSendBurningRequestRaydiumTx-tokenID", tokenID)
      .required()
      .string();
    new Validator("createAndSendBurningRequestRaydiumTx-signKey", signKey)
      .required()
      .string();
    new Validator("createAndSendBurningRequestRaydiumTx-feeAddress", feeAddress)
      .required()
      .string();
    new Validator("createAndSendBurningRequestRaydiumTx-tradeFee", tradeFee)
      .required()
      .amount();
    new Validator("createAndSendBurningRequestRaydiumTx-info", info).string();
    console.log("burningPayload", burningPayload);
    console.log("tradePayload", tradePayload);
    const version = PrivacyVersion.ver2;
    const dataSubmit = {
      tradeID,
      paymentAddress: this.getPaymentKey(),
      srcTokenID,
      destTokenID,
      expectedDestAmt,
      srcQties,
    };
    await this.account.createAndSendBurningRequestTx({
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
        burningType: BurningSOLForDepositToSCRequestMeta,
        version,
        burningCallback: async (burningTx) => {
          const { txId } = burningTx;
          console.log("burningTx", txId);
          const response = await this.rpcApiService.apiSubmitRaydiumTradingTx({
            burnTxID: txId,
            ...dataSubmit,
          });
          tx = {
            burningTx,
            response,
          };
          try {
            const tokenIDs = [srcTokenID, destTokenID];
            await this?.setStorageSwapTokenIDs({ version, tokenIDs });
          } catch (error) {
            console.log(error);
          }
        },
      },
    });
  } catch (error) {
    throw error;
  }
  return tx;
}

export default {
  estimateRaydiumTradingFee,
  createAndSendTradeRequestRaydiumTx,
  getRaydiumTokens,
  getQuoteRaydium,
  ...raydiumHistory,
};
