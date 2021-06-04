import { encryptMessageOutCoin } from "@lib/core";
import Validator from "@lib/utils/validator";

/**
 * @param {PaymentAddress: string, Amount: string, Message: string }} prvPayments
 * @param {number} fee
 * @param {string} info
 * @param {object} metadata
 * @param {boolean} isEncryptMessage
 * @param {function} txHandler
 * @param {function} txHashHandler
 */
async function createAndSendNativeToken({
  transfer: { prvPayments = [], fee, info = "" },
  extra: {
    metadata = null,
    isEncryptMessage = false,
    txHandler = null,
    txType,
    txHashHandler = null
  } = {},
} = {}) {
  new Validator("prvPayments", prvPayments).required().paymentInfoList();
  new Validator("fee", fee).required().amount();
  new Validator("info", info).string();
  new Validator("metadata", metadata).object();
  new Validator("isEncryptMessage", isEncryptMessage).boolean();
  new Validator("txType", txType).required().number();
  await this.updateProgressTx(10, "Encrypting Message");
  const isEncodeOnly = !isEncryptMessage;
  prvPayments = await encryptMessageOutCoin(prvPayments, isEncodeOnly);
  try {
    const tx = await this.transact({
      transfer: { prvPayments, fee, info },
      extra: { metadata, txHandler, txType },
    });
    await this.updateProgressTx(100, "Completed");
    return tx;
  } catch (e) {
    throw e;
  }
}

/**
 *
 * @param {{PaymentAddress: string, Amount: number, Message: string }} prvPayments
 * @param {{PaymentAddress: string, Amount: number, Message: string }} tokenPayments
 * @param {number} fee
 * @param {string} info
 * @param {boolean} tokenID
 * @param {object} metadata
 * @param {boolean} isEncryptMessage
 * @param {boolean} isEncryptMessageToken
 * @param {function} txHandler
 * @param txType
 * @param txHashHandler
 */
async function createAndSendPrivacyToken({
  transfer: { prvPayments = [], tokenPayments = [], fee, info = "", tokenID },
  extra: {
    metadata = null,
    isEncryptMessage = false,
    isEncryptMessageToken = false,
    txHandler = null,
    txHashHandler = null,
    txType,
  } = {},
}) {
  new Validator("prvPayments", prvPayments).paymentInfoList();
  new Validator("tokenPayments", tokenPayments).required().paymentInfoList();
  new Validator("fee", fee).required().amount();
  new Validator("info", info).string();
  new Validator("tokenID", tokenID).string();
  new Validator("metadata", metadata).object();
  new Validator("isEncryptMessage", isEncryptMessage).boolean();
  new Validator("isEncryptMessageToken", isEncryptMessageToken).boolean();
  new Validator("txType", txType).required().number();
  if (fee < 0) {
    fee = 0;
  }
  await this.updateProgressTx(10, "Encrypting Message");
  let isEncodeOnly = !isEncryptMessage;
  prvPayments = await encryptMessageOutCoin(prvPayments, isEncodeOnly);
  isEncodeOnly = !isEncryptMessageToken;
  tokenPayments = await encryptMessageOutCoin(tokenPayments, isEncodeOnly);
  try {
    let tx = await this.transact({
      transfer: {
        prvPayments,
        fee,
        info,
        tokenID,
        tokenPayments,
      },
      extra: { metadata, txHandler, txType, txHashHandler },
    });
    await this.updateProgressTx(100, "Completed");
    return tx;
  } catch (e) {
    throw e;
  }
}

export default {
  createAndSendNativeToken,
  createAndSendPrivacyToken,
};
