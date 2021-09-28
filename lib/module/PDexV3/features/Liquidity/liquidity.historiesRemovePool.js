import Validator from '@lib/utils/validator';
import { LIMIT_DEFAULT } from '@lib/module/PDexV3/features/Liquidity/liquidity.constant';
import flatten from 'lodash/flatten';
import { MAP_REMOVE_LP_HISTORIES_SERVICE, REMOVE_LP_HISTORIES_TX_STR } from '@lib/module/Account';

async function getRemoveLPHistories({ offset = 0, limit = LIMIT_DEFAULT } = {}) {
  new Validator("getRemoveLPHistories-offset", offset).required().number();
  new Validator("getRemoveLPHistories-limit", limit).required().number();
  let histories = flatten(await this.getRemoveLPHistoriesApi());
  let [csvHistories, storageHistories] = await Promise.all([
    flatten(await this.getRemoveLPHistoriesApi()),
    this.getStorageHistoriesRemoveLP(),
  ])
  histories = histories.map(history => {
    const status = MAP_REMOVE_LP_HISTORIES_SERVICE[history.status];
    const statusStr = REMOVE_LP_HISTORIES_TX_STR[status];
    return {
      ...history,
      status,
      statusStr,
    }
  })
  return histories;
}

export default ({
  getRemoveLPHistories,
})
