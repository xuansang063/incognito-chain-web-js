import Validator from '@lib/utils/validator';
import { LIMIT_DEFAULT } from '@lib/module/PDexV3/features/Liquidity/liquidity.constant';
import { camelCaseKeys } from '@lib/utils/camelCaseKeys';
import flatten from 'lodash/flatten';
import {PDEX_TRANSACTION_TYPE} from "@lib/module/Account";

async function getContributeHistoryByNFT({ offset = 0, limit = LIMIT_DEFAULT } = {}) {
  new Validator("getContributeHistoryByNFT-offset", offset).number();
  new Validator("getContributeHistoryByNFT-limit", limit).number();
  let histories = []
  try {
    const nftIds = (await this.getNFTTokenIDs()) || [];
    const tasks = nftIds.map(nftId => (
        this.rpcTradeService.apiGetContributeHistories({ offset, limit, nftId })
    ))
    histories = camelCaseKeys(((await Promise.all(tasks)) || []).filter(item => !!item));
    histories = flatten(histories || [])
        .map(item => ({ ...item, txType: PDEX_TRANSACTION_TYPE.NFT }));
  } catch (error) {
    histories = [];
    console.log('getContributeHistoryByNFT error: ', error);
  }
  return histories;
}

async function getContributeHistoryByOTAKey({ offset = 0, limit = LIMIT_DEFAULT } = {}) {
  new Validator("getContributeHistoryByOTAKey-offset", offset).number();
  new Validator("getContributeHistoryByOTAKey-limit", limit).number();
  let histories = [];
  const otaKey = this.getOTAKey();
  try {
    histories =
        (await this.rpcTradeService.apiGetContributeHistories({ offset, limit, otaKey })) || [];
    histories = camelCaseKeys(histories).map(item => ({ ...item, txType: PDEX_TRANSACTION_TYPE.ACCESS_ID }));;
  } catch (error) {
    histories = [];
    console.log('getContributeHistoryByNFT error: ', error);
  }
  return histories;
}

async function getContributeHistoriesApi() {
  let history = [];
  try {
    const tasks = [
      await this.getContributeHistoryByNFT(),
      await this.getContributeHistoryByNFT(),
    ];
    history = await Promise.all(tasks);
    history = flatten(history)
  } catch (error) {
    console.log('getContributeHistoriesApi: ', error);
  }
  return history
}

async function getRemoveLPHistoriesApi({ offset = 0, limit = LIMIT_DEFAULT } = {}) {
  new Validator("getLiquidityRemoveHistoriesApi-offset", offset).number();
  new Validator("getLiquidityRemoveHistoriesApi-limit", limit).number();
  const nftIDs = (await this.getNFTTokenIDs()) || [];
  const tasks = nftIDs.map(async nftId => {
    const histories = await this.rpcTradeService.apiGetWithdrawContributeHistories({
      nftId,
      offset,
      limit,
    });
    if (!histories) return null;
    return histories.map(history => ({ ...history, nftId }))
  })
  let histories = flatten((await Promise.all(tasks)) || []).filter(item => !!item);
  histories = camelCaseKeys(histories || []);
  return histories;
}

async function getWithdrawFeeLPHistoriesApi({ offset = 0, limit = LIMIT_DEFAULT } = {}) {
  new Validator("getLiquidityWithdrawFeeHistoriesApi-offset", offset).required().number();
  new Validator("getLiquidityWithdrawFeeHistoriesApi-limit", limit).number();
  const nftIDs = (await this.getNFTTokenIDs()) || [];
  const tasks = nftIDs.map(async nftId => {
    const histories = await this.rpcTradeService.apiGetWithdrawFeeContributeHistories({
      nftId,
      offset,
      limit,
    });
    if (!histories) return null;
    return histories.map(history => ({ ...history, nftId }))
  })
  let histories = flatten((await Promise.all(tasks)) || []).filter(item => !!item);
  histories = camelCaseKeys(histories || []);
  return histories
}

export default {
  getContributeHistoryByNFT,
  getContributeHistoryByOTAKey,
  getContributeHistoriesApi,
  getRemoveLPHistoriesApi,
  getWithdrawFeeLPHistoriesApi,
};

