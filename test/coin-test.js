import * as keyset from "../lib/keySet";
import * as key from "../lib/key";
import * as privacyUtils from "privacy-js-lib/lib/privacy_utils";
import * as constants from "privacy-js-lib/lib/constants";
import {Coin, InputCoin, OutputCoin} from "../lib/coin";
import * as ec from "privacy-js-lib/lib/ec";
import bn from 'bn.js';
import { parseInputCoinFromEncodedObject } from "../lib/tx/utils";
import {checkDecode, checkEncode} from "../lib/base58";
import {PedCom} from 'privacy-js-lib/lib/pedersen';
import {SK,
  VALUE,
  SND,
  SHARD_ID,
  RAND,} from "privacy-js-lib/lib/constants";

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


function Test() {
  // let coinObject = {
  //   "PublicKey": "18HVeyiKRRLTKjj1jANhhP6CxDvx2XEJMWqJiYUhvb4MK8JqQP3",
  //   "CoinCommitment": "18c17gvaLuw4voyZSfUBCKE8V2qKcQbMfRu7j5peuDorubobsFU",
  //   "SNDerivator": "1GnN2AC8tmTbcMLj4daPse1ZByee8tB9Td5R9qrjo49KYFH26N",
  //   "SerialNumber": "176yfPnVDsfXJbLMEQ3apEsh48RJ1XWqncA55QJ3HJZrFgXSz9K",
  //   "Randomness": "12TnojAatDgEjcGySPiZ7e58fns2Q5UbKBwVuvrAwAYjdkviL5m",
  //   "Value": "1755000000000",
  //   "Info": "13PMpZ4"
  // };

  // let publicKeyDecode = checkDecode(coinObject.PublicKey).bytesDecoded;
  // let commitmentDecode = checkDecode(coinObject.CoinCommitment).bytesDecoded;
  // let sndDecode = checkDecode(coinObject.SNDerivator).bytesDecoded;
  // let randDecode = checkDecode(coinObject.Randomness).bytesDecoded;
  // // let snDecode = checkDecode(coinObject.SerialNumber).bytesDecoded;

  // console.log("commitmentDecode: ", commitmentDecode.join(" "));
  // console.log("publicKeyDecode: ", publicKeyDecode);
  // console.log("sndDecode: ", sndDecode);
  // console.log("randDecode: ", randDecode);

  // let inputCoin = new InputCoin();
  // inputCoin.coinDetails.publicKey = P256.decompress(publicKeyDecode);
  // // inputCoin.coinDetails.coinCommitment = P256.decompress(commitmentDecode);
  // inputCoin.coinDetails.snderivator = new bn(sndDecode);
  // inputCoin.coinDetails.randomness = new bn(randDecode);
  // inputCoin.coinDetails.value = new bn(coinObject.Value);
  // inputCoin.coinDetails.info = checkDecode(coinObject.Info).bytesDecoded;
  // // inputCoin.coinDetails.serialNumber = P256.decompress(snDecode)

  // inputCoin.coinDetails.commitAll();
  // console.log("coinCommitment: ", inputCoin.coinDetails.coinCommitment.compress().join(" "));

  // console.log("PedCom.G[0]: ", PedCom.G[0].compress());
  // console.log("PedCom.G[1]: ", PedCom.G[1].compress());
  // console.log("PedCom.G[2]: ", PedCom.G[2].compress());
  // console.log("PedCom.G[3]: ", PedCom.G[3].compress());
  // console.log("PedCom.G[4]: ", PedCom.G[4].compress());

  // let cmValue = PedCom.G[VALUE].mul(inputCoin.coinDetails.value);
  // let cmSND = PedCom.G[SND].mul(inputCoin.coinDetails.snderivator);
  // let lastBytes = inputCoin.coinDetails.getPubKeyLastByte();
  // console.log("last bytes: ", lastBytes);
  // let shardID = getShardIDFromLastByte(lastBytes);
  // console.log("ShardId : ", shardID);
  // let cmShardID = PedCom.G[SHARD_ID].mul(new bn(shardID));
  // let cmRand = PedCom.G[RAND].mul(inputCoin.coinDetails.randomness);

  // console.log("cmValue: ", cmValue.compress().join(" "));
  // console.log("cmSND: ", cmSND.compress().join(" "));
  // console.log("cmShardID: ", cmShardID.compress().join(" "));
  // console.log("cmRand: ", cmRand.compress().join(" "));

  // let cmSum = cmValue.add(cmSND);
  // cmSum = cmSum.add(cmShardID);
  // cmSum = cmSum.add(cmRand);
  // cmSum = cmSum.add(inputCoin.coinDetails.publicKey);

  // console.log("cmSum: ", cmSum.compress().join(" "));

  let cmBytes = checkDecode("17Gnq79CYjUAwCrzebpfhDb7fv6vDDZFTVRQKMd9sr3iGrtSBpW").bytesDecoded;
  console.log("cmBytes: ", cmBytes)

  let cmBytes2 = [2, 56, 117, 32, 131, 155, 5, 127, 77, 254, 233, 125, 147, 168, 254, 124, 229, 84, 56, 162, 130, 239, 28, 184, 93, 2, 220, 209, 220, 1, 237, 235, 194]
  let cmBytesEncode = checkEncode(cmBytes2, ENCODE_VERSION)
  console.log("cmBytesEncode: ", cmBytesEncode)

  let cmBytes3 = [2, 166, 55, 55, 74, 84 ,165, 149, 219, 75 ,6 ,71, 204, 204, 135, 123, 94, 116, 78, 109, 84, 106, 113, 115, 62, 156, 43, 174, 251, 192, 76, 150, 172]
  let cmBytesEncode3 = checkEncode(cmBytes3, ENCODE_VERSION)
  console.log("cmBytesEncode3: ", cmBytesEncode3)


  let cmBytes4 = [2, 207, 160, 139, 226, 44, 85, 237, 115, 57, 27 ,20, 144, 133, 90, 78, 68 ,151, 179, 206, 233, 48, 83, 77, 199, 25, 81, 158, 88, 96, 13, 219, 205]
  let cmBytesEncode4 = checkEncode(cmBytes4, ENCODE_VERSION)
  console.log("cmBytesEncode4: ", cmBytesEncode4)
}

Test()