import { PRVIDSTR } from "@lib/core";
import Validator from "@lib/utils/validator";
import bn from "bn.js";
import { flatten, uniqBy } from "lodash";
import { TX_TYPE, LIMIT, TX_STATUS } from "./account.constants";
import { pagination } from "./account.utils";

async function determinedTypeOfTxReceiver({ tx, tokenID = PRVIDSTR } = {}) {
  new Validator("tx", tx).required().object();
  new Validator("tokenID", tokenID).required().string();
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

async function calTotalAmountSpentCoin({ tx, tokenID = PRVIDSTR } = {}) {
  try {
    new Validator("tokenID", tokenID).required().string();
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

async function calTotalAmountOutputCoin({ tx, tokenID = PRVIDSTR } = {}) {
  new Validator("tx", tx).required().object();
  new Validator("tokenID", tokenID).required().string();
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

async function getTxsByReceiver({ tokenID = PRVIDSTR } = {}) {
  try {
    new Validator("tokenID", tokenID).required().string();
    const otaKey = this.getOTAKey();
    new Validator("otaKey", otaKey).required().string();
    const keyInfo = (await this.getKeyInfo(tokenID)) || {};
    let total = 0;
    if (keyInfo && keyInfo.receivetxs && keyInfo.receivetxs[tokenID]) {
      total = keyInfo?.receivetxs[tokenID];
    }
    if (total === 0) {
      return [];
    }
    let { times, remainder } = pagination(total);
    remainder > 0 ? (times = times + 1) : false;
    const task = [...Array(times)].map((item, index) => {
      const offset = index * LIMIT;
      return this.rpcCoinService.apiGetTxsByReceiver({
        tokenID,
        otaKey,
        limit: LIMIT,
        offset,
      });
    });
    let txs = [];
    let result = (await Promise.all(task)) || [];
    txs = flatten(result);
    txs = uniqBy(txs, (tx) => tx?.TxDetail?.Hash);
    txs = txs
      .map((tx) => {
        const {
          Hash,
          ProofDetail: { InputCoins = [], OutputCoins = [] } = {},
          OutputCoinPubKey = [],
        } = tx?.TxDetail || {};
        return {
          Hash,
          InputCoins,
          OutputCoins,
          OutputCoinPubKey,
        };
      })
      .map(async (tx) => {
        let totalAmountOutputCoin = await this.calTotalAmountOutputCoin({
          tx,
          tokenID,
        });
        const isSendTx = await this.determinedTypeOfTxReceiver({ tx, tokenID });
        let totalAmountSpentCoin;
        if (isSendTx) {
          totalAmountSpentCoin = await this.calTotalAmountSpentCoin({
            tx,
            tokenID,
          });
        }
        const _tx = {
          txId: tx.Hash,
          amount: isSendTx
            ? totalAmountSpentCoin.sub(totalAmountOutputCoin).toString()
            : totalAmountOutputCoin.toString(),
          txType: isSendTx ? TX_TYPE.SEND : TX_TYPE.RECEIVE,
          typeStr: isSendTx ? "Send" : "Receive",
          status: TX_STATUS.TXSTATUS_SUCCESS,
          statusStr: "Success",
        };
        console.log("\n_tx", _tx);
        return _tx;
      });
    return await Promise.all(txs);
  } catch (error) {
    throw error;
  }
}

export default {
  determinedTypeOfTxReceiver,
  calTotalAmountSpentCoin,
  calTotalAmountOutputCoin,
  getTxsByReceiver,
};
