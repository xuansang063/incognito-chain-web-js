import { camelCaseKeys } from "@lib/utils/camelCaseKeys";

async function getOpenOrders(params) {
  let orders = [];
  try {
    const { poolid } = params;
    const otakey = this.getOTAKey();
    const res = await this.rpcTradeService.apiGetOpenOrders({ poolid, otakey });
    orders = res.map((item) => camelCaseKeys(item));
  } catch (error) {
    throw error;
  }
  return orders;
}

export default { getOpenOrders };
