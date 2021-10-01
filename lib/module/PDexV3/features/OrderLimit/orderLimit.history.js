import { camelCaseKeys } from "@lib/utils/camelCaseKeys";
import Validator from "@lib/utils/validator";
import orderBy from "lodash/orderBy";
import flatten from "lodash/flatten";
import isArray from "lodash/isArray";
import uniqBy from "lodash/uniqBy";
import { differenceBy } from "lodash";

async function getOrderLimitDetail({
  requestTx,
  token1ID,
  token2ID,
  poolid,
  version,
  fromStorage,
}) {
  let result = {};
  try {
    new Validator("getOrderLimitDetail-requestTx", requestTx)
      .required()
      .string();
    new Validator("getOrderLimitDetail-token1ID", token1ID).required().string();
    new Validator("getOrderLimitDetail-token2ID", token2ID).required().string();
    new Validator("getOrderLimitDetail-poolid", poolid).required().string();
    new Validator("getOrderLimitDetail-version", version).required().number();
    new Validator("getOrderLimitDetail-fromStorage", fromStorage)
      .required()
      .boolean();
    result = await this.rpcTradeService.apiGetTradeDetail({
      txhash: requestTx,
    });
    if (isArray(result)) {
      result = result[0];
      result = camelCaseKeys(result);
    } else if (fromStorage) {
      const history = await this.getOrderLimitHistoryFromStorage({
        token1ID,
        token2ID,
        version,
        poolid,
      });
      result = history.find((h) => h?.requestTx === requestTx);
    }
    console.log("result", result, fromStorage);
  } catch (error) {
    throw error;
  }
  return result;
}

async function getOrderLimitHistoryFromStorage({
  token1ID,
  token2ID,
  version,
  poolid,
}) {
  let historyStorage = [];
  try {
    new Validator("getOrderLimitHistoryFromStorage-token1ID", token1ID)
      .required()
      .string();
    new Validator("getOrderLimitHistoryFromStorage-token2ID", token2ID)
      .required()
      .string();
    new Validator("getOrderLimitHistoryFromStorage-version", version)
      .required()
      .number();
    new Validator("getOrderLimitHistoryFromStorage-poolid", poolid)
      .required()
      .string();
    let history = await Promise.all([
      this.account?.getTxsTransactorFromStorage({
        tokenID: token1ID,
        version,
      }),
      this.account?.getTxsTransactorFromStorage({
        tokenID: token2ID,
        version,
      }),
    ]);
    history = flatten(history);
    history = history.filter(
      (h) => !!h?.txId && h?.metadata?.PoolPairID === poolid
    );
    history = uniqBy(history, (h) => h?.txId);
    history = history.map((h) => {
      try {
        const { metadata, txId, time, statusStr } = h;
        const {
          SellAmount,
          MinAcceptableAmount,
          PoolPairID,
          TokenToSell,
          NftID,
        } = metadata || {};
        const result = {
          amount: SellAmount,
          minAccept: MinAcceptableAmount,
          poolId: PoolPairID,
          sellTokenId: TokenToSell,
          nftid: NftID,
          requestTx: txId,
          requestime: time,
          buyTokenId: TokenToSell === token1ID ? token2ID : token1ID,
          respondTxs: [],
          withdrawTxs: {},
          status: statusStr,
          statusCode: 0,
          pairId: "",
          matched: 0,
          receiver: "",
          fee: 0,
          feeToken: "",
          isCompleted: false,
          sellTokenBalance: 0,
          buyTokenBalance: 0,
          sellTokenWithdrawed: 0,
          buyTokenWithdrawed: 0,
          fromStorage: true,
        };
        return result;
      } catch (error) {
        console.log("getOrderLimitHistoryFromStorage-error", error);
      }
      return null;
    });
    historyStorage = history;
  } catch (error) {
    throw error;
  }
  return historyStorage;
}

async function getOrderLimitHistoryFromApi({ poolid, version }) {
  let history = [];
  try {
    new Validator("apiGetHistory-poolid", poolid).required().string();
    new Validator("apiGetHistory-version", version).required().number();
    const { listNFTToken } = await this.getNFTTokenData({ version });
    new Validator("apiGetHistory-listNFTToken", listNFTToken)
      .required()
      .array();
    let task =
      (await Promise.all(
        listNFTToken.map((nftid) =>
          this.rpcTradeService.apiGetHistory({
            queryStr: `poolid=${poolid}&nftid=${nftid}`,
          })
        )
      )) || [];
    if (task.length > 0) {
      history = flatten(task);
    }
    history = history
      .filter((h) => !!h?.RequestTx)
      .map((h) => camelCaseKeys(h));
  } catch (error) {
    throw error;
  }
  return history;
}

async function getOrderLimitHistory({ poolid, version, token1ID, token2ID }) {
  let history = [];
  try {
    new Validator("getOrderLimitHistoryFromStorage-token1ID", token1ID)
      .required()
      .string();
    new Validator("getOrderLimitHistoryFromStorage-token2ID", token2ID)
      .required()
      .string();
    new Validator("getOrderLimitHistoryFromStorage-version", version)
      .required()
      .number();
    new Validator("getOrderLimitHistoryFromStorage-poolid", poolid)
      .required()
      .string();
    let [historyFromApi, historyFromStorage] = await Promise.all([
      this.getOrderLimitHistoryFromApi({ poolid, version }),
      this.getOrderLimitHistoryFromStorage({
        poolid,
        version,
        token1ID,
        token2ID,
      }),
    ]);
    historyFromStorage = differenceBy(
      historyFromStorage,
      historyFromApi,
      (h) => h?.requestTx
    );
    history = [...historyFromStorage, ...historyFromApi];
  } catch (error) {
    throw error;
  }
  history = orderBy(history, "requestime", "desc");
  return history;
}

export default {
  getOrderLimitHistory,
  getOrderLimitDetail,
  getOrderLimitHistoryFromApi,
  getOrderLimitHistoryFromStorage,
};
