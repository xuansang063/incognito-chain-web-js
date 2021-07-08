import { CustomError, ErrorObject } from "@lib/common/errorhandler";
import { TX_STATUS } from "@lib/module/Account/account.constants";
import Validator from "@lib/utils/validator";
import uniq from "lodash/uniq";

export const SPENDING_COINS_STORAGE = "SPENDING-COINS-STORAGE";

async function getSpendingCoinsStorageByTokenId(params) {
  try {
    const { tokenID, version } = params;
    new Validator("getSpendingCoinsStorageByTokenId-tokenID", tokenID)
      .required()
      .string();
    new Validator("getSpendingCoinsStorageByTokenId-version", version)
      .required()
      .number();
    const key = await this.getKeySpendingCoinsStorageByTokenId(params);
    const spendingCoins = (await this.getAccountStorage(key)) || [];
    const txIds = uniq(spendingCoins.map((coin) => coin.txId));
    const tasks = txIds.map((txId) =>
      this.rpcTxService.apiGetTxStatus({ txId })
    );
    let statuses = [];
    try {
      statuses = await Promise.all(tasks);
    } catch (e) {
      throw new CustomError(
        ErrorObject.GetStatusTransactionErr,
        "Message is too large",
        e
      );
    }
    statuses = txIds.map((txId, index) => ({
      txId,
      status: statuses[index],
    }));

    const spendingCoinsFilterByTime = spendingCoins.filter((item) => {
      const timeExist = new Date().getTime() - item?.createdAt;
      const timeExpired = 3 * 60 * 1000;
      const { status } = statuses.find((status) => status.txId === item.txId);
      const isSpending = (
        (timeExist < timeExpired)
        || status === TX_STATUS.TXSTATUS_PENDING
        || status === TX_STATUS.PROCESSING
      )
      return isSpending;
    });
    await this.setAccountStorage(key, spendingCoinsFilterByTime);
    return spendingCoinsFilterByTime || [];
  } catch (error) {
    throw error;
  }
}

async function setSpendingCoinsStorage(params) {
  try {
    const { coins, tokenID, txId, version } = params;
    new Validator("setSpendingCoinsStorage-tokenID", tokenID)
      .required()
      .string();
    new Validator("setSpendingCoinsStorage-coins", coins).required().array();
    new Validator("setSpendingCoinsStorage-txId", txId).required().string();
    new Validator("setSpendingCoinsStorage-version", version)
      .required()
      .number();
    if (!coins) {
      return;
    }
    const key = this.getKeySpendingCoinsStorageByTokenId(params);
    const spendingCoins = (await this.getSpendingCoinsStorageByTokenId(params)) || [];
    const mapCoins = coins.map((item) => ({
      keyImage: item?.KeyImage,
      createdAt: new Date().getTime(),
      txId,
      tokenID,
    }));
    mapCoins.forEach((item) => {
      const isExist = spendingCoins.some(
        (coin) => coin?.keyImage === item?.keyImage
      );
      if (!isExist) {
        spendingCoins.push(item);
      }
    });
    await this.setAccountStorage(key, spendingCoins);
  } catch (error) {
    throw error;
  }
}

async function getSpendingCoins(params) {
  try {
    const { tokenID, version } = params;
    new Validator(`getSpendingCoins-tokenID`, tokenID).required().string();
    new Validator(`getSpendingCoins-version`, version).required().number();
    let { unspentCoins: coins } = await this.getOutputCoins(params);
    const spendingCoinsStorage = await this.getSpendingCoinsStorageByTokenId(
      params
    );
    coins = coins.filter(
      (item) =>
        !spendingCoinsStorage?.find((coin) => coin?.keyImage === item?.KeyImage)
    );
    const spendingCoins =
      await this.rpcCoinService.apiGetSpendingCoinInMemPool();
    if (!!spendingCoins) {
      coins = coins.filter((coin) => !spendingCoins.includes(coin.KeyImage));
    }
    return coins || [];
  } catch (error) {
    console.log("getSpendingCoins FAILED", error);
    throw error;
  }
}

function getKeySpendingCoinsStorageByTokenId(params) {
  try {
    const { tokenID, version } = params;
    new Validator("getKeySpendingCoinsStorageByTokenId-tokenID", tokenID)
      .required()
      .string();
    new Validator("getKeySpendingCoinsStorageByTokenId-version", version)
      .required()
      .number();
    const keyByTokenId = this.getKeyStorageByTokenId(params);
    return `${keyByTokenId}-${SPENDING_COINS_STORAGE}`;
  } catch (error) {
    throw error;
  }
}

async function removeSpendingCoinsByTxIDs({ txIDs, tokenIDs, version }) {
  try {
    new Validator("removeSpendingCoinsByTxIDs-txIDs", txIDs).required().array();
    new Validator("removeSpendingCoinsByTxIDs-tokenIDs", tokenIDs).required().array();
    new Validator("removeSpendingCoinsByTxIDs-version", version).required().number();
    tokenIDs = uniq(tokenIDs).filter(tokenID => !!tokenID);
    txIDs = uniq(txIDs).filter(txID => !!txID);
    const tasks = uniq(tokenIDs).map(async (tokenID) => {
      const oldSpendingCoins = (await this.getSpendingCoinsStorageByTokenId({
        tokenID,
        version,
      })) || [];
      const newSpendingCoins = oldSpendingCoins.filter(spendingCoins => !txIDs.includes(spendingCoins?.txId));
      const key = await this.getKeySpendingCoinsStorageByTokenId({
        tokenID,
        version,
      });
      await this.setAccountStorage(key, newSpendingCoins);
    });
    await Promise.all(tasks)
  } catch (e) {
    throw e;
  }
}

export default {
  getSpendingCoins,
  getKeySpendingCoinsStorageByTokenId,
  getSpendingCoinsStorageByTokenId,
  setSpendingCoinsStorage,
  removeSpendingCoinsByTxIDs,
};
