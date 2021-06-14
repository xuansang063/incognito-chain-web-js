import { CustomError, ErrorObject } from "@lib/common/errorhandler";
import { isJsonString } from "@lib/utils/json";
import Validator from "@lib/utils/validator";
import difference from "lodash/difference";
import differenceBy from "lodash/differenceBy";
import { TX_TYPE, TX_TYPE_STR } from "./account.constants";

const SET_PUBLIC_KEY = "SET_PUBLIC_KEY";

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
    const outputCoins = await this.getListOutputCoinsStorage({ tokenID });
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
    throw new CustomError(
      ErrorObject.GetTxsReceiverFail,
      ErrorObject.GetTxsReceiverFail.description,
      error
    );
  }
  return txsReceiver;
}

function handleFilterTxsReceiverByTxsPToken({ txsReceiver, txsPToken }) {
  try {
    new Validator("txsReceiver", txsReceiver).required().array();
    new Validator("txsPToken", txsPToken).required().array();
    let _txsReceiver = [...txsReceiver];
    _txsReceiver = _txsReceiver.filter((txr) => {
      const { metaData } = txr;
      if (isJsonString(metaData)) {
        const parse = JSON.parse(metaData);
        const requestTxId = parse?.RequestedTxID;
        const type = parse?.Type;
        switch (type) {
          case 25:
          case 81: {
            const foundIndex = txsPToken.findIndex(
              (txp) => txp.incognitoTx === requestTxId
            );
            if (foundIndex > -1) {
              return false;
            }
          }
          default:
            break;
        }
      }
      return true;
    });
    return _txsReceiver;
  } catch (error) {
    console.log("FILTER TXS RECEIVER BY TXS PTOKEN FAILED", error);
  }
  return txsReceiver;
}

export default {
  getKeySetPublickKeysStorage,
  getSetPublicKeys,
  getTxsReceiver,
  handleFilterTxsReceiverByTxsPToken,
};
