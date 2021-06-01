import { PRVIDSTR } from "@lib/core";
import Validator from "@lib/utils/validator";
import intersectionBy from "lodash/intersectionBy";
import differenceBy from "lodash/differenceBy";
import bn from "bn.js";
import { TX_STATUS, TX_TYPE, TX_TYPE_STR } from "./account.constants";

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

async function saveTxHistory({ tx } = {}) {
  new Validator("tx", tx).required().object();
  try {
    const { tokenID } = tx;
    new Validator("tokenID", tokenID).required().string();
    const key = this.getKeyTxHistoryByTokenId(tokenID);
    const txs = (await this.getAccountStorage(key)) || [];
    console.log("txs", txs.length);
    console.log("tokenID", tokenID);
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
        await this.saveTxHistory({ tx: { ...tx, status } });
      }
    }
  } catch (error) {
    throw error;
  }
  return tx;
}

async function getTxsTransactorFromStorage({ tokenID = PRVIDSTR } = {}) {
  new Validator("tokenID", tokenID).required().string();
  let txsTransactor = [];
  try {
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
  } catch (error) {
    throw error;
  }
  return txsTransactor;
}

async function getSetKeyImages({ tokenID }) {
  let setKeyImages = [];
  try {
    new Validator("tokenID", tokenID).required().string();
    const { spentCoins } = await this.getOutputCoins(tokenID);
    if (!spentCoins) {
      return setKeyImages;
    }
    const keyImages = spentCoins.map((coin) => coin?.KeyImage);
    const shardID = this.getShardId();
    let txs = await this.rpcCoinService.apiGetTxsBySender({
      shardID,
      keyImages,
    });
    if (!txs) {
      return setKeyImages;
    }
    txs = txs
      .map((tx) => tx?.TxDetail)
      .map(
        (
          { LockTime, Fee, Metadata, IsInBlock, IsInMempool, Hash, Info, Type },
          index
        ) => {
          const result = {
            // LockTime,
            Fee,
            Metadata,
            // IsInBlock,
            // IsInMempool,
            // Info,
            TxHash: Hash,
            KeyImage: keyImages[index],
            Value: spentCoins[index].Value,
            Type, // n: prv , tp: token, tcv: convert
          };
          return result;
        }
      )
      .map((tx) => {
        const { TxHash, Value } = tx;
        const foundTx = setKeyImages.find((tx) => tx?.TxHash === TxHash);
        if (!foundTx) {
          setKeyImages.push({ ...tx, Amount: new bn(Value).toString() });
        } else {
          foundTx.Amount = new bn(foundTx.Amount).add(new bn(Value));
        }
      });
  } catch (error) {
    throw error;
  }
  return setKeyImages;
}

async function getSetPublicKeys({ tokenID }) {
  let setPublicKeys = [];
  try {
    new Validator("tokenID", tokenID).required().string();
    const { outputCoins } = await this.getOutputCoins(tokenID);
    if (!outputCoins) {
      return setPublicKeys;
    }
    outputCoins.map((coin) => {
      const { TxHash, Value, PublicKey } = coin;
      const indexTx = setPublicKeys.findIndex((tx) => tx?.TxHash === TxHash);
      if (indexTx === -1) {
        setPublicKeys.push({
          TxHash,
          Amount: new bn(Value).toString(),
          PublicKey,
        });
      } else {
        setPublicKeys[indexTx].Amount = new bn(foundTx.Amount)
          .add(new bn(Value))
          .toString();
      }
    });
  } catch (error) {
    throw error;
  }
  return setPublicKeys;
}

function getTxsTransactor({ keyImages, publicKeys, tokenID }) {
  let txsTransactor;
  try {
    new Validator("tokenID", tokenID).required().string();
    new Validator("keyImages", keyImages).required().array();
    new Validator("publicKeys", publicKeys).required().array();
    let intersectHash = intersectionBy(keyImages, publicKeys, "TxHash");
    txsTransactor = intersectHash.map((tx) => {
      const { Fee, TxHash, Amount: AmountTxKeyImg = 0 } = tx;
      const txPubKey = publicKeys.find((tx) => tx.TxHash === TxHash);
      const { Amount: AmountTxPubKey = 0 } = txPubKey;
      const amount = new bn(AmountTxKeyImg)
        .sub(new bn(AmountTxPubKey))
        .sub(new bn(tokenID === PRVIDSTR ? Fee : 0));
      return {
        ...tx,
        Amount: amount.toString(),
        TxType: TX_TYPE.SEND,
        TxTypeStr: TX_TYPE_STR[TX_TYPE.SEND],
      };
    });
  } catch (error) {
    throw error;
  }
  return txsTransactor;
}

function getTxsReceiver({ keyImages, publicKeys, tokenID }) {
  let txsReceiver;
  try {
    new Validator("tokenID", tokenID).required().string();
    new Validator("keyImages", keyImages).required().array();
    new Validator("publicKeys", publicKeys).required().array();
    txsReceiver = differenceBy(publicKeys, keyImages, "TxHash").map((tx) => ({
      ...tx,
      TxType: TX_TYPE.RECEIVE,
      TxTypeStr: TX_TYPE_STR[TX_TYPE.RECEIVE],
    }));
  } catch (error) {
    throw error;
  }
  return txsReceiver;
}

async function getTxsHistory({ tokenID = PRVIDSTR } = {}) {
  new Validator("tokenID", tokenID).required().string();
  let result = {
    txsTransactor: [],
    txsReceiver: [],
  };

  try {
    const task = [
      this.getSetKeyImages({ tokenID }),
      this.getSetPublicKeys({ tokenID }),
    ];
    const [keyImages, publicKeys] = await Promise.all(task);
    const txsTransactor = this.getTxsTransactor({
      keyImages,
      publicKeys,
      tokenID,
    });
    const txsReceiver = this.getTxsReceiver({
      keyImages,
      publicKeys,
      tokenID,
    });
    console.log("\\n\ntxsTransactor", txsTransactor);
    console.log("\\n\txsReceiver", txsReceiver);
    // let task = [
    //   this.getTxsTransactor({ tokenID }),
    //   this.getTxsByReceiver({ tokenID }),
    // ];
    // const [txsTransactor, txsReceiver] = await Promise.all(task);
    // result.txsTransactor = txsTransactor || [];
    // result.txsReceiver = txsReceiver || [];
  } catch (error) {
    throw error;
  }
  return result;
}

async function getTransactorHistoriesByTokenID({ tokenId = PRVIDSTR } = {}) {
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
  getTransactorHistoriesByTokenID,
  getSetKeyImages,
  getSetPublicKeys,
  getTxsTransactorFromStorage,
  getTxsReceiver,
};
