import { addressAsObject, KeySet } from "@lib/common/keySet";
import {
  PortalV4UnshieldRequestMeta,
  encryptMessageOutCoin,
  getBurningAddress,
} from "@lib/core";
import Validator from "@lib/utils/validator";
import bn from "bn.js";
import { TX_TYPE } from "@lib/module/Account/account.constants";
import { PaymentAddressType } from "@lib/core";
import { wasm } from "@lib/wasm";
import { createCoin } from "@lib/module/Account//account.utils";

// createAndSendUnshieldPortalV4RequestTx create and send tx burning ptoken when withdraw
// remoteAddress (string) is an ETH/BTC address which users want to receive ETH/BTC (without 0x)

/** createAndSendUnshieldPortalV4RequestTx
 * @param {{paymentAddressStr: string, amount: number}} prvPayments
 * @param {number} fee
 * @param {string} info
 * @param {string} tokenID
 * @param {object} metadata
 * @param {boolean} burningType
 * @param {boolean} isEncryptMessageToken
 * @param {number} unshieldAmount
 * @param {string} remoteAddress
 *
 */
async function createAndSendUnshieldPortalV4RequestTx({
  transfer: { fee, tokenID, info = "", prvPayments = [] },
  extra: {
    burningType = PortalV4UnshieldRequestMeta,
    isEncryptMessageToken = false,
    unshieldAmount, 
    remoteAddress,
    txHashHandler = null,
    version,
  } = {},
}) {
  try {
    new Validator("createAndSendUnshieldPortalV4RequestTx-fee", fee).required().amount();
    new Validator("createAndSendUnshieldPortalV4RequestTx-info", info).string();
    new Validator("createAndSendUnshieldPortalV4RequestTx-tokenID", tokenID)
      .required()
      .string();
    new Validator(
      "createAndSendUnshieldPortalV4RequestTx-burningType",
      burningType
    ).number();
    new Validator(
      "createAndSendUnshieldPortalV4RequestTx-disEncryptMessageToken",
      isEncryptMessageToken
    ).boolean();
    new Validator("createAndSendUnshieldPortalV4RequestTx-unshieldAmount", unshieldAmount)
      .required()
      .amount();
    new Validator("createAndSendUnshieldPortalV4RequestTx-remoteAddress", remoteAddress)
      .required()
      .string();
    new Validator("createAndSendUnshieldPortalV4RequestTx-prvPayments", prvPayments)
      .required()
      .array();
    new Validator("createAndSendUnshieldPortalV4RequestTx-version", version)
      .required()
      .number();
    const burningTokenID = tokenID;
    await this.updateProgressTx(10, "Encrypting Message");
    const burningAddress = await getBurningAddress(this.rpc);
    let tokenPayments = [
      {
        PaymentAddress: burningAddress,
        Amount: new bn(unshieldAmount).toString(),
        Message: "",
      },
    ];
    prvPayments = prvPayments.map((payment) => ({
      PaymentAddress: payment?.paymentAddress,
      Amount: new bn(payment?.amount).toString(),
      Message: "",
    }));
    const isEncodeOnly = !isEncryptMessageToken;
    tokenPayments = await encryptMessageOutCoin(tokenPayments, isEncodeOnly);
    prvPayments = await encryptMessageOutCoin(prvPayments, isEncodeOnly);

    // use an empty payment address
    let emptyKeySet = new KeySet();
    await emptyKeySet.importFromPrivateKey(new Uint8Array(32));
    await this.updateProgressTx(15, "Generating Metadata");
    let myAddressStr = this.key.base58CheckSerialize(PaymentAddressType);
    let pInf = {
        PaymentAddress: myAddressStr,
        Amount: "0"
    }
   
    // since we only use the PublicKey and TxRandom fields, the tokenID is irrelevant
    let newCoin = await createCoin({ paymentInfo: pInf, tokenID: null });

    // prepare meta data for tx
    let portalUnshieldRequest = {
      OTAPubKeyStr: newCoin.PublicKey,
      TxRandomStr: newCoin.TxRandom,
      RemoteAddress: remoteAddress,
      TokenID: tokenID,
      UnshieldAmount: unshieldAmount,
      Type: burningType,
    }
    const tx = await this.transact({
      transfer: {
        prvPayments,
        fee,
        info,
        tokenID: burningTokenID,
        tokenPayments,
      },
      extra: {
        metadata: portalUnshieldRequest,
        txType: TX_TYPE.UNSHIELDPORTAL,
        txHashHandler,
        version,
      },
    });

    await this.updateProgressTx(100, "Completed");
    return tx;
  } catch (error) {
    throw error;
  }
}
export default {
  createAndSendUnshieldPortalV4RequestTx,
};
