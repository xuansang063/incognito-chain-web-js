import Validator from '@lib/utils/validator';
import { LIMIT_DEFAULT } from '@lib/module/PDexV3/features/Liquidity/liquidity.constant';
import { camelCaseKeys } from '@lib/utils/camelCaseKeys';
import flatten from 'lodash/flatten';

async function getContributeHistoriesApi({ offset = 0, limit = LIMIT_DEFAULT } = {}) {
  new Validator("getContributeHistoriesApi-offset", offset).number();
  new Validator("getContributeHistoriesApi-limit", limit).number();
  const nftIds = (await this.getNFTTokenIDs()) || [];
  const tasks = nftIds.map(nftId => (
    this.rpcTradeService.apiGetContributeHistories({ offset, limit, nftId })
  ))
  const histories = camelCaseKeys(((await Promise.all(tasks)) || []).filter(item => !!item));
  return histories
}

async function getRemoveLPHistoriesApi({ offset = 0, limit = LIMIT_DEFAULT } = {}) {
  new Validator("getLiquidityRemoveHistoriesApi-offset", offset).number();
  new Validator("getLiquidityRemoveHistoriesApi-limit", limit).number();
  const nftIDs = (await this.getNFTTokenIDs()) || [];
  const tasks = nftIDs.map(async nftId => {
    const histories = await this.rpcTradeService.apiGetWithdrawContributeHistories({
      nftId,
      offset,
      limit,
    });
    if (!histories) return null;
    return histories.map(history => ({ ...history, nftId }))
  })
  let histories = flatten((await Promise.all(tasks)) || []).filter(item => !!item);
  histories = camelCaseKeys(histories || []);
  return histories;
}

async function getWithdrawFeeLPHistoriesApi({ offset = 0, limit = LIMIT_DEFAULT } = {}) {
  new Validator("getLiquidityWithdrawFeeHistoriesApi-offset", offset).required().number();
  new Validator("getLiquidityWithdrawFeeHistoriesApi-limit", limit).number();
  const nftIDs = (await this.getNFTTokenIDs()) || [];
  const tasks = nftIDs.map(async nftId => {
    const histories = await this.rpcTradeService.apiGetWithdrawFeeContributeHistories({
      nftId,
      offset,
      limit,
    });
    if (!histories) return null;
    return histories.map(history => ({ ...history, nftId }))
  })
  let histories = flatten((await Promise.all(tasks)) || []).filter(item => !!item);
  histories = camelCaseKeys(histories || []);
  return histories
}

export default {
  getContributeHistoriesApi,
  getRemoveLPHistoriesApi,
  getWithdrawFeeLPHistoriesApi,
};

