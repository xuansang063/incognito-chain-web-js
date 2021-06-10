import { PRVIDSTR } from "@lib/core";
import Validator from "@lib/utils/validator";
import bn from "bn.js";
import { isJsonString } from "@lib/utils/json";
import endsWith from "lodash/endsWith";
import { META_TYPE, TX_STATUS, TX_STATUS_STR } from "./account.constants";

const TX_HISTORY = "TX_HISTORY";

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
      try {
        const status = await this.rpcTxService.apiGetTxStatus({ txId });
        if (Number.isFinite(status) && status >= 0) {
          await this.saveTxHistory({ tx: { ...tx, status } });
        }
      } catch {
        console.log("GET TX HISTORY BY TXID FAILED", tx?.txId);
      }
    }
  } catch (error) {
    throw error;
  }
  const result = this.mappingTxsTransactorFromStorage({ tokenID, tx });
  return result;
}

function getKeySetKeysStorageByTokenId({ tokenID, prefixName }) {
  new Validator("tokenID", tokenID).required().string();
  new Validator("prefixName", prefixName).required().string();
  const keyByTokenId = this.getKeyStorageByTokenId(tokenID);
  const key = `${prefixName}-${keyByTokenId}`;
  return key;
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

/** ==================================================
 * Get txs history include transactor + receiver
 */

function mappingTxDetail({ tx, tokenID } = {}) {
  try {
    new Validator("tx", tx).object();
    new Validator("tokenID", tokenID).required().string();
    if (!tx) {
      return {};
    }
    const isPRV = tokenID === PRVIDSTR;
    const { LockTime, Fee, Metadata, Hash, Info, Type, ...rest } = tx || {};
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
      ...rest,
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
      .map(
        ({
          Fee,
          LockTime,
          Amount,
          TxHash,
          TxType,
          TxTypeStr,
          Info,
          ReceiverAddress = "",
        }) => ({
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
          receiverAddress: ReceiverAddress,
        })
      );
    return result;
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

async function clearTxsHistory({ tokenID }) {
  try {
    new Validator("tokenID", tokenID).required().string();
    const keySetKeysImage = this.getKeySetKeysImageStorage({
      tokenID,
    });
    const keySetKeysPublic = this.getKeySetPublickKeysStorage({
      tokenID,
    });
    let task = [
      this.clearAccountStorage(keySetKeysImage),
      this.clearAccountStorage(keySetKeysPublic),
    ];
    await Promise.all(task);
  } catch (error) {
    console.log("ERROR CLEAR TXS HISTORY", error);
  }
}

async function getTxsHistory({ tokenID }) {
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
    let [setKeyImages, setPublicKeys] = await Promise.all(task);
    console.log("setKeyImages", setKeyImages.length);
    console.log("setPublicKeys", setPublicKeys.length);
    let keyImages = this.mappingSetKeys(setKeyImages);
    let publicKeys = this.mappingSetKeys(setPublicKeys);
    let txsTransactor = await this.getTxsTransactor({
      keyImages,
      publicKeys,
      tokenID,
    });
    console.log("txsTransactor", txsTransactor.length);
    let txsReceiver = this.getTxsReceiver({
      keyImages,
      publicKeys,
      tokenID,
    });
    console.log("txsReceiver", txsReceiver.length);
    result.txsTransactor = txsTransactor || [];
    result.txsReceiver = txsReceiver || [];
  } catch (error) {
    await clearTxsHistory({ tokenID });
    throw error;
  }
  return result;
}

export default {
  getNormalTxHistory,
  getPrivacyTokenTxHistory,
  saveTxHistory,
  getTxsHistory,
  getKeyTxHistoryByTokenId,
  getTxHistoryByTxID,
  getTransactorHistoriesByTokenID,
  mappingTxs,
  mappingTxDetail,
  setSetKeysStorage,
  getSetKeysStorage,
  getKeySetKeysStorageByTokenId,
  mappingSetKeys,
  clearTxsHistory,
};
