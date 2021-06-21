import { PRVIDSTR } from '@lib/core';
import { TX_STATUS, TX_TYPE } from '@lib/module/Account/account.constants';
import Validator from '@lib/utils/validator';
import { isEmpty } from 'lodash';
import { base64Encode, stringToBytes } from '@lib/privacy/utils';
import bn from 'bn.js';
import { CustomError, ErrorObject } from '@lib/common/errorhandler';
import { prepareInputForConvertTxV2 } from '@lib/module/Account/features/CoinsV1/coins.utils';
import { newParamTxV2, newTokenParamV2 } from '@lib/module/Account/account.utils';
import { wasm } from '@lib/wasm';
import { checkDecode } from '@lib/common/base58';
import { PrivacyVersion } from '@lib/core/constants';

async function transactConvert({
  transfer: {
    fee = 100,
    info = "",
    tokenID = PRVIDSTR,
    prvPayments = [],
    tokenPayments,
  } = {},
  extra: { numOfDefragInputs = 0, txType = TX_TYPE.CONVERT, version = PrivacyVersion.ver1 } = {},
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
      fee,
      tokenID,
      account,
      version
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

    const inputCoins = isTokenConvert
      ? inputForTx?.inputCoinsForFee
      : inputForTx?.inputCoinsToSpent;
    let inputTokenCoins = [];
    if (isTokenConvert) {
      inputTokenCoins = inputForTx?.inputCoinsToSpent;
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
    console.debug('txParams: ', txParamsJson)
    let wasmResult;
    if (isDefrag) {
      wasmResult = await wasm.createTransaction(txParamsJson, theirTime);
    } else {
      wasmResult = await wasm.createConvertTx(txParamsJson, theirTime);
    }
    /** create raw tx success */
    let { b58EncodedTx, hash, outputs } = JSON.parse(wasmResult);

    console.log('hash: ', hash);
    console.log('b58EncodedTx: ', b58EncodedTx);

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
      txType,
      status: TX_STATUS.PROCESSING,
      info,
    };

    await this.saveTxHistory({
      tx,
      version: PrivacyVersion.ver2,
      tokenID,
    });

    // set pending tx
    const inputV1 = isTokenConvert
      ? txParams?.TokenParams?.InputCoins
      : txParams?.InputCoins;
    await this.setSpendingCoinsStorage({
      tokenID: tokenID,
      coins: inputV1 || [],
      version: PrivacyVersion.ver1,
      txId: hash,
    });
    console.log('Convert: InputV1 ', inputV1)
    if (isTokenConvert) {
      const inputV2 = txParams?.InputCoins;
      console.log('Convert: InputV2 ', inputV2)
      await this.setSpendingCoinsStorage({
        tokenID: PRVIDSTR,
        coins: inputV2,
        txId: hash,
        version: PrivacyVersion.ver2
      });
    }
    // pubsub
    try {
      const pushRawTxToPubsub = await this.rpcTxService.apiPushTx({
        rawTx: b58EncodedTx,
      });
      console.log("pushRawTxToPubsub: ", pushRawTxToPubsub);
      if (!pushRawTxToPubsub) {
        throw new CustomError(
          ErrorObject.FailPushRawTxToPubsub,
          "Can not send transaction"
        );
      }
    } catch (error) {
      throw error;
    }
    return tx;
  } catch (e) {
    throw e;
  }
}

export default {
  transactConvert,
}
