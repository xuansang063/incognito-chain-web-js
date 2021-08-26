import { TX_STATUS_STR } from "@lib/module/Account/account.constants";
import { camelCaseKeys } from "@lib/utils/camelCaseKeys";

async function getOpenOrders(params) {
  let orders = [];
  try {
    const { poolid } = params;
    const otakey = this.getOTAKey();
    const res = await this.rpcTradeService.apiGetOpenOrders({ poolid, otakey });
    orders = res.map((item) => ({
      ...camelCaseKeys(item),
      txStatus: "",
      txStatusStr: "",
    }));
    let task = orders.map(({ txHash: txId }) =>
      this.rpcTxService.apiGetTxStatus({ txId })
    );
    const implTask = await Promise.all(task);
    orders = orders.map((order, index) => ({
      ...order,
      txStatus: implTask[index],
      txStatusStr: TX_STATUS_STR[implTask[index]],
    }));
  } catch (error) {
    throw error;
  }
  return orders;
}

export default { getOpenOrders };
