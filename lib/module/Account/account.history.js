import { PRVIDSTR } from "@lib/core";
import Validator from "@lib/utils/validator";
import intersectionBy from "lodash/intersectionBy";
import difference from "lodash/difference";
import differenceBy from "lodash/differenceBy";
import bn from "bn.js";
import { ErrorObject } from "@lib/common/errorhandler";
import { isJsonString } from "@lib/utils/json";
import endsWith from "lodash/endsWith";
import {
  MAX_FEE_PER_TX,
  META_TYPE,
  TX_STATUS,
  TX_STATUS_STR,
  TX_TYPE,
  TX_TYPE_STR,
} from "./account.constants";

const TX_HISTORY = "TX_HISTORY";
const SET_KEY_IMAGES = "SET_KEY_IMAGES";
const SET_PUBLIC_KEY = "SET_PUBLIC_KEY";

function mappingTxDetail({ tx, tokenID } = {}) {
  try {
    new Validator("tx", tx).object();
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
        case "s":
        case "rs":
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
      LockTime,
      Fee,
      Metadata,
      Info,
      TxHash: Hash,
      Type, // n: prv , tp: token, tcv: convert token, cv: convert prv
      TypeStr,
    };
    return result;
  } catch (error) {
    throw error;
  }
}

function mappingTxs({ txs }) {
  try {
    if (!txs || txs.length === 0) {
      return [];
    }
    new Validator("txs", txs).required().array();
    const result = txs
      .filter((tx) => tx?.TypeStr !== "Skip")
      .map((tx) =>
        tx?.TypeStr !== "" ? { ...tx, TxTypeStr: tx?.TypeStr } : tx
      )
      .map(({ Fee, LockTime, Amount, TxHash, TxType, TxTypeStr, Info }) => ({
        time: new Date(
          !endsWith(LockTime, "Z") ? `${LockTime}Z` : LockTime
        ).getTime(),
        fee: Fee,
        amount: Amount,
        txId: TxHash,
        txType: TxType,
        txTypeStr: TxTypeStr,
        memo: Info,
        status: TX_STATUS.TXSTATUS_SUCCESS,
        statusStr: TX_STATUS_STR[TX_STATUS.TXSTATUS_SUCCESS],
      }));
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

function getKeyTxHistoryByTokenId(tokenId) {
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
    const isExisted = txs.find((i) => i.txId === tx.txId);
    let newTxs = [];
    newTxs = isExisted
      ? [...txs].map((i) =>
          i.txId === tx.txId ? { ...tx, updatedAt: new Date().getTime() } : i
        )
      : [{ ...tx, createdAt: new Date().getTime() }, ...txs];
    await this.setAccountStorage(key, newTxs);
  } catch (error) {
    throw error;
  }
}

async function getTxHistoryByTxID({ tokenID, txId } = {}) {
  let tx;
  try {
    new Validator("tokenID", tokenID).required().string();
    new Validator("txId", txId).required().string();
    const key = this.getKeyTxHistoryByTokenId(tokenID);
    const txs = (await this.getAccountStorage(key)) || [];
    tx = txs.find((t) => t?.txId === txId);
    if (tx) {
      const status = await this.rpcTxService.apiGetTxStatus({ txId });
      if (Number.isFinite(status) && status >= 0) {
        await this.saveTxHistory({ tx: { ...tx, status } });
      }
    }
  } catch (error) {
    throw error;
  }
  const result = this.mappingTxsTransactorFromStorage({ tokenID, tx });
  return result;
}

function mappingTxsTransactorFromStorage({ tokenID, tx }) {
  new Validator("tokenID", tokenID).required().string();
  new Validator("tx", tx).required().object();
  try {
    const {
      txId,
      amount,
      status,
      txType,
      tx: txDetail,
      fee,
      receivers,
      tokenReceivers,
      memo,
      tokenAmount,
    } = tx;
    const isMainCrypto = tokenID === PRVIDSTR;
    const _tx = isMainCrypto ? txDetail : txDetail?.Tx;
    const statusStr = TX_STATUS_STR[status];
    const txTypeStr = TX_TYPE_STR[txType];
    const time = _tx?.LockTime * 1000;
    const receiverAddress = isMainCrypto ? receivers[0] : tokenReceivers[0];
    const _amount = isMainCrypto ? amount : tokenAmount;
    const result = {
      txId,
      amount: _amount,
      status,
      statusStr,
      txType,
      txTypeStr,
      time,
      fee,
      receiverAddress,
      memo,
    };
    return result;
  } catch (error) {
    throw error;
  }
}

async function getTxsTransactorFromStorage({ tokenID = PRVIDSTR } = {}) {
  console.log("getTxsTransactorFromStorage", tokenID);
  new Validator("tokenID", tokenID).required().string();
  let txsTransactor = [];
  try {
    const key = this.getKeyTxHistoryByTokenId(tokenID);
    console.log("KEY", key);
    let txs = (await this.getAccountStorage(key)) || [];
    console.log("txs", txs.length);
    if (!txs) {
      return [];
    }
    let task = [];
    task = txs
      .filter((tx) => tx.status !== TX_STATUS.TXSTATUS_SUCCESS)
      .map((tx) => this.getTxHistoryByTxID({ tokenID, txId: tx?.txId }));
    await Promise.all(task);
    txsTransactor = (await this.getAccountStorage(key)) || [];
    txsTransactor = txsTransactor.map((tx) => ({
      ...this.mappingTxsTransactorFromStorage({ tokenID, tx }),
    }));
  } catch (error) {
    throw error;
  }
  return txsTransactor;
}

// Set keys

function getKeySetKeysStorageByTokenId({ tokenID, prefixName }) {
  new Validator("tokenID", tokenID).required().string();
  new Validator("prefixName", prefixName).required().string();
  const keyByTokenId = this.getKeyStorageByTokenId(tokenID);
  const key = `${prefixName}-${keyByTokenId}`;
  return key;
}

async function getSetKeysStorage({ key }) {
  try {
    new Validator("key", key).required().string();
    return (await this.getAccountStorage(key)) || [];
  } catch (error) {
    throw error;
  }
}

async function setSetKeysStorage({ tokenID, setKeys, key }) {
  try {
    new Validator("tokenID", tokenID).required().string();
    new Validator("key", key).required().string();
    new Validator("setKeys", setKeys).required().array();
    const oldSetKeys = await this.getSetKeysStorage({ tokenID, key });
    const value =
      oldSetKeys.length === 0 ? setKeys : [...setKeys, ...oldSetKeys];
    return this.setAccountStorage(key, value);
  } catch (error) {
    throw error;
  }
}

function mappingSetKeys(setKeys) {
  new Validator("setKeys", setKeys).required().array();
  let keys = [];
  try {
    if (setKeys.length === 0) {
      return keys;
    }
    setKeys
      .filter((tx) => !!tx?.TxHash)
      .forEach((tx) => {
        const { TxHash, Value } = tx || {};
        const indexTx = keys.findIndex((tx) => tx?.TxHash === TxHash);
        if (indexTx === -1) {
          keys.push({ ...tx, Amount: new bn(Value).toString() });
        } else {
          const foundTx = keys[indexTx];
          keys[indexTx].Amount = new bn(foundTx.Amount)
            .add(new bn(Value))
            .toString();
        }
      });
  } catch (error) {
    throw error;
  }
  return keys;
}

// Set key images

function getKeySetKeysImageStorage({ tokenID }) {
  try {
    new Validator("tokenID", tokenID).required().string();
    return this.getKeySetKeysStorageByTokenId({
      tokenID,
      prefixName: SET_KEY_IMAGES,
    });
  } catch (error) {
    throw error;
  }
}

async function getSetKeyImages({ tokenID }) {
  new Validator("tokenID", tokenID).required().string();
  const key = this.getKeySetKeysImageStorage({ tokenID });
  try {
    const oldSetKeyImages = await this.getSetKeysStorage({ key });
    const { spentCoins } = await this.getOutputCoins(tokenID);
    if (spentCoins.length === 0) {
      return oldSetKeyImages;
    }
    const oldKeyImages = oldSetKeyImages.map((i) => i?.KeyImage);
    const spentCoinsKeyImages = spentCoins.map((coin) => coin?.KeyImage);
    const keyImages = difference(spentCoinsKeyImages, oldKeyImages);
    if (keyImages.length === 0) {
      return oldSetKeyImages;
    }
    const shardID = this.getShardId();
    let txs = await this.rpcCoinService.apiGetTxsBySender({
      shardID,
      keyImages,
    });
    if (txs.length !== keyImages.length) {
      throw new Error(ErrorObject.GetTxsByKeyImagesFail.description);
    }
    if (txs.length === 0) {
      return oldSetKeyImages;
    }
    const setKeyImages = txs
      .map((tx) => tx?.TxDetail)
      .map((tx, index) => {
        const KeyImage = keyImages[index];
        const foundCoin = spentCoins.find((coin) => coin.KeyImage === KeyImage);
        const Value = foundCoin?.Value || 0;
        return {
          ...this.mappingTxDetail({ tx, tokenID }),
          KeyImage,
          Value,
        };
      });
    await this.setSetKeysStorage({ tokenID, setKeys: setKeyImages, key });
  } catch (error) {
    throw error;
  }
  return await this.getSetKeysStorage({ key });
}

// Set public keys

function getKeySetPublickKeysStorage({ tokenID }) {
  try {
    new Validator("tokenID", tokenID).required().string();
    return this.getKeySetKeysStorageByTokenId({
      tokenID,
      prefixName: SET_PUBLIC_KEY,
    });
  } catch (error) {
    throw error;
  }
}

async function getSetPublicKeys({ tokenID }) {
  new Validator("tokenID", tokenID).required().string();
  const key = this.getKeySetPublickKeysStorage({ tokenID });
  try {
    const { outputCoins } = await this.getOutputCoins(tokenID);
    const oldSetPublicKeys = await this.getSetKeysStorage({ key });
    if (outputCoins.length === 0) {
      return oldSetPublicKeys;
    }
    const oldPublicKeys = oldSetPublicKeys.map((i) => i?.PublicKey);
    const outputCoinsPublicKeys = outputCoins.map((coin) => coin?.PublicKey);
    const pubKeys = difference(outputCoinsPublicKeys, oldPublicKeys);
    if (pubKeys.length === 0) {
      return oldSetPublicKeys;
    }
    const txs = await this.rpcCoinService.apiGetTxsByPublicKey({
      pubKeys,
    });
    if (txs.length !== pubKeys.length) {
      throw new Error(ErrorObject.GetTxsByPubKeysFail.description);
    }
    if (txs.length === 0) {
      return oldSetPublicKeys;
    }
    const setPublicKeys = txs
      .map((tx) => tx?.TxDetail)
      .map((tx, index) => {
        const PublicKey = pubKeys[index];
        const foundCoin = outputCoins.find(
          (coin) => coin.PublicKey === PublicKey
        );
        const Value = foundCoin?.Value || 0;
        return {
          ...this.mappingTxDetail({ tx, tokenID }),
          PublicKey,
          Value,
        };
      });
    await this.setSetKeysStorage({ tokenID, setKeys: setPublicKeys, key });
  } catch (error) {
    throw error;
  }
  return await this.getSetKeysStorage({ key });
}

// Get txs transactor

async function getTxsTransactor({ keyImages, publicKeys, tokenID }) {
  new Validator("tokenID", tokenID).required().string();
  new Validator("keyImages", keyImages).required().array();
  new Validator("publicKeys", publicKeys).required().array();
  let txsTransactor = [];
  try {
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
    const txsTransactorStorage = await this.getTxsTransactorFromStorage({
      tokenID,
    });
    if (txsTransactorStorage.length !== 0) {
      txsTransactor = txsTransactor.map((tx) => {
        let receiverAddress = "";
        const foundIndex = txsTransactorStorage.findIndex(
          (txs) => txs?.txId === tx?.txId
        );
        if (foundIndex > -1) {
          receiverAddress = txsTransactorStorage[foundIndex].receiverAddress;
        }
        return {
          ...tx,
          receiverAddress,
        };
      });
    }
    const differenceTxs = differenceBy(
      txsTransactorStorage,
      txsTransactor,
      "txId"
    );
    txsTransactor = [...txsTransactor, ...differenceTxs];
  } catch (error) {
    throw error;
  }
  return txsTransactor;
}

// Get txs receiver

function getTxsReceiver({ keyImages, publicKeys, tokenID }) {
  new Validator("tokenID", tokenID).required().string();
  new Validator("keyImages", keyImages).required().array();
  new Validator("publicKeys", publicKeys).required().array();
  let txsReceiver = [];
  try {
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
  let result = {
    txsTransactor: [],
    txsReceiver: [],
  };
  try {
    new Validator("tokenID", tokenID).required().string();
    const task = [
      this.getSetKeyImages({ tokenID }),
      this.getSetPublicKeys({ tokenID }),
    ];
    let [setKeyImages, setPublicKeys] = await Promise.all(task);
    let keyImages = this.mappingSetKeys(setKeyImages);
    let publicKeys = this.mappingSetKeys(setPublicKeys);
    const txsTransactor = await this.getTxsTransactor({
      keyImages,
      publicKeys,
      tokenID,
    });
    const txsReceiver = this.getTxsReceiver({
      keyImages,
      publicKeys,
      tokenID,
    });
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
  getSetPublicKeys,
  getTxsTransactorFromStorage,
  getTxsReceiver,
  mappingTxs,
  mappingTxDetail,
  setSetKeysStorage,
  getSetKeysStorage,
  getKeySetKeysStorageByTokenId,
  mappingSetKeys,
  getKeySetKeysImageStorage,
  getKeySetPublickKeysStorage,
  getSetKeyImages,
  getSetPublicKeys,
  mappingTxsTransactorFromStorage,
};
