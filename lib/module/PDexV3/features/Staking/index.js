import data from '@lib/module/PDexV3/features/Staking/staking.data';
import histories from '@lib/module/PDexV3/features/Staking/staking.histories';
import transactions from '@lib/module/PDexV3/features/Staking/staking.transaction';
import storage from '@lib/module/PDexV3/features/Staking/staking.storage';

export default {
  ...data,
  ...histories,
  ...transactions,
  ...storage,
}
