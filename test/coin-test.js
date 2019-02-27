import * as keyset from "../lib/keySet";
import * as key from "../lib/key";
import * as privacyUtils from "privacy-js-lib/lib/privacy_utils";
import * as constants from "privacy-js-lib/lib/constants";
import {Coin, InputCoin, OutputCoin} from "../lib/coin";
import * as ec from "privacy-js-lib/lib/ec";
import bn from 'bn.js';

const P256 = ec.P256;

function TestCoin() {
  let coin = new Coin();
  let spendingKey = key.GenerateSpendingKey([123]);
  let keySet = new keyset.KeySet();
  keySet.importFromPrivateKey(spendingKey);
  // console.log(keySet.PaymentAddress.Pk);
  // console.log('viewingKey : ', keySet.ReadonlyKey);

  coin.PublicKey = P256.decompress(keySet.PaymentAddress.Pk);
  coin.Value = new bn(10);
  coin.Randomness = privacyUtils.randScalar(constants.BIG_INT_SIZE);
  coin.SNDerivator = privacyUtils.randScalar(constants.BIG_INT_SIZE);
  coin.SerialNumber = P256.g.derive(new bn(keySet.PrivateKey), coin.SNDerivator);
  coin.commitAll();

  console.log('************** INFO COIN **************');
  console.log('coin.Pk: ', coin.PublicKey.compress().join(', '));
  console.log('coin.Value: ', coin.Value.toArray().join(', '));
  console.log('coin.Randomness: ', coin.Randomness.toArray().join(', '));
  console.log('coin.SNDerivator: ', coin.SNDerivator.toArray().join(', '));
  console.log('coin.Serial number: ', coin.SerialNumber.compress().join(', '));
  console.log('coin.Coin commitment: ', coin.CoinCommitment.compress().join(', '));

  /*--------- TEST COIN BYTES ------------*/
  let coinBytes = coin.toBytes();
  console.log('coin bytes :', coinBytes.join(', '));
  console.log('coin bytes size :', coinBytes.length);
  // using Golang code to reverts coinBytes to coin

  /*--------- TEST INPUT COIN ------------*/
  let inCoin = new InputCoin();
  inCoin.CoinDetails = coin;
  let inCoinBytes = inCoin.toBytes();

  console.log('************** INPUT COIN **************');
  console.log('input coin bytes :', inCoinBytes.join(', '));
  console.log('input coin bytes size :', inCoinBytes.length);

  /*--------- TEST OUTPUT COIN ------------*/
  let outCoin = new OutputCoin();
  outCoin.CoinDetails = coin;
  outCoin.encrypt(keySet.PaymentAddress.Tk);
  let outCoinBytes = outCoin.toBytes();

  console.log('************** OUTPUT COIN **************');
  console.log('output coin bytes :', outCoinBytes.join(', '));
  console.log('output coin bytes size :', outCoinBytes.length);
  // using Golang code to decrypt ciphertext, we receive coin's info exactly
}

TestCoin();