import bn from 'bn.js';
import {
  getBurningAddress,
  PaymentAddressType,
  PDEFeeWithdrawalRequestMeta,
  PDEPRVRequiredContributionRequestMeta,
  PDEWithdrawalRequestMeta,
  PRVIDSTR,
} from '@lib/core';
import { MAX_FEE_PER_TX, TX_STATUS, TX_TYPE } from '@lib/module/Account/account.constants';
import Validator from '@lib/utils/validator';
import { CACHE_KEYS, cachePromise } from '@lib/module/Account/features/Cache/cache';
import { has, uniqBy, uniq, flatten, isEmpty, minBy } from 'lodash';
import { mergeTokens } from '@lib/module/Account/features/Liquidity/liquidity.utils';

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
 */
async function createAndSendTxWithContribution({
  transfer: { fee = MAX_FEE_PER_TX, info = "", tokenID },
  extra: { pairID, contributedAmount, txHandler = undefined } = {},
}) {
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
      extra: { metadata, txType: TX_TYPE.ADD_LIQUIDITY, txHandler, txHashHandler },
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

async function getPairs() {
  try {
    const tasks = [
      await cachePromise(CACHE_KEYS.P_TOKEN, this.rpcApiService.apiGetPTokens),
      await cachePromise(CACHE_KEYS.CUSTOM_TOKEN, this.rpcApiService.apiGetCustomTokens),
      await cachePromise(CACHE_KEYS.PDE_STATE, this.rpcCoinService.apiGetPDeState),
    ];
    const [pTokens, chainTokens, chainPairs] = await Promise.all(tasks)

    if (!has(chainPairs, 'PDEPoolPairs')) {
      // throw new CustomError(ErrorCode.FULLNODE_DOWN);
    }
    const oldPaymentAddress = this.getOldPaymentAddress();
    return mergeTokens({ chainTokens, pTokens, chainPairs, oldPaymentAddress });
  } catch (e) {
    throw e;
  }
}

function createPairId ({ tokenID1, symbol1, tokenID2, symbol2 } = {}) {
  new Validator("createPairId-symbol1", symbol1).required().string();
  new Validator("createPairId-symbol2", symbol2).required().string();
  new Validator("createPairId-tokenID1", tokenID1).required().string();
  new Validator("createPairId-tokenID2", tokenID2).required().string();
  const paymentAddress = this.getPaymentAddress();
  const suffixAddress = paymentAddress.substring(paymentAddress.length - 5, paymentAddress.length);
  return `add-${tokenID1}-${symbol1}-${tokenID2}-${symbol2}-${suffixAddress}-${Date.now()}`;
}

function getKeyStoragePairId() {
  return `${STORAGE_KEYS.PAIR_ID}-${this.getPaymentAddress()}`;
}

async function getAllStoragePairIds () {
  try {
    const key = this.getKeyStoragePairId();
    return uniqBy((await this.getAccountStorage(key) || []), 'pairID');
  } catch (e) {
    throw e;
  }
}

async function setStoragePairId({ pairID, txId, tokenID }) {
  new Validator("setStoragePairId-pairID", pairID).required().string();
  new Validator("setStoragePairId-txId", txId).string();
  new Validator("setStoragePairId-tokenID", tokenID).string();

  try {
    const key = this.getKeyStoragePairId();
    let pairTxs = (await this.getAllStoragePairIds()) || [];
    const index = pairTxs.findIndex(pair => pair.pairID === pairID);
    if (index === -1) {
      pairTxs.push({
        pairID,
        txID1: txId,
        createTime1: Date.now(),
        tokenIDs: [tokenID]
      })
    } else {
      const pair = pairTxs[index];
      const txID1 = !!pair.txID1 ? pair.txID1 : txId;
      const txID2 = txID1 !== txId ? txId : '';
      pairTxs[index] = {
        ...pair,
        pairID,
        txID1,
        txID2,
        createTime2: Date.now(),
        tokenIDs: (pair.tokenIDs || []).concat(tokenID)
      }
    }
    await this.setAccountStorage(key, pairTxs);
  } catch (e) {
    throw e;
  }
}

async function getContributeHistories({ offset = 0, limit = 50 } = {}) {
  new Validator("getContributeHistory-offset", offset).required().number();
  new Validator("getContributeHistory-limit", limit).number();
  return this.rpcCoinService2.apiGetContributeHistories({
    offset,
    limit,
    paymentAddress: this.getPaymentAddress()
  });
}

async function getLiquidityRemoveHistories({ offset = 0, limit = 50 } = {}) {
  new Validator("getLiquidityRemoveHistories-offset", offset).required().number();
  new Validator("getLiquidityRemoveHistories-limit", limit).number();
  return this.rpcCoinService2.apiGetLiquidityRemoveHistories({
    offset,
    limit,
    paymentAddress: this.getPaymentAddress()
  });
}

async function getLiquidityWithdrawFeeHistories({ offset = 0, limit = 50 } = {}) {
  new Validator("getLiquidityWithdrawFeeHistories-offset", offset).required().number();
  new Validator("getLiquidityWithdrawFeeHistories-limit", limit).number();
  return this.rpcCoinService2.apiGetLiquidityWithdrawFeeHistories({
    offset,
    limit,
    paymentAddress: this.getPaymentAddress()
  });
}

async function getContributeHistoriesWithStorage({ offset = 0, limit = 50 } = {}) {
  new Validator("getContributeHistoriesWithStorage-offset", offset).required().number();
  new Validator("getContributeHistoriesWithStorage-limit", limit).required().number();

  const startTime = Date.now();
  const tasks = [
    await this.getContributeHistories({ limit, offset }),
    await this.getAllStoragePairIds(),
  ];
  let [contributes, storagePairs] = await Promise.all(tasks);

  let apiPairIds = (contributes || []).reduce((pairIds, curr ) => {
    const { pairId } = curr;
    pairIds.push(pairId)
    return pairIds;
  }, []);

  const {
    spendingPairIds
  } = storagePairs.reduce((prv, curr) => {
    const { spendingPairIds } = prv
    const { pairID } = curr;
    const isExist = apiPairIds.some(apiPairId => apiPairId === pairID);
    if (!isExist) {
      spendingPairIds.push(pairID)
    }
    return prv;
  }, {
    spendingPairIds: []
  });

  const tokenIds = uniq(storagePairs.reduce((prvValue, curr) => {
    prvValue = prvValue.concat(curr?.tokenIDs || []);
    return prvValue;
  }, []))

  const storageContributeTasks = tokenIds.map(async (tokenId) => {
    let histories = (await this.getTransactorHistoriesByTokenID({ tokenId })) || [];
    histories.filter((item) => {
      return item?.txType === TX_TYPE.ADD_LIQUIDITY;
    });
    const tasks = histories.map(async (history) => {
      let status;
      if (history.createdAt && Date.now() - history.createdAt < 3 * 60 * 1000) {
        status = TX_STATUS.TXSTATUS_PENDING;
      } else {
        status = await this.rpcTxService.apiGetTxStatus({ txId: history?.txId });
      }
      return { ...history, status }
    })
    return await Promise.all(tasks);
  });

  const storageContributeTxs = flatten(await Promise.all(storageContributeTasks));

  const pairIds = contributes.reduce((prv, apiHistory) => {
    const { pairId } = apiHistory;
    if (!prv.includes(pairId)) {
      prv.push(pairId);
    }
    return prv;
  }, []);

  const contributeHistories = pairIds.map(pairId => {
    const _contributes = contributes.filter(item => item.pairId === pairId);
    const txHashs = _contributes.reduce((prev, item) => {
      prev.push(item.requestTx)
      return prev
    }, []);
    const subContribute = storageContributeTxs.reduce((prv, item) => {
      let metaData;
      if (item?.tx?.Tx) {
        metaData = item?.tx?.Tx?.Metadata
      }
      if (item?.tx?.Metadata) {
        metaData = item?.tx?.Metadata;
      }
      const { hash: txHash, status } = item
      if (metaData && !txHashs.includes(txHash) && metaData?.PDEContributionPairID === pairId) {
        return {
          tokenId: metaData?.TokenIDStr,
          pairId: metaData?.PDEContributionPairID,
          amount: metaData?.ContributedAmount,
          paymentAddress: metaData?.ContributorAddressStr,
          requestTx: txHash,
          blockTime: item?.tx?.Tx?.LockTime,
          status,
          isStorage: true,
        }
      }
      return prv;
    }, {})
    if (!isEmpty(subContribute)) {
      _contributes.push(subContribute)
    }
    return {
      pairId,
      contributes: _contributes,
      blockTime: minBy(_contributes, 'blockTime')?.blockTime,
    };
  });

  const storageContributes = spendingPairIds.reduce((prev, pairId) => {
    let contributes = storageContributeTxs.filter(item => {
      let metaData;
      if (item?.tx?.Tx) {
        metaData = item?.tx?.Tx?.Metadata
      }
      if (item?.tx?.Metadata) {
        metaData = item?.tx?.Metadata;
      }
      return metaData?.PDEContributionPairID === pairId;
    });
    if (contributes.length > 0) {
      contributes = contributes.map((item) => {
        let metaData;
        let tx;
        if (item?.tx?.Tx) {
          tx = item?.tx?.Tx
          metaData = tx.Metadata;
        }
        if (item?.tx?.Metadata) {
          tx = item?.tx;
          metaData = tx.Metadata;
        }
        const { hash: txHash, status } = item
        return {
          tokenId: metaData?.TokenIDStr,
          pairId: metaData?.PDEContributionPairID,
          amount: metaData?.ContributedAmount,
          paymentAddress: metaData?.ContributorAddressStr,
          requestTx: txHash,
          blockTime: tx?.LockTime,
          status,
        }
      })
      prev.push({
        pairId,
        contributes,
        blockTime: minBy(contributes, 'blockTime')?.blockTime,
      })
    }
    return prev;
  }, []);

  const endTime = Date.now();
  console.debug("=======================================");
  console.debug('Log time: Contribute', endTime - startTime);
  console.debug('Log contributes: ', contributes);
  console.debug('Log contributeHistories: ', contributeHistories);
  console.debug('Log storageContributes: ', storageContributes);
  console.debug('Log storageContributeTxs: ', storageContributeTxs);
  console.debug('Log storagePairs: ', storagePairs);
  console.debug('Log tokenIds: ', tokenIds);
  console.debug("=======================================");

  return {
    contributeHistories,
    storageContributes
  }
}

async function getLiquidityWithdrawHistoriesWithStorage({ offset = 0, limit = 50 } = {}) {
  new Validator("getLiquidityWithdrawHistoriesWithStorage-offset", offset).required().number();
  new Validator("getLiquidityWithdrawHistoriesWithStorage-limit", limit).required().number();
  const startTime = Date.now();
  const tasks = [
    await this.getLiquidityRemoveHistories({ offset, limit }),
    await this.getTransactorHistoriesByTokenID({ tokenId: PRVIDSTR })
  ];
  const [apiHistories, storageHistories] = await Promise.all(tasks)

  let spendingStorage = (storageHistories || []).filter(history => {
    const isExist = apiHistories.some(apiHistory => apiHistory?.requestTx === history?.txId);
    const isWithdrawFee = history?.txType === TX_TYPE.WITHDRAW_LIQUIDITY;
    return !isExist && isWithdrawFee;
  });

  const tasksStorage = spendingStorage.map(async (history) => {
    const { metadata, txId, tx } = history;
    const status = await this.rpcTxService.apiGetTxStatus({ txId });
    const { WithdrawalShareAmt: amount1, WithdrawalToken1IDStr: tokenId1, WithdrawalToken2IDStr: tokenId2 } = metadata;
    return {
      id: txId,
      requestTx: txId,
      amount1,
      tokenId1,
      tokenId2,
      status,
      blockTime: tx?.LockTime,
    }
  })
  spendingStorage = flatten(await Promise.all(tasksStorage))

  const endTime = Date.now();

  console.debug("=======================================");
  console.debug('Log time: Withdraw ', endTime - startTime);
  console.debug('Log apiHistories ', apiHistories);
  console.debug('Log spendingStorage withdraw ', spendingStorage);
  console.debug("=======================================");

  return {
    apiHistories,
    spendingStorage,
  }
}

async function getLiquidityWithdrawFeeHistoriesWithStorage({ offset = 0, limit = 50 } = {}) {
  new Validator("getLiquidityWithdrawFeeHistoriesWithStorage-offset", offset).required().number();
  new Validator("getLiquidityWithdrawFeeHistoriesWithStorage-limit", limit).required().number();
  const startTime = Date.now();
  const tasks = [
    await this.getLiquidityWithdrawFeeHistories({ offset, limit }),
    await this.getTransactorHistoriesByTokenID({ tokenId: PRVIDSTR })
  ];
  const [apiHistories, storageHistories] = await Promise.all(tasks)

  let spendingStorage = (storageHistories || []).filter(history => {
    const isExist = apiHistories.some(apiHistory => apiHistory?.requestTx === history?.txId);
    const isWithdrawFee = history?.txType === TX_TYPE.WITHDRAW_LIQUIDITY_FEE;
    return !isExist && isWithdrawFee;
  });


  const tasksStorage = spendingStorage.map(async (history) => {
    const { metadata, txId, tx } = history;
    const status = await this.rpcTxService.apiGetTxStatus({ txId });
    const { WithdrawalFeeAmt: amount, WithdrawalToken1IDStr: tokenId1, WithdrawalToken2IDStr: tokenId2 } = metadata;
    return {
      id: txId,
      requestTx: txId,
      amount,
      tokenId1,
      tokenId2,
      status,
      blockTime: tx?.LockTime,
    }
  })
  spendingStorage = flatten(await Promise.all(tasksStorage))

  const endTime = Date.now();

  console.debug("=======================================");
  console.debug('Log time: Withdraw Fee ', endTime - startTime);
  console.debug('Log apiHistories ', apiHistories);
  console.debug('Log spendingStorage fee ', spendingStorage);
  console.debug("=======================================");

  return {
    apiHistories,
    spendingStorage,
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
  getContributeHistories,
  getLiquidityRemoveHistories,
  getLiquidityWithdrawFeeHistories,
  getContributeHistoriesWithStorage,
  getLiquidityWithdrawHistoriesWithStorage,
  getLiquidityWithdrawFeeHistoriesWithStorage
};
