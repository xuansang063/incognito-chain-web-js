import bn from "bn.js";
import Validator from "@lib/utils/validator";
import { base64Encode, stringToBytes } from "@lib/privacy/utils";
import { CustomError, ErrorObject } from "@lib/common/errorhandler";
import { encryptMessageOutCoin, PRVIDSTR } from "@lib/core";
import { wasm } from "@lib/wasm";
import { checkDecode } from "@lib/common/base58";
import { MAX_INPUT_PER_TX } from "./account.constants";
import {
  newParamTxV2,
  prepareInputForConvertTxV2,
  prepareInputForTxV2,
  newTokenParamV2,
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
    const result = await this._transact({
      transfer: { prvPayments, fee, info },
      extra: { metadata, txHandler, txType },
    });
    const tokenId = PRVIDSTR;
    const tx = {
      ...result,
      memo: info,
      messageForNativeToken,
    };
    await this.saveTxHistory({
      tx,
      tokenId,
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
    let result = await this._transact({
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
      tokenId: tokenID,
    });
    await this.updateProgressTx(100, "Completed");
    return tx;
  } catch (e) {
    throw e;
  }
}

async function _transact({
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

async function _transactConvert({
  transfer: {
    fee,
    info = "",
    tokenID = null,
    prvPayments = [],
    tokenPayments,
  } = {},
  extra: { numOfDefragInputs = 0 } = {},
}) {
  const account = this;
  // await this.updateProgressTx(20, 'Preparing Your Payments');
  info = base64Encode(stringToBytes(info));
  const metadata = null;
  const receiverPaymentAddrStr = new Array(prvPayments.length);
  let totalAmountTransfer = new bn(0);

  for (let i = 0; i < prvPayments.length; i++) {
    receiverPaymentAddrStr[i] = prvPayments[i].paymentAddressStr;
    totalAmountTransfer = totalAmountTransfer.add(
      new bn(prvPayments[i].Amount)
    );
    prvPayments[i].Amount = new bn(prvPayments[i].Amount).toString();
  }

  let isTokenConvert = tokenID && tokenPayments;
  let isDefrag = numOfDefragInputs > 0;

  if (isDefrag && isTokenConvert) {
    throw new CustomError(
      ErrorObject.SendTxErr,
      "Error: token defragment is not supported"
    );
  }
  // await this.updateProgressTx(35, 'Selecting Coins');

  /** Prepare Input For Tx */
  let inputForTx;
  try {
    if (isTokenConvert) {
      // converting token. We need v2 PRV coins
      // inputForTx = await prepareInputForTxV2(totalAmountTransfer, fee, null, this);
    } else {
      // 0 means convert, otherwise we defrag
      if (isDefrag) {
        // inputForTx = await prepareInputForTxV2(-1, fee, null, this, 2, 20, numOfDefragInputs);
      } else {
        inputForTx = await prepareInputForConvertTxV2(
          -1,
          fee,
          null,
          account,
          1,
          0
        );
      }
    }
    // await this.updateProgressTx(50, 'Packing Parameters');
    let txParams = newParamTxV2(
      this.key,
      prvPayments,
      inputForTx.inputCoinStrs,
      fee,
      null,
      null,
      info,
      inputForTx.coinsForRing
    );
    let txParamsJson = JSON.stringify(txParams);
    let wasmResult;
    // await this.updateProgressTx(80, 'Signing Transaction');
    let theirTime = await this.rpc.getNodeTime();
    if (isDefrag) {
      wasmResult = await wasm.createTransaction(txParamsJson, theirTime);
    } else {
      wasmResult = await wasm.createConvertTx(txParamsJson, theirTime);
    }
    /** create raw tx success */
    let { b58EncodedTx, hash } = JSON.parse(wasmResult);

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
    await this.updateProgressTx(90, "Submitting Transaction");
    let response;
    try {
      response = await this.send(
        b58EncodedTx,
        Boolean(!!tokenID && !!tokenPayments)
      );
    } catch (e) {
      throw new CustomError(
        ErrorObject.SendTxErr,
        "Can not send PRV transaction",
        e
      );
    }
    await this.updateProgressTx(95, "Saving Records");
    return {
      response,
      tx: txObj,
      hash,
      amount: totalAmountTransfer.toNumber(),
      inputs: inputForTx.inputCoinStrs,
      receivers: receiverPaymentAddrStr,
      tokenAmount: totalAmountTokenTransfer.toNumber(),
      tokenInputs: inputForToken.inputCoinStrs,
      tokenReceivers: [],
      isPrivacy: true,
      metadata,
    };
  } catch (e) {
    throw new CustomError(ErrorObject.SendTxErr, "Can not prepare inputs", e);
  }
}

async function createAndSendConvertTx({
  transfer: { prvPayments = [], fee = 10, info = "" } = {},
  extra: { isEncryptMessage = false } = {},
} = {}) {
  const account = this;
  let messageForNativeToken = "";
  if (prvPayments.length > 0) {
    messageForNativeToken = prvPayments[0].Message;
  }
  await this.updateProgressTx(10, "Encrypting Message");
  const isEncodeOnly = !isEncryptMessage;
  prvPayments = await encryptMessageOutCoin(prvPayments, isEncodeOnly);

  try {
    let result = await _transactConvert.call(this, {
      transfer: { prvPayments, fee, info },
    });
    // // prvPayments, fee, info);
    // this.saveTxHistory(result, false, "", messageForNativeToken);
    // await this.updateProgressTx(100, "Completed");
    // return result;
  } catch (e) {
    throw e;
  }

  try {
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
  createAndSendConvertTx,
  createAndSendPrivacyToken,
  send,
  _transact,
  _transactConvert,
};
