import { PaymentAddress, ViewingKey, GeneratePrivateKey, GeneratePublicKey, GenerateReceivingKey, GenerateTransmissionKey } from './key';

class KeySet {
  constructor() {
    this.PrivateKey = [];
    this.PaymentAddress = new PaymentAddress();
    this.ReadonlyKey = new ViewingKey();
  }

  async importFromPrivateKey(privateKey) {
    this.PrivateKey = privateKey;
    let publicKey = await GeneratePublicKey(this.PrivateKey);
    let receivingKey = await GenerateReceivingKey(this.PrivateKey);
    let transmissionKey = await GenerateTransmissionKey(receivingKey);

    this.PaymentAddress = new PaymentAddress();
    this.PaymentAddress.Pk = publicKey;
    this.PaymentAddress.Tk = transmissionKey;
    this.ReadonlyKey = new ViewingKey();
    this.ReadonlyKey.Pk = publicKey;
    this.ReadonlyKey.Rk = receivingKey;
    return this;
  }

  async generateKey(seed) {
    let privateKey = await GeneratePrivateKey(seed);
    await this.importFromPrivateKey(privateKey);
  }

  // sign(data){
  //   let hash = hashSha3BytesToBytes(data);
  //   let privKeySig = new SchnPrivKey(new bn(this.PrivateKey), new bn(0));

  //   return privKeySig.sign(hash);
  // }
}

export { KeySet };
