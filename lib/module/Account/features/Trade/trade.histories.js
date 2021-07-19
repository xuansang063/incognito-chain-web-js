import { PrivacyVersion } from '@lib/core/constants';
import uniq from 'lodash/uniq';
import orderBy from 'lodash/orderBy';
import flatten from 'lodash/flatten';
import uniqBy from 'lodash/uniqBy';
import { pdexHistoryStoragePureModel, pdexHistoryPureModel } from '@lib/module/Account/features/Trade/trade.utils'
import { TX_TYPE } from '@lib/module/Account/account.constants';
import Validator from '@lib/utils/validator';

async function getPDexHistoriesApi({ offset, limit } = {}) {
  new Validator('offset', offset).required().number();
  new Validator('limit', limit).required().number();
  let histories = [];
  const accountName = this.name || "";
  try {
    const otakey = this.getOTAKey();
    histories = await this.rpcCoinService.apiGetPDexHistories({ otakey, offset, limit });
  } catch (error) {
    console.debug('getPDexHistoriesApi error: ', error);
  }
  return histories.map(
    (history) =>
      pdexHistoryPureModel({ history, accountName }),
  );
}

async function getTxPdexStorageHistories() {
  try {
    const version = PrivacyVersion.ver2;
    const keyInfo = await this.getKeyInfo({ version });
    let tokenIds = [];
    const storageTokenIDs = (await this.getStorageTradeTokenIDs({ version })) || [];
    const coinsIndex = keyInfo?.coinindex;
    if (coinsIndex) {
      tokenIds = Object.keys(coinsIndex);
    }
    tokenIds = uniq(tokenIds.concat(storageTokenIDs))
    const tasks = tokenIds.map(async (tokenID) => {
      const histories =
        (await this.getTransactorHistoriesByTokenID({ tokenID, version })) ||
        [];
      return histories.filter((item) => item?.txType === TX_TYPE.TRADE);
    });

    const accountName = this.name || "";
    return orderBy(flatten(await Promise.all(tasks))).map(
      (history) => pdexHistoryStoragePureModel({ history, accountName })
    );
  } catch (error) {
    throw error;
  }
}

async function getPDexHistories({ offset, limit, oldHistories } = {}) {
  new Validator('offset', offset).required().number();
  new Validator('limit', limit).required().number();
  new Validator('oldHistories', oldHistories).array();

  const tasks = [
    await this.getPDexHistoriesApi({ limit, offset }),
    await this.getTxPdexStorageHistories(),
  ];

  let [newHistories, storageHistories] = await Promise.all(tasks);
  const oldIds = oldHistories.map(item => item.requestTx);
  newHistories = newHistories.filter(item => !oldIds.includes(item.requestTx));
  let apiHistories = uniqBy(
    oldHistories.concat(newHistories.filter(item => !oldIds.includes(item.requestTx))),
    item => item.requestTx
  );
  let pendingStorage = [];
  storageHistories.forEach(history => {
    const notHave = apiHistories.some(item => item?.requestTx === history?.requestTx);
    if (!notHave) {
      pendingStorage.push(history);
    }
  });


  const tasksStorage = pendingStorage.map(async (history) => {
    const { requestTx: txId } = history;
    const status = await this.rpcTxService.apiGetTxStatus({ txId });
    return {
      ...history,
      status,
    }
  })

  pendingStorage = flatten(await Promise.all(tasksStorage))

  const histories = orderBy(
    apiHistories.concat(pendingStorage),
    ['requestTime',],
    ['desc'],
  );

  return {
    histories,
    apiHistoriesLength: (newHistories || []).length,
  }
}

export default {
  getPDexHistories,
  getTxPdexStorageHistories,
  getPDexHistoriesApi,
}
