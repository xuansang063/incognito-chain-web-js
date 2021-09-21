import Validator from '@lib/utils/validator';
import { LIMIT_DEFAULT } from '@lib/module/PDexV3/features/Liquidity/liquidity.constant';
import { camelCaseKeys } from '@lib/utils/camelCaseKeys';

async function getContributeHistoriesApi({ offset = 0, limit = LIMIT_DEFAULT } = {}) {
  new Validator("getContributeHistoriesApi-offset", offset).number();
  new Validator("getContributeHistoriesApi-limit", limit).number();
  const nftIds = (await this.getNFTTokenIDs()) || [];
  const tasks = nftIds.map(nftId => (
    this.rpcTradeService.apiGetContributeHistories({ offset, limit, nftId })
  ))
  const history = camelCaseKeys(((await Promise.all(tasks))))
  return history
}

async function getRemoveLPHistoriesApi({ offset = 0, limit = LIMIT_DEFAULT } = {}) {
  new Validator("getLiquidityRemoveHistoriesApi-offset", offset).number();
  new Validator("getLiquidityRemoveHistoriesApi-limit", limit).number();
  const dataMap = (await this.mapNFIDWithFollowPool()) || [];
  const tasks = dataMap.map(param => (
    this.rpcCoinService.apiGetWithdrawContributeHistories({
      ...param,
      offset,
      limit,
    })
  ))
  const history = camelCaseKeys(((await Promise.all(tasks)) || []))
  return history
}

async function getWithdrawFeeLPHistoriesApi({ offset = 0, limit = LIMIT_DEFAULT } = {}) {
  new Validator("getLiquidityWithdrawFeeHistoriesApi-offset", offset).required().number();
  new Validator("getLiquidityWithdrawFeeHistoriesApi-limit", limit).number();
  const dataMap = (await this.mapNFIDWithFollowPool()) || [];
  const tasks = dataMap.map(param => (
    this.rpcCoinService.apiGetWithdrawFeeContributeHistories({
      ...param,
      offset,
      limit,
    })
  ))
  const history = camelCaseKeys(((await Promise.all(tasks)) || []))
  return history
}

export default {
  getContributeHistoriesApi,
  getRemoveLPHistoriesApi,
  getWithdrawFeeLPHistoriesApi,
};

