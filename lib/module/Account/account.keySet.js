import { OTAKeyType, PaymentAddressType, PriKeyType } from "@lib/core";
import { wasm } from "@lib/wasm";

function getOTAKey() {
  return this.key.base58CheckSerialize(OTAKeyType);
}

function getPaymentAddress() {
  return this.key.base58CheckSerialize(PaymentAddressType);
}

function getPrivateKey() {
  return this.key.base58CheckSerialize(PriKeyType);
}

async function getSignPublicKeyEncode() {
  try {
    const privateKey = this.getPrivateKey();
    const result = await wasm.getSignPublicKey(
      JSON.stringify({ data: { privateKey } })
    );
    return result;
  } catch (error) {
    throw error;
  }
}

export default {
  getOTAKey,
  getPaymentAddress,
  getPrivateKey,
  getSignPublicKeyEncode,
};
