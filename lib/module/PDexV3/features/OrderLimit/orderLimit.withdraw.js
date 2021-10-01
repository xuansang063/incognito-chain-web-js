import { ACCOUNT_CONSTANT } from "@lib/wallet";
import Validator from "@lib/utils/validator";

function getKeyStorageWithdrawOrderTxs(params) {
  const { poolid } = params;
  new Validator("getWithdrawOrderTxs-poolid", poolid).required().string();
  const otakey = this.getOTAKey();
  return `WITHDRAW-ORDER-${otakey}-${poolid}`;
}

async function clearWithdrawOrderTxs(params) {
  const { poolid } = params;
  new Validator("getWithdrawOrderTxs-poolid", poolid).required().string();
  const key = this.getKeyStorageWithdrawOrderTxs(params);
  await this.clearStorage(key);
}

async function setWithdrawOrderTx(params) {
  try {
    const { poolid, txWithdraw } = params;
    const { withdrawTxId, requestTx, status = -1 } = txWithdraw || {};
    new Validator("setWithdrawOrderTx-poolid", poolid).required().string();
    new Validator("setWithdrawOrderTx-withdrawTxId", withdrawTxId)
      .required()
      .string();
    new Validator("setWithdrawOrderTx-requestTx", requestTx)
      .required()
      .string();
    new Validator("setWithdrawOrderTx-status", status).required().number();
    const key = this.getKeyStorageWithdrawOrderTxs({ poolid });
    const oldList = (await this.getWithdrawOrderTxs({ poolid })) || [];
    const isExisted =
      oldList.findIndex((tx) => tx?.requestTx === requestTx) > -1;
    if (!isExisted) {
      let newList = [txWithdraw, ...oldList];
      await this.setStorage(key, newList);
    }
  } catch (error) {
    throw error;
  }
}

async function setWithdrawOrderTxs(params) {
  try {
    const { poolid, withdrawTxs } = params;
    new Validator("setWithdrawOrderTxs-poolid", poolid).required().string();
    new Validator("setWithdrawOrderTxs-withdrawTxs", withdrawTxs)
      .required()
      .array();
    const key = this.getKeyStorageWithdrawOrderTxs({ poolid });
    await this.setStorage(key, withdrawTxs);
  } catch (error) {
    throw error;
  }
}

async function getWithdrawOrderTxs(params) {
  let withdrawTxs = [];
  try {
    const { poolid } = params;
    new Validator("getWithdrawOrderTxs-poolid", poolid).required().string();
    const key = this.getKeyStorageWithdrawOrderTxs({ poolid });
    withdrawTxs = (await this.getStorage(key)) || [];
    const task = withdrawTxs.map(({ withdrawTxId: txId, status }) =>
      [
        ACCOUNT_CONSTANT.TX_STATUS.PROCESSING,
        ACCOUNT_CONSTANT.TX_STATUS.TXSTATUS_PENDING,
      ].includes(status)
        ? this.rpcTxService.apiGetTxStatus({ txId })
        : status
    );
    const implTask = await Promise.all(task);
    withdrawTxs = withdrawTxs.map((tx, index) => ({
      ...tx,
      status: implTask[index],
    }));

    await this.setWithdrawOrderTxs({
      poolid,
      withdrawTxs,
    });
  } catch (error) {
    throw error;
  }
  return withdrawTxs;
}

export default {
  getKeyStorageWithdrawOrderTxs,
  setWithdrawOrderTx,
  setWithdrawOrderTxs,
  getWithdrawOrderTxs,
  clearWithdrawOrderTxs,
};
