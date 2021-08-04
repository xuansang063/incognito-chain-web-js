import Validator from "@lib/utils/validator";
import { encryptMessageOutCoin, PRVIDSTR } from "@lib/core";
import { isEmpty } from "lodash";
import {
  MAX_FEE_PER_TX,
  TX_TYPE,
} from "@lib/module/Account/account.constants";
import { CustomError, ErrorObject } from '@lib/common/errorhandler';
import { PrivacyVersion } from '@lib/core/constants';

async function createAndSendConvertTx({
  transfer: {
    prvPayments = [],
    fee = MAX_FEE_PER_TX,
    info = "",
    tokenID = PRVIDSTR,
    tokenPayments = [],
  },
  extra: { isEncryptMessage = false } = {},
}) {
  new Validator('createAndSendConvertTx-tokenID', tokenID).required().string();
  new Validator('createAndSendConvertTx-fee', fee).required().amount();

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
      extra: { txType: TX_TYPE.CONVERT },
    });
    console.debug("Convert Tx: ", {
      tokenID: tokenID,
      txId: result?.txId,
      fee,
    });
    return result;
  } catch (error) {
    console.log("Convert with error: ", error.message);
    throw error;
  }
}

async function createAndSendConvertPToken({
  tokenID,
  fee = MAX_FEE_PER_TX,
  txHandler = null
}) {
  new Validator("createAndSendConvertPToken-tokenID", tokenID).required().string();
  new Validator("createAndSendConvertPToken-fee", fee).required().amount();
  let info = "";
  let paymentInfo = [];
  let tokenPaymentInfo = [];
  /** create and send convert pToken */
  while (true) {
    try {
      let start = Date.now();
      const { unspentCoins: unspentCoinExceptSpendingCoin } =
        await this.getUnspentCoinsByTokenIdV1({ version: PrivacyVersion.ver1, tokenID });
      if (unspentCoinExceptSpendingCoin.length === 0) break;

      // check balance v2
      const nextStep = await this.waitingBalanceNativeTokenV2();
      if (!nextStep) {
        // Not enough PRV v2 for prepare input fee
        throw new CustomError(
          ErrorObject.NotEnoughCoinPRVError,
          ErrorObject.NotEnoughCoinPRVError.description,
        );
      }
      const tsx = await this.createAndSendConvertTx({
        transfer: {
          tokenID,
          prvPayments: paymentInfo,
          tokenPayments: tokenPaymentInfo,
          fee,
          info,
        },
        extra: { isEncryptMessageToken: true },
      });
      let end = Date.now();
      if (typeof txHandler === 'function') {
        txHandler({ ...tsx, timeCreate: end - start })
      }
    } catch (error) {
      if (error.code === ErrorObject.EmptyUTXO.code) break;
      throw error;
    }
  }
}

async function convertAllPToken({ unspentCoins, fee = MAX_FEE_PER_TX } = {}) {
  new Validator("convertAllPToken-unspentCoins", unspentCoins).required().array();
  new Validator("convertAllPToken-fee", fee).number();
  for (const unspentPToken of unspentCoins) {
    try {
      const { tokenID: tokenID, balance } = unspentPToken;
      await this.createAndSendConvertPToken({ tokenID, balance, fee });
    } catch (error) {
      throw error
    }
  }
}

async function createAndSendConvertNativeToken({
  tokenID = PRVIDSTR,
  fee = MAX_FEE_PER_TX,
  txHandler = null
}) {
  new Validator("createAndSendConvertNativeToken-tokenID", tokenID).string();
  new Validator("createAndSendConvertNativeToken-fee", fee).required().amount();

  /** Loop handle convert transaction */
  while (true) {
    try {
      let info = "";
      let paymentInfosParam = [];
      let start = Date.now();
      const tsx = await this.createAndSendConvertTx({
        transfer: { prvPayments: paymentInfosParam, fee, info, tokenID },
        extra: { isEncryptMessage: true },
      });
      let end = Date.now();
      if (typeof txHandler === 'function') {
        txHandler({ ...tsx, timeCreate: end - start })
      }
    } catch (error) {
      if (error.code === ErrorObject.EmptyUTXO.code) break;
      throw error;
    }
  }
}

async function convertCoinsV1() {
  this.coinsV1Storage = {
    unspentCoins: [],
  };
  /** list unspent coins v1 */
  const unspentCoins = (await this.getUnspentCoinsV1({ fromApi: true })) || [];
  const prvUnspent = unspentCoins.find((coin) => coin.tokenID === PRVIDSTR);
  const pTokenUnspent = unspentCoins.filter(
    (coin) => coin.tokenID !== PRVIDSTR && coin.balance > 0
  );

  /** handle convert PRV */
  if (!isEmpty(prvUnspent)) {
    try {
      await this.createAndSendConvertNativeToken(prvUnspent);
    } catch (error) {
      console.log('Convert PRV error: ', error)
    }
  }

  /** handle convert PToken */
  if (!isEmpty(pTokenUnspent)) {
    try {
      await this.convertAllPToken({ unspentCoins: pTokenUnspent });
    } catch (error) {
      console.log('Convert pToken error: ', error)
    }
  }
}

export default {
  createAndSendConvertTx,
  createAndSendConvertNativeToken,
  createAndSendConvertPToken,

  convertAllPToken,
  convertCoinsV1,
};
