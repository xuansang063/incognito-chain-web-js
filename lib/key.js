import { hashSha3BytesToBytes } from 'privacy-js-lib/lib/privacy_utils';
import { P256 } from 'privacy-js-lib/lib/ec';
import { VIEWING_KEY_SIZE, PUBLIC_KEY_SIZE, PAYMENT_ADDR_SIZE } from './constants';
import bn from 'bn.js';
import { byteToHexString } from './common';
import {base64Decode, base64Encode} from "privacy-js-lib/lib/privacy_utils";

// GeneratePrivateKey generates spending key from seed
function GeneratePrivateKey(seed) {
  let seedB64Encode = base64Encode(seed);

  let privateKeyB64Encode;
  if (typeof generateKeyFromSeed == "function") {
    privateKeyB64Encode = generateKeyFromSeed(seedB64Encode);
  }
  if (privateKeyB64Encode == null) {
    throw new Error("Can not generate private key");
  }

  let spendingKey = base64Decode(privateKeyB64Encode);
  return spendingKey;
}

// GeneratePublicKey generates a public key (address) from spendingKey
function GeneratePublicKey(privateKey) {
  let privateKeyB64Encode = base64Encode(privateKey);

  let publicKeyB64Encode;
  if (typeof scalarMultBase == "function") {
    publicKeyB64Encode = scalarMultBase(privateKeyB64Encode);
  }
  if (publicKeyB64Encode == null) {
    throw new Error("Can not generate public key");
  }

  let publicKey = base64Decode(publicKeyB64Encode);
  return publicKey;
}

// GenerateReceivingKey generates a receiving key (ElGamal decryption key) from spendingKey
function GenerateReceivingKey(privateKey) {
  let privateKeyB64Encode = base64Encode(privateKey);

  let receivingKeyB64Encode;
  if (typeof generateKeyFromSeed == "function") {
    receivingKeyB64Encode = generateKeyFromSeed(privateKeyB64Encode);
  }
  if (receivingKeyB64Encode == null) {
    throw new Error("Can not generate private key");
  }

  let receivingKey = base64Decode(receivingKeyB64Encode);
  return receivingKey;
}

// GenerateTransmissionKey generates a transmission key (ElGamal encryption key) from receivingKey
function GenerateTransmissionKey(receivingKey) {
  let receivingKeyB64Encode = base64Encode(receivingKey);

  let transmissionKeyB64Encode;
  if (typeof scalarMultBase == "function") {
    transmissionKeyB64Encode = scalarMultBase(receivingKeyB64Encode);
  }
  if (transmissionKeyB64Encode == null) {
    throw new Error("Can not generate public key");
  }

  let transmissionKey = base64Decode(transmissionKeyB64Encode);
  return transmissionKey;
}

// ViewingKey consists of publicKey and receivingKey
class ViewingKey {
  constructor() {
    this.Pk = [];
    this.Rk = [];
    return this;
  }

  // fromPrivateKey derives viewingKey from spendingKey
  fromPrivateKey(privateKey) {
    this.Pk = GeneratePublicKey(privateKey);
    this.Rk = GenerateReceivingKey(privateKey);
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
  // fromPrivateKey derives a payment address corresponding to spendingKey
  fromPrivateKey(privateKey) {
    this.Pk = GeneratePublicKey(privateKey);
    this.Tk = GenerateTransmissionKey(GenerateReceivingKey(privateKey));
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
  GeneratePrivateKey,
  GeneratePublicKey,
  GenerateTransmissionKey,
  GenerateReceivingKey,
  PaymentAddress,
  ViewingKey,
  PaymentInfo
}
