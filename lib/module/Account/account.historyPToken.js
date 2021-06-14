import bn from "bn.js";
import Validator from "@lib/utils/validator";
import {
  ADDRESS_TYPE,
  STATUS_CODE_SHIELD_CENTRALIZED,
  STATUS_CODE_SHIELD_DECENTRALIZED,
  STATUS_CODE_UNSHIELD_DECENTRALIZED,
  TX_TYPE,
  TX_TYPE_STR,
} from "./account.constants";
import { camelCaseKeys } from "./account.utils";

function mappingShieldHistory(history) {
  try {
    new Validator("history", history).required().object();
    const { decentralized, status, isShieldTx } = history;
    const canRetryExpiredShield =
      decentralized === 0 &&
      isShieldTx &&
      STATUS_CODE_SHIELD_CENTRALIZED.TIMED_OUT.includes(status);
    const canRemovePendingShield =
      isShieldTx &&
      (STATUS_CODE_SHIELD_CENTRALIZED.PENDING === status ||
        STATUS_CODE_SHIELD_DECENTRALIZED.PENDING === status);
    return {
      ...history,
      canRetryExpiredShield,
      canRemovePendingShield,
      txType: TX_TYPE.SHIELD,
      txTypeStr: TX_TYPE_STR[TX_TYPE.SHIELD],
    };
  } catch (error) {
    console.log("ERROR MAPPING SHIELD TX", error);
  }
  return history;
}

function mappingUnshieldHistory(history) {
  try {
    new Validator("history", history).required().object();
    const { decentralized, burnPrivacyFee, outChainPrivacyFee } = history;
    let inchainFee = "";
    let outchainFee = outChainPrivacyFee;
    switch (decentralized) {
      case 0: {
        // centralized
        inchainFee = new bn(burnPrivacyFee).mul(new bn("2")).toString();
        break;
      }
      case 1: {
        // decentralized
        inchainFee = burnPrivacyFee;
        break;
      }
      default:
        break;
    }
    return {
      ...history,
      inchainFee,
      outchainFee,
      txType: TX_TYPE.UNSHIELD,
      txTypeStr: TX_TYPE_STR[TX_TYPE.UNSHIELD],
    };
  } catch (error) {
    console.log("ERROR MAPPING UNSHIELD TX", error);
  }
  return history;
}

function mappingPTokenHistories(histories) {
  let data = [];
  try {
    new Validator("histories", histories).required().array();
    data = [...histories]
      .map((h) => camelCaseKeys(h))
      .map(({ createdAt, address, addressType, ...rest }) => {
        const time = new Date(createdAt).getTime();
        const depositTmpAddress =
          addressType === ADDRESS_TYPE.SHIELD && !!address;
        const isShieldTx = !!depositTmpAddress;
        const isUnshieldTx = !isShieldTx;
        return {
          ...rest,
          isShieldTx,
          isUnshieldTx,
          time,
        };
      })
      .map((h) => {
        const { isShieldTx, isUnshieldTx } = h;
        if (isShieldTx) {
          return this.mappingShieldHistory(h);
        } else if (isUnshieldTx) {
          return this.mappingUnshieldHistory(h);
        }
      });
    return data;
  } catch (error) {
    console.log("ERROR MAPPING PTOKEN HISTOIRES", error);
  }
  return data;
}

async function getPTokenHistoryByTokenID({ tokenID }) {
  let histories = [];
  try {
    new Validator("getPTokenHistory-tokenID", tokenID).required().string();
    const paymentAddress = this.getPaymentAddress();
    const signPublicKeyEncode = await this.getSignPublicKeyEncode();
    histories =
      (await this.rpcApiService.apiGetPTokenHistory({
        tokenID,
        paymentAddress,
        signPublicKeyEncode,
      })) || [];
    if (histories.length > 0) {
      histories = this.mappingPTokenHistories(histories);
    }
  } catch (error) {
    throw error;
  }
  return histories;
}

function handleMappingTxsPTokenByTxsTransactor({ txsPToken, txsTransactor }) {
  let _txsPToken = [...txsPToken];
  try {
    txsTransactor.forEach((txt) => {
      const foundTxpIndex = _txsPToken.findIndex(
        (txp) =>
          txp.incognitoTx === txt.txId ||
          txp.incognitoTxToPayOutsideChainFee === txt.txId
      );
      if (foundTxpIndex > -1) {
        const { amount, fee, txId } = txt;
        console.log("found tx", txId);
        const foundTxp = _txsPToken[foundTxpIndex];
        const { incognitoAmount, inchainFee, decentralized } = foundTxp;
        console.log(
          "inchainFee",
          inchainFee,
          "incognitoAmount",
          incognitoAmount,
          "amount",
          amount,
          "fee",
          fee
        );
        if (!incognitoAmount) {
          _txsPToken[foundTxpIndex].incognitoAmount = amount;
        }
        if (!inchainFee) {
          switch (decentralized) {
            case 0: {
              // centralized
              _txsPToken[foundTxpIndex].inchainFee = new bn(fee)
                .mul("2")
                .toString();
              break;
            }
            case 1: {
              // decentralized
              _txsPToken[foundTxpIndex].inchainFee = fee;
              break;
            }
            default:
              break;
          }
        }
      }
    });
  } catch (error) {
    console.log("MAPPING TXS PTOKEN BY TXS TRANSACTOR FAIL", error);
  }
  return _txsPToken;
}

export default {
  handleMappingTxsPTokenByTxsTransactor,
  getPTokenHistoryByTokenID,
  mappingPTokenHistories,
  mappingShieldHistory,
  mappingUnshieldHistory,
};
