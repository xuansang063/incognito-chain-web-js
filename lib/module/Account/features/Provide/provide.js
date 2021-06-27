import Validator from "@lib/utils/validator";
import { wasm } from "@lib/wasm";
import { PaymentAddressType, PriKeyType } from "@lib/core";

async function signPoolWithdraw({ amount }) {
  new Validator("amount", amount).required();
  const privateKey = this.key.base58CheckSerialize(PriKeyType);
  const paymentAddress = this.key.base58CheckSerialize(PaymentAddressType);
  const args = {
    data: {
      privateKey,
      paymentAddress,
      amount,
    },
  };
  return wasm.signPoolWithdraw(JSON.stringify(args));
}

export default {
  signPoolWithdraw,
};
