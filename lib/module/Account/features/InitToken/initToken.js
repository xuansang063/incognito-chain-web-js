import { InitTokenRequestMeta } from "@lib/core";
import Validator from "@lib/utils/validator";
import bn from "bn.js";
import { createCoin } from "@lib/module/Account/account.utils";
import { TX_TYPE } from "@lib/module/Account/account.constants";
import {
  hashSha3BytesToBytes,
  stringToBytes,
  toHexString,
} from "@lib/privacy/utils";

async function createAndSendInitTokenTx({
  transfer: { fee, info = "", tokenPayments },
  extra: { tokenName, tokenSymbol, version } = {},
}) {
  try {
    new Validator("createAndSendInitTokenTx-tokenPayments", tokenPayments)
      .required()
      .paymentInfoList();
    new Validator("createAndSendInitTokenTx-fee", fee).required().amount();
    new Validator("createAndSendInitTokenTx-info", info).string();
    new Validator("createAndSendInitTokenTx-tokenName", tokenName)
      .required()
      .string();
    new Validator("createAndSendInitTokenTx-tokenSymbol", tokenSymbol)
      .required()
      .string();
    new Validator("createAndSendInitTokenTx-version", version)
      .required()
      .number();
    if (tokenPayments.length) tokenPayments = tokenPayments[0];
    await this.updateProgressTx(10, "Generating Metadata");
    const newCoin = await createCoin({
      paymentInfo: tokenPayments,
    });
    let metadata = {
      Type: InitTokenRequestMeta,
      Amount: new bn(tokenPayments.Amount).toString(),
      OTAStr: newCoin.PublicKey,
      TxRandomStr: newCoin.TxRandom,
      TokenName: tokenName,
      TokenSymbol: tokenSymbol,
    };
    let tx = await this.transact({
      transfer: { prvPayments: [], fee, info },
      extra: { metadata, txType: TX_TYPE.INIT_TOKEN, version },
    });
    const shardID = this.getShardID();
    const content = stringToBytes(tx.hash + shardID);
    // swap the endian to match Go code
    let hashed = hashSha3BytesToBytes(content);
    hashed.reverse();
    tx.tokenID = toHexString(hashed);
    await this.updateProgressTx(100, "Completed");
    return tx;
  } catch (e) {
    throw e;
  }
}

export default { createAndSendInitTokenTx };
