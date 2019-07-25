import { hashSha3BytesToBytes } from 'privacy-js-lib/lib/privacy_utils';
import { P256 } from 'privacy-js-lib/lib/ec';
import { VIEWING_KEY_SIZE, PUBLIC_KEY_SIZE, PAYMENT_ADDR_SIZE } from './constants';
import bn from 'bn.js';
import { byteToHexString } from './common';

// GenerateSpendingKey generates spending key from seed
function GenerateSpendingKey(seed) {
  let spendingKey = hashSha3BytesToBytes(seed);

  // check if spendingKey is less than P256.n
  while (new bn(spendingKey).gt(P256.n)) {
    spendingKey = hashSha3BytesToBytes(spendingKey);
  }

  return spendingKey;
}

// GeneratePublicKey generates a public key (address) from spendingKey
function GeneratePublicKey(spendingKey) {
  return (P256.g.mul(new bn(spendingKey))).compress();
}

// GenerateReceivingKey generates a receiving key (ElGamal decryption key) from spendingKey
function GenerateReceivingKey(spendingKey) {
  let receivingKey = hashSha3BytesToBytes(spendingKey);

  // check if spendingKey is less than P256.n
  while (new bn(receivingKey).gt(P256.n)) {
    receivingKey = hashSha3BytesToBytes(receivingKey);
  }

  return receivingKey;
}

// GenerateTransmissionKey generates a transmission key (ElGamal encryption key) from receivingKey
function GenerateTransmissionKey(receivingKey) {
  return (P256.g.mul(new bn(receivingKey))).compress();
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
    let viewingKeyBytes = new Uint8Array(VIEWING_KEY_SIZE);
    viewingKeyBytes.set(this.Pk, 0);
    viewingKeyBytes.set(this.Rk, PUBLIC_KEY_SIZE);
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
    let paymentAddrBytes = new Uint8Array(PAYMENT_ADDR_SIZE);
    paymentAddrBytes.set(this.Pk);
    paymentAddrBytes.set(this.Tk, PUBLIC_KEY_SIZE);
    return paymentAddrBytes;
  }

  toString(){
    let bytes = this.toBytes();
    return byteToHexString(bytes);
  }
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
