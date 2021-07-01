import { encryptMessageOutCoin } from "@lib/core";
import Validator from "@lib/utils/validator";

/**
 * @param {PaymentAddress: string, Amount: string, Message: string }} prvPayments
 * @param {number} fee
 * @param {string} info
 * @param {object} metadata
 * @param {boolean} isEncryptMessage
 * @param {function} txHandler
 */
async function createAndSendNativeToken({
  transfer: { prvPayments = [], fee, info = "" },
  extra: {
    metadata = null,
    isEncryptMessage = false,
    txHandler = null,
    txType,
    version,
  } = {},
} = {}) {
  new Validator("createAndSendNativeToken-prvPayments", prvPayments)
    .required()
    .paymentInfoList();
  new Validator("createAndSendNativeToken-fee", fee).required().amount();
  new Validator("createAndSendNativeToken-info", info).string();
  new Validator("createAndSendNativeToken-metadata", metadata).object();
  new Validator(
    "createAndSendNativeToken-isEncryptMessage",
    isEncryptMessage
  ).boolean();
  new Validator("createAndSendNativeToken-txType", txType).required().number();
  new Validator("createAndSendNativeToken-version", version)
    .required()
    .number();
  await this.updateProgressTx(10, "Encrypting Message");
  const isEncodeOnly = !isEncryptMessage;
  prvPayments = await encryptMessageOutCoin(prvPayments, isEncodeOnly);
  try {
    const tx = await this.transact({
      transfer: { prvPayments, fee, info },
      extra: { metadata, txHandler, txType, version },
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
    version,
  } = {},
}) {
  new Validator(
    "createAndSendPrivacyToken-prvPayments",
    prvPayments
  ).paymentInfoList();
  new Validator("createAndSendPrivacyToken-tokenPayments", tokenPayments)
    .required()
    .paymentInfoList();
  new Validator("createAndSendPrivacyToken-fee", fee).required().amount();
  new Validator("createAndSendPrivacyToken-info", info).string();
  new Validator("createAndSendPrivacyToken-tokenID", tokenID).string();
  new Validator("createAndSendPrivacyToken-metadata", metadata).object();
  new Validator(
    "createAndSendPrivacyToken-isEncryptMessage",
    isEncryptMessage
  ).boolean();
  new Validator(
    "createAndSendPrivacyToken-isEncryptMessageToken",
    isEncryptMessageToken
  ).boolean();
  new Validator("createAndSendPrivacyToken-txType", txType).required().number();
  new Validator("createAndSendPrivacyToken-version", version)
    .required()
    .number();
  await this.updateProgressTx(10, "Encrypting Message");
  let isEncodeOnly = !isEncryptMessage;
  prvPayments = await encryptMessageOutCoin(prvPayments, isEncodeOnly);
  isEncodeOnly = !isEncryptMessageToken;
  tokenPayments = await encryptMessageOutCoin(tokenPayments, isEncodeOnly);
  console.log("version", version);
  try {
    let tx = await this.transact({
      transfer: {
        prvPayments,
        fee,
        info,
        tokenID,
        tokenPayments,
      },
      extra: { metadata, txHandler, txType, txHashHandler, version },
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
