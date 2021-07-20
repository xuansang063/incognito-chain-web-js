import Validator from '@lib/utils/validator';
import { flatten, isEmpty, maxBy, uniq, uniqBy } from 'lodash';
import { PrivacyVersion, PRVIDSTR } from '@lib/core/constants';
import { TX_STATUS, TX_TYPE } from '@lib/module/Account/account.constants';

async function getContributeHistories({ offset = 0, limit = 50 } = {}) {
  new Validator("getContributeHistory-offset", offset).required().number();
  new Validator("getContributeHistory-limit", limit).number();
  return this.rpcCoinService.apiGetContributeHistories({
    offset,
    limit,
    paymentAddress: this.getPaymentAddress()
  });
}

async function getLiquidityRemoveHistories({ offset = 0, limit = 50 } = {}) {
  new Validator("getLiquidityRemoveHistories-offset", offset).required().number();
  new Validator("getLiquidityRemoveHistories-limit", limit).number();
  return this.rpcCoinService.apiGetLiquidityRemoveHistories({
    offset,
    limit,
    paymentAddress: this.getPaymentAddress()
  });
}

async function getLiquidityWithdrawFeeHistories({ offset = 0, limit = 50 } = {}) {
  new Validator("getLiquidityWithdrawFeeHistories-offset", offset).required().number();
  new Validator("getLiquidityWithdrawFeeHistories-limit", limit).number();
  return this.rpcCoinService.apiGetLiquidityWithdrawFeeHistories({
    offset,
    limit,
    paymentAddress: this.getPaymentAddress()
  });
}

async function getContributeHistoriesWithStorage({
  offset = 0,
  limit = 50,
  oldApiHistories = [],
} = {}) {
  new Validator("getContributeHistoriesWithStorage-offset", offset).required().number();
  new Validator("getContributeHistoriesWithStorage-limit", limit).required().number();
  new Validator("getContributeHistoriesWithStorage-oldApiHistories", oldApiHistories).required().array();

  const startTime = Date.now();
  const tasks = [
    await this.getContributeHistories({ limit, offset }),
    await this.getAllStoragePairIds(),
  ];
  let [newOriginalContributes, storagePairs] = await Promise.all(tasks);

  const contributes = uniqBy(newOriginalContributes.concat(oldApiHistories), contribute => contribute.id);

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

  const storageContributeTasks = tokenIds.map(async (tokenID) => {
    let histories = (await this.getTransactorHistoriesByTokenID({
      tokenID,
      version: PrivacyVersion.ver2
    })) || [];
    histories = histories.filter((item) => item?.txType === TX_TYPE.ADD_LIQUIDITY);
    const tasks = histories.map(async (history) => {
      let status;
      const { createdAt, txId } = history;
      if (history.createdAt && (Date.now() - createdAt) < (2 * 60 * 1000)) {
        status = TX_STATUS.TXSTATUS_PENDING;
      } else {
        status = await this.rpcTxService.apiGetTxStatus({ txId });
      }
      return { ...history, status }
    })
    return await Promise.all(tasks);
  });

  const storageContributeTxs = flatten(await Promise.all(storageContributeTasks));

  const pairIds = contributes.reduce((prev, apiHistory) => {
    const { pairId } = apiHistory;
    if (!prev.includes(pairId)) {
      prev.push(pairId);
    }
    return prev;
  }, []);

  const contributeHistories = pairIds.map(pairId => {
    let _contributes = contributes.filter(item => item.pairId === pairId);
    const txHashs = _contributes.map((item) => item.requestTx);
    const subContribute = storageContributeTxs.reduce((prev, item) => {
      const { hash: txHash, status, metadata: metaData } = item
      if (metaData && !txHashs.includes(txHash) && metaData?.PDEContributionPairID === pairId) {
        const contributeStorage = {
          tokenId: metaData?.TokenIDStr,
          pairId: metaData?.PDEContributionPairID,
          amount: metaData?.ContributedAmount,
          paymentAddress: metaData?.ContributorAddressStr,
          requestTx: txHash,
          lockTime: item?.lockTime,
          status,
          isStorage: true,
        }
        prev.push(contributeStorage)
      }
      return prev;
    }, []);
    if (!isEmpty(subContribute)) {
      _contributes = _contributes.concat(subContribute)
    }
    return {
      pairId,
      contributes: _contributes,
      lockTime: maxBy(_contributes, 'lockTime')?.lockTime,
    };
  });

  const storageContributes = spendingPairIds.reduce((prev, pairId) => {
    let contributes = storageContributeTxs.filter(item => {
      const { metadata: metaData } = item
      return metaData?.PDEContributionPairID === pairId;
    });
    if (contributes.length > 0) {
      contributes = contributes.map((item) => {
        const { hash: txHash, status, metadata: metaData, lockTime } = item
        return {
          tokenId: metaData?.TokenIDStr,
          pairId: metaData?.PDEContributionPairID,
          amount: metaData?.ContributedAmount,
          paymentAddress: metaData?.ContributorAddressStr,
          requestTx: txHash,
          lockTime: lockTime,
          status,
        }
      })
      prev.push({
        pairId,
        contributes,
        lockTime: maxBy(contributes, 'lockTime')?.lockTime,
      })
    }
    return prev;
  }, []);

  const endTime = Date.now();
  console.debug("=======================================");
  console.debug('Log time: Contribute', endTime - startTime);
  console.debug('Log all contributes: ', contributes);
  console.debug('Log all newOriginalContributes: ', newOriginalContributes);
  console.debug('Log contributeHistories: ', contributeHistories);
  console.debug('Log storageContributes: ', storageContributes);
  console.debug('Log storageContributeTxs: ', storageContributeTxs);
  console.debug('Log storagePairs: ', storagePairs);
  console.debug('Log tokenIds: ', tokenIds);
  console.debug("=======================================");

  return {
    contributeHistories,
    storageContributes,
    newOriginalContributes,
  }
}

async function getLiquidityWithdrawHistoriesWithStorage({ offset = 0, limit = 50 } = {}) {
  new Validator("getLiquidityWithdrawHistoriesWithStorage-offset", offset).required().number();
  new Validator("getLiquidityWithdrawHistoriesWithStorage-limit", limit).required().number();
  const startTime = Date.now();
  const tasks = [
    await this.getLiquidityRemoveHistories({ offset, limit }),
    await this.getStorageHistoriesRemovePool()
  ];
  const [apiHistories, storageHistories] = await Promise.all(tasks)

  let spendingStorage = (storageHistories || []).filter(history => {
    const isExist = apiHistories.some(apiHistory => apiHistory?.requestTx === history?.requestTx);
    return !isExist;
  });

  const tasksStorage = spendingStorage.map(async (history) => {
    const { requestTx } = history;
    const status = await this.rpcTxService.apiGetTxStatus({ txId: requestTx });
    return {
      ...history,
      status,
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
    await this.getTransactorHistoriesByTokenID({ tokenID: PRVIDSTR, version: PrivacyVersion.ver2 })
  ];
  const [apiHistories, storageHistories] = await Promise.all(tasks)

  let spendingStorage = (storageHistories || []).filter(history => {
    const isExist = apiHistories.some(apiHistory => apiHistory?.requestTx === history?.txId);
    const isWithdraw = history?.txType === TX_TYPE.WITHDRAW_LIQUIDITY_FEE;
    return !isExist && isWithdraw;
  });


  const tasksStorage = spendingStorage.map(async (history) => {
    const { metadata, txId, lockTime } = history;
    const status = await this.rpcTxService.apiGetTxStatus({ txId });
    const { WithdrawalFeeAmt: amount, WithdrawalToken1IDStr: tokenId1, WithdrawalToken2IDStr: tokenId2 } = metadata;
    return {
      id: txId,
      requestTx: txId,
      amount,
      tokenId1,
      tokenId2,
      status,
      lockTime,
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
  getContributeHistories,
  getLiquidityRemoveHistories,
  getLiquidityWithdrawFeeHistories,
  getContributeHistoriesWithStorage,
  getLiquidityWithdrawHistoriesWithStorage,
  getLiquidityWithdrawFeeHistoriesWithStorage
};
