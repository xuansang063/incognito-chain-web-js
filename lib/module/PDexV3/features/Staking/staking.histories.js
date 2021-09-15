import { mappingStakingHistories } from '@lib/module/PDexV3/features/Staking/staking.utils';
import Validator from '@lib/utils/validator';
import uniqBy from 'lodash/uniqBy';
import orderBy from 'lodash/orderBy';

async function serviceStakingHistories({ tokenID, nftID }) {
  new Validator('getStakingHistories-tokenID', tokenID).required().string();
  new Validator('getStakingHistories-nftID', nftID).required().string();
  const histories = await this.rpcTradeService.apiGetStakingHistories({ tokenID, nftID })
  return mappingStakingHistories(histories || []);
}

async function serviceStakingRewardHistories({ tokenID, nftID }) {
  new Validator('serviceStakingRewardHistories-tokenID', tokenID).required().string();
  new Validator('serviceStakingRewardHistories-nftID', nftID).required().string();
  const histories = await this.rpcTradeService.apiGetStakingRewardHistories({ tokenID, nftID })
  console.log('histories:', histories)
  return mappingStakingHistories(histories || []);
}

async function getStakingHistories({ tokenID, nftID }) {
  new Validator('serviceStakingRewardHistories-tokenID', tokenID).required().string();
  new Validator('serviceStakingRewardHistories-nftID', nftID).required().string();
  const tasks = [
    await this.serviceStakingHistories({ tokenID, nftID }),
    await this.serviceStakingRewardHistories({ tokenID, nftID }),
  ];
  const [staking, reward] = await Promise.all(tasks)
  return orderBy(uniqBy((staking || []).concat((reward || [])), 'requestTx'), 'requestTime', ['desc'])
}

export default ({
  getStakingHistories,
  serviceStakingHistories,
  serviceStakingRewardHistories,
})
