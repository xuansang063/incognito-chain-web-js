// saveNormalTxHistory save history of normal tx to history account

import Validator from "@lib/utils/validator";

/**
 * @param {{txId: string, typeTx: string, amountNativeToken: number, feeNativeToken: number, txStatus: number, lockTime: number}} tx
 *  @param {[string]} receivers
 * @param {bool} isIn
 * @param {bool} isPrivacy
 * @param {[string]} listUTXOForPRV
 * @param {string} hashOriginalTx
 */
async function saveNormalTxHistory(
  tx,
  receivers,
  isIn,
  isPrivacyNativeToken,
  listUTXOForPRV,
  hashOriginalTx = "",
  metaData = null,
  info = "",
  messageForNativeToken = "",
  tradeHandler = null
) {
  await this.setSpendingCoinsStorage({
    value: listUTXOForPRV,
    tokenId: PRVIDSTR,
  });
  if (tradeHandler) return;
  const txHistory = new TxHistoryInfo();
  const historyObj = {
    txID: tx.txId,
    amountNativeToken: tx.amountNativeToken, // in nano PRV
    amountPToken: 0,
    feeNativeToken: tx.feeNativeToken, // in nano PRV
    feePToken: 0, // in nano PRV
    typeTx: tx.typeTx,
    receivers: receivers,
    tokenName: "",
    tokenID: "",
    tokenSymbol: "",
    isIn: isIn,
    time: tx.lockTime * 1000, // in mili-second
    status: tx.txStatus,
    isPrivacyNativeToken: isPrivacyNativeToken,
    isPrivacyForPToken: false,
    listUTXOForPRV: listUTXOForPRV,
    listUTXOForPToken: [],
    hashOriginalTx: hashOriginalTx,
    metaData: metaData,
    info: info,
    messageForNativeToken: messageForNativeToken,
    messageForPToken: "",
  };

  txHistory.setHistoryInfo(historyObj);
  this.txHistory.NormalTx.unshift(txHistory);
}

// savePrivacyTokenTxHistory save history of privacy token tx to history account
/**
 * @param {{txId: string, typeTx: string, amountNativeToken: number, amountPToken: number, feeNativeToken: number, feePToken: number,  txStatus: number, lockTime: number}} tx
 *  @param {[string]} receivers
 * @param {bool} isIn
 * @param {bool} isPrivacyNativeToken
 * @param {bool} isPrivacyForPToken
 * @param {[string]} listUTXOForPRV
 * @param {[string]} listUTXOForPToken
 * @param {string} hashOriginalTx
 */
async function savePrivacyTokenTxHistory(
  tx,
  receivers,
  isIn,
  isPrivacyNativeToken,
  isPrivacyForPToken,
  listUTXOForPRV,
  listUTXOForPToken,
  hashOriginalTx = "",
  metaData = null,
  info = "",
  messageForNativeToken = "",
  messageForPToken = "",
  tradeHandler = null
) {
  await Promise.all([
    this.setSpendingCoinsStorage({
      value: listUTXOForPRV,
      tokenId: PRVIDSTR,
    }),
    this.setSpendingCoinsStorage({
      value: listUTXOForPToken,
      tokenId: tx?.tokenID,
    }),
  ]);
  if (tradeHandler) return;
  const txHistory = new TxHistoryInfo();
  const historyObj = {
    txID: tx.txId,
    amountNativeToken: tx.amountNativeToken, // in nano PRV
    amountPToken: tx.amountPToken,
    feeNativeToken: tx.feeNativeToken, // in nano PRV
    feePToken: tx.feePToken, // in nano PRV
    typeTx: tx.typeTx,
    receivers: receivers,
    tokenName: tx.tokenName,
    tokenID: tx.tokenID,
    tokenSymbol: tx.tokenSymbol,
    tokenTxType: tx.tokenTxType,
    isIn: isIn,
    time: tx.lockTime * 1000, // in mili-second
    status: tx.txStatus,
    isPrivacyNativeToken: isPrivacyNativeToken,
    isPrivacyForPToken: isPrivacyForPToken,
    listUTXOForPRV: listUTXOForPRV,
    listUTXOForPToken: listUTXOForPToken,
    hashOriginalTx: hashOriginalTx,
    metaData: metaData,
    info: info,
    messageForNativeToken: messageForNativeToken,
    messageForPToken: messageForPToken,
  };
  txHistory.setHistoryInfo(historyObj);
  this.txHistory.PrivacyTokenTx.unshift(txHistory);
}

// getNormalTxHistory return history of normal txs
function getNormalTxHistory() {
  return this.txHistory.NormalTx;
}

// getPrivacyTokenTxHistory return history of normal txs
function getPrivacyTokenTxHistory() {
  return this.txHistory.PrivacyTokenTx;
}

async function saveTxHistory({ tx }) {
  new Validator("tx", tx).required().object();
  console.log("tx", tx);
}

export default {
  saveNormalTxHistory,
  savePrivacyTokenTxHistory,
  getNormalTxHistory,
  getPrivacyTokenTxHistory,
  saveTxHistory,
};
