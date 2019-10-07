import * as keyset from "../lib/keySet";
import * as key from "../lib/key";
import * as privacyUtils from "privacy-js-lib/lib/privacy_utils";
import * as constants from "privacy-js-lib/lib/constants";
import { Coin, InputCoin, OutputCoin } from "../lib/coin";
import * as ec from "privacy-js-lib/lib/ec";
import bn from 'bn.js';
import { parseInputCoinFromEncodedObject } from "../lib/tx/utils";
import { checkDecode, checkEncode } from "../lib/base58";
import { PedCom } from 'privacy-js-lib/lib/pedersen';
import {
  SK,
  VALUE,
  SND,
  SHARD_ID,
  RAND,
} from "privacy-js-lib/lib/constants";

import { getShardIDFromLastByte } from '../lib/common';
import { ENCODE_VERSION } from "../lib/constants";

const P256 = ec.P256;

function TestCoin() {
  let coin = new Coin();
  let spendingKey = key.GenerateSpendingKey([123]);
  let keySet = new keyset.KeySet();
  keySet.importFromPrivateKey(spendingKey);
  // console.log(keySet.PaymentAddress.Pk);
  // console.log('viewingKey : ', keySet.ReadonlyKey);

  coin.publicKey = P256.decompress(keySet.PaymentAddress.Pk);
  coin.value = new bn(10);
  coin.randomness = privacyUtils.randScalar(constants.BIG_INT_SIZE);
  coin.snderivator = privacyUtils.randScalar(constants.BIG_INT_SIZE);
  coin.serialNumber = P256.g.derive(new bn(keySet.PrivateKey), coin.snderivator);
  coin.commitAll();

  console.log('************** INFO COIN **************');
  console.log('coin.Pk: ', coin.publicKey.compress().join(', '));
  console.log('coin.value: ', coin.value.toArray().join(', '));
  console.log('coin.randomness: ', coin.randomness.toArray().join(', '));
  console.log('coin.snderivator: ', coin.snderivator.toArray().join(', '));
  console.log('coin.Serial number: ', coin.serialNumber.compress().join(', '));
  console.log('coin.Coin commitment: ', coin.coinCommitment.compress().join(', '));

  /*--------- TEST COIN BYTES ------------*/
  let coinBytes = coin.toBytes();
  console.log('coin bytes :', coinBytes.join(', '));
  console.log('coin bytes size :', coinBytes.length);
  // using Golang code to reverts coinBytes to coin

  /*--------- TEST INPUT COIN ------------*/
  let inCoin = new InputCoin();
  inCoin.coinDetails = coin;
  let inCoinBytes = inCoin.toBytes();

  console.log('************** INPUT COIN **************');
  console.log('input coin bytes :', inCoinBytes.join(', '));
  console.log('input coin bytes size :', inCoinBytes.length);

  /*--------- TEST OUTPUT COIN ------------*/
  let outCoin = new OutputCoin();
  outCoin.coinDetails = coin;
  outCoin.encrypt(keySet.PaymentAddress.Tk);
  let outCoinBytes = outCoin.toBytes();

  console.log('************** OUTPUT COIN **************');
  console.log('output coin bytes :', outCoinBytes.join(', '));
  console.log('output coin bytes size :', outCoinBytes.length);
  // using Golang code to decrypt ciphertext, we receive coin's info exactly
}

// TestCoin();

function TestDecodeCoin() {
  // let coinObject = {
  //   "PublicKey": "181pftJwY4zhvsCNa89M5Kdw7qJnXV67BaNn6qqaYKS3GNCTLKA",
  //   "CoinCommitment": "18jq2ND9L1PnAxVjRLLpNk2Eo3ztYkUifFps1eTtDfhkhxCQy6G",
  //   "SNDerivator": "12bs8tNVK2Ljkx8vivD9NEufxarjkd3dqkMYoKLUtwjQFVS77yS",
  //   // "SerialNumber": "176yfPnVDsfXJbLMEQ3apEsh48RJ1XWqncA55QJ3HJZrFgXSz9K",
  //   "Randomness": "15vZR4fK8MS7P2vKnYDkwkwDm7a9TL5Z5VwCkBL1FySmpyq7nU",
  //   "Value": "3000000000",
  //   "Info": "13PMpZ4"
  // };

  // let coinObject = {
  //   "CoinCommitment": "15HhXJZzE6Kxg8SUAVd2wVmdeYF8WpQpMjScBYSQCPSxLfWeiEF",
  //   "Info": "13PMpZ4",
  //   "PublicKey": "16k14A5DRKLHYSYNeQ33TvK2v5wwWAw4z7aZwh3URwhNE2E7c8j",
  //   "Randomness": "123dwfhDp9tUKXbaKZv4AVoLE1uowQNPUK5FN96MMvmSxWEHBmK",
  //   "SNDerivator": "12Xwd6pzv3FwHN6KH4avzr2C3G5skUfc2s5nTEoddYBSXV3PPwL",
  //   "SerialNumber": null,
  //   "Value": "389749998920"
  // }

  let coinObject = {
    "PublicKey": "183XvUp5gn7gtTWjMBGwpBSgER6zexEMAqmvvQsd9ZavsErG89y",
    "CoinCommitment": "17Pw2SmoW4zXojM8HHHMEpX5k3SjKL8UAeGXBDKjqpJBJKtHSkf",
    "SNDerivator": "122qVAS24X5AjWdWsiX54npCN7WDrAyDk4VmGSbFNexWcofzNXa",
    "SerialNumber": "18LrSQofiFy9HuiCbdPJZp7nFKg9z6xNiN1EoeRVWdCiMf6Yyrm",
    "Randomness": "12XdvDLJ2UKASYX2wCSEKvda3xYrJKeUaP4XXmQ3f6f5hA399pg",
    "Value": "13423728813",
    "Info": "13PMpZ4"
  }				

  let publicKeyDecode = checkDecode(coinObject.PublicKey).bytesDecoded;
  let commitmentDecode = checkDecode(coinObject.CoinCommitment).bytesDecoded;
  let sndDecode = checkDecode(coinObject.SNDerivator).bytesDecoded;
  let randDecode = checkDecode(coinObject.Randomness).bytesDecoded;
  // let snDecode = checkDecode(coinObject.SerialNumber).bytesDecoded;

  console.log("commitmentDecode: ", commitmentDecode.join(", "));
  console.log("publicKeyDecode: ", publicKeyDecode);
  console.log("sndDecode: ", sndDecode);
  console.log("randDecode: ", randDecode);

  let inputCoin = new InputCoin();
  inputCoin.coinDetails.publicKey = P256.decompress(publicKeyDecode);
  // inputCoin.coinDetails.coinCommitment = P256.decompress(commitmentDecode);
  inputCoin.coinDetails.snderivator = new bn(sndDecode);
  inputCoin.coinDetails.randomness = new bn(randDecode);
  inputCoin.coinDetails.value = new bn(coinObject.Value);
  inputCoin.coinDetails.info = checkDecode(coinObject.Info).bytesDecoded;
  // inputCoin.coinDetails.serialNumber = P256.decompress(snDecode)

  inputCoin.coinDetails.commitAll();
  console.log("coinCommitment: ", inputCoin.coinDetails.coinCommitment.compress().join(", "));
}
// 
// TestDecodeCoin()

function Test(){
  let a = privacyUtils.randBytes(31);
  let aBN = new bn(a);
  let b = privacyUtils.addPaddingBigInt(aBN, 32);
  let bBN = new bn(b);

  let p = PedCom.G[0].mul(aBN)
  let q = PedCom.G[0].mul(bBN)

  console.log("p: ", p);
  console.log("q: ", q);

  let c = new bn(123456);
  let cBN = new bn(privacyUtils.addPaddingBigInt(c, 32))
  console.log("C byte: ", c.toArray())
  console.log("c padding: ", cBN)
  
  let point = PedCom.G[0].mul(cBN)
  console.log("point: ", point.compress());
}
// Test()

function Test2(){
  let cm = "17ioQJTBFV8HGK6TYQn9mWfdT8Z7wRCMyn9GjFYhMx6dP8UrnJp";
  let cmBytes = checkDecode(cm).bytesDecoded;
  console.log("CMBytes: ", cmBytes.join(", "));
}

Test2()