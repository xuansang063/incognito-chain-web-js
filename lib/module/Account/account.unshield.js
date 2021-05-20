import { addressAsObject, KeySet } from "@lib/common/keySet";
import {
  BurningRequestMeta,
  encryptMessageOutCoin,
  getBurningAddress,
} from "@lib/core";
import Validator from "@lib/utils/validator";
import bn from "bn.js";
import { TX_TYPE } from "./account.constants";

// createAndSendBurningRequestTx create and send tx burning ptoken when withdraw
// remoteAddress (string) is an ETH/BTC address which users want to receive ETH/BTC (without 0x)

/** createAndSendBurningRequestTx
 * @param {{PaymentAddress: string, Amount: string, Message: string }} prvPayments
 * @param {number} fee
 * @param {string} info
 * @param {string} tokenID
 * @param {object} metadata
 * @param {boolean} burningType
 * @param {boolean} isEncryptMessage
 * @param {boolean} isEncryptMessageToken
 * @param {number} burnAmount
 * @param {string} remoteAddress
 *
 */
async function createAndSendBurningRequestTx({
  transfer: { fee, info = "", tokenID },
  extra: {
    burningType = BurningRequestMeta,
    isEncryptMessageToken = true,
    burnAmount,
    remoteAddress,
  } = {},
}) {
  try {
    new Validator("fee", fee).required().amount();
    new Validator("info", info).string();
    new Validator("tokenID", tokenID).required().string();
    new Validator("burningType", burningType).number();
    new Validator("disEncryptMessageToken", isEncryptMessageToken).boolean();
    new Validator("burnAmount", burnAmount).required().amount();
    new Validator("remoteAddress", remoteAddress).required().string();
    const burningTokenID = tokenID;
    if (remoteAddress.startsWith("0x")) {
      remoteAddress = remoteAddress.slice(2);
    }
    await this.updateProgressTx(10, "Encrypting Message");
    const burningAddress = await getBurningAddress(this.rpc);
    let tokenPayments = [
      {
        PaymentAddress: burningAddress,
        Amount: new bn(burnAmount).toString(),
        Message: "",
      },
    ];
    const isEncodeOnly = !isEncryptMessageToken;
    tokenPayments = await encryptMessageOutCoin(tokenPayments, isEncodeOnly);
    // use an empty payment address
    let emptyKeySet = new KeySet();
    await emptyKeySet.importFromPrivateKey(new Uint8Array(32));
    let addrForMd = addressAsObject(emptyKeySet.PaymentAddress);
    await this.updateProgressTx(15, "Generating Metadata");
    // prepare meta data for tx
    const burningReqMetadata = {
      BurnerAddress: addrForMd,
      BurningAmount: burnAmount,
      TokenID: burningTokenID,
      RemoteAddress: remoteAddress,
      Type: burningType,
    };
    console.log("burningReqMetadata", burningReqMetadata);
    const tx = await this.transact({
      transfer: {
        prvPayments: [],
        fee,
        info,
        tokenID: burningTokenID,
        tokenPayments,
      },
      extra: {
        metadata: burningReqMetadata,
        txType: TX_TYPE.BURN_DECENTRALIZED,
      },
    });
    await this.updateProgressTx(100, "Completed");
    return tx;
  } catch (error) {
    throw error;
  }
}
export default {
  createAndSendBurningRequestTx,
};
