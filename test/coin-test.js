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
  let coinObject = {
    "PublicKey": "181pftJwY4zhvsCNa89M5Kdw7qJnXV67BaNn6qqaYKS3GNCTLKA",
    "CoinCommitment": "18jq2ND9L1PnAxVjRLLpNk2Eo3ztYkUifFps1eTtDfhkhxCQy6G",
    "SNDerivator": "12bs8tNVK2Ljkx8vivD9NEufxarjkd3dqkMYoKLUtwjQFVS77yS",
    // "SerialNumber": "176yfPnVDsfXJbLMEQ3apEsh48RJ1XWqncA55QJ3HJZrFgXSz9K",
    "Randomness": "15vZR4fK8MS7P2vKnYDkwkwDm7a9TL5Z5VwCkBL1FySmpyq7nU",
    "Value": "3000000000",
    "Info": "13PMpZ4"
  };

  let publicKeyDecode = checkDecode(coinObject.PublicKey).bytesDecoded;
  let commitmentDecode = checkDecode(coinObject.CoinCommitment).bytesDecoded;
  let sndDecode = checkDecode(coinObject.SNDerivator).bytesDecoded;
  let randDecode = checkDecode(coinObject.Randomness).bytesDecoded;
  // let snDecode = checkDecode(coinObject.SerialNumber).bytesDecoded;

  console.log("commitmentDecode: ", commitmentDecode.join(", "));
  // console.log("publicKeyDecode: ", publicKeyDecode);
  // console.log("sndDecode: ", sndDecode);
  // console.log("randDecode: ", randDecode);

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

  // let cmBytes = checkDecode("17Gnq79CYjUAwCrzebpfhDb7fv6vDDZFTVRQKMd9sr3iGrtSBpW").bytesDecoded;
  // console.log("cmBytes: ", cmBytes)

  // let cmBytes2 = [2, 56, 117, 32, 131, 155, 5, 127, 77, 254, 233, 125, 147, 168, 254, 124, 229, 84, 56, 162, 130, 239, 28, 184, 93, 2, 220, 209, 220, 1, 237, 235, 194]
  // let cmBytesEncode = checkEncode(cmBytes2, ENCODE_VERSION)
  // console.log("cmBytesEncode: ", cmBytesEncode)

  // let cmBytes3 = [2, 166, 55, 55, 74, 84 ,165, 149, 219, 75 ,6 ,71, 204, 204, 135, 123, 94, 116, 78, 109, 84, 106, 113, 115, 62, 156, 43, 174, 251, 192, 76, 150, 172]
  // let cmBytesEncode3 = checkEncode(cmBytes3, ENCODE_VERSION)
  // console.log("cmBytesEncode3: ", cmBytesEncode3)


  // let cmBytes4 = [3, 251, 30, 109, 201, 165, 207, 245, 236, 52, 169, 227, 11, 20, 241, 26, 99, 14, 204, 152, 209, 4 ,164, 123, 76 ,48 ,81 ,170 ,90 ,93 ,233 ,219, 161];
  // let cmBytesEncode4 = checkEncode(cmBytes4, ENCODE_VERSION)
  // console.log("cmBytesEncode4: ", cmBytesEncode4)

  // cmBytes4 = [2, 50, 209, 212, 162, 188, 179, 1 ,129, 143, 189, 246, 200, 153, 146, 252, 26, 164, 203, 171, 227, 215, 85, 233, 149, 110, 74 ,145, 249, 149, 151, 107, 52];
  // cmBytesEncode4 = checkEncode(cmBytes4, ENCODE_VERSION)
  // console.log("cmBytesEncode5: ", cmBytesEncode4)
}

// Test()


function Test2() {
  let coinObjects = [
    {
      "CoinCommitment": "17RUKXhuzvnJaF5yTpvzLXJuCejj4nkeCE8PE6pNLiWvaEg8n38",
      "Info": "13PMpZ4",
      "PublicKey": "181pftJwY4zhvsCNa89M5Kdw7qJnXV67BaNn6qqaYKS3GNCTLKA",
      "Randomness": "12mPYkDQ4qGhQanETTsLB8DWG1uhRJSKPBN92fmjLuqYXj6emeN",
      "SNDerivator": "1ApvSZbe93mvsfMigmtFZ2g5mApKpi47ZHCvASbkwjLcGddFsf",
      "SerialNumber": null,
      "Value": "1000000000"
    },
    {
      "CoinCommitment": "18V3VfZnauVDaky5nDArrYDYC8s2qnB4rY1yTihHQVzMqdQHv4g",
      "Info": "13PMpZ4",
      "PublicKey": "181pftJwY4zhvsCNa89M5Kdw7qJnXV67BaNn6qqaYKS3GNCTLKA",
      "Randomness": "1FpduyCaRggeQfdftX5eBaCWkscyQoewKG6D6FX1p6E2wSpb7b",
      "SNDerivator": "1anuW2sAECSQnG4yLupGZgwXNchNAuSyRsrfJDcWcYSYYJdqHu",
      "SerialNumber": null,
      "Value": "1000000000"
    },
    {
      "CoinCommitment": "17kto8KrsCJ7k2b69fwqGx4pZaJRJcbPttmjtnvcAqWiDtNDMoW",
      "Info": "13PMpZ4",
      "PublicKey": "181pftJwY4zhvsCNa89M5Kdw7qJnXV67BaNn6qqaYKS3GNCTLKA",
      "Randomness": "12NrCmzSTg98L9YiJ79KoDo59bg3URscFKrtcceT5i8CSms36NG",
      "SNDerivator": "13o2gbGNksU1PYJ1WyJmfQmQKvgapqhCZ49RP6AQMuinYrtqmT",
      "SerialNumber": null,
      "Value": "1000000000000"
    },
    {
      "CoinCommitment": "18XqHezZ9FuC8azodB8v7zNBgdCdQgBFfhjmR3AwZ8GmtisC6ej",
      "Info": "13PMpZ4",
      "PublicKey": "181pftJwY4zhvsCNa89M5Kdw7qJnXV67BaNn6qqaYKS3GNCTLKA",
      "Randomness": "1sr1gNhM6tCovBWbN4C44R2NeJPRXu3p8ABsUexGpUC2B4Pfri",
      "SNDerivator": "12BHeWbAfmu6JrHQgK5hucN6pn3eu4hW2DPSJpuV8QcZsBmNiNj",
      "SerialNumber": null,
      "Value": "1000000000000"
    },
    {
      "CoinCommitment": "15R3KphSHUeTx48q6xD3chnfAzcDvxwzzL8SB9qv8264TgmYQS1",
      "Info": "13PMpZ4",
      "PublicKey": "181pftJwY4zhvsCNa89M5Kdw7qJnXV67BaNn6qqaYKS3GNCTLKA",
      "Randomness": "1mZDppHi8qBEX3t2EMdYNXr9wixQiibtS9KpixF6zMwXDZR9XP",
      "SNDerivator": "12CGBZfMyaRbumYzLvk7yNQLYZY1bTdNMbrgTnv8CvRcYrrknUP",
      "SerialNumber": null,
      "Value": "1000000000000"
    },
    {
      "CoinCommitment": "18FSvNXGFKMjT17E8gp5zdVxa1SMrwLPByrfVeGsQHzxuAaHDiW",
      "Info": "13PMpZ4",
      "PublicKey": "181pftJwY4zhvsCNa89M5Kdw7qJnXV67BaNn6qqaYKS3GNCTLKA",
      "Randomness": "1GfXgA3B5XjisJUtT776VkxeJvbi794idXvDRD1WBA3RQ33Kdr",
      "SNDerivator": "128LTybze6kr15hsXf9mjH7E7xiZFEgHehWeY3UfGUyt65kXjYz",
      "SerialNumber": null,
      "Value": "1000000000000"
    },
    {
      "CoinCommitment": "1599pTKdDRLqxPf4hCMU4mjzWNmMfdX1MJejFfs5Ak35oDR2sxL",
      "Info": "13PMpZ4",
      "PublicKey": "181pftJwY4zhvsCNa89M5Kdw7qJnXV67BaNn6qqaYKS3GNCTLKA",
      "Randomness": "1gDR4y58TdaMuSaXMg2GCwgZ3izpJdGA7UMR8ZmXgn9UHWjVFJ",
      "SNDerivator": "12eMZEN7wrvntk4e2Y4b6BTrX3QJTLZeANPURg5rT61Cu38fFQd",
      "SerialNumber": null,
      "Value": "1000000000000"
    },
    {
      "CoinCommitment": "18LTpyiAbeegkz2efnq9yZwjTZXhmcya3nxLEGYjAL1orFDUB2m",
      "Info": "13PMpZ4",
      "PublicKey": "181pftJwY4zhvsCNa89M5Kdw7qJnXV67BaNn6qqaYKS3GNCTLKA",
      "Randomness": "12ht226TD46D2vjc3dpmZrWLFT8gThy5zSFBL37rnMUHDMVTu5q",
      "SNDerivator": "12DvCVw1fgfkckXrCCVyRxnf7GStv9jAd2hJCWfFmvPWDbypw1g",
      "SerialNumber": null,
      "Value": "176706249999980"
    }
  ];

  // let coinObject = {
  //   "PublicKey": "181pftJwY4zhvsCNa89M5Kdw7qJnXV67BaNn6qqaYKS3GNCTLKA",
  //   "CoinCommitment": "18jq2ND9L1PnAxVjRLLpNk2Eo3ztYkUifFps1eTtDfhkhxCQy6G",
  //   "SNDerivator": "12bs8tNVK2Ljkx8vivD9NEufxarjkd3dqkMYoKLUtwjQFVS77yS",
  //   // "SerialNumber": "176yfPnVDsfXJbLMEQ3apEsh48RJ1XWqncA55QJ3HJZrFgXSz9K",
  //   "Randomness": "15vZR4fK8MS7P2vKnYDkwkwDm7a9TL5Z5VwCkBL1FySmpyq7nU",
  //   "Value": "3000000000",
  //   "Info": "13PMpZ4"
  // };


  for (let i =0; i<coinObjects.length; i++){
    let publicKeyDecode = checkDecode(coinObjects[i].PublicKey).bytesDecoded;
    let commitmentDecode = checkDecode(coinObjects[i].CoinCommitment).bytesDecoded;
    let sndDecode = checkDecode(coinObjects[i].SNDerivator).bytesDecoded;
    let randDecode = checkDecode(coinObjects[i].Randomness).bytesDecoded;
    // let snDecode = checkDecode(coinObject.SerialNumber).bytesDecoded;

    console.log("commitmentDecode: ", commitmentDecode.join(", "));
    // console.log("publicKeyDecode: ", publicKeyDecode);
    // console.log("sndDecode: ", sndDecode);
    // console.log("randDecode: ", randDecode);

    let inputCoin = new InputCoin();
    inputCoin.coinDetails.publicKey = P256.decompress(publicKeyDecode);
    // inputCoin.coinDetails.coinCommitment = P256.decompress(commitmentDecode);
    inputCoin.coinDetails.snderivator = new bn(sndDecode);
    inputCoin.coinDetails.randomness = new bn(randDecode);
    inputCoin.coinDetails.value = new bn(coinObjects[i].Value);
    inputCoin.coinDetails.info = checkDecode(coinObjects[i].Info).bytesDecoded;
    // inputCoin.coinDetails.serialNumber = P256.decompress(snDecode)

    inputCoin.coinDetails.commitAll();
    console.log("coinCommitment: ", inputCoin.coinDetails.coinCommitment.compress().join(", "));

    // if (!commitmentDecode.equals(inputCoin.coinDetails.coinCommitment.compress())){
    //   console.log("Input coin: ", i);
    // }
  }
  
}

Test2()