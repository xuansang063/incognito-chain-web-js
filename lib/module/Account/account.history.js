// saveNormalTxHistory save history of normal tx to history account
import bn from "bn.js";
import { PRVIDSTR } from "@lib/core";
import Validator from "@lib/utils/validator";
import { checkDecode } from "@lib/common/base58";
import { base64Encode } from "@lib/privacy/utils";
import { TX_TYPE } from "./account.constants";
import { PrivacyVersion } from '@lib/core/constants';
import { flatten, orderBy } from 'lodash';

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
    console.log("tokenId", tokenId)
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
    result = (await this.getAccountStorage(key)) || [];
  } catch (error) {
    throw error;
  }
  return result;
}

async function determinedTypeOfTxReceiver({ tx }) {
  new Validator("tx", tx).required().object();
  try {
    const { spentCoins } = await this.getOutputCoins(tokenID);
    const spentCoinsMapping = spentCoins.map(({ KeyImage, Value }) => ({
      KeyImage,
      Value,
    }));
    const inputCoinsKeyImg = tx?.InputCoins.map((coin) => coin?.KeyImage) || [];
    const isSendTx =
      inputCoinsKeyImg.length > 0
        ? inputCoinsKeyImg.every((KeyImage) => {
            const coin = spentCoinsMapping.find(
              (coin) => coin?.KeyImage === KeyImage
            );
            return !!coin;
          })
        : false;
    return isSendTx;
  } catch (error) {
    throw error;
  }
}

async function calTotalAmountSpentCoin({ tx }) {
  try {
    new Validator("tx", tx).required().object();
    const { spentCoins } = await this.getOutputCoins(tokenID);
    const spentCoinsMapping = spentCoins.map(({ KeyImage, Value }) => ({
      KeyImage,
      Value,
    }));
    const inputCoinsKeyImg = tx?.InputCoins.map((coin) => coin?.KeyImage) || [];
    let totalAmountSpentCoin = new bn("0");
    inputCoinsKeyImg.forEach((KeyImage) => {
      const coin = spentCoinsMapping.find(
        (coin) => coin?.KeyImage === KeyImage
      );
      totalAmountSpentCoin = totalAmountSpentCoin.add(coin?.Value || "0");
    });
    return totalAmountSpentCoin;
  } catch (error) {
    throw error;
  }
}

async function calTotalAmountOutputCoin({ tx }) {
  new Validator("tx", tx).required().object();
  try {
    const { outputCoins } = await this.getOutputCoins(tokenID);
    const outputCoinsMapping = outputCoins.map(({ PublicKey, Value }) => ({
      PublicKey,
      Value,
    }));
    const outputCoinPubKey = tx?.OutputCoinPubKey || [];
    let totalAmountOutputCoin = outputCoinPubKey.reduce((total, PublicKey) => {
      const coinByTxPublicKey = outputCoinsMapping.find((outcoin) => {
        return outcoin?.PublicKey === PublicKey;
      });
      total = total.add(new bn(coinByTxPublicKey?.Value || "0"));
      return total;
    }, new bn("0"));
    return totalAmountOutputCoin;
  } catch (error) {
    throw error;
  }
}

async function getTxsByReceiver({
  tokenID = PRVIDSTR,
  // limit = 100,
  // offset = 0,
} = {}) {
  try {
    new Validator("tokenID", tokenID).required().string();
    // new Validator("limit", limit).required().number();
    // new Validator("offset", offset).required().number();
    const otaKey = this.getOTAKey();
    new Validator("otaKey", otaKey).required().string();
    let txs = [];
    let oversize = false;
    let offset = 0;
    let limit = 10;
    while (!oversize) {
      const data =
        (await this.rpcCoinService.apiGetTxsByReceiver({
          limit,
          offset,
          otaKey,
          tokenID,
        })) || [];
      txs = [...[...txs], ...[...data]];
      if (data.length < limit) {
        oversize = true;
      } else {
        offset = offset + limit;
      }
    }

    txs = txs
      .map((tx) => {
        const {
          Hash,
          ProofDetail: { InputCoins = [], OutputCoins = [] } = {},
          OutputCoinPubKey = [],
        } = tx.TxDetail || {};
        return {
          Hash,
          InputCoins,
          OutputCoins,
          OutputCoinPubKey,
        };
      })
      .map(async (tx) => {
        let totalAmountOutputCoin = await this.calTotalAmountOutputCoin({ tx });
        const isSendTx = await this.determinedTypeOfTxReceiver({ tx });
        let totalAmountSpentCoin;
        if (isSendTx) {
          totalAmountSpentCoin = await this.calTotalAmountSpentCoin({ tx });
        }
        const _tx = {
          txId: tx.Hash,
          amount: isSendTx
            ? totalAmountSpentCoin.sub(totalAmountOutputCoin).toString()
            : totalAmountOutputCoin.toString(),
          txType: isSendTx ? TX_TYPE.SEND : TX_TYPE.RECEIVE,
          type: isSendTx ? "Send" : "Receive",
        };
        console.log("\n_tx", _tx);
        return _tx;
      });

    return await Promise.all(txs);
  } catch (error) {
    throw error;
  }
}

class PDexHistoryStoragePureModel {
  constructor({ history, accountName }) {
    const { metadata, txId, status, tx } = history;
    this.sellAmount = metadata?.SellAmount;
    this.buyAmount = metadata?.MinAcceptableAmount;
    this.buyTokenId = metadata?.TokenIDToBuyStr;
    this.sellTokenId = metadata?.TokenIDToSellStr;

    this.requestTx = txId;
    this.status = status;

    this.networkFee = tx?.Fee;
    this.requesttime = tx?.LockTime;
    this.accountName = accountName;
  }
}

async function getTxPdexStorageHistories() {
  this.setPrivacyVersion(PrivacyVersion.ver2);
  const version = this.privacyVersion;
  const otaKey = this.getOTAKey();
  const keyInfo = await this.rpcCoinService.apiGetKeyInfo({
    key: otaKey,
    version,
  });

  let tokenIds = [];
  const coinsIndex = keyInfo?.coinindex
  if (coinsIndex) {
    tokenIds = Object.keys(coinsIndex);
  }
  const tasks = tokenIds.map(async (tokenId) => {
    const histories = (await this.getTxHistory({ tokenId })) || [];
    return histories.filter(item => item?.txType === TX_TYPE.TRADE);
  })

  const accountName = this.name || '';
  return orderBy(flatten(await Promise.all(tasks))).map(history => new PDexHistoryStoragePureModel({ history, accountName }));
}

export default {
  getNormalTxHistory,
  getPrivacyTokenTxHistory,
  saveTxHistory,
  getTxHistory,
  getKeyTxHistoryByTokenId,
  getTxHistoryByTxID,
  getTxsByReceiver,
  determinedTypeOfTxReceiver,
  calTotalAmountSpentCoin,
  getTxPdexStorageHistories,
};
