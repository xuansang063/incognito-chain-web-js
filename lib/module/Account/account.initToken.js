import { InitTokenRequestMeta } from "@lib/core";
import Validator from "@lib/utils/validator";
import bn from "bn.js";
import { createCoin } from "@lib/module/Account/account.utils";
import { TX_TYPE } from "./account.constants";
import {
  hashSha3BytesToBytes,
  stringToBytes,
  toHexString,
} from "@lib/privacy/utils";

async function createAndSendInitTokenTx({
  transfer: { fee, info = "", tokenPayments },
  extra: { tokenName = "", tokenSymbol = "" } = {},
}) {
  try {
    new Validator("tokenPayments", tokenPayments).required().paymentInfoList();
    new Validator("fee", fee).required().amount();
    new Validator("info", info).string();
    new Validator("tokenName", tokenName).required().string();
    new Validator("tokenSymbol", tokenSymbol).required().string();
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
    console.log("metadata", metadata);
    let tx = await this.transact({
      transfer: { prvPayments: [], fee, info },
      extra: { metadata, txType: TX_TYPE.INIT_TOKEN },
    });
    console.log("tx", tx);
    const shardID = this.getShardId();
    const content = stringToBytes(tx.hash + shardID);
    // swap the endian to match Go code
    let hashed = hashSha3BytesToBytes(content);
    hashed.reverse();
    tx.tokenID = toHexString(hashed);
    await this.saveTxHistory({ tx });
    await this.updateProgressTx(100, "Completed");
    return tx;
  } catch (e) {
    throw e;
  }
}

export default { createAndSendInitTokenTx };
