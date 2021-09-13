import { camelCaseKeys } from '@lib/utils/camelCaseKeys';
import Validator from '@lib/utils/validator';
import {
  TX_STAKING_STATUS_STR,
  TX_STAKING_TYPE,
  TX_STAKING_TYPE_STR
} from '@lib/module/PDexV3/features/Staking/Staking.constants';

const mappingStakingType = (key) => {
  if (key === true) {
    return TX_STAKING_TYPE.WITHDRAW_STAKING
  } else if (key === false) {
    return TX_STAKING_TYPE.STAKING
  } else {
    return TX_STAKING_TYPE.WITHDRAW_REWARD
  }
};

export const mappingStakingHistories = (histories) => {
  new Validator("formatHistory-histories", histories).required().array();
  return histories.map(history => {
    history = camelCaseKeys(history);
    const { isStaking } = history;
    const typeStr = TX_STAKING_TYPE_STR[mappingStakingType(isStaking)];
    const statusStr = TX_STAKING_STATUS_STR[history.status];
    return {
      ...history,
      typeStr,
      statusStr,
    }
  })
};

export const mappingStakingInfo = ({ object, nftID }) => {
  new Validator("mappingStakingInfo-object", object).required().object();
  new Validator("mappingStakingInfo-nftID", nftID).required().string();
  return Object.keys(object).map(tokenID => {
    const data = camelCaseKeys(object[tokenID]);
    return {
      ...data,
      id: `${tokenID}-${nftID}`,
      tokenId: tokenID,
      nftId: nftID,
    }
  })
}
