import bn from "bn.js";
import {
  getBurningAddress,
  PaymentAddressType,
  PDEFeeWithdrawalRequestMeta,
  PDEPRVRequiredContributionRequestMeta,
  PDEWithdrawalRequestMeta,
  PRVIDSTR,
} from "@lib/core";
import { MAX_FEE_PER_TX, TX_TYPE } from "./account.constants";
import Validator from "@lib/utils/validator";

/**
 *
 * @param {amount} fee
 * @param {string} info
 * @param {string} tokenID
 * @param {string} pairID
 * @param {amount} contributedAmount
 */
async function createAndSendTxWithContribution({
  transfer: { fee = MAX_FEE_PER_TX, info = "", tokenID },
  extra: { pairID, contributedAmount } = {},
}) {
  new Validator("fee", fee).amount().required();
  new Validator("info", info).string();
  new Validator("tokenID", tokenID).string();
  new Validator("pairID", pairID).string().required();
  new Validator("contributedAmount", contributedAmount).amount().required();
  await this.updateProgressTx(10, "Generating Metadata");
  let burningAddress = await getBurningAddress(this.rpc);
  new Validator("burningAddress", burningAddress).string().required();
  let burningPayments = [
    {
      PaymentAddress: burningAddress,
      Amount: new bn(contributedAmount).toString(),
      Message: "",
    },
  ];
  let contributorAddressStr = this.key.base58CheckSerialize(PaymentAddressType);
  let isToken = tokenID !== PRVIDSTR;
  // prepare meta data for tx
  let metadata = {
    PDEContributionPairID: pairID,
    ContributorAddressStr: contributorAddressStr,
    ContributedAmount: contributedAmount,
    TokenIDStr: tokenID,
    Type: PDEPRVRequiredContributionRequestMeta,
  };
  try {
    let result = await this.transact({
      transfer: {
        fee,
        info,
        tokenID,
        tokenPayments: isToken ? burningPayments : null,
        prvPayments: isToken ? [] : burningPayments,
      },
      extra: { metadata, txType: TX_TYPE.ADD_LIQUIDITY },
    });
    await this.updateProgressTx(100, "Completed");
    return result;
  } catch (e) {
    throw e;
  }
}

/**
 *
 * @param {amount} fee
 * @param {string} pairID
 * @param {amount} sellAmount
 * @returns {object}
 */
async function createAndSendWithdrawContributionTx({
  transfer: { fee = MAX_FEE_PER_TX },
  extra: {
    withdrawalToken1IDStr,
    withdrawalToken2IDStr,
    withdrawalShareAmt,
  } = {},
}) {
  new Validator("fee", fee).required().amount();
  new Validator("withdrawalShareAmt", withdrawalShareAmt).required().amount();
  new Validator("withdrawalToken1IDStr", withdrawalToken1IDStr)
    .required()
    .string();
  new Validator("withdrawalToken2IDStr", withdrawalToken2IDStr)
    .required()
    .string();
  await this.updateProgressTx(10, "Generating Metadata");
  let md = {
    WithdrawerAddressStr: this.key.base58CheckSerialize(PaymentAddressType),
    WithdrawalToken1IDStr: withdrawalToken1IDStr,
    WithdrawalToken2IDStr: withdrawalToken2IDStr,
    WithdrawalShareAmt: new bn(withdrawalShareAmt).toString(),
    Type: PDEWithdrawalRequestMeta,
  };
  try {
    let result = await this.transact({
      transfer: { fee, prvPayments: [] },
      extra: { metadata: md, txType: TX_TYPE.WITHDRAW_LIQUIDITY },
    });
    await this.updateProgressTx(100, "Completed");
    return result;
  } catch (e) {
    throw e;
  }
}

async function createAndSendWithdrawContributionFeeTx({
  transfer: { fee = MAX_FEE_PER_TX },
  extra: {
    withdrawalToken1IDStr,
    withdrawalToken2IDStr,
    withdrawalFeeAmt,
  } = {},
}) {
  new Validator("fee", fee).required().amount();
  new Validator("withdrawalFeeAmt", withdrawalFeeAmt).required().amount();
  new Validator("withdrawalToken1IDStr", withdrawalToken1IDStr)
    .required()
    .string();
  new Validator("withdrawalToken2IDStr", withdrawalToken2IDStr)
    .required()
    .string();
  await this.updateProgressTx(10, "Generating Metadata");
  let md = {
    WithdrawerAddressStr: this.key.base58CheckSerialize(PaymentAddressType),
    WithdrawalToken1IDStr: withdrawalToken1IDStr,
    WithdrawalToken2IDStr: withdrawalToken2IDStr,
    WithdrawalFeeAmt: new bn(withdrawalFeeAmt).toString(),
    Type: PDEFeeWithdrawalRequestMeta,
  };
  try {
    let result = await this.transact({
      transfer: { fee, prvPayments: [] },
      extra: { metadata: md, txType: TX_TYPE.WITHDRAW_LIQUIDITY_FEE },
    });
    await this.updateProgressTx(100, "Completed");
    return result;
  } catch (e) {
    throw e;
  }
}

export default {
  createAndSendTxWithContribution,
  createAndSendWithdrawContributionTx,
  createAndSendWithdrawContributionFeeTx,
};
