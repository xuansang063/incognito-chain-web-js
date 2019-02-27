import key from "../../lib/key";
import * as constants from "../../lib/wallet/constants";
import {KeyWallet} from "../../lib/wallet/hdwallet"

function TestKeyWallet() {

  let spendingKey = key.GenerateSpendingKey([123]);
  console.log("Spending key: ", spendingKey.join(" , "));
  let keyWallet = new KeyWallet().fromSpendingKey(spendingKey);

  console.log("Key wallet : ", keyWallet);
  let keySerial = keyWallet.base58CheckSerialize(constants.PriKeyType);
  console.log("Key serial: ", keySerial);

  let keyDeserialize = KeyWallet.base58CheckDeserialize(keySerial);
  console.log("Key deserialize :", keyDeserialize.KeySet.PaymentAddress);

}

TestKeyWallet();