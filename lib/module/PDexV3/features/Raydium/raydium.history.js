import differenceBy from "lodash/differenceBy";
import flatten from "lodash/flatten";
import orderBy from "lodash/orderBy";
import uniq from "lodash/uniq";
import uniqBy from "lodash/uniqBy";
import { TX_TYPE } from "@lib/module/Account";
import { PrivacyVersion, Validator } from "@lib/wallet";
import { camelCaseKeys } from "@lib/utils/camelCaseKeys";
import { EXCHANGE_SUPPORTED } from "@lib/module/PDexV3/PDexV3.constants";
import { BurningSOLForDepositToSCRequestMeta } from "@lib/core";

const mappingHistoryFromApi = (h) => {
  let history = camelCaseKeys(h);
  const { id, mintAccept = 0, status = "Processing", requestime } = h;
  return {
    ...history,
    tradeID: id,
    minAccept: mintAccept,
    status,
    exchange: EXCHANGE_SUPPORTED.raydium,
    price: mintAccept,
    requestime: requestime * 1000,
  };
};

async function getSwapRaydiumHistoryFromApi() {
  let history = [];
  try {
    const response = await this.rpcApiService.apiGetRaydiumHistory({
      walletAddress: this.getPaymentKey(),
    });
    console.log("getSwapRaydiumHistoryFromApiResponse", response);
    history = response?.History || [];
    history = history.map((h) => mappingHistoryFromApi(h));
  } catch (error) {
    console.log("getSwapRaydiumHistoryFromApi-error", error);
    throw error;
  }
  return history;
}

async function getSwapRaydiumHistoryFromStorage({ version }) {
  let historyStorage = [];
  try {
    new Validator("getSwapHistoryFromStorage-version", version)
      .required()
      .number();
    let tokenIds = [];
    const storageTokenIDs =
      (await this.getStorageSwapTokenIDs({ version })) || [];
    try {
      const keyInfo = await this.account?.getKeyInfo({ version });
      const coinsIndex = keyInfo?.coinindex;
      if (coinsIndex) {
        tokenIds = Object.keys(coinsIndex);
      }
    } catch {
      //
    }
    tokenIds = uniq(tokenIds.concat(storageTokenIDs));
    let history =
      (await Promise.all(
        tokenIds.map(async (tokenID) => {
          const histories =
            (await this.account?.getTxsTransactorFromStorage({
              tokenID,
              version,
            })) || [];
          return histories.filter(
            (item) =>
              item?.txType === TX_TYPE.BURN &&
              item?.metadata?.Type === BurningSOLForDepositToSCRequestMeta
          );
        })
      )) || [];
    history = flatten(history);
    history = history.filter((h) => !!h?.txId);
    history = uniqBy(history, (h) => h?.txId);
    if (!history) {
      return [];
    }
    history = history?.map((h) => {
      try {
        const { metadata, txId, time, status: statusCode, statusStr } = h;
        const {
          tradeID,
          srcTokenID,
          destTokenID,
          paths,
          srcQties,
          expectedDestAmt,
          tradingFee,
          feeToken,
          ...rest
        } = metadata || {};
        const result = {
          id: tradeID,
          tradeID,
          amount: srcQties,
          minAccept: expectedDestAmt,
          requestTx: txId,
          burningTxID: txId,
          requestime: time,
          sellTokenId: srcTokenID,
          buyTokenId: destTokenID,
          respondTxs: [],
          status: statusStr,
          statusCode,
          fee: tradingFee,
          feeToken,
          fromStorage: true,
          tradingPath: paths.split(","),
          exchange: EXCHANGE_SUPPORTED.raydium,
          price: expectedDestAmt,
          ...rest,
        };
        return result;
      } catch (error) {
        console.log("getSwapHistoryFromStorage-error", error);
      }
      return null;
    });
    historyStorage = history;
  } catch (error) {
    console.log("getSwapRaydiumHistoryFromStorage-error", error);
    throw error;
  }
  return historyStorage;
}

async function getSwapRaydiumHistory() {
  let history = [];
  try {
    let [historyFromApi, historyFromStorage] = await Promise.all([
      this.getSwapRaydiumHistoryFromApi(),
      this.getSwapRaydiumHistoryFromStorage({ version: PrivacyVersion.ver2 }),
    ]);
    historyFromStorage = differenceBy(
      historyFromStorage,
      historyFromApi,
      (h) => h?.requestTx
    );
    history = [...historyFromStorage, ...historyFromApi];
    history = orderBy(history, "requestime", "desc");
  } catch (error) {
    console.log("getSwapRaydiumHistory-error", error);
    throw error;
  }
  return history;
}

async function getOrderSwapRaydiumDetail({
  tradeID,
  requestTx,
  version,
  fromStorage,
}) {
  let result = {};
  try {
    new Validator("getOrderSwapRaydiumDetail-tradeID", tradeID)
      .required()
      .number();
    new Validator("getOrderSwapRaydiumDetail-requestTx", requestTx)
      .required()
      .string();
    new Validator("getOrderSwapRaydiumDetail-version", version)
      .required()
      .number();
    new Validator("getOrderSwapRaydiumDetail-fromStorage", fromStorage)
      .required()
      .boolean();
    result = await this.rpcApiService.apiGetRaydiumHistoryDetail({
      tradeID,
    });
    if (!!result) {
      result = mappingHistoryFromApi(result);
    } else if (fromStorage) {
      const history = await this.getSwapRaydiumHistoryFromStorage({
        version,
      });
      result = history.find((h) => h?.requestTx === requestTx);
    }
  } catch (error) {
    throw error;
  }
  return result;
}

async function getSwapRaydiumRewardHistory(params) {
  let history = [];
  const { page, limit } = params;
  try {
    const response = await this.rpcApiService.apiGetRaydiumRewardHistory({
      walletAddress: this.getPaymentKey(),
      page,
      limit,
    });
    console.log("getSwapRaydiumRewardHistory", response);
    history = response?.History || [];
    history = history?.map((h) => camelCaseKeys(h));
  } catch (error) {
    console.log("getSwapRaydiumRewardHistory-error", error);
    throw error;
  }
  return history;
}

export default {
  getSwapRaydiumHistoryFromStorage,
  getSwapRaydiumHistoryFromApi,
  getSwapRaydiumHistory,
  getOrderSwapRaydiumDetail,
  getSwapRaydiumRewardHistory,
};
