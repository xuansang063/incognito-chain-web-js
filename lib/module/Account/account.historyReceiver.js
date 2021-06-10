import { CustomError, ErrorObject } from "@lib/common/errorhandler";
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

export default {
  getKeySetPublickKeysStorage,
  getSetPublicKeys,
  getTxsReceiver,
};
