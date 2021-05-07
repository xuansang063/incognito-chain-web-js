const { Wallet, Transactor : AccountWallet, types, constants, utils } = require('../../');
const { KeyWallet } = types;
const { base58CheckEncode : checkEncode, base64Encode, base64Decode } = utils;
const { wasm } = require('../../lib/wasm');

async function TestKeyWallet() {
  let privateKeyB64Encode = await wasm.generateKeyFromSeed(base64Encode([123]));
  let spendingKey = base64Decode(privateKeyB64Encode);
  console.log("Spending key: ", spendingKey.join(" , "));
  let keyWallet = await (new KeyWallet().fromPrivateKey(spendingKey));
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
// TestKeyWallet();


async function TestGetKeySetFromPrivateKeyStr(){
  let privateKey = "112t8rneH8RSZmLfmtYibmrAxpBtpSnLtkdJY57JJmdhRdnTTF8yxrzaMxi9ctjQyXXETNZ26pTnmNL2LDPWxahVQgQQyNUKy4dHiBcFSjng"

  // let keyWallet = new(KeyWallet)
  let res = await KeyWallet.getKeySetFromPrivateKeyStr(privateKey);
  console.log("res: ", res)

}
// TestGetKeySetFromPrivateKeyStr()

module.exports = {
    TestKeyWallet,
    TestGetKeySetFromPrivateKeyStr
}