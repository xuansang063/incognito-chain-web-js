import { camelCaseKeys } from "@lib/utils/camelCaseKeys";
import Validator from "@lib/utils/validator";
import orderBy from "lodash/orderBy";
import flatten from "lodash/flatten";

async function getOrderLimitHistory({ poolid, version }) {
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
    history = orderBy(history, "requestime", "desc");
  } catch (error) {
    throw error;
  }
  return history;
}

export default {
  getOrderLimitHistory,
};
