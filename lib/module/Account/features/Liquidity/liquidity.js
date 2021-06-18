import bn from "bn.js";
import {
  getBurningAddress,
  PaymentAddressType,
  PDEFeeWithdrawalRequestMeta,
  PDEPRVRequiredContributionRequestMeta,
  PDEWithdrawalRequestMeta,
  PRVIDSTR,
} from "@lib/core";
import Validator from "@lib/utils/validator";
import { MAX_FEE_PER_TX, TX_TYPE } from "@lib/module/Account/account.constants";
import { CACHE_KEYS, cachePromise } from "@lib/module/Account/features/Cache";
//TODO: import cost -> fix import lodash
import { has, uniqBy } from "lodash";
import { mergeTokens } from "./liquidity.utils";

// TODO: remove '$' => this is jquery global variable
export const STORAGE_KEYS = {
  BEACON_HEIGHT_KEY: "$BEACON_HEIGHT_KEY",
  PDE_STATE: "$PDE_STATE_KEY",
  PAIR_ID: "$STORAGE_PAIR_ID_KEY",
};

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
  extra: { pairID, contributedAmount, txHandler, version } = {},
}) {
  new Validator("createAndSendTxWithContribution-fee", fee).amount().required();
  new Validator("createAndSendTxWithContribution-info", info).string();
  new Validator("createAndSendTxWithContribution-tokenID", tokenID).string();
  new Validator("createAndSendTxWithContribution-pairID", pairID)
    .string()
    .required();
  new Validator(
    "createAndSendTxWithContribution-contributedAmount",
    contributedAmount
  )
    .amount()
    .required();
  new Validator("createAndSendTxWithContribution-version", version)
    .required()
    .number();
  new Validator(
    "createAndSendTxWithContribution-txHandler",
    txHandler
  ).function();
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
    await this.setStoragePairId({ pairID, txId });
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
      extra: {
        metadata,
        txType: TX_TYPE.ADD_LIQUIDITY,
        version,
        txHandler,
        txHashHandler,
      },
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
    version,
  } = {},
}) {
  new Validator("createAndSendWithdrawContributionTx-fee", fee)
    .required()
    .amount();
  new Validator(
    "createAndSendWithdrawContributionTx-withdrawalShareAmt",
    withdrawalShareAmt
  )
    .required()
    .amount();
  new Validator(
    "createAndSendWithdrawContributionTx-withdrawalToken1IDStr",
    withdrawalToken1IDStr
  )
    .required()
    .string();
  new Validator(
    "createAndSendWithdrawContributionTx-withdrawalToken2IDStr",
    withdrawalToken2IDStr
  )
    .required()
    .string();
  new Validator("createAndSendWithdrawContributionTx-version", version)
    .required()
    .number();
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
    version,
  } = {},
}) {
  new Validator("createAndSendWithdrawContributionFeeTx-fee", fee)
    .required()
    .amount();
  new Validator(
    "createAndSendWithdrawContributionFeeTx-withdrawalFeeAmt",
    withdrawalFeeAmt
  )
    .required()
    .amount();
  new Validator(
    "createAndSendWithdrawContributionFeeTx-withdrawalToken1IDStr",
    withdrawalToken1IDStr
  )
    .required()
    .string();
  new Validator(
    "createAndSendWithdrawContributionFeeTx-withdrawalToken2IDStr",
    withdrawalToken2IDStr
  )
    .required()
    .string();
  new Validator(
    "createAndSendWithdrawContributionFeeTx-createAndSendWithdrawContributionFeeTx-version",
    version
  )
    .required()
    .number();
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

async function getPairs() {
  try {
    const tasks = [
      await cachePromise(CACHE_KEYS.P_TOKEN, this.rpcApiService.apiGetPTokens),
      await cachePromise(
        CACHE_KEYS.CUSTOM_TOKEN,
        this.rpcApiService.apiGetCustomTokens
      ),
      await cachePromise(
        CACHE_KEYS.PDE_STATE,
        this.rpcCoinService.apiGetPDeState
      ),
    ];
    const [pTokens, chainTokens, chainPairs] = await Promise.all(tasks);

    if (!has(chainPairs, "PDEPoolPairs")) {
      // throw new CustomError(ErrorCode.FULLNODE_DOWN);
    }
    const oldPaymentAddress = this.getOldPaymentAddress();
    return mergeTokens({ chainTokens, pTokens, chainPairs, oldPaymentAddress });
  } catch (e) {
    throw e;
  }
}

function createPairId({ tokenID1, tokenID2 } = {}) {
  new Validator("tokenID1", tokenID1).required().string();
  new Validator("tokenID2", tokenID2).required().string();
  return `pdepool-${tokenID2}-${tokenID1}-${this.getPaymentAddress()}-${Date.now()}`;
}

function getKeyStoragePairId() {
  return `${STORAGE_KEYS.PAIR_ID}-${this.getPaymentAddress()}`;
}

async function getAllStoragePairIds() {
  try {
    const key = this.getKeyStoragePairId();
    return uniqBy((await this.getAccountStorage(key)) || [], "pairID");
  } catch (e) {
    throw e;
  }
}

async function setStoragePairId({ pairID, txId }) {
  new Validator("pairID", pairID).required().string();
  new Validator("txId", "txId").string();

  try {
    const key = this.getKeyStoragePairId();
    let pairTxs = (await this.getAllStoragePairIds()) || [];
    const index = pairTxs.findIndex((pair) => pair.pairID === pairID);
    if (index === -1) {
      pairTxs.push({
        pairID,
        txID1: txId,
      });
    } else {
      const pair = pairTxs[index];
      const txID1 = !!pair.txID1 ? pair.txID1 : txId;
      const txID2 = txID1 !== txId ? txId : "";
      pairTxs[index] = {
        pairID,
        txID1,
        txID2,
      };
    }
    await this.setAccountStorage(key, pairTxs);
  } catch (e) {
    throw e;
  }
}

export default {
  createAndSendTxWithContribution,
  createAndSendWithdrawContributionTx,
  createAndSendWithdrawContributionFeeTx,
  getKeyStoragePairId,
  getAllStoragePairIds,
  setStoragePairId,
  createPairId,
  getPairs,
};
