import * as key from "../../lib/key";
import * as constants from "../../lib/wallet/constants";
import { KeyWallet } from "../../lib/wallet/hdwallet"

async function sleep(sleepTime) {
  return new Promise(resolve => setTimeout(resolve, sleepTime));
}

async function TestKeyWallet() {
  await sleep(4000);
  let spendingKey = key.GeneratePrivateKey([123]);
  console.log("Spending key: ", spendingKey.join(" , "));
  let keyWallet = new KeyWallet().fromPrivateKey(spendingKey);
  console.log("key wallet : ", keyWallet);

  let privateKeyStr = keyWallet.base58CheckSerialize(constants.PriKeyType);
  console.log("key serialize private: ", privateKeyStr);
  let keyDeserialize = KeyWallet.base58CheckDeserialize(privateKeyStr);
  console.log("key deserialize :", keyDeserialize);


  let paymentAddress = keyWallet.base58CheckSerialize(constants.PaymentAddressType);
  console.log("key serial payment adress: ", paymentAddress);
  keyDeserialize = KeyWallet.base58CheckDeserialize(paymentAddress);
  console.log("key deserialize :", keyDeserialize);

  let readonlyKeystr = keyWallet.base58CheckSerialize(constants.ReadonlyKeyType);
  console.log("key serial readonly key: ", readonlyKeystr);
  keyDeserialize = KeyWallet.base58CheckDeserialize(readonlyKeystr);
  console.log("key deserialize :", keyDeserialize);
}

TestKeyWallet();


function TestGetKeySetFromPrivateKeyStr(){
  let privateKey = "112t8rneH8RSZmLfmtYibmrAxpBtpSnLtkdJY57JJmdhRdnTTF8yxrzaMxi9ctjQyXXETNZ26pTnmNL2LDPWxahVQgQQyNUKy4dHiBcFSjng"

  // let keyWallet = new(KeyWallet)
  let res = KeyWallet.getKeySetFromPrivateKeyStr(privateKey);
  console.log("res: ", res)

}

// TestGetKeySetFromPrivateKeyStr()
