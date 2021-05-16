import bn from "bn.js";
import Validator from "@lib/utils/validator";
import { base64Encode, stringToBytes } from "@lib/privacy/utils";
import { CustomError, ErrorObject } from "@lib/common/errorhandler";
import {
  encryptMessageOutCoin,
  getBurningAddress,
  PaymentAddressType,
  PDECrossPoolTradeRequestMeta,
  PRVIDSTR,
} from "@lib/core";
import { wasm } from "@lib/wasm";
import { checkDecode } from "@lib/common/base58";
import { MAX_INPUT_PER_TX, TX_TYPE } from "./account.constants";
import {
  newParamTxV2,
  prepareInputForConvertTxV2,
  prepareInputForTxV2,
  newTokenParamV2,
  createCoin,
} from "./account.utils";

/**
 * @param {PaymentAddress: string, Amount: string, Message: string }} prvPayments
 * @param {number} fee
 * @param {string} info
 * @param {object} metadata
 * @param {boolean} isEncryptMessage
 * @param {function} txHandler
 */
async function createAndSendNativeToken({
  transfer: { prvPayments = [], fee, info = "" },
  extra: {
    metadata = null,
    isEncryptMessage = false,
    txHandler = null,
    txType,
  } = {},
} = {}) {
  new Validator("prvPayments", prvPayments).required().paymentInfoList();
  new Validator("fee", fee).required().amount();
  new Validator("info", info).string();
  new Validator("metadata", metadata).object();
  new Validator("isEncryptMessage", isEncryptMessage).boolean();
  new Validator("txType", txType).required().number();
  // check fee
  if (fee < 0) {
    fee = 0;
  }
  let messageForNativeToken = "";
  if (prvPayments.length > 0) {
    messageForNativeToken = prvPayments[0].Message;
  }
  await this.updateProgressTx(10, "Encrypting Message");
  const isEncodeOnly = !isEncryptMessage;
  prvPayments = await encryptMessageOutCoin(prvPayments, isEncodeOnly);
  try {
    const result = await this.transact({
      transfer: { prvPayments, fee, info },
      extra: { metadata, txHandler, txType },
    });
    const tx = {
      ...result,
      memo: info,
      messageForNativeToken,
    };
    await this.saveTxHistory({
      tx,
    });
    await this.updateProgressTx(100, "Completed");
    return tx;
  } catch (e) {
    throw e;
  }
}

/**
 *
 * @param {{PaymentAddress: string, Amount: number, Message: string }} prvPayments
 * @param {{PaymentAddress: string, Amount: number, Message: string }} tokenPayments
 * @param {number} fee
 * @param {string} info
 * @param {boolean} tokenID
 * @param {object} metadata
 * @param {boolean} isEncryptMessage
 * @param {boolean} isEncryptMessageToken
 * @param {function} txHandler
 */
async function createAndSendPrivacyToken({
  transfer: { prvPayments = [], tokenPayments = [], fee, info = "", tokenID },
  extra: {
    metadata = null,
    isEncryptMessage = false,
    isEncryptMessageToken = false,
    txHandler = null,
    txType,
  } = {},
}) {
  new Validator("prvPayments", prvPayments).paymentInfoList();
  new Validator("tokenPayments", tokenPayments).required().paymentInfoList();
  new Validator("fee", fee).required().amount();
  new Validator("info", info).string();
  new Validator("tokenID", tokenID).string();
  new Validator("metadata", metadata).object();
  new Validator("isEncryptMessage", isEncryptMessage).boolean();
  new Validator("isEncryptMessageToken", isEncryptMessageToken).boolean();
  new Validator("txType", txType).required().number();
  if (fee < 0) {
    fee = 0;
  }
  await this.updateProgressTx(10, "Encrypting Message");
  let messageForNativeToken = "";
  if (prvPayments.length > 0) {
    messageForNativeToken = prvPayments[0].Message;
  }
  let messageForPToken = tokenPayments[0].Message;
  let isEncodeOnly = !isEncryptMessage;
  prvPayments = await encryptMessageOutCoin(prvPayments, isEncodeOnly);
  isEncodeOnly = !isEncryptMessageToken;
  tokenPayments = await encryptMessageOutCoin(tokenPayments, isEncodeOnly);
  try {
    let result = await this.transact({
      transfer: {
        prvPayments,
        fee,
        info,
        tokenID,
        tokenPayments,
      },
      extra: { metadata, txHandler, txType },
    });
    const tx = {
      ...result,
      memo: info,
      messageForNativeToken,
      messageForPToken,
    };
    this.saveTxHistory({
      tx,
    });
    await this.updateProgressTx(100, "Completed");
    return tx;
  } catch (e) {
    throw e;
  }
}

async function transact({
  transfer: {
    prvPayments,
    tokenPayments,
    fee = 10,
    info = "",
    tokenID = PRVIDSTR,
    tokenParams = null,
  } = {},
  extra: { metadata = null, txHandler = null, txType } = {},
}) {
  new Validator("prvPayments", prvPayments).paymentInfoList();
  new Validator("tokenPayments", tokenPayments).paymentInfoList();
  new Validator("fee", fee).required().number();
  new Validator("info", info).string();
  new Validator("tokenID", tokenID).string();
  new Validator("metadata", metadata).object();
  new Validator("tokenParams", tokenParams).object();
  new Validator("txType", txType).required().number();
  console.log(20);
  await this.updateProgressTx(20, "Preparing Your Payments");
  info = base64Encode(stringToBytes(info));
  let receiverPaymentAddrStr = new Array(prvPayments.length);
  let totalAmountTransfer = new bn(0);
  for (let i = 0; i < prvPayments.length; i++) {
    receiverPaymentAddrStr[i] = prvPayments[i].paymentAddressStr;
    totalAmountTransfer = totalAmountTransfer.add(
      new bn(prvPayments[i].Amount)
    );
    prvPayments[i].Amount = new bn(prvPayments[i].Amount).toString();
  }
  console.log(30);
  await this.updateProgressTx(30, "Selecting Coins");
  let inputForTx;
  try {
    inputForTx = await prepareInputForTxV2({
      amountTransfer: totalAmountTransfer,
      fee,
      account: this,
      tokenID: PRVIDSTR,
    });
  } catch (e) {
    throw new CustomError(
      ErrorObject.InitNormalTxErr,
      "Error while preparing inputs",
      e
    );
  }
  if (inputForTx.inputCoinStrs.length > MAX_INPUT_PER_TX) {
    throw new CustomError(ErrorObject.TxSizeExceedErr);
  }
  console.log(40);
  await this.updateProgressTx(40, "Packing Parameters");
  let txParams = newParamTxV2(
    this.key,
    prvPayments,
    inputForTx.inputCoinStrs,
    fee,
    null,
    metadata,
    info,
    inputForTx.coinsForRing
  );
  // handle token transfer
  let tokenReceiverPaymentAddrStr = [];
  let totalAmountTokenTransfer = new bn(0);
  let inputForToken = {
    inputCoinStrs: [],
    coinsForRing: {},
  };
  console.log(50);
  await this.updateProgressTx(50, "Adding Token Info");
  // tokenID is non-null when transferring token; tokenParams is non-null when creating new token
  if (!!tokenPayments) {
    let isInit = Boolean(tokenParams);
    let isTransfer = Boolean(tokenID);
    if (!(isInit || isTransfer)) {
      throw new CustomError(
        ErrorObject.InitNormalTxErr,
        "Invalid Token parameters"
      );
    }
    tokenReceiverPaymentAddrStr = new Array(tokenPayments.length);
    for (let i = 0; i < tokenPayments.length; i++) {
      receiverPaymentAddrStr[i] = tokenPayments[i].paymentAddressStr;
      totalAmountTokenTransfer = totalAmountTokenTransfer.add(
        new bn(tokenPayments[i].Amount)
      );
      tokenPayments[i].Amount = new bn(tokenPayments[i].Amount).toString();
    }
    console.log(60);
    await this.updateProgressTx(60, "Selecting Token Coins");
    if (isTransfer) {
      try {
        inputForToken = await prepareInputForTxV2({
          amountTransfer: totalAmountTokenTransfer,
          fee: 0,
          tokenID,
          account: this,
        });
      } catch (e) {
        throw new CustomError(
          ErrorObject.InitNormalTxErr,
          `Error while preparing inputs ${e}`
        );
      }
    }
    console.log(70);
    await this.updateProgressTx(70, "Decorating Parameters");
    tokenParams = newTokenParamV2(
      tokenPayments,
      inputForToken.inputCoinStrs,
      tokenID,
      inputForToken.coinsForRing,
      tokenParams || {}
    );
    txParams.TokenParams = tokenParams;
  }
  let txParamsJson = JSON.stringify(txParams);
  console.log(80);
  await this.updateProgressTx(80, "Signing Transaction");
  let theirTime = await this.rpc.getNodeTime();
  let wasmResult = await wasm.createTransaction(txParamsJson, theirTime);
  let { b58EncodedTx, hash, outputs } = JSON.parse(wasmResult);
  if (!!hash && typeof txHandler === "function") {
    await txHandler(hash);
  }
  if (b58EncodedTx === null || b58EncodedTx === "") {
    throw new CustomError(
      ErrorObject.InitNormalTxErr,
      "Can not init transaction tranfering PRV"
    );
  }
  let tempBuf = checkDecode(b58EncodedTx).bytesDecoded;
  let theString = String.fromCharCode.apply(null, tempBuf);
  let txObj = JSON.parse(theString);
  txObj.Encoded = b58EncodedTx;
  console.log(90);
  await this.updateProgressTx(90, "Submitting Transaction");
  let response;
  try {
    response = await this.send(b58EncodedTx, Boolean(tokenPayments));
  } catch (e) {
    throw new CustomError(
      ErrorObject.SendTxErr,
      "Can not send PRV transaction",
      e
    );
  }

  if (response.TokenID && response.TokenID.length > 0) {
    tokenID = response.TokenID;
  }
  await this.updateProgressTx(95, "Saving Records");
  let taskSpendingCoins = [];
  if (!!inputForTx.inputCoinStrs) {
    taskSpendingCoins.push(
      this.setSpendingCoinsStorage({
        coins: inputForTx.inputCoinStrs,
        tokenId: PRVIDSTR,
      })
    );
  }
  if (!!inputForToken.inputCoinStrs && tokenID !== PRVIDSTR) {
    taskSpendingCoins.push(
      this.setSpendingCoinsStorage({
        coins: inputForToken.inputCoinStrs,
        tokenId: tokenID,
      })
    );
  }
  await Promise.all(taskSpendingCoins);
  return {
    response,
    tx: txObj,
    hash,
    outputs,
    amount: totalAmountTransfer.toString(),
    inputs: inputForTx.inputCoinStrs,
    receivers: receiverPaymentAddrStr,
    tokenID,
    tokenAmount: totalAmountTokenTransfer.toString(),
    tokenInputs: inputForToken.inputCoinStrs,
    tokenReceivers: tokenReceiverPaymentAddrStr,
    isPrivacy: true,
    metadata,
    txType,
  };
}

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
    this.saveTxHistory({
      tx,
    });
    await this.updateProgressTx(100, "Completed");
    return result;
  } catch (e) {
    throw e;
  }
}

async function send(encodedTx, isToken) {
  new Validator("isToken", isToken).boolean();
  new Validator("encodedTx", encodedTx).required();
  if (this.offlineMode) {
    return { offline: true };
  }
  let response;
  if (isToken) {
    response = await this.rpc.sendRawTxCustomTokenPrivacy(encodedTx);
  } else {
    response = await this.rpc.sendRawTx(encodedTx);
  }
  return response;
}

export default {
  createAndSendNativeToken,
  createAndSendPrivacyToken,
  send,
  createAndSendTradeRequestTx,
  transact,
};
