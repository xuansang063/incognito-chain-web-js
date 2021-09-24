import Validator from '@lib/utils/validator';
import { LIMIT_DEFAULT } from '@lib/module/PDexV3/features/Liquidity/liquidity.constant';

async function getWithdrawFeeLPHistories({ offset = 0, limit = LIMIT_DEFAULT } = {}) {
  new Validator("getWithdrawRewardHistories-offset", offset).required().number();
  new Validator("getWithdrawRewardHistories-limit", limit).required().number();
  const histories = await this.getWithdrawFeeLPHistoriesApi();
  console.log('getWithdrawFeeLPHistories: ', histories)
  return histories;
}

export default ({
  getWithdrawFeeLPHistories
})
