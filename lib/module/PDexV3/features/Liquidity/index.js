import histories from '@lib/module/PDexV3/features/Liquidity/liquidity.histories';
import historiesService from '@lib/module/PDexV3/features/Liquidity/liquidity.historiesService';
import storage from '@lib/module/PDexV3/features/Liquidity/liquidity.storage';
import transaction from '@lib/module/PDexV3/features/Liquidity/liquidity.transaction';
import historiesContribute from '@lib/module/PDexV3/features/Liquidity/liquidity.historiesContribute';
import historiesRemovePool from '@lib/module/PDexV3/features/Liquidity/liquidity.historiesRemovePool';
import historiesWithdrawReward from '@lib/module/PDexV3/features/Liquidity/liquidity.historiesWithdrawReward';

export default {
  ...histories,
  ...historiesService,
  ...storage,
  ...transaction,
  ...historiesContribute,
  ...historiesRemovePool,
  ...historiesWithdrawReward,
};
