import * as utils from 'privacy-js-lib/lib/privacy_utils';
import * as ec from 'privacy-js-lib/lib/ec';
import * as constants from 'privacy-js-lib/lib/constants';
import BigInt from 'bn.js';

// GenerateSpendingKey generates spending key from seed
function GenerateSpendingKey(seed) {
  let spendingKey = utils.hashSha3BytesToBytes(seed);

  // check if spendingKey is less than ec.P256.n
  while (new BigInt(spendingKey).gt(ec.P256.n)) {
    spendingKey = utils.hashSha3BytesToBytes(spendingKey);
  }

  return spendingKey;
}

// GeneratePublicKey generates a public key (address) from spendingKey
function GeneratePublicKey(spendingKey) {
  return (ec.P256.g.mul(new BigInt(spendingKey))).compress();
}

// GenerateReceivingKey generates a receiving key (ElGamal decryption key) from spendingKey
function GenerateReceivingKey(spendingKey) {
  let receivingKey = utils.hashSha3BytesToBytes(spendingKey);

  // check if spendingKey is less than ec.P256.n
  while (new BigInt(receivingKey).gt(ec.P256.n)) {
    receivingKey = utils.hashSha3BytesToBytes(receivingKey);
  }

  return receivingKey;
}

// GenerateTransmissionKey generates a transmission key (ElGamal encryption key) from receivingKey
function GenerateTransmissionKey(receivingKey) {
  return (ec.P256.g.mul(new BigInt(receivingKey))).compress();
}

// ViewingKey consists of publicKey and receivingKey
class ViewingKey {
  constructor() {
    this.Pk = [];
    this.Rk = [];
    return this;
  }

  // fromSpendingKey derives viewingKey from spendingKey
  fromSpendingKey(spendingKey) {
    this.Pk = GeneratePublicKey(spendingKey);
    this.Rk = GenerateReceivingKey(spendingKey);
    return this;
  }

  // toBytes converts viewingKey to a byte array
  toBytes() {
    let viewingKeyBytes = new Uint8Array(constants.VIEWING_KEY_SIZE);
    viewingKeyBytes.set(this.Pk, 0);
    viewingKeyBytes.set(this.Rk, constants.PUBLIC_KEY_SIZE);
    return viewingKeyBytes;
  }
}

// PaymentAddress consists of public key and transmission key
class PaymentAddress {
  // fromSpendingKey derives a payment address corresponding to spendingKey
  fromSpendingKey(spendingKey) {
    this.Pk = GeneratePublicKey(spendingKey);
    this.Tk = GenerateTransmissionKey(GenerateReceivingKey(spendingKey));
    return this;
  }

  // toBytes converts payment address to a byte array
  toBytes() {
    let paymentAddrBytes = new Uint8Array(constants.PAYMENT_ADDR_SIZE);
    paymentAddrBytes.set(this.Pk);
    paymentAddrBytes.set(this.Tk, constants.PUBLIC_KEY_SIZE);
    return paymentAddrBytes;
  }

  // fromBytes converts payment address from bytes array
  // fromBytes(bytes){
  //     this.Pk = new Uint8Array(bytes.slice(0, constants.PUBLIC_KEY_SIZE));
  //     console.log(this.Pk.length);
  //     this.Tk = new Uint8Array(bytes.slice(constants.PUBLIC_KEY_SIZE));
  //     return this
  // }
}

class PaymentInfo {
  constructor(paymentAddr, amount) {
    this.PaymentAddress = paymentAddr;
    this.Amount = amount;
    return this;
  }
}

export  {
  GenerateSpendingKey,
  GeneratePublicKey,
  GenerateTransmissionKey,
  GenerateReceivingKey,
  PaymentAddress,
  ViewingKey,
  PaymentInfo
}
