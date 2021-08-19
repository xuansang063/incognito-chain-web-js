import Validator from '@lib/utils/validator';
import flatten from 'lodash/flatten';
import { uniqBy } from 'lodash';
import { LIMIT_DEFAULT } from '@lib/module/PDexV3/features/Liquidity/liquidity.constant';


async function getRemovePoolHistories({ offset = 0, limit = LIMIT_DEFAULT, accountInst } = {}) {
  new Validator("getRemovePoolHistories-offset", offset).required().number();
  new Validator("getRemovePoolHistories-limit", limit).required().number();
  new Validator("getRemovePoolHistories-accountInstant", accountInst).required().object();
  const tasks = [
    await this.getLiquidityRemoveHistoriesApi({ offset, limit }),
    await this.getStorageHistoriesRemovePool()
  ];
  const [apiHistories, storageHistories] = await Promise.all(tasks)

  let spendingStorage = (storageHistories || []).filter(history => {
    const isExist = apiHistories.some(apiHistory => apiHistory?.requestTx === history?.requestTx);
    return !isExist;
  });

  const tasksStorage = spendingStorage.map(async (history) => {
    const { requestTx } = history;
    const status = await accountInst.rpcTxService.apiGetTxStatus({ txId: requestTx });
    return {
      ...history,
      status,
    }
  })
  spendingStorage = flatten(await Promise.all(tasksStorage))

  return this.mapperStatus({
    histories: uniqBy(apiHistories.concat(spendingStorage), 'id')
  })
}

export default ({
  getRemovePoolHistories,
})
