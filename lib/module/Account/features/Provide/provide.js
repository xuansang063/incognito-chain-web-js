import Validator from "@lib/utils/validator";
import { wasm } from "@lib/wasm";
import { PaymentAddressType } from "@lib/core";

async function signPoolWithdraw({ amount }) {
  new Validator("amount", amount).required();
  const privateKey = this.getPrivateKey();
  const paymentAddress = this.getPaymentAddress();
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
