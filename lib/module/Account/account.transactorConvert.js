import Validator from "@lib/utils/validator";
import { encryptMessageOutCoin, PRVIDSTR } from "@lib/core";
import { isEmpty } from "lodash";
import { base64Encode, stringToBytes } from "@lib/privacy/utils";
import bn from "bn.js";
import { CustomError, ErrorObject } from "@lib/common/errorhandler";
import {
  newParamTxV2,
  newTokenParamV2,
  prepareInputForConvertTxV2,
  sleep,
} from "@lib/module/Account/account.utils";
import { wasm } from "@lib/wasm";
import { checkDecode } from "@lib/common/base58";
import { PrivacyVersion } from "@lib/core/constants";
import { TX_STATUS } from '@lib/module/Account/account.constants';

async function transactConvert({
  transfer: {
    fee = 100,
    info = "",
    tokenID = PRVIDSTR,
    prvPayments = [],
    tokenPayments,
  } = {},
  extra: { numOfDefragInputs = 0 } = {},
}) {
  tokenID = tokenID || PRVIDSTR;
  new Validator("fee", fee).required().number();

  if (!isEmpty(info)) {
    info = base64Encode(stringToBytes(info)); /** encode base64 info */
  }

  const account = this;
  const isTokenConvert = tokenID !== PRVIDSTR;
  const isDefrag = numOfDefragInputs > 0;

  const metadata = null;
  const receiverPaymentAddrStr = new Array(prvPayments.length);
  let totalAmountTransfer = new bn(0);

  prvPayments.forEach((payment, index) => {
    receiverPaymentAddrStr[index] = payment.paymentAddressStr;
    totalAmountTransfer = totalAmountTransfer.add(new bn(payment.Amount));
    payment.Amount = new bn(prvPayments[i].Amount).toString();
  });

  if (isDefrag && isTokenConvert) {
    throw new CustomError(
      ErrorObject.SendTxErr,
      "Error: token defragment is not supported"
    );
  }

  /** prepare input for tx */
  let inputForTx;
  try {
    const paramConvert = {
      amountTransfer: -1,
      fee,
      tokenID,
      account,
    };
    if (isTokenConvert) {
      /** converting token. We need v2 PRV coins */
      inputForTx = await prepareInputForConvertTxV2(paramConvert);
    } else {
      /** 0 means convert, otherwise we defrag */
      if (isDefrag) {
        // inputForTx = await prepareInputForTxV2(-1, fee, null, this, 2, 20, numOfDefragInputs);
      } else {
        /** converting prv */
        inputForTx = await prepareInputForConvertTxV2(paramConvert);
      }
    }

    const inputCoins = isTokenConvert ? inputForTx?.inputCoinsForFee : inputForTx?.inputCoinsToSpent;
    let inputTokenCoins = [];
    if (isTokenConvert) {
      inputTokenCoins = inputForTx?.inputCoinsToSpent
    }

    if (inputCoins.length === 0) {
      throw new CustomError(
        ErrorObject.EmptyUTXO,
        "Error: Dont have UTXO PRV v1"
      );
    }

    let txParams = newParamTxV2(
      this.key,
      prvPayments,
      inputCoins,
      fee,
      null,
      null,
      info,
      inputForTx.coinsForRing
    );
    let tokenReceiverPaymentAddrStr = [];
    let totalAmountTokenTransfer = new bn(0);
    if (isTokenConvert) {
      tokenReceiverPaymentAddrStr = new Array(tokenPayments.length);
      for (let i = 0; i < tokenPayments.length; i++) {
        receiverPaymentAddrStr[i] = tokenPayments[i].paymentAddressStr;
        totalAmountTokenTransfer = totalAmountTokenTransfer.add(
          new bn(tokenPayments[i].Amount)
        );
        tokenPayments[i].Amount = new bn(tokenPayments[i].Amount).toString();
      }
      if (inputTokenCoins.length === 0) {
        throw new CustomError(
          ErrorObject.EmptyUTXO,
          "Error: Dont have UTXO pToken v1"
        );
      }
      txParams.TokenParams = newTokenParamV2(
        tokenPayments,
        inputTokenCoins,
        tokenID,
        null
      );
    }
    const theirTime = await this.rpc.getNodeTime();
    let txParamsJson = JSON.stringify(txParams);
    console.log('txParams: ', txParams)
    let wasmResult;
    if (isDefrag) {
      wasmResult = await wasm.createTransaction(txParamsJson, theirTime);
    } else {
      wasmResult = await wasm.createConvertTx(txParamsJson, theirTime);
    }
    /** create raw tx success */
    let { b58EncodedTx, hash, outputs } = JSON.parse(wasmResult);

    if (b58EncodedTx === null || b58EncodedTx === "") {
      throw new CustomError(
        ErrorObject.InitNormalTxErr,
        "Can not init transaction transferring PRV"
      );
    }
    let tempBuf = checkDecode(b58EncodedTx).bytesDecoded;
    let theString = String.fromCharCode.apply(null, tempBuf);
    let txObj = JSON.parse(theString);
    txObj.Encoded = b58EncodedTx;
    let response;
    let tx = {
      txId: hash,
      tx: txObj,
      hash,
      outputs,
      amount: totalAmountTransfer.toString(),
      inputs: inputCoins,
      receivers: receiverPaymentAddrStr,
      tokenID,
      tokenAmount: totalAmountTokenTransfer.toString(),
      tokenInputs: inputTokenCoins,
      tokenReceivers: tokenReceiverPaymentAddrStr,
      isPrivacy: true,
      metadata,
      txType: "cv",
      status: TX_STATUS.PROCESSING,
      info,
    };
    await this.saveTxHistory({
      tx,
    });

    // set pending tx
    const inputV1 = isTokenConvert ? txParams?.TokenParams?.InputCoins : txParams?.InputCoins;
    await this.setSpendingCoinsV1ByTokenId({
      tokenId: tokenID,
      value: inputV1 || [],
    });
    if (isTokenConvert) {
      const inputV2 = txParams?.InputCoins;
      await this.setSpendingCoinsStorage({
        tokenId: PRVIDSTR,
        coins: inputV2,
      });
    }
    // pubsub
    try {
      const pushRawTxToPubsub = await this.rpcTxService.apiPushTx({
        rawTx: b58EncodedTx,
      });
      console.log('pushRawTxToPubsub: ', pushRawTxToPubsub)
      if (!pushRawTxToPubsub) {
        throw new CustomError(
          ErrorObject.FailPushRawTxToPubsub,
          "Can not send transaction",
        );
      }
    } catch (error) {
      throw error;
    }
    // send transaction
    try {
      response = await this.send(
        b58EncodedTx,
        Boolean(tokenID && tokenPayments)
      );
      if (!!response.TokenID) {
        tokenID = response.TokenID;
      }
      console.log('response txId: ', response.txId)
      await this.saveTxHistory({
        tx: { ...tx, tokenID, txId: response.txId || hash },
      });

    } catch (error) {
      throw new CustomError(
        ErrorObject.SendTxErr,
        "Can not send PRV transaction",
        error
      );
    }
    return tx;
  } catch (e) {
    throw e;
  }
}

async function createAndSendConvertTx({
  transfer: {
    prvPayments = [],
    fee = 10,
    info = "",
    tokenID = null,
    tokenPayments = [],
  },
  extra: { isEncryptMessage = false } = {},
}) {
  try {
    const isEncodeOnly = !isEncryptMessage;

    if (!isEmpty(prvPayments)) {
      prvPayments = await encryptMessageOutCoin(prvPayments, isEncodeOnly);
    }

    if (!isEmpty(tokenPayments)) {
      tokenPayments = await encryptMessageOutCoin(tokenPayments, isEncodeOnly);
    }
    let result = await this.transactConvert({
      transfer: { prvPayments, fee, info, tokenID, tokenPayments },
    });
    console.debug(`Convert Tx: ${JSON.stringify(result?.response)}`)
    console.debug(`Converted token: ${tokenID || PRVIDSTR} with fee: ${fee}`);

    // Todo: Save history when convert tx success
    // this.saveTxHistory(result, false, "", messageForNativeToken);
    return result;
  } catch (error) {
    console.log('Convert with error: ', error.message);
    throw error;
  }
}

async function createAndSendConvertPToken({ tokenID = null, balance }) {
  new Validator("tokenID", tokenID).required().string();
  const errors = [];
  if (balance === 0) return errors;
  let fee = 100;
  let info = "";

  let paymentInfo = [];
  let tokenPaymentInfo = [];
  /** create and send convert pToken */
  while (true) {
    try {
      await this.createAndSendConvertTx({
        transfer: {
          tokenID,
          prvPayments: paymentInfo,
          tokenPayments: tokenPaymentInfo,
          fee,
          info,
        },
        extra: { isEncryptMessageToken: true },
      });
    } catch (error) {
      if (error.code !== "WEB_JS_ERROR(-3012)") {
        errors.push(error);
      }
      break;
    }
  }
  return errors;
}

async function convertAllPToken(unspentPTokens) {
  new Validator("unspentPTokens", unspentPTokens).required().array();
  let errorsList = []
  for (const unspentPToken of unspentPTokens) {
    try {
      const { tokenId: tokenID, balance } = unspentPToken;
      await this.createAndSendConvertPToken({ tokenID, balance });
    } catch (errors) {
      errorsList = errorsList.concat(errors)
    }
  }
  return { errors: errorsList };
}

async function createAndSendConvertNativeToken({ tokenID, balance }) {
  new Validator("tokenID", tokenID).string();
  const errors = []
  if (balance <= 100) return errors;
  /** Loop handle convert transaction */
  while (true) {
    try {
      let fee = 100;
      let info = "";
      let paymentInfosParam = [];
      await this.createAndSendConvertTx({
        transfer: { prvPayments: paymentInfosParam, fee, info, tokenID },
        extra: { isEncryptMessage: true },
      });
    } catch (error) {
      if (error.code === "WEB_JS_ERROR(-3012)") break;
      errors.push(error);
      break;
    }
  }
  return { errors };
}

async function convertAllToken() {
  this.setPrivacyVersion(PrivacyVersion.ver1);
  if (!this.coinsV1Storage) {
    this.coinsV1Storage = {
      unspentCoins: [],
      spendingCoins: [],
    };
  }

  let errorsList = [];

  /** list unspent coins v1 */
  const unspentCoins = (await this.getAllUnspentCoinsV1()) || [];
  const prvUnspent = unspentCoins.find((coin) => coin.tokenId === PRVIDSTR);
  const pTokenUnspent = unspentCoins.filter(
    (coin) => coin.tokenId !== PRVIDSTR && coin.balance > 100
  );

  // /** handle convert PRV */
  // if (!isEmpty(prvUnspent)) {
  //   const { errors } = await this.createAndSendConvertNativeToken(prvUnspent);
  //   if (Array.isArray(errors)) {
  //     errorsList = errorsList.concat(errors)
  //   }
  // }
  //
  // /** handle convert PToken */
  // if (!isEmpty(pTokenUnspent)) {
  //   const { errors } = await this.convertAllPToken(pTokenUnspent);
  //   if (Array.isArray(errors)) {
  //     errorsList = errorsList.concat(errors)
  //   }
  // }
  // console.log('errorsList: ', errorsList)
  return { errors: errorsList };
}

export default {
  transactConvert,
  createAndSendConvertTx,
  convertAllToken,
  convertAllPToken,
  createAndSendConvertNativeToken,
  createAndSendConvertPToken,
};
