import { mappingStakingInfo } from '@lib/module/PDexV3/features/Staking/Staking.utils';
import flatten from 'lodash/flatten';
import { camelCaseKeys } from '@lib/utils/camelCaseKeys';

async function getStakingData() {
  const nftIDs = ['123'];
  const task = nftIDs.map(async (nftID) => {
    const res = (await this.rpcTradeService.apiGetStakingInfo({ nftID })) || {};
    return mappingStakingInfo({ object: res, nftID })
  });
  return flatten(await Promise.all(task));
}

async function getStakingPool() {
  return ((await this.rpcTradeService.apiGetStakingPool()) || []).map(item => camelCaseKeys(item));
}

export default ({
  getStakingData,
  getStakingPool,
})
