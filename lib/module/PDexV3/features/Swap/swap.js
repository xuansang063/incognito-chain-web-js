import { pdexv3 } from "@lib/core/constants";
import { getBurningAddress, PRVIDSTR } from "@lib/core";
import bn from "bn.js";
import { Validator } from "@lib/wallet";
import { TX_TYPE } from "@lib/module/Account";

async function getOrderSwapHistory() {
  let history = [];
  try {
    const otakey = this.getOTAKey();
    new Validator("apiGetHistory-otakey", otakey).required().string();
    history = await this.rpcTradeService.apiGetHistory({
      queryStr: `otakey=${otakey}`,
    });
    console.log("history", history);
    history = history.map((h) => camelCaseKeys(h));
  } catch (error) {
    throw error;
  }
  return history;
}

async function createAndSendSwapRequestTx(params) {
  try {
    const {
      transfer: { fee, info = "" },
      extra: {
        tokenIDToSell,
        sellAmount,
        tokenIDToBuy,
        tradingFee,
        tradePath,
        isTradingFeeInPRV,
        version,
      },
    } = params;
    new Validator("createAndSendOrderRequestTx-fee", fee).required().amount();
    new Validator("createAndSendOrderRequestTx-info", info).string();
    new Validator("createAndSendOrderRequestTx-tokenIDToBuy", tokenIDToBuy)
      .required()
      .string();
    new Validator("createAndSendOrderRequestTx-sellAmount", sellAmount)
      .required()
      .amount();
    new Validator("createAndSendOrderRequestTx-tradingFee", tradingFee)
      .required()
      .amount();
    new Validator("createAndSendOrderRequestTx-tokenIDToSell", tokenIDToSell)
      .required()
      .string();
    new Validator("createAndSendOrderRequestTx-tradePath", tradePath)
      .required()
      .array();
    new Validator(
      "createAndSendOrderRequestTx-isTradingFeeInPRV",
      isTradingFeeInPRV
    )
      .required()
      .amount();
    new Validator("createAndSendOrderRequestTx-version", version)
      .required()
      .number();
    await this.account?.updateProgressTx(10, "Generating Metadata");
    let burningAddress = await getBurningAddress(this.rpc);
    let isToken = tokenIDToSell !== PRVIDSTR;
    let receivingTokens = [tokenIDToSell, tokenIDToBuy];
    if (isToken && isTradingFeeInPRV && tokenIDToBuy !== PRVIDSTR) {
      receivingTokens.push(PRVIDSTR);
    }
    let otaReceivers = await Promise.all(
      receivingTokens.map(() => this.getOTAReceive())
    );
    console.log("otaReceivers", otaReceivers);
    let receiver = {};
    receivingTokens.forEach((t, index) => (receiver[t] = otaReceivers[index]));
    console.log("receivingTokens", receivingTokens);
    // prepare meta data for tx
    let metadata = {
      TradePath: tradePath,
      TokenToSell: tokenIDToSell,
      SellAmount: sellAmount,
      TradingFee: tradingFee,
      Receiver: receiver,
      Type: pdexv3.TradeRequestMeta,
    };
    console.log("meatadata", metadata);
    let result, tokenPayments, prvPayments;
    if (isToken) {
      if (isTradingFeeInPRV) {
        // pay fee with PRV
        prvPayments = [
          {
            PaymentAddress: burningAddress,
            Amount: new bn(tradingFee).toString(),
            Message: "",
          },
        ];
        tokenPayments = [
          {
            PaymentAddress: burningAddress,
            Amount: new bn(sellAmount).toString(),
            Message: info,
          },
        ];
      } else {
        tokenPayments = [
          {
            PaymentAddress: burningAddress,
            Amount: new bn(sellAmount).add(new bn(tradingFee)).toString(),
            Message: info,
          },
        ];
      }
      console.log("transfer", {
        fee,
        info,
        tokenID: tokenIDToSell,
        prvPayments,
        tokenPayments,
      });
      result = await this.account?.transact({
        transfer: {
          fee,
          info,
          tokenID: tokenIDToSell,
          prvPayments,
          tokenPayments,
        },
        extra: { metadata, version, txType: TX_TYPE.SWAP },
      });
    } else {
      prvPayments = [
        {
          PaymentAddress: burningAddress,
          Amount: new bn(sellAmount).add(new bn(tradingFee)).toString(),
          Message: info,
        },
      ];
      console.log("transfer", { prvPayments, fee, info });
      result = await this.account?.transact({
        transfer: { prvPayments, fee, info },
        extra: { metadata, version, txType: TX_TYPE.SWAP },
      });
    }
    await this.account?.updateProgressTx(100, "Completed");
    return result;
  } catch (e) {
    throw e;
  }
}
export default {
  createAndSendSwapRequestTx,
  getOrderSwapHistory,
};
