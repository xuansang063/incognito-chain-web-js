import { PaymentAddress, ViewingKey, GenerateSpendingKey } from './key';
import { SchnPrivKey } from './schnorr';
import { hashSha3BytesToBytes } from 'privacy-js-lib/lib/privacy_utils';
import bn from 'bn.js';

class KeySet {
  constructor() {
    this.PrivateKey = [];
    this.PaymentAddress = new PaymentAddress();
    this.ReadonlyKey = new ViewingKey();
  }

  importFromPrivateKey(privateKey) {
    this.PrivateKey = privateKey;
    this.PaymentAddress = new PaymentAddress().fromSpendingKey(privateKey);
    this.ReadonlyKey = new ViewingKey().fromSpendingKey(privateKey);
    return this;
  }

  generateKey(seed) {
    this.PrivateKey = GenerateSpendingKey(seed);
    this.PaymentAddress = new PaymentAddress();
    this.PaymentAddress.fromSpendingKey(this.PrivateKey);
    this.ReadonlyKey = new ViewingKey();
    this.ReadonlyKey.fromSpendingKey(this.PrivateKey);
  }

  sign(data){
    let hash = hashSha3BytesToBytes(data);
    let privKeySig = new SchnPrivKey(new bn(this.PrivateKey), new bn(0));

    return privKeySig.sign(hash);
  }
}

export { KeySet };
