import {
  getBurningAddress,
  PaymentAddressType,
  PDECrossPoolTradeRequestMeta,
  PRVIDSTR,
} from "@lib/core";
import Validator from "@lib/utils/validator";
import { TX_TYPE } from "./account.constants";
import { createCoin } from "./account.utils";

/**
 * @param {string} info
 * @param {number} fee
 * @param {string} tokenIDToBuy
 * @param {string} tokenIDToSell
 * @param {number} sellAmount
 * @param {number} minAcceptableAmount
 * @param {number} tradingFee
 */
async function createAndSendTradeRequestTx({
  transfer: { fee },
  extra: {
    tokenIDToBuy = PRVIDSTR,
    tokenIDToSell = PRVIDSTR,
    sellAmount,
    minAcceptableAmount,
    tradingFee,
  } = {},
}) {
  new Validator("tokenIDToBuy", tokenIDToBuy).required().string();
  new Validator("tokenIDToSell", tokenIDToSell).required().string();
  new Validator("sellAmount", sellAmount).required().amount();
  new Validator("minAcceptableAmount", minAcceptableAmount).required().amount();
  new Validator("tradingFee", tradingFee).required().amount();
  new Validator("fee", fee).required().amount();
  if (fee < 0) {
    fee = 0;
  }
  await this.updateProgressTx(10, "Generating Metadata");
  let sellPRV = tokenIDToSell === PRVIDSTR;
  const burningAddress = await getBurningAddress(this.rpc);
  new Validator("burningAddress", burningAddress).required().paymentAddress();
  let amount = tradingFee;
  let tokenPaymentInfos = [];
  if (sellPRV) {
    amount += sellAmount;
  } else {
    tokenPaymentInfos = [
      {
        PaymentAddress: burningAddress,
        Amount: sellAmount,
        Message: "",
      },
    ];
  }
  const prvPaymentInfos = [
    {
      PaymentAddress: burningAddress,
      Amount: amount,
      Message: "",
    },
  ];
  let myAddressStr = this.key.base58CheckSerialize(PaymentAddressType);
  let pInf = {
    PaymentAddress: myAddressStr,
    Amount: "0",
  };
  let newCoinsTask = [
    createCoin({ paymentInfo: pInf, tokenID: tokenIDToBuy }),
    createCoin({ paymentInfo: pInf, tokenID: tokenIDToSell }),
  ];
  const [newCoin, newCoinForSub] = await Promise.all(newCoinsTask);
  // prepare meta data for tx. It is normal trade request at first
  let metadata = {
    TokenIDToBuyStr: tokenIDToBuy,
    TokenIDToSellStr: tokenIDToSell,
    SellAmount: sellAmount,
    Type: PDECrossPoolTradeRequestMeta,
    MinAcceptableAmount: minAcceptableAmount,
    TradingFee: tradingFee,
    TraderAddressStr: newCoin.PublicKey,
    TxRandomStr: newCoin.TxRandom,
    SubTraderAddressStr: newCoinForSub.PublicKey,
    SubTxRandomStr: newCoinForSub.TxRandom,
  };
  console.log(metadata);
  try {
    let result;
    if (sellPRV) {
      result = await this.transact({
        transfer: { prvPayments: prvPaymentInfos, fee },
        extra: { metadata, txType: TX_TYPE.TRADE },
      });
    } else {
      result = await this.transact({
        transfer: {
          prvPayments: prvPaymentInfos,
          fee,
          tokenID: tokenIDToSell,
          tokenPayments: tokenPaymentInfos,
        },
        extra: { metadata, txType: TX_TYPE.TRADE },
      });
    }
    const tx = { ...result };
    await this.saveTxHistory({
      tx,
    });
    await this.updateProgressTx(100, "Completed");
    return result;
  } catch (e) {
    throw e;
  }
}

async function getPDeState() {
  return this.rpcCoinService.apiGetPDeState();
}

export default {
  createAndSendTradeRequestTx,
  getPDeState,
};
