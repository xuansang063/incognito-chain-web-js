import { PaymentAddress, ViewingKey, GeneratePrivateKey } from './key';
import {base64Decode, base64Encode} from './privacy/utils';

import {wasm} from './wasm/loader';

class KeySet {
  constructor() {
    this.PrivateKey = [];
    this.PaymentAddress = {};
    this.ReadonlyKey = {};
    this.OTAKey = {};
  }

  async importFromPrivateKey(privateKey) {
    let params = {PrivateKey: base64Encode(privateKey)};
    
    let resp = await wasm.newKeySetFromPrivate(JSON.stringify(params))
    let obj = JSON.parse(resp);
    this.PrivateKey = base64Decode(obj.PrivateKey);
    // let publicKey = GeneratePublicKey(this.PrivateKey);
    // let receivingKey = GenerateReceivingKey(this.PrivateKey);
    // let transmissionKey = GenerateTransmissionKey(receivingKey);

    this.PaymentAddress = {
      Pk: base64Decode(obj.PaymentAddress.Pk),
      Tk: base64Decode(obj.PaymentAddress.Tk),
      OTAPublic: base64Decode(obj.PaymentAddress.OTAPublic),
    };
    // this.PaymentAddress.Pk = publicKey;
    // this.PaymentAddress.Tk = transmissionKey;
    // this.ReadonlyKey = new ViewingKey();
    this.ReadonlyKey = {
      Pk: base64Decode(obj.ReadonlyKey.Pk),
      Rk: base64Decode(obj.ReadonlyKey.Rk),
    };
    // this.ReadonlyKey.Rk = receivingKey;
    this.OTAKey = {
      Pk: base64Decode(obj.OTAKey.Pk),
      OTASecret: base64Decode(obj.OTAKey.OTASecret),
    }
    return this;
  }

  async generateKey(seed) {
    let privateKey = GeneratePrivateKey(seed);
    await this.importFromPrivateKey(privateKey);
  }

  // sign(data){
  //   let hash = hashSha3BytesToBytes(data);
  //   let privKeySig = new SchnPrivKey(new bn(this.PrivateKey), new bn(0));

  //   return privKeySig.sign(hash);
  // }
}

let addressToUnmarshallable = (pa) => {
	return {
		OTAPublic : base64Encode(pa.OTAPublic),
		Pk : base64Encode(pa.Pk),
		Tk : base64Encode(pa.Tk)
	}
}

export { KeySet, addressToUnmarshallable };
