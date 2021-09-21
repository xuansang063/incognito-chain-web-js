import Validator from '@lib/utils/validator';
import { LIMIT_DEFAULT } from '@lib/module/PDexV3/features/Liquidity/liquidity.constant';

async function getRemoveLPHistories({ offset = 0, limit = LIMIT_DEFAULT } = {}) {
  new Validator("getRemoveLPHistories-offset", offset).required().number();
  new Validator("getRemoveLPHistories-limit", limit).required().number();
  const histories = await this.getRemoveLPHistoriesApi();
  console.log('getRemoveLPHistories: ', histories)
  return histories;
}

export default ({
  getRemoveLPHistories,
})
