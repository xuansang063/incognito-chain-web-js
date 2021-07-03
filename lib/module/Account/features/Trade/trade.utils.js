import isEmpty from 'lodash/isEmpty'

export const pdexHistoryStoragePureModel = ({ history, accountName }) => {
  const { metadata, txId, status, tx } = history;
  return {
    sellAmount: metadata?.SellAmount,
    buyAmount: metadata?.MinAcceptableAmount,
    buyTokenId: metadata?.TokenIDToBuyStr,
    sellTokenId: metadata?.TokenIDToSellStr,
    requestTx: txId,
    status: status,
    networkFee: tx?.Fee,
    requestTime: tx?.LockTime,
    accountName: accountName,
  }
}

export const pdexHistoryPureModel = ({ history, accountName }) => {
  let responseTx;
  if (!isEmpty(history?.respondtx)) {
    responseTx = history?.respondtx;
  }
  let buyAmount = 0;
  const buyTokenId = history?.buytoken;
  if (buyTokenId && !isEmpty(history?.receive) && history?.receive[buyTokenId]) {
    buyAmount = history?.receive[buyTokenId];
  }
  return {
    sellAmount: history?.sell,
    requestTx: history?.requesttx,
    responseTx,
    status: history?.status,
    buyTokenId,
    sellTokenId: history?.selltoken,
    buyAmount,
    networkFee: history?.fee,
    requestTime: history?.requesttime,
    accountName: accountName,
  }
}
