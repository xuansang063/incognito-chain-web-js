import { mappingStakingHistories } from '@lib/module/PDexV3/features/Staking/staking.utils';
import Validator from '@lib/utils/validator';
import uniqBy from 'lodash/uniqBy';
import orderBy from 'lodash/orderBy';
import uniq from "lodash/uniq";
import flatten from "lodash/flatten";

async function serviceStakingHistories({ tokenID, nftID }) {
  new Validator('getStakingHistories-tokenID', tokenID).required().string();
  new Validator('getStakingHistories-nftID', nftID).required().string();
  const histories = await this.rpcTradeService.apiGetStakingHistories({ tokenID, nftID });
  return mappingStakingHistories(histories || []);
}

async function serviceStakingRewardHistories({ tokenID, nftID }) {
  new Validator('serviceStakingRewardHistories-tokenID', tokenID).required().string();
  new Validator('serviceStakingRewardHistories-nftID', nftID).required().string();
  const histories = await this.rpcTradeService.apiGetStakingRewardHistories({ tokenID, nftID });
  return mappingStakingHistories(histories || []);
}

async function mapNFTWithStakingPool() {
  const [stakingPools, nftIds] = await Promise.all([
    await this.getStakingPool(),
    await this.getNFTTokenIDs(),
  ]);
  const tokenIds = uniq((stakingPools || []).map(item => item.tokenId))
  const arrayMap = flatten(tokenIds.map(tokenId =>
      nftIds.map(nftId => ({ tokenId, nftId }))
  ));
  return arrayMap || [];
}

async function getStakingHistories() {
  const params = (await this.mapNFTWithStakingPool()) || [];
  const tasks = params.map(async ({ tokenId, nftId }) => {
    const [staking, reward] = await Promise.all([
      await this.serviceStakingHistories({ tokenID: tokenId, nftID: nftId }),
      await this.serviceStakingRewardHistories({ tokenID: tokenId, nftID: nftId }),
    ]);
    return orderBy((staking || []).concat((reward || [])), 'requestTime', ['desc'])
  })
  return flatten(await Promise.all(tasks)).filter(item => !!item);
}

export default ({
  getStakingHistories,
  serviceStakingHistories,
  serviceStakingRewardHistories,
  mapNFTWithStakingPool,
})
