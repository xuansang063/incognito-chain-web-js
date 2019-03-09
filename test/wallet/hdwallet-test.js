import * as key from "../../lib/key";
import * as constants from "../../lib/wallet/constants";
import {KeyWallet} from "../../lib/wallet/hdwallet"

function TestKeyWallet() {

  let spendingKey = key.GenerateSpendingKey([123]);
  console.log("Spending key: ", spendingKey.join(" , "));
  let keyWallet = new KeyWallet().fromSpendingKey(spendingKey);
  console.log("key wallet : ", keyWallet);

  let privateKeyStr = keyWallet.base58CheckSerialize(constants.PriKeyType);
  console.log("key serialize private: ", privateKeyStr);
  let keyDeserialize = KeyWallet.base58CheckDeserialize(privateKeyStr);
  console.log("key deserialize :", keyDeserialize);


  let paymentAddress = keyWallet.base58CheckSerialize(constants.PaymentAddressType);
  console.log("key serial: ", privateKeyStr);
  keyDeserialize = KeyWallet.base58CheckDeserialize(paymentAddress);
  console.log("key deserialize :", keyDeserialize);

  let readonlyKeystr = keyWallet.base58CheckSerialize(constants.ReadonlyKeyType);
  console.log("key serial: ", readonlyKeystr);
  keyDeserialize = KeyWallet.base58CheckDeserialize(readonlyKeystr);
  console.log("key deserialize :", keyDeserialize);

}

TestKeyWallet();
