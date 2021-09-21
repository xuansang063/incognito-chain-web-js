import Validator from '@lib/utils/validator';
import { LIMIT_DEFAULT } from '@lib/module/PDexV3/features/Liquidity/liquidity.constant';
import flatten from 'lodash/flatten';

async function getContributeHistories({ offset = 0, limit = LIMIT_DEFAULT } = {}) {
  new Validator("getContributeHistories-offset", offset).required().number();
  new Validator("getContributeHistories-limit", limit).required().number();
  let histories = await this.getContributeHistoriesApi();
  histories = flatten(histories || []) || []
  return histories;
}

export default ({
  getContributeHistories,
})
