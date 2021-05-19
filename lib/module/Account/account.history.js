// saveNormalTxHistory save history of normal tx to history account

import { PRVIDSTR } from "@lib/core";
import Validator from "@lib/utils/validator";

const TX_HISTORY = "TX_HISTORY";

// getNormalTxHistory return history of normal txs
function getNormalTxHistory() {
  return this.txHistory.NormalTx;
}

// getPrivacyTokenTxHistory return history of normal txs
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
    tx = txs.find((t) => t.txId == txId);
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

async function getTxHistory({ tokenId = PRVIDSTR } = {}) {
  new Validator("tokenId", tokenId).required().string();
  let result = [];
  try {
    const key = this.getKeyTxHistoryByTokenId(tokenId);
    result = (await this.getAccountStorage(key)) | [];
  } catch (error) {
    throw error;
  }
  return result;
}

export default {
  getNormalTxHistory,
  getPrivacyTokenTxHistory,
  saveTxHistory,
  getTxHistory,
  getKeyTxHistoryByTokenId,
  getTxHistoryByTxID,
};
