import key from "../../lib/key";
import * as constants from "../../lib/wallet/constants";
import {KeyWallet} from "../../lib/wallet/hdwallet"

function TestKeyWallet() {

  let spendingKey = key.GenerateSpendingKey([123]);
  console.log("Spending key: ", spendingKey.join(" , "));
  let keyWallet = new KeyWallet().fromSpendingKey(spendingKey);

  console.log("key wallet : ", keyWallet);
  let keySerial = keyWallet.base58CheckSerialize(constants.PriKeyType);
  console.log("key serial: ", keySerial);

  let keyDeserialize = KeyWallet.base58CheckDeserialize(keySerial);
  console.log("key deserialize :", keyDeserialize.KeySet.PaymentAddress);

}

TestKeyWallet();