import { addressAsObject, KeySet } from "@lib/common/keySet";
import {
  BurningRequestMeta,
  encryptMessageOutCoin,
  getBurningAddress,
} from "@lib/core";
import Validator from "@lib/utils/validator";
import bn from "bn.js";
import { TX_TYPE } from "@lib/module/Account/account.constants";
import { PRVIDSTR } from "@lib/core/constants";

// createAndSendBurningRequestTx create and send tx burning ptoken when withdraw
// remoteAddress (string) is an ETH/BTC address which users want to receive ETH/BTC (without 0x)

/** createAndSendBurningRequestTx
 * @param {{paymentAddressStr: string, amount: number}} prvPayments
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
  transfer: { fee, tokenID, info = "", prvPayments = [] },
  extra: {
    burningType = BurningRequestMeta,
    isEncryptMessageToken = true,
    burnAmount,
    remoteAddress,
    txHashHandler = null,
    version,
    burningCallback,
    burningMetadata = {}, //customize metadata
  } = {},
}) {
  try {
    new Validator("createAndSendBurningRequestTx-fee", fee).required().amount();
    new Validator("createAndSendBurningRequestTx-info", info).string();
    new Validator("createAndSendBurningRequestTx-tokenID", tokenID)
      .required()
      .string();
    new Validator(
      "createAndSendBurningRequestTx-burningType",
      burningType
    ).number();
    new Validator(
      "createAndSendBurningRequestTx-disEncryptMessageToken",
      isEncryptMessageToken
    ).boolean();
    new Validator("createAndSendBurningRequestTx-burnAmount", burnAmount)
      .required()
      .amount();
    new Validator("createAndSendBurningRequestTx-remoteAddress", remoteAddress)
      .required()
      .string();
    new Validator("createAndSendBurningRequestTx-prvPayments", prvPayments)
      .required()
      .array();
    new Validator("createAndSendBurningRequestTx-version", version)
      .required()
      .number();
    const burningTokenID = tokenID;
    if (remoteAddress.startsWith("0x")) {
      remoteAddress = remoteAddress.slice(2);
    }
    await this.updateProgressTx(10, "Encrypting Message");
    const burningAddress = await getBurningAddress(this.rpc);
    const isPRV = burningTokenID === PRVIDSTR;
    let tokenPayments = [];
    if (isPRV) {
      prvPayments = prvPayments.map((payment) => ({
        PaymentAddress: payment?.paymentAddress,
        Amount: new bn(payment?.amount).toString(),
        Message: "",
      }));
      prvPayments.push({
        PaymentAddress: burningAddress,
        Amount: new bn(burnAmount).toString(),
        Message: "",
      });
    } else {
      // token
      tokenPayments = [
        {
          PaymentAddress: burningAddress,
          Amount: new bn(burnAmount).toString(),
          Message: "",
        },
      ];
      prvPayments = prvPayments.map((payment) => ({
        PaymentAddress: payment?.paymentAddress,
        Amount: new bn(payment?.amount).toString(),
        Message: "",
      }));
    }
    console.log("tokenPayments", tokenPayments);
    console.log("prvPayments", prvPayments);
    const isEncodeOnly = !isEncryptMessageToken;
    tokenPayments = await encryptMessageOutCoin(tokenPayments, isEncodeOnly);
    prvPayments = await encryptMessageOutCoin(prvPayments, isEncodeOnly);
    console.log("tokenPayments", tokenPayments);
    console.log("prvPayments", prvPayments);
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
      ...burningMetadata,
    };
    console.log("burningReqMetadata", burningReqMetadata);
    let transactTransfer = {};
    if (isPRV) {
      transactTransfer = {
        prvPayments,
        fee,
        info,
        tokenID: burningTokenID,
        tokenPayments: null,
      };
    } else {
      transactTransfer = {
        prvPayments,
        fee,
        info,
        tokenID: burningTokenID,
        tokenPayment,
      };
    }
    console.log("transactTransfer", transactTransfer);
    const tx = await this.transact({
      transfer: transactTransfer,
      extra: {
        metadata: burningReqMetadata,
        txType: TX_TYPE.BURN,
        txHashHandler,
        version,
      },
    });
    if (typeof burningCallback === "function") {
      await burningCallback(tx);
    }
    await this.updateProgressTx(100, "Completed");
    return tx;
  } catch (error) {
    throw error;
  }
}
export default {
  createAndSendBurningRequestTx,
};
