import * as key from './key';
import * as schnorr from './schnorr';
import * as privacyUtils from 'privacy-js-lib/lib/privacy_utils';
import bn from 'bn.js';

class KeySet {
  constructor() {
    this.PrivateKey = [];
    this.PaymentAddress = new key.PaymentAddress();
    this.ReadonlyKey = new key.ViewingKey();
  }

  importFromPrivateKey(privateKey) {
    this.PrivateKey = privateKey;
    this.PaymentAddress = new key.PaymentAddress().fromSpendingKey(privateKey);
    this.ReadonlyKey = new key.ViewingKey().fromSpendingKey(privateKey);
    return this;
  }

  generateKey(seed) {
    this.PrivateKey = key.GenerateSpendingKey(seed);
    this.PaymentAddress = new key.PaymentAddress();
    this.PaymentAddress.fromSpendingKey(this.PrivateKey);
    this.ReadonlyKey = new key.ViewingKey();
    this.ReadonlyKey.fromSpendingKey(this.PrivateKey);
  }

  sign(data){
    let hash =privacyUtils.hashBytesToBytes(data);

    let privKeySig = new schnorr.SchnPrivKey(new bn(this.PrivateKey), new bn(0));

    return privKeySig.sign(hash);
  }
}

export {KeySet};