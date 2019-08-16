import * as keyset from "../lib/keySet";
import * as key from "../lib/key";
import * as privacyUtils from "privacy-js-lib/lib/privacy_utils";
import * as constants from "privacy-js-lib/lib/constants";
import {Coin, InputCoin, OutputCoin} from "../lib/coin";
import * as ec from "privacy-js-lib/lib/ec";
import bn from 'bn.js';
import { parseInputCoinFromEncodedObject } from "../lib/tx/utils";
import {checkDecode} from "../lib/base58";

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
    "PublicKey": "171GWBiRH5B7pV9Sc9dpumR6a9q3T9ecp7TXf3VtgKJ1JoNKzZV",
    "CoinCommitment": "15u8R4p5pM2nE9UY3thNfLgQWRMi63YhvuGaYzphs1yQmDonP5Q",
    "SNDerivator": "12DsUW8WjBd6XDFciW6FEkz9jWeECjVgCtDMK1tsY7DnkN37bAe",
    "SerialNumber": "176yfPnVDsfXJbLMEQ3apEsh48RJ1XWqncA55QJ3HJZrFgXSz9K",
    "Randomness": "12oPrsLY1f1MnVyKmfyuWaSMM2XipdQtmeWivyfVF1LZp8Pd9oh",
    "Value": "996484000000000",
    "Info": "13PMpZ4"
  };

  let publicKeyDecode = checkDecode(coinObject.PublicKey).bytesDecoded;
  let commitmentDecode = checkDecode(coinObject.CoinCommitment).bytesDecoded;
  let sndDecode = checkDecode(coinObject.SNDerivator).bytesDecoded;
  let randDecode = checkDecode(coinObject.Randomness).bytesDecoded;
  let snDecode = checkDecode(coinObject.SerialNumber).bytesDecoded;

  console.log("commitmentDecode: ", commitmentDecode);

  let inputCoin = new InputCoin();
  inputCoin.coinDetails.publicKey = P256.decompress(publicKeyDecode);
  inputCoin.coinDetails.coinCommitment = P256.decompress(commitmentDecode);
  inputCoin.coinDetails.snderivator = new bn(sndDecode);
  inputCoin.coinDetails.randomness = new bn(randDecode);
  inputCoin.coinDetails.value = new bn(coinObject.Value);
  inputCoin.coinDetails.info = checkDecode(coinObject.Info).bytesDecoded;
  inputCoin.coinDetails.serialNumber = P256.decompress(snDecode)

  inputCoin.coinDetails.commitAll();
  console.log("coinCommitment: ", inputCoin.coinDetails.coinCommitment.compress());


  // let newSN = PedCom.G[0].derive()

  // let inputCoin = parseInputCoinFromEncodedObject(coinObject);

}

Test()