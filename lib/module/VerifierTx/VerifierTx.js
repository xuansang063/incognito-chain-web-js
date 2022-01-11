import { KeyWallet } from "@lib/core";
import { wasm } from "@lib/wasm";
import { RpcClient } from "@lib/rpcclient/rpcclient";
import Validator from "@lib/utils/validator";
import { addressAsObject, otaKeyAsObject } from "@lib/common/keySet";

class VerifierTx {
  constructor() {
    this.rpc = null;
    this.requiredConfirmations = 5;
  }

  setRPCClient(url) {
    new Validator("setRPCClient-url", url).required().string();
    this.rpc = new RpcClient(url);
  }

  formatResult(nConfirms, coinPosition) {
    return {
      nConfirms,
      coinPosition,
    };
  }

  async verifySentTx({ txId, senderSeal, paymentAddress }) {
    try {
      new Validator("verifySentTx-txId", txId).required().string();
      new Validator("verifySentTx-senderSeal", senderSeal).required().string();
      new Validator("verifySentTx-paymentAddress", paymentAddress)
        .required()
        .string();
      const kw = KeyWallet.base58CheckDeserialize(paymentAddress);
      const tx = await this.rpc.getTransactionByHash(txId);
      if (!tx?.blockHash) {
        return this.formatResult(0, 0);
      }
      const [bhRes, coinPosition] = await Promise.all([
        this.rpc.getBlockByHash(tx.blockHash),
        wasm.verifySentTx(
          JSON.stringify({
            Tx: tx,
            SenderSeal: senderSeal,
            PaymentAddress: addressAsObject(kw.KeySet.PaymentAddress),
          })
        ),
      ]);
      return this.formatResult(bhRes?.Confirmations, coinPosition);
    } catch (error) {
      throw error;
    }
  }

  async verifyReceivedTx({ txId, otaKey }) {
    try {
      new Validator("verifyReceivedTx-txId", txId).required().string();
      new Validator("verifyReceivedTx-otaKey", otaKey).required().string();
      const kw = KeyWallet.base58CheckDeserialize(otaKey);
      const tx = await this.rpc.getTransactionByHash(txId);
      if (!tx?.blockHash) {
        return this.formatResult(0, 0);
      }
      const [bhRes, coinPosition] = await Promise.all([
        this.rpc.getBlockByHash(tx.blockHash),
        wasm.verifyReceivedTx(
          JSON.stringify({
            Tx: tx,
            OTAKey: otaKeyAsObject(kw.KeySet.OTAKey),
          })
        ),
      ]);
      return this.formatResult(bhRes?.Confirmations, coinPosition);
    } catch (error) {
      throw error;
    }
  }
}

export default VerifierTx;
