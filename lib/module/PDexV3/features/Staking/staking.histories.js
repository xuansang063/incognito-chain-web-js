import {mappingStakingHistories, mappingStakingType} from '@lib/module/PDexV3/features/Staking/staking.utils';
import Validator from '@lib/utils/validator';
import uniq from "lodash/uniq";
import flatten from "lodash/flatten";
import {
  MAP_STORAGE_STAKING_TX_STATUS,
  TX_STAKING_STATUS_STR,
  TX_STAKING_TYPE_STR,
} from "@lib/module/Account";
import orderBy from "lodash/orderBy";

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


async function mappingStorageStakingTxs (histories) {
  const tasks = histories.map(async history => {
    const { isStaking } = history;
    const typeStr = TX_STAKING_TYPE_STR[mappingStakingType(isStaking)];
    const status = await this.account?.rpcTxService.apiGetTxStatus({ txId: history.requestTx })
    history.status = MAP_STORAGE_STAKING_TX_STATUS[status];
    const statusStr = TX_STAKING_STATUS_STR[history.status];
    return {
      ...history,
      typeStr,
      statusStr,
    }
  })
  return Promise.all(tasks)
}


async function getStakingHistories() {
  const params = (await this.mapNFTWithStakingPool()) || [];
  let storageTsx = await this.getStorageStakingTxs();
  const tasks = params.map(async ({ tokenId, nftId }) => {
    const [staking, reward] = await Promise.all([
      await this.serviceStakingHistories({ tokenID: tokenId, nftID: nftId }),
      await this.serviceStakingRewardHistories({ tokenID: tokenId, nftID: nftId }),
    ]);
    return (staking || []).concat(reward || []);
  })
  const csvTsx = flatten((await Promise.all(tasks)).filter(item => !!item)).map(item => ({
    ...item,
    requestTime: item.requesttime,
  }));
  const requestTxs = uniq(csvTsx.map(item => item.requestTx))
  storageTsx = storageTsx.filter(({ requestTx }) => !requestTxs.includes(requestTx))
  await this.setStorageStakingTxs(storageTsx)
  storageTsx = await this.mappingStorageStakingTxs(storageTsx);
  return orderBy(storageTsx.concat(csvTsx), 'requestTime', 'desc');
}

export default ({
  getStakingHistories,
  serviceStakingHistories,
  serviceStakingRewardHistories,
  mapNFTWithStakingPool,
  mappingStorageStakingTxs,
})
