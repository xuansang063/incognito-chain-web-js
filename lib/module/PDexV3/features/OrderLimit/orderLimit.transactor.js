import { pdexv3 } from "@lib/core/constants";
import { getBurningAddress, PRVIDSTR } from "@lib/core";
import bn from "bn.js";
import { ACCOUNT_CONSTANT, Validator } from "@lib/wallet";
import { TX_TYPE } from "@lib/module/Account";

async function createAndSendOrderRequestTx(params) {
  try {
    const {
      transfer: { fee, info = "" },
      extra: { tokenIDToSell, poolPairID, sellAmount, nftID, version },
    } = params;
    console.log("tokenIDToSell", tokenIDToSell);
    new Validator("createAndSendOrderRequestTx-fee", fee).required().amount();
    new Validator("createAndSendOrderRequestTx-info", info).string();
    new Validator("createAndSendOrderRequestTx-tokenIDToSell", tokenIDToSell)
      .required()
      .string();
    new Validator("createAndSendOrderRequestTx-poolPairID", poolPairID)
      .required()
      .string();
    new Validator("createAndSendOrderRequestTx-sellAmount", sellAmount)
      .required()
      .amount();
    new Validator("createAndSendOrderRequestTx-nftID", nftID)
      .required()
      .string();
    new Validator("createAndSendOrderRequestTx-version", version)
      .required()
      .number();
    await this.account?.updateProgressTx(10, "Generating Metadata");
    let burningAddress = await getBurningAddress(this.rpc);
    let burningPayments = [
      {
        PaymentAddress: burningAddress,
        Amount: new bn(sellAmount).toString(),
        Message: info,
      },
    ];
    let isToken = tokenIDToSell !== PRVIDSTR;
    let receiver = {};
    // create new OTA for refund
    receiver[tokenIDToSell] = await this.getOTAReceive();
    // prepare meta data for tx
    let metadata = {
      PoolPairID: poolPairID,
      SellAmount: sellAmount,
      TokenToSell: tokenIDToSell,
      NftID: nftID,
      Receiver: receiver,
      Type: pdexv3.AddOrderRequestMeta,
    };
    let result;
    if (isToken) {
      result = await this.account?.transact({
        transfer: {
          fee,
          info,
          tokenID: tokenIDToSell,
          tokenPayments: burningPayments,
        },
        extra: {
          metadata,
          version,
          txType: ACCOUNT_CONSTANT.TX_TYPE.ORDER_LIMIT,
        },
      });
    } else {
      result = await this.account?.transact({
        transfer: { prvPayments: burningPayments, fee, info },
        extra: {
          metadata,
          version,
          txType: ACCOUNT_CONSTANT.TX_TYPE.ORDER_LIMIT,
        },
      });
    }
    await this.account?.updateProgressTx(100, "Completed");
    return result;
  } catch (error) {
    throw error;
  }
}

async function createAndSendCancelOrderRequestTx(params) {
  try {
    const {
      transfer: { fee, info = "" },
      extra: { withdrawTokenID, poolPairID, orderID, amount, nftID, version },
    } = params;
    new Validator("createAndSendCancelOrderRequestTx-fee", fee)
      .required()
      .amount();
    new Validator("createAndSendCancelOrderRequestTx-info", info).string();
    new Validator(
      "createAndSendCancelOrderRequestTx-withdrawTokenID",
      withdrawTokenID
    )
      .required()
      .string();
    new Validator("createAndSendCancelOrderRequestTx-poolPairID", poolPairID)
      .required()
      .string();
    new Validator("createAndSendCancelOrderRequestTx-orderID", orderID)
      .required()
      .string();
    new Validator("createAndSendCancelOrderRequestTx-amount", amount)
      .required()
      .amount();
    new Validator("createAndSendCancelOrderRequestTx-nftID", nftID)
      .required()
      .string();
    new Validator("createAndSendCancelOrderRequestTx-version", version)
      .required()
      .number();
    await this.account?.updateProgressTx(10, "Generating Metadata");
    let burningAddress = await getBurningAddress(this.rpc);
    let burningPayments = [
      {
        PaymentAddress: burningAddress,
        Amount: new bn(1).toString(), // burn 1 of NFTID
        Message: info,
      },
    ];
    let receivingTokens = [nftID, withdrawTokenID];
    let otaReceivers = await Promise.all(
      receivingTokens.map(() => this.getOTAReceive())
    );
    let receiver = {};
    receivingTokens.forEach((t, index) => (receiver[t] = otaReceivers[index]));
    // prepare meta data for tx
    let metadata = {
      PoolPairID: poolPairID,
      OrderID: orderID,
      TokenID: withdrawTokenID,
      Amount: amount,
      NftID: nftID,
      Receiver: receiver,
      Type: pdexv3.WithdrawOrderRequestMeta,
    };
    let result = await this.account?.transact({
      transfer: {
        prvPayments: [],
        tokenPayments: burningPayments,
        tokenID: nftID,
        fee,
        info,
      },
      extra: { metadata, version, txType: TX_TYPE.CANCEL_ORDER_LIMIT },
    });
    await this.account?.updateProgressTx(100, "Completed");
    return result;
  } catch (e) {
    throw e;
  }
}

export default {
  createAndSendOrderRequestTx,
  createAndSendCancelOrderRequestTx,
};
