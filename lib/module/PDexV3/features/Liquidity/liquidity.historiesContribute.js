import Validator from '@lib/utils/validator';
import { LIMIT_DEFAULT } from '@lib/module/PDexV3/features/Liquidity/liquidity.constant';
import flatten from 'lodash/flatten';
import uniq from 'lodash/uniq';
import difference from 'lodash/difference';
import { PrivacyVersion, TX_STATUS } from '@lib/wallet';
import { CONTRIBUTE_HISTORIES_TX_STR, CONTRIBUTE_STATUS_TYPE, TX_TYPE } from '@lib/module/Account';
import { maxBy } from 'lodash';

async function getPairHashContribute() {
  const storageHashs = (await this.getStoragePairHash()) || [];
  return storageHashs.reduce((prev, curr) => {
    const { pairHashs: hashs, tokenIds: prevTokensIds } = prev;
    const { pairHash, tokenIds: currTokenIds } = curr;
    hashs.push(pairHash)
    const diff = difference(currTokenIds, prevTokensIds);
    return {
      pairHashs: uniq(hashs),
      tokenIds: prevTokensIds.concat(diff)
    }
  }, { pairHashs: [], tokenIds: [] });
}

async function getTxsContributeStorage({ csvTxIds, tokenIds }) {
  new Validator("getTxsContributeStorage-csvTxIds", csvTxIds).required().array();
  new Validator("getTxsContributeStorage-tokenIds", tokenIds).required().array();
  const txsHistories = flatten(await Promise.all(tokenIds.map(async (tokenID) => {
    let histories = (await this.account.getTransactorHistoriesByTokenID({ version: PrivacyVersion.ver2, tokenID })) || [];
    histories = histories.filter(history => (
      history.txType === TX_TYPE.CONTRIBUTE && !csvTxIds.includes(history.txId)
    ))
    return await Promise.all(
      histories.map(async (history) => {
        const metaData = history?.metadata || {};
        const { createdAt, txId } = history;
        let status;
        if (history.createdAt && (Date.now() - createdAt) < (2 * 60 * 1000)) {
          status = TX_STATUS.TXSTATUS_PENDING;
        } else {
          status = await this.account?.rpcTxService.apiGetTxStatus({ txId });
        }
        return {
          requestTx: txId,
          requestTime: createdAt,
          tokenId: tokenID,
          poolId: metaData?.PoolPairID,
          pairHash: metaData?.PairHash,
          nftId: metaData?.NftID,
          amp: metaData?.Amplifier,
          contributeAmount: metaData.TokenAmount,
          status,
        }
      })
    );
  })));
  return txsHistories;
}

async function getContributeHistories({ offset = 0, limit = LIMIT_DEFAULT } = {}) {
  new Validator("getContributeHistories-offset", offset).required().number();
  new Validator("getContributeHistories-limit", limit).required().number();
  const { pairHashs, tokenIds } = await this.getPairHashContribute();
  let [csvHistories] = await Promise.all([
    await this.getContributeHistoriesApi(),
  ]);
  csvHistories = (flatten((csvHistories || [])) || []).filter(item => !!item);
  const csvTxIds = uniq(flatten(csvHistories.map(history => history.requestTxs)))
  const csvPairHashs = uniq(flatten(csvHistories.map(history => history.pairHash)))
  const storageHistories = (await this.getTxsContributeStorage({ tokenIds, csvTxIds })) || [];
  csvHistories = csvHistories.map(history => {
    const { pairHash, requestTxs, status } = history;
    const storageContribute = storageHistories.filter(({pairHash: _pairHash, requestTx: _requestTx}) => {
      return (pairHash === _pairHash && !requestTxs.includes(_requestTx))
    })
    return {
      ...history,
      storageContribute,
      statusStr: CONTRIBUTE_HISTORIES_TX_STR[status]
    }
  })
  const diffPairHashs = difference(pairHashs, csvPairHashs) || [];
  const diffHistories = diffPairHashs.map(pairHash => {
    const histories = storageHistories.filter(({ pairHash: _pairHash }) => pairHash === _pairHash);
    const contributeAmount = histories.map(history => history.contributeAmount);
    const contributeTokens = histories.map(history => history.tokenId);
    const requestTxs = histories.map(history => history.requestTx);
    const allStatus = histories.map(history => history.requestTx);
    let status;
    if (allStatus.includes(TX_STATUS.TXSTATUS_PENDING) || allStatus.includes(TX_STATUS.PROCESSING)) {
      status = CONTRIBUTE_STATUS_TYPE.WAITING;
    } else if (allStatus.includes(TX_STATUS.TXSTATUS_SUCCESS)) {
      status = CONTRIBUTE_STATUS_TYPE.COMPLETED;
    } else {
      status = CONTRIBUTE_STATUS_TYPE.FAIL;
    }
    return {
      contributeAmount,
      contributeTokens,
      pairId: '',
      poolId: histories[0].poolId,
      pairHash,
      requestTime: maxBy(histories, 'requestTime'),
      status,
      statusStr: CONTRIBUTE_HISTORIES_TX_STR[status],
      requestTxs,
    }
  })
  console.log('SANG TEST: csvHistories', csvHistories)
  console.log('SANG TEST: diffHistories', diffHistories)
  console.log('SANG TEST: pairHashs', pairHashs);
  console.log('SANG TEST: tokenIds', tokenIds)
  return csvHistories;
}

export default ({
  getPairHashContribute,
  getTxsContributeStorage,
  getContributeHistories,
})
