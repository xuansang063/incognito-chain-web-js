import bn from 'bn.js';
import {
  getBurningAddress,
  PaymentAddressType,
  PDEFeeWithdrawalRequestMeta,
  PDEPRVRequiredContributionRequestMeta,
  PDEWithdrawalRequestMeta,
  PRVIDSTR,
} from '@lib/core';
import { MAX_FEE_PER_TX, TX_TYPE } from '@lib/module/Account/account.constants';
import Validator from '@lib/utils/validator';
import { PrivacyVersion } from '@lib/core/constants';
import { sleep } from '@lib/module/Account/account.utils';
import { CustomError, ErrorObject } from '@lib/common/errorhandler';

export const STORAGE_KEYS = {
  BEACON_HEIGHT_KEY: "$BEACON_HEIGHT_KEY",
  PDE_STATE: "$PDE_STATE_KEY",
  PAIR_ID: "$STORAGE_PAIR_ID_KEY"
}

/**
 *
 * @param {amount} fee
 * @param {string} info
 * @param {string} tokenID
 * @param {string} pairID
 * @param {amount} contributedAmount
 * @param txHandler
 */
async function createAndSendTxWithContribution({
  transfer: { fee = MAX_FEE_PER_TX, info = "", tokenID },
  extra: { pairID, contributedAmount, txHandler } = {},
}) {
  const version = PrivacyVersion.ver2;

  new Validator("fee", fee).amount().required();
  new Validator("info", info).string();
  new Validator("tokenID", tokenID).string();
  new Validator("pairID", pairID).string().required();
  new Validator("contributedAmount", contributedAmount).amount().required();
  new Validator("txHandler", txHandler).function();

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

  const txHashHandler = async ({ txId }) => {
    await this.setStoragePairId({ pairID, txId, tokenID });
  }

  try {
    let result = await this.transact({
      transfer: {
        fee,
        info,
        tokenID,
        tokenPayments: isToken ? burningPayments : null,
        prvPayments: isToken ? [] : burningPayments,
      },
      extra: { metadata, txType: TX_TYPE.ADD_LIQUIDITY, txHandler, txHashHandler, version },
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
 * @param {string} withdrawalToken1IDStr
 * @param {string} withdrawalToken2IDStr
 * @param {amount} withdrawalShareAmt
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
  const version = PrivacyVersion.ver2;

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
      extra: { metadata: md, txType: TX_TYPE.WITHDRAW_LIQUIDITY, version },
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
 * @param {string} withdrawalToken1IDStr
 * @param {string} withdrawalToken2IDStr
 * @param {amount} withdrawalFeeAmt
 * @returns {object}
 */
async function createAndSendWithdrawContributionFeeTx({
  transfer: { fee = MAX_FEE_PER_TX },
  extra: {
    withdrawalToken1IDStr,
    withdrawalToken2IDStr,
    withdrawalFeeAmt,
  } = {},
}) {
  const version = PrivacyVersion.ver2;
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
      extra: { metadata: md, txType: TX_TYPE.WITHDRAW_LIQUIDITY_FEE, version },
    });
    await this.updateProgressTx(100, "Completed");
    return result;
  } catch (e) {
    throw e;
  }
}

async function createAndSendTxsWithContributions({
  tokenID1,
  tokenID2,
  symbol1,
  symbol2,
  contributedAmount1,
  contributedAmount2,
  fee,
  version = PrivacyVersion.ver2,
} = {}) {
  new Validator('createAndSendTxsWithContributions-tokenID1', tokenID1).required().string();
  new Validator('createAndSendTxsWithContributions-tokenID2', tokenID2).required().string();
  new Validator('createAndSendTxsWithContributions-symbol1', symbol1).required().string();
  new Validator('createAndSendTxsWithContributions-symbol2', symbol2).required().string();
  new Validator('createAndSendTxsWithContributions-contributedAmount1', contributedAmount1).required().amount();
  new Validator('createAndSendTxsWithContributions-contributedAmount2', contributedAmount2).required().amount();
  new Validator('createAndSendTxsWithContributions-fee', fee).amount();
  new Validator('createAndSendTxsWithContributions-version', version).required().number();

  const pairID = this.createPairId({ tokenID1, symbol1, tokenID2, symbol2 });

  let rawTx1 = '';
  let rawTx2 = '';
  let txID1 = '';
  let txID2 = '';
  let pubSubs = [];

  try {
    const txHandler1 = ({ rawTx, txID }) => {
      txID1 = txID;
      rawTx1 = rawTx;
    };
    const txHandler2 = ({ rawTx, txID }) => {
      txID2 = txID;
      rawTx2 = rawTx;
    };

    await this.createAndSendTxWithContribution({
      transfer: {
        fee,
        tokenID: tokenID1,
      },
      extra: { pairID, contributedAmount: contributedAmount1, txHandler: txHandler1 },
    });

    await this.createAndSendTxWithContribution({
      transfer: {
        tokenID: tokenID2,
      },
      extra: { pairID, contributedAmount: contributedAmount2, version, txHandler: txHandler2, },
    });
  } catch (e) {
    const params = {
      tokenIDs: [tokenID1, tokenID2],
      txIDs: [txID1, txID2],
      version
    }
    const tasks = [
      await this.removeTxHistoryByTxIDs(params),
      await this.removeSpendingCoinsByTxIDs(params),
    ]
    await Promise.all(tasks)
    throw e;
  }
  try {
    pubSubs = await Promise.all([
      await this.rpcTxService.apiPushTx({ rawTx: rawTx1 }),
      await this.rpcTxService.apiPushTx({ rawTx: rawTx2 }),
    ]);
    console.log('ADD LIQUIDITY RESULT: ', pubSubs);
  } catch (e) {
    throw new CustomError(
      ErrorObject.FailPushRawTxToPubsub,
      "Can not send transaction"
    );
  }

}

export default {
  createAndSendTxWithContribution,
  createAndSendWithdrawContributionTx,
  createAndSendWithdrawContributionFeeTx,
  createAndSendTxsWithContributions,
};
