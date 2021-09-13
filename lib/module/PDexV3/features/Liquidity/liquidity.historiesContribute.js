import Validator from '@lib/utils/validator';
import { PrivacyVersion } from '@lib/core/constants';
import {
  CONTRIBUTE_STATUS,
  CONTRIBUTE_STATUS_STR,
  CONTRIBUTE_STATUS_TYPE,
  TX_STATUS,
  TX_TYPE
} from '@lib/module/Account/account.constants';
import { LIMIT_DEFAULT } from '@lib/module/PDexV3/features/Liquidity/liquidity.constant';
import orderBy from 'lodash/orderBy';
import flatten from 'lodash/flatten';
import isEmpty from 'lodash/isEmpty';
import maxBy from 'lodash/maxBy';
import uniq from 'lodash/uniq';
import uniqBy from 'lodash/uniqBy';
import difference from 'lodash/difference';

async function getStorageContributeTxs({ tokenIDs }) {
  new Validator("getStorageContributeTxs-tokenIDs", tokenIDs).required().array();
  const account = this.getAccount()
  const tasks = tokenIDs.map(async (tokenID) => {
    let histories = (await account.getTransactorHistoriesByTokenID({
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
        status = await account.rpcTxService.apiGetTxStatus({ txId });
      }
      return { ...history, status }
    })
    return await Promise.all(tasks);
  });
  return flatten(await Promise.all(tasks))
}

function mapperContributeTxsServiceWithStorage({
  pairIDs,
  contributes,
  storageContributeTxs
} = {}) {
  new Validator("mapperContributeTxsServiceWithStorage-pairIDs", pairIDs).required().array();
  new Validator("mapperContributeTxsServiceWithStorage-contributes", contributes).required().array();
  new Validator("mapperContributeTxsServiceWithStorage-storageContributeTxs", storageContributeTxs).required().array();
  return pairIDs.map(pairID => {
    let _contributes = contributes.filter(item => item.pairID === pairID);
    const txHashs = _contributes.map((item) => item.requestTx);
    const subContribute = storageContributeTxs.reduce((prev, item) => {
      const { hash: txHash, status, metadata: metaData } = item
      if (metaData && !txHashs.includes(txHash) && metaData?.PDEContributionPairID === pairID) {
        const contributeStorage = {
          tokenId: metaData?.TokenIDStr,
          pairID: metaData?.PDEContributionPairID,
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
      pairID,
      contributes: _contributes,
      lockTime: maxBy(_contributes, 'lockTime')?.lockTime,
    };
  });
}

function mapperStorageContributeTxsWithoutService({
  pairIDs,
  storageContributeTxs
}) {
  new Validator("mapperStorageContributeTxsWithoutService-pairIDs", pairIDs).required().array();
  new Validator("mapperStorageContributeTxsWithoutService-storageContributeTxs", storageContributeTxs).required().array();
  return pairIDs.reduce((prev, pairID) => {
    let contributes = storageContributeTxs.filter(item => {
      const { metadata: metaData } = item
      return metaData?.PDEContributionPairID === pairID;
    });
    if (contributes.length > 0) {
      contributes = contributes.map((item) => {
        const { hash: txHash, status, metadata: metaData, lockTime } = item
        return {
          tokenId: metaData?.TokenIDStr,
          pairID: metaData?.PDEContributionPairID,
          amount: metaData?.ContributedAmount,
          paymentAddress: metaData?.ContributorAddressStr,
          requestTx: txHash,
          lockTime: lockTime,
          status,
        }
      })
      prev.push({
        pairID,
        contributes,
        lockTime: maxBy(contributes, 'lockTime')?.lockTime,
      })
    }
    return prev;
  }, []);
}

function mapperContributes(contributes) {
  let statusText;
  contributes = contributes.map(item => ({
    ...item,
    status: CONTRIBUTE_STATUS_TYPE[item?.status]
  }))
  const allStatus = contributes.map(item => item.status);
  if (allStatus.includes(CONTRIBUTE_STATUS.MATCHED) || allStatus.includes(CONTRIBUTE_STATUS.MATCHED_N_RETURNED)) {
    statusText = CONTRIBUTE_STATUS_STR.SUCCESSFUL;
  } else if (allStatus.includes(CONTRIBUTE_STATUS.REFUND)) {
    statusText = CONTRIBUTE_STATUS_STR.REFUNDED;
  } else if (allStatus.includes(CONTRIBUTE_STATUS.WAITING)) {
    statusText = CONTRIBUTE_STATUS_STR.WAITING;
  } else {
    statusText = CONTRIBUTE_STATUS_STR.FAILED;
  }
  return {
    contributes,
    statusText,
    allStatus
  }
}

function mapperRetryTxs({ pairID, contributes, statusText }) {
  let tokenIdsFromPairId = [];
  if (pairID.split('-').length === 7) {
    tokenIdsFromPairId = [pairID.split('-')[1], pairID.split('-')[3]];
  }
  let tokenIds = uniq(contributes.map(item => item.tokenId).concat(tokenIdsFromPairId));
  const storageContributes = contributes.filter(item => item.isStorage === true);

  let inputTokenId;
  let inputAmount;
  let outputTokenId;
  let outputAmount;
  if (tokenIds.length === 1) {
    inputTokenId = tokenIds[0];
    inputAmount = (contributes.find(contribute => contribute.tokenId === inputTokenId) || {})?.amount;
  } else if (tokenIds.length > 1) {
    inputTokenId = tokenIds[0];
    inputAmount = (contributes.find(contribute => contribute.tokenId === inputTokenId) || {})?.amount;
    outputTokenId = tokenIds[1];
    outputAmount = (contributes.find(contribute => contribute.tokenId === outputTokenId) || {})?.amount;
  }

  let refundTokenID;
  let refundAmount;
  let retryTokenID;
  let retryAmount;
  const waitingTokens = contributes.filter(contribute =>
    (contribute.status).toLowerCase() === CONTRIBUTE_STATUS.WAITING.toLowerCase());
  if (statusText === CONTRIBUTE_STATUS_STR.WAITING && waitingTokens.length === 1) {
    /** filter refund */
    refundTokenID = (inputAmount && inputTokenId) ? inputTokenId : outputTokenId;
    refundAmount = (inputAmount && inputTokenId) ? inputAmount : outputAmount;

    /** filter retry */
    const retryTokenFilter = tokenIds.filter(tokenID => tokenID !== refundTokenID);
    if (retryTokenFilter && retryTokenFilter.length > 0) {
      retryTokenID = retryTokenFilter[0];
    }
    if (retryTokenID && storageContributes.length > 0) {
      retryAmount = storageContributes.find(item => item.tokenId === retryTokenID)?.amount;
    }
  }
  return {
    tokenIds,
    refundTokenID,
    refundAmount,
    retryTokenID,
    retryAmount,
    showRetry: !!retryTokenID && !!retryAmount,
    showRefund: !!refundTokenID,
  }
}

function mapperHistories({ mapContributesService, mapContributesStorage }) {
  new Validator("mapperHistories-mapContributesService", mapContributesService).required().array();
  new Validator("mapperHistories-mapContributesStorage", mapContributesStorage).required().array();
  const histories = orderBy(mapContributesService.concat(mapContributesStorage), 'lockTime', ['desc']);
  return histories.map(history => {
    let { contributes, statusText, allStatus } = this.mapperContributes(history?.contributes)
    let retryData = this.mapperRetryTxs({
      pairID: history?.pairID,
      contributes,
      statusText,
    })
    return {
      ...history,
      ...retryData,
      statusText,
      allStatus,
      contributes,
    };
  })
}

async function getContributeHistories({
  offset = 0,
  limit = LIMIT_DEFAULT,
  oldApiHistories = [],
} = {}) {
  new Validator("getContributeHistories-offset", offset).required().number();
  new Validator("getContributeHistories-limit", limit).required().number();
  new Validator("getContributeHistories-oldApiHistories", oldApiHistories).required().array();
  const tasks = [
    await this.getContributeHistoriesApi({ limit, offset }),
    await this.getAllStoragePairIds(),
  ];
  let [newOriginalContributes, storagePairs] = await Promise.all(tasks);
  const contributesService = uniqBy(newOriginalContributes.concat(oldApiHistories), "id");

  const storagePairIDs  = uniq(storagePairs.map(item => item?.pairID));
  const apiPairIDs      = uniq(contributesService.map(item => item?.pairID));
  const diffPairIDs     = difference(storagePairIDs, apiPairIDs)

  const tokenIDs        = uniq(flatten(storagePairs.map(item => item?.tokenIDs)));

  const storageContributeTxs = await this.getStorageContributeTxs({ tokenIDs });

  const mapContributesService = this.mapperContributeTxsServiceWithStorage({
    pairIDs: apiPairIDs,
    contributes: contributesService,
    storageContributeTxs
  }) || [];

  const mapContributesStorage = this.mapperStorageContributeTxsWithoutService({
    pairIDs: diffPairIDs,
    storageContributeTxs
  }) || [];

  const histories = this.mapperHistories({
    mapContributesService,
    mapContributesStorage,
  })
  console.log('histories: ', histories)
  return histories;
}

export default ({
  getStorageContributeTxs,
  mapperContributeTxsServiceWithStorage,
  mapperStorageContributeTxsWithoutService,
  mapperContributes,
  mapperRetryTxs,
  mapperHistories,
  getContributeHistories,
})
