import { camelCaseKeys } from "@lib/utils/camelCaseKeys";
import Validator from "@lib/utils/validator";

async function getHistory(params) {
  let history = [];
  try {
    const { poolid = "" } = params;
    const paymentkey = this.getPaymentKey();
    new Validator("apiGetHistory-poolid", poolid).string();
    new Validator("apiGetHistory-paymentkey", paymentkey).string().required();
    history = await this.rpcTradeService.apiGetHistory({
      paymentkey,
      poolid,
    });
    history = history.map((h) => camelCaseKeys(h));
  } catch (error) {
    throw error;
  }
  return history;
}

export default {
  getHistory,
};
