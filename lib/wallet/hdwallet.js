import { KeySet } from '../keySet';
import {
  PriKeyType,
  PriKeySerializeSize,
  PaymentAddressType,
  PaymentAddrSerializeSize,
  ReadonlyKeyType,
  ReadonlyKeySerializeSize,
  PublicKeyType,
  PublicKeySerializeSize,
  ChildNumberSize,
  ChainCodeSize
} from './constants';
import { addChecksumToBytes } from './utils';
import { byteToHexString } from '../common';
import { checkEncode, checkSumFirst4Bytes, checkDecode } from '../base58';
import CryptoJS from "crypto-js";
import bn from "bn.js";
import { ENCODE_VERSION, ED25519_KEY_SIZE } from "../constants";
import {generateBLSPubKeyB58CheckEncodeFromSeed} from "../committeekey";
import { hashSha3BytesToBytes } from "../privacy/utils";
import { getShardIDFromLastByte } from './wallet';


class KeyWallet {
  constructor() {
    this.Depth = 0;                                       // 1 byte
    this.ChildNumber = new Uint8Array(ChildNumberSize);   // 4 bytes
    this.ChainCode = new Uint8Array(ChainCodeSize);       // 32 bytes
    this.KeySet = new KeySet();
  }

  fromPrivateKey(privateKey) {
    this.Depth = 0;                                       // 1 byte
    this.ChildNumber = new Uint8Array(ChildNumberSize);   // 4 bytes
    this.ChainCode = new Uint8Array(ChainCodeSize);       // 32 bytes
    this.KeySet = new KeySet().importFromPrivateKey(privateKey);
    return this;
  }

  newChildKey(childIdx) {
    let intermediary = this.getIntermediary(childIdx);
    let newSeed = intermediary.slice(0, 32);
    let newKeySet = new KeySet();
    newKeySet.generateKey(newSeed);

    let childKey = new KeyWallet();
    childKey.ChildNumber = (new bn(childIdx)).toArray("be", ChildNumberSize);
    childKey.ChainCode = intermediary.slice(ChainCodeSize);
    childKey.Depth = this.Depth + 1;
    childKey.KeySet = newKeySet;
    return childKey;
  }

  getIntermediary(childIdx) {
    let childIndexBytes = (new bn(childIdx)).toArray();
    let chainCode = this.ChainCode;
    // HmacSHA512(data, key)
    let hmac = CryptoJS.HmacSHA512(CryptoJS.enc.Base64.stringify(byteArrayToWordArray(chainCode)), byteArrayToWordArray(childIndexBytes));
    let intermediary = wordArrayToByteArray(hmac)
    return intermediary;
  }

  // Serialize a KeySet to a 78 byte byte slice
  serialize(keyType) {
    // Write fields to buffer in order
    let keyBytes;

    if (keyType === PriKeyType) {
      keyBytes = new Uint8Array(PriKeySerializeSize);
      let offset = 0;
      keyBytes.set([keyType], offset);
      offset += 1;

      keyBytes.set([this.Depth], offset);
      offset += 1;

      keyBytes.set(this.ChildNumber, offset);
      offset += ChildNumberSize;

      keyBytes.set(this.ChainCode, offset);
      offset += ChainCodeSize;

      keyBytes.set([this.KeySet.PrivateKey.length], offset);
      offset += 1;
      keyBytes.set(this.KeySet.PrivateKey, offset);
      console.log("Offset: ", offset);

    } else if (keyType === PaymentAddressType) {
      keyBytes = new Uint8Array(PaymentAddrSerializeSize);
      let offset = 0;
      keyBytes.set([keyType], offset);
      offset += 1;

      keyBytes.set([this.KeySet.PaymentAddress.Pk.length], offset);
      offset += 1;
      keyBytes.set(this.KeySet.PaymentAddress.Pk, offset);
      offset += ED25519_KEY_SIZE;

      keyBytes.set([this.KeySet.PaymentAddress.Tk.length], offset);
      offset += 1;
      keyBytes.set(this.KeySet.PaymentAddress.Tk, offset);

    } else if (keyType === ReadonlyKeyType) {
      keyBytes = new Uint8Array(ReadonlyKeySerializeSize);
      let offset = 0;
      keyBytes.set([keyType], offset);
      offset += 1;

      keyBytes.set([this.KeySet.ReadonlyKey.Pk.length], offset);
      offset += 1;
      keyBytes.set(this.KeySet.ReadonlyKey.Pk, offset);
      offset += ED25519_KEY_SIZE;

      keyBytes.set([this.KeySet.ReadonlyKey.Rk.length], offset);
      offset += 1;
      keyBytes.set(this.KeySet.ReadonlyKey.Rk, offset);
    } else if (keyType === PublicKeyType) {
      keyBytes = new Uint8Array(PublicKeySerializeSize);
      let offset = 0;
      keyBytes.set([keyType], offset);
      offset += 1;

      keyBytes.set([this.KeySet.PaymentAddress.Pk.length], offset);
      offset += 1;
      keyBytes.set(this.KeySet.PaymentAddress.Pk, offset);
    }

    // Append key bytes to the standard sha3 checksum
    return addChecksumToBytes(keyBytes);
  }

  base58CheckSerialize(keyType) {
    let serializedKey = this.serialize(keyType);
    return checkEncode(serializedKey, ENCODE_VERSION);
  }

  hexSerialize(keyType) {
    let serializedKey = this.serialize(keyType);
    return byteToHexString(serializedKey)
  }

  getPublicKeyByHex() {
    return byteToHexString(this.KeySet.PaymentAddress.Pk)
  }

  getPublicKeyCheckEncode() {
    return checkEncode(this.KeySet.PaymentAddress.Pk, ENCODE_VERSION);
  }

  getMiningSeedKey(){
    return hashSha3BytesToBytes(hashSha3BytesToBytes(this.KeySet.PrivateKey));
  }

  async getBLSPublicKeyB58CheckEncode(){
    let miningSeedKey = this.getMiningSeedKey();
    let blsPublicKey = await generateBLSPubKeyB58CheckEncodeFromSeed(miningSeedKey);
    return blsPublicKey;
  }
  

  static deserialize(bytes) {
    let key = new KeyWallet();

    // get key type
    let keyType = bytes[0];

    if (keyType === PriKeyType) {
      key.Depth = bytes[1];
      key.ChildNumber = bytes.slice(2, 6);
      key.ChainCode = bytes.slice(6, 38);
      let keyLength = bytes[38];

      key.KeySet.PrivateKey = bytes.slice(39, 39 + keyLength);

    } else if (keyType === PaymentAddressType) {
      let PublicKeyLength = bytes[1];
      key.KeySet.PaymentAddress.Pk = bytes.slice(2, 2 + PublicKeyLength);

      let TransmisionKeyLength = bytes[PublicKeyLength + 2];
      key.KeySet.PaymentAddress.Tk = bytes.slice(PublicKeyLength + 3, PublicKeyLength + 3 + TransmisionKeyLength);
    } else if (keyType === ReadonlyKeyType) {
      let PublicKeyLength = bytes[1];
      key.KeySet.ReadonlyKey.Pk = bytes.slice(2, 2 + PublicKeyLength);

      let ReceivingKeyLength = bytes[PublicKeyLength + 2];
      key.KeySet.ReadonlyKey.Rk = bytes.slice(PublicKeyLength + 3, PublicKeyLength + 3 + ReceivingKeyLength);
    } else if (keyType === PublicKeyType) {
      let PublicKeyLength = bytes[1];
      key.KeySet.PaymentAddress.Pk = bytes.slice(2, 2 + PublicKeyLength);
    }

    // validate checksum
    let cs1 = checkSumFirst4Bytes(bytes.slice(0, bytes.length - 4));
    let cs2 = bytes.slice(bytes.length - 4);

    if (!cs1.equals(cs2)) {
      throw error("Checksum wrong!!!")
    } 

    return key;
  }

  static base58CheckDeserialize(str) {
    let bytes;
    try{
      bytes = checkDecode(str).bytesDecoded;
    } catch(e){
      throw e;
    }
    
    return this.deserialize(bytes);
  }

  static getKeySetFromPrivateKeyStr(privateKeyStr) {
    let keyWallet;
    try{
      keyWallet = KeyWallet.base58CheckDeserialize(privateKeyStr);
    } catch(e){
      throw e;
    }

    keyWallet.KeySet.importFromPrivateKey(keyWallet.KeySet.PrivateKey)
    let paymentAddressStr = keyWallet.base58CheckSerialize(PaymentAddressType)

    return {
      PaymentAddress: paymentAddressStr,
      ShardID: getShardIDFromLastByte(keyWallet.KeySet.PaymentAddress.Pk[(keyWallet.KeySet.PaymentAddress.Pk.length - 1)])
    }
  }
}

function NewMasterKey(seed) {
  // HmacSHA512(data, key)
  let hmac = CryptoJS.HmacSHA512(CryptoJS.enc.Base64.stringify(byteArrayToWordArray(seed)), "Constant seed");
  let intermediary = wordArrayToByteArray(hmac)
  // console.log("Master intermediary", intermediary)

  // Split it into our PubKey and chain code
  let keyBytes = intermediary.slice(0, 32)  // use to create master private/public keypair
  let chainCode = intermediary.slice(32) // be used with public PubKey (in keypair) for new child keys
  let keySet = new KeySet();
  keySet.generateKey(keyBytes);

  let keyWallet = new KeyWallet();
  keyWallet.KeySet = keySet;
  keyWallet.ChainCode = chainCode;
  keyWallet.Depth = 0;
  keyWallet.ChildNumber = new Uint8Array([0, 0, 0, 0]);
  return keyWallet;
}

function wordToByteArray(word, length) {
  var ba = [],
    i,
    xFF = 0xFF;
  if (length > 0)
    ba.push(word >>> 24);
  if (length > 1)
    ba.push((word >>> 16) & xFF);
  if (length > 2)
    ba.push((word >>> 8) & xFF);
  if (length > 3)
    ba.push(word & xFF);

  return ba;
}

function wordArrayToByteArray(wordArray, length) {
  if (wordArray.hasOwnProperty("sigBytes") && wordArray.hasOwnProperty("words")) {
    length = wordArray.sigBytes;
    wordArray = wordArray.words;
  }

  var result = [],
    bytes,
    i = 0;
  while (length > 0) {
    bytes = wordToByteArray(wordArray[i], Math.min(4, length));
    length -= bytes.length;
    result.push(bytes);
    i++;
  }
  return [].concat.apply([], result);
}

function byteArrayToWordArray(ba) {
  var wa = [],
    i;
  for (i = 0; i < ba.length; i++) {
    wa[(i / 4) | 0] |= ba[i] << (24 - 8 * i);
  }

  return CryptoJS.lib.WordArray.create(wa, ba.length);
}

export { KeyWallet, NewMasterKey, wordArrayToByteArray, wordToByteArray, byteArrayToWordArray };
