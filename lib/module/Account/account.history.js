import { PRVID, PRVIDSTR } from "@lib/core";
import Validator from "@lib/utils/validator";
import { flatten, toString } from "lodash";
import { TX_STATUS, TX_STATUS_STR, TX_TYPE_STR } from "./account.constants";

const TX_HISTORY = "TX_HISTORY";

function getNormalTxHistory() {
  return this.txHistory.NormalTx;
}

function getPrivacyTokenTxHistory() {
  return this.txHistory.PrivacyTokenTx;
}

function getKeyTxHistoryByTokenId(tokenId = PRVIDSTR) {
  new Validator("tokenId", tokenId).required().string();
  const keyByTokenId = this.getKeyStorageByTokenId(tokenId);
  const key = `${TX_HISTORY}-${keyByTokenId}`;
  return key;
}

async function saveTxHistory({ tx, tokenId = PRVIDSTR } = {}) {
  new Validator("tx", tx).required().object();
  new Validator("tokenId", tokenId).required().string();
  try {
    const key = this.getKeyTxHistoryByTokenId(tokenId);
    const txs = (await this.getAccountStorage(key)) || [];
    console.log("txs", txs.length);
    console.log("tokenId", tokenId);
    const isExisted = txs.find((i) => i.txId === tx.txId);
    let newTxs = [];
    newTxs = isExisted
      ? [...txs].map((i) =>
          i.txId === tx.txId ? { ...tx, updatedAt: new Date().getTime() } : i
        )
      : [{ ...tx, createdAt: new Date().getTime() }, ...txs];
    console.log("newTxs", newTxs.length);
    await this.setAccountStorage(key, newTxs);
  } catch (error) {
    throw error;
  }
}

async function getTxHistoryByTxID({ tokenId = PRVIDSTR, txId } = {}) {
  new Validator("tokenId", tokenId).required().string();
  new Validator("txId", txId).required().string();
  let tx;
  try {
    const key = this.getKeyTxHistoryByTokenId(tokenId);
    const txs = (await this.getAccountStorage(key)) || [];
    tx = txs.find((t) => t.txId === txId);
    if (tx) {
      const status = await this.rpcTxService.apiGetTxStatus({ txId });
      if (Number.isFinite(status) && status >= 0) {
        await this.saveTxHistory({ tx: { ...tx, status }, tokenId });
      }
    }
  } catch (error) {
    throw error;
  }
  return tx;
}
async function getTxsTransactor({ tokenID = PRVIDSTR } = {}) {
  let txsTransactor = [];
  try {
    new Validator("tokenID", tokenID).required().string();
    const key = this.getKeyTxHistoryByTokenId(tokenID);
    let txs = (await this.getAccountStorage(key)) || [];
    if (!txs) {
      return [];
    }
    let task = [];
    console.log(typeof txs.filter, txs);
    task = txs
      .filter((tx) => tx.status !== TX_STATUS.TXSTATUS_SUCCESS)
      .map((tx) =>
        this.getTxHistoryByTxID({ tokenId: tokenID, txId: tx?.txId })
      );
    await Promise.all(task);
    txsTransactor = (await this.getAccountStorage(key)) || [];
    // txsTransactor = txsTransactor.map((txt) => {
    //   const { amount, txId, status, txType, tokenID, tx } = txt;
    //   return {
    //     txId,
    //     amount,
    //     status,
    //     statusStr: TX_STATUS_STR[toString(status)],
    //     txType,
    //     txTypeStr: TX_TYPE_STR[toString(txType)],
    //     tokenID,
    //     time: tx?.LockTime * 1000,
    //   };
    // });
  } catch (error) {
    throw error;
  }
  return txsTransactor;
}

async function getTxsHistory({ tokenID = PRVIDSTR } = {}) {
  new Validator("tokenID", tokenID).required().string();
  let result = {
    txsTransactor: [],
    txsReceiver: [],
  };
  try {
    let task = [
      this.getTxsTransactor({ tokenID }),
      this.getTxsByReceiver({ tokenID }),
    ];
    const [txsTransactor, txsReceiver] = await Promise.all(task);
    result.txsTransactor = txsTransactor || [];
    result.txsReceiver = txsReceiver || [];
  } catch (error) {
    throw error;
  }
  return result;
}

async function getTxHistoriesByTokenID({
  tokenId = PRVIDSTR,
} = {}) {
  new Validator("tokenId", tokenId).required().string();
  let txs;
  try {
    const key = this.getKeyTxHistoryByTokenId(tokenId);
    txs = (await this.getAccountStorage(key)) || [];
  } catch (error) {
    throw error;
  }
  return txs;
}

export default {
  getNormalTxHistory,
  getPrivacyTokenTxHistory,
  saveTxHistory,
  getTxsHistory,
  getKeyTxHistoryByTokenId,
  getTxHistoryByTxID,
  getTxsTransactor,
  getTxHistoriesByTokenID,
};
