import { camelCaseKeys } from '@lib/utils/camelCaseKeys';
import Validator from '@lib/utils/validator';
import {TX_STAKING_TYPE, TX_STAKING_TYPE_STR, TX_STAKING_STATUS_STR} from "@lib/module/Account";

export const mappingStakingType = (key) => {
  if (key === true) {
    return TX_STAKING_TYPE.STAKING
  } else if (key === false) {
    return TX_STAKING_TYPE.WITHDRAW_STAKING
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
  let item = object;
  const { tokenid: tokenId } = item
  item = {
    ...item,
    id: `${tokenId}-${nftID}`,
    tokenId,
    nftId: nftID,
  }
  delete item['nftid'];
  delete item['tokenid'];
  return item;
}
