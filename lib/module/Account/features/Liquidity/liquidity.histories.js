import Validator from '@lib/utils/validator';
import { flatten, isEmpty, minBy, uniq, uniqBy } from 'lodash';
import { PrivacyVersion, PRVIDSTR } from '@lib/core/constants';
import { TX_STATUS, TX_TYPE } from '@lib/module/Account/account.constants';

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
    histories.filter((item) => {
      return item?.txType === TX_TYPE.ADD_LIQUIDITY;
    });
    const tasks = histories.map(async (history) => {
      let status;
      const { createdAt, txId } = history;
      if (history.createdAt && Date.now() - createdAt < 2 * 60 * 1000) {
        status = TX_STATUS.TXSTATUS_PENDING;
      } else {
        status = await this.rpcTxService.apiGetTxStatus({ txId });
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
    await this.getTransactorHistoriesByTokenID({ tokenID: PRVIDSTR, version: PrivacyVersion.ver2 })
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
    await this.getTransactorHistoriesByTokenID({ tokenID: PRVIDSTR, version: PrivacyVersion.ver2 })
  ];
  const [apiHistories, storageHistories] = await Promise.all(tasks)

  let spendingStorage = (storageHistories || []).filter(history => {
    const isExist = apiHistories.some(apiHistory => apiHistory?.requestTx === history?.txId);
    const isWithdraw = history?.txType === TX_TYPE.WITHDRAW_LIQUIDITY_FEE;
    return !isExist && isWithdraw;
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
  getContributeHistories,
  getLiquidityRemoveHistories,
  getLiquidityWithdrawFeeHistories,
  getContributeHistoriesWithStorage,
  getLiquidityWithdrawHistoriesWithStorage,
  getLiquidityWithdrawFeeHistoriesWithStorage
};
