import { ACCOUNT_CONSTANT } from "@lib/wallet";
import Validator from "@lib/utils/validator";
import transactorPrototype from "./orderLimit.transactor";
import { camelCaseKeys } from "@lib/utils/camelCaseKeys";

function getKeyStorageCancelingOrderTxs(params) {
  const { poolid } = params;
  new Validator("getCancelingOrderTxs-poolid", poolid).required().string();
  const otakey = this.getOTAKey();
  return `CANCELING-ORDER-${otakey}-${poolid}`;
}

async function setCancelingOrderTx(params) {
  try {
    const { poolid, txCancel } = params;
    const { cancelTxId, requesttx, status = -1 } = txCancel || {};
    new Validator("setCancelingOrderTx-poolid", poolid).required().string();
    new Validator("setCancelingOrderTx-cancelTxId", cancelTxId)
      .required()
      .string();
    new Validator("setCancelingOrderTx-requesttx", requesttx)
      .required()
      .string();
    new Validator("setCancelingOrderTx-status", status).required().number();
    const key = this.getKeyStorageCancelingOrderTxs({ poolid });
    const oldList = (await this.getCancelingOrderTxs({ poolid })) || [];
    const isExisted =
      oldList.findIndex((tx) => tx?.requesttx === requesttx) > -1;
    if (!isExisted) {
      let newList = [txCancel, ...oldList];
      await this.setStorage(key, newList);
    }
  } catch (error) {
    throw error;
  }
}

async function setCancelingOrderTxs(params) {
  try {
    const { poolid, cancelingTxs } = params;
    new Validator("setCancelingOrderTxs-poolid", poolid).required().string();
    new Validator("setCancelingOrderTxs-cancelingTxs", cancelingTxs)
      .required()
      .array();
    const key = this.getKeyStorageCancelingOrderTxs({ poolid });
    await this.setStorage(key, cancelingTxs);
  } catch (error) {
    throw error;
  }
}

async function getCancelingOrderTxs(params) {
  let cancelingTxs = [];
  try {
    const { poolid } = params;
    new Validator("getCancelingOrderTxs-poolid", poolid).required().string();
    const key = this.getKeyStorageCancelingOrderTxs({ poolid });
    cancelingTxs = (await this.getStorage(key)) || [];
    const task = cancelingTxs.map(({ cancelTxId: txId }) =>
      this.rpcTxService.apiGetTxStatus({ txId })
    );
    const implTask = await Promise.all(task);
    cancelingTxs = cancelingTxs
      .map((tx, index) => ({
        ...tx,
        status: implTask[index],
      }))
      .filter(
        (tx) =>
          ![
            ACCOUNT_CONSTANT.TX_STATUS.TXSTATUS_CANCELED,
            ACCOUNT_CONSTANT.TX_STATUS.TXSTATUS_FAILED,
          ].includes(tx?.status)
      );
    await this.setCancelingOrderTxs({
      poolid,
      cancelingTxs,
    });
  } catch (error) {
    throw error;
  }
  return cancelingTxs;
}

async function getPendingOrder(params) {
  let list = [];
  try {
    const { poolid } = params;
    const otakey = this.getOTAKey();
    const res = await this.rpcTradeService.apiGetPendingOrder({
      poolid,
      otakey,
    });
    list = res.map((i) => camelCaseKeys(i));
  } catch (error) {
    throw error;
  }
  return list;
}

export default {
  getKeyStorageCancelingOrderTxs,
  setCancelingOrderTx,
  getCancelingOrderTxs,
  setCancelingOrderTxs,
  getPendingOrder,
  ...transactorPrototype,
};
