import { camelCaseKeys } from '@lib/utils/camelCaseKeys';
import { TX_STATUS_STR } from '@lib/module/Account/account.constants';
import Validator from '@lib/utils/validator';
import { TX_STAKING_TYPE_STR } from '@lib/module/PDexV3/features/Staking/Staking.constants';

export const formatStakingHistory = (item) => {
  new Validator("formatHistory-item", item).required().object();
  const history = camelCaseKeys(item);
  const statusStr = TX_STATUS_STR[history.status];
  const typeStr = TX_STAKING_TYPE_STR[history.type]
  return {
    ...history,
    statusStr,
    typeStr,
  }
}
