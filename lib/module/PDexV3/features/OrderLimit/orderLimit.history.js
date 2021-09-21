import { camelCaseKeys } from "@lib/utils/camelCaseKeys";
import Validator from "@lib/utils/validator";

async function getOrderLimitHistory({ poolid, version }) {
  let history = [];
  try {
    new Validator("apiGetHistory-poolid", poolid).required().string();
    new Validator("apiGetHistory-version", version).required().number();
    const { nftToken: nftid } = await this.getNFTTokenData({ version });
    new Validator("apiGetHistory-nftToken", nftid).required().string();
    history =
      (await this.rpcTradeService.apiGetHistory({
        queryStr: `poolid=${poolid}&nftid=${nftid}`,
      })) || [];
    history = history.map((h) => camelCaseKeys(h));
  } catch (error) {
    throw error;
  }
  return history;
}

export default {
  getOrderLimitHistory,
};
