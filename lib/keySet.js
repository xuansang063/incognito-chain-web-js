import { PaymentAddress, ViewingKey, GeneratePrivateKey, GeneratePublicKey, GenerateReceivingKey, GenerateTransmissionKey } from './key';
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
    let publicKey = GeneratePublicKey(this.PrivateKey);
    let receivingKey = GenerateReceivingKey(this.PrivateKey);
    let transmissionKey = GenerateTransmissionKey(receivingKey);

    this.PaymentAddress = new PaymentAddress();
    this.PaymentAddress.Pk = publicKey;
    this.PaymentAddress.Tk = transmissionKey;
    this.ReadonlyKey = new ViewingKey();
    this.ReadonlyKey.Pk = publicKey;
    this.ReadonlyKey.Rk = receivingKey;
    return this;
  }

  generateKey(seed) {
    let privateKey = GeneratePrivateKey(seed);
    this.importFromPrivateKey(privateKey);
  }

  // sign(data){
  //   let hash = hashSha3BytesToBytes(data);
  //   let privKeySig = new SchnPrivKey(new bn(this.PrivateKey), new bn(0));

  //   return privKeySig.sign(hash);
  // }
}

export { KeySet };
