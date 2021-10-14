import { mappingStakingInfo } from '@lib/module/PDexV3/features/Staking/staking.utils';
import flatten from 'lodash/flatten';
import { camelCaseKeys } from '@lib/utils/camelCaseKeys';

async function getStakingData() {
  const nftIDs = (await this.getNFTTokenIDs()) || [];
  const task = nftIDs.map(async (nftID) => {
    const res = (await this.rpcTradeService.apiGetStakingInfo({ nftID })) || [];
    return (camelCaseKeys(res) || []).map(item => mappingStakingInfo({ object: item, nftID }))
  });
  return flatten(await Promise.all(task)).filter(item => !!item);
}

async function getStakingPool() {
  return ((await this.rpcTradeService.apiGetStakingPool()) || []).map(item => {
    return camelCaseKeys(item)
  });
}

export default ({
  getStakingData,
  getStakingPool,
})
