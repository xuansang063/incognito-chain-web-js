import { PRVIDSTR } from "@lib/core";
import Validator from "@lib/utils/validator";
import intersectionBy from "lodash/intersectionBy";
import differenceBy from "lodash/differenceBy";
import bn from "bn.js";
import { ErrorObject } from "@lib/common/errorhandler";
import { isJsonString } from "@lib/utils/json";
import endsWith from "lodash/endsWith";
import {
  META_TYPE,
  TX_STATUS,
  TX_TYPE,
  TX_TYPE_STR,
} from "./account.constants";

const TX_HISTORY = "TX_HISTORY";

function mappingTxDetail({ tx, tokenID } = {}) {
  try {
    new Validator("tx", tx).required().object();
    new Validator("tokenID", tokenID).required().string();
    if (!tx) {
      return {};
    }
    const isPRV = tokenID === PRVIDSTR;
    const { LockTime, Fee, Metadata, Hash, Info, Type } = tx || {};
    const metadata = isJsonString(Metadata) ? JSON.parse(Metadata) : {};
    const metaType = metadata?.Type;
    let TypeStr = "";
    if (isPRV) {
      switch (Type) {
        case "cv":
          TypeStr = "Convert PRV";
          break;
        case "n":
          TypeStr = META_TYPE[metaType] || "";
          break;
        default:
          TypeStr = "Skip";
          break;
      }
    } else {
      switch (Type) {
        case "tcv":
          TypeStr = "Convert Token";
          break;
        case "tp":
          TypeStr = META_TYPE[metaType] || "";
          break;
        default:
          TypeStr = "Skip";
          break;
      }
    }
    const result = {
      LockTime: endsWith(LockTime, "Z") ? `${LockTime}Z` : LockTime,
      Fee,
      Metadata,
      Info,
      TxHash: Hash,
      Type, // n: prv , tp: token, tcv: convert token, cv: convert prv
      TypeStr,
    };
    return result;
  } catch (error) {
    console.log("ERROR", error);
    throw error;
  }
}

function mappingTxs({ txs }) {
  try {
    if (!txs || txs.length === 0) {
      return [];
    }
    new Validator("txs", txs).required().array();
    console.log("TXS BEFORE MAPPING", txs.length);
    const result = txs
      .filter((tx) => tx?.TypeStr !== "Skip")
      .map((tx) =>
        tx?.TypeStr !== "" ? { ...tx, TxTypeStr: tx?.TypeStr } : tx
      );
    console.log("TXS AFTER MAPPING", result.length);
    return result;
  } catch (error) {
    throw error;
  }
}

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
    if (spentCoins.length === 0) {
      return setKeyImages;
    }
    const keyImages = spentCoins.map((coin) => coin?.KeyImage);
    if (keyImages.length === 0) {
      return setKeyImages;
    }
    const shardID = this.getShardId();
    let txs = await this.rpcCoinService.apiGetTxsBySender({
      shardID,
      keyImages,
    });
    if (!txs || txs.length === 0) {
      return setKeyImages;
    }
    txs = txs
      .map((tx) => tx?.TxDetail)
      .map((tx, index) => ({
        ...this.mappingTxDetail({ tx, tokenID }),
        KeyImage: keyImages[index],
        Value: spentCoins[index].Value,
      }))
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
    if (outputCoins.length === 0) {
      return setPublicKeys;
    }
    const pubKeys = outputCoins.map((coin) => coin.PublicKey);
    if (pubKeys.length === 0 || !pubKeys) {
      return setPublicKeys;
    }
    const txsByPubkey = await this.rpcCoinService.apiGetTxsByPublicKey({
      pubKeys,
    });
    if (txsByPubkey.length !== outputCoins.length) {
      throw new Error(ErrorObject.GetTxsByPubKeysFail);
    }
    if (txsByPubkey.length === 0 || !txsByPubkey) {
      return setPublicKeys;
    }
    txsByPubkey
      .map((tx) => tx?.TxDetail)
      .map((tx, index) => ({
        ...this.mappingTxDetail({ tx, tokenID }),
        PublicKey: pubKeys[index],
        Value: outputCoins[index].Value,
      }))
      .map((tx) => {
        const { TxHash, Value } = tx;
        const indexTx = setPublicKeys.findIndex((tx) => tx?.TxHash === TxHash);
        if (indexTx === -1) {
          setPublicKeys.push({
            ...tx,
            Amount: new bn(Value).toString(),
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
      const { Fee, TxHash, Amount: AmountTxKeyImg = 0, Type } = tx;
      const txPubKey = publicKeys.find((tx) => tx.TxHash === TxHash);
      const { Amount: AmountTxPubKey = 0 } = txPubKey;
      const amount = new bn(AmountTxKeyImg)
        .sub(new bn(AmountTxPubKey))
        .sub(new bn(Type === "n" ? Fee : 0));
      return {
        ...tx,
        Amount: amount.toString(),
        TxType: TX_TYPE.SEND,
        TxTypeStr: TX_TYPE_STR[TX_TYPE.SEND],
      };
    });
    txsTransactor = this.mappingTxs({ txs: txsTransactor });
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
    txsReceiver = this.mappingTxs({ txs: txsReceiver });
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
    // let task = [
    //   this.getTxsTransactor({ tokenID }),
    //   this.getTxsByReceiver({ tokenID }),
    // ];
    // const [txsTransactor, txsReceiver] = await Promise.all(task);
    result.txsTransactor = txsTransactor || [];
    result.txsReceiver = txsReceiver || [];
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
  mappingTxs,
  mappingTxDetail,
};
