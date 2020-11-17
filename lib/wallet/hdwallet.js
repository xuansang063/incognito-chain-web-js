import { KeySet } from '../keySet';
import {
  ChainCodeSize,
  ChildNumberSize,
  PaymentAddressType,
  PaymentAddrSerializeSize,
  PriKeySerializeSize,
  PriKeyType,
  PublicKeySerializeSize,
  PublicKeyType,
  ReadonlyKeySerializeSize,
  ReadonlyKeyType,
} from './constants';
import { addChecksumToBytes } from './utils';
import { byteToHexString } from '../common';
import { checkDecode, checkEncode, checkSumFirst4Bytes } from '../base58';
import bn from "bn.js";
import { BIP44_COIN_TYPE, ED25519_KEY_SIZE, ENCODE_VERSION } from "../constants";
import { generateBLSPubKeyB58CheckEncodeFromSeed } from "../committeekey";
import { hashSha3BytesToBytes } from "../privacy/utils";
import { getShardIDFromLastByte } from './wallet';
import * as hdkey from 'hdkey';

class KeyWallet {
  constructor() {
    this.Depth = 0;                                       // 1 byte
    this.ChildNumber = new Uint8Array(ChildNumberSize);   // 4 bytes
    this.ChainCode = new Uint8Array(ChainCodeSize);       // 32 bytes
    this.KeySet = new KeySet();
  }

  async fromPrivateKey(privateKey) {
    this.Depth = 0;                                       // 1 byte
    this.ChildNumber = new Uint8Array(ChildNumberSize);   // 4 bytes
    this.ChainCode = new Uint8Array(ChainCodeSize);       // 32 bytes
    this.KeySet = await new KeySet().importFromPrivateKey(privateKey);
    return this;
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
      // if (bytes.length != PriKeySerializeAddCheckSumSize) {
      //   throw new error("invalid private key");
      // }
      key.Depth = bytes[1];
      key.ChildNumber = bytes.slice(2, 6);
      key.ChainCode = bytes.slice(6, 38);
      let keyLength = bytes[38];

      key.KeySet.PrivateKey = bytes.slice(39, 39 + keyLength);

    } else if (keyType === PaymentAddressType) {
      // let bytesBurnAddress = checkDecode(BurnAddress).bytesDecoded;
      //
      //
      // if (!bytes.equals(bytesBurnAddress)) {
      //   if (bytes.length != PaymentAddrSerializeAddCheckSumSize) {
      //     throw new error("invalid payment address");
      //   }
      // }

      let PublicKeyLength = bytes[1];
      key.KeySet.PaymentAddress.Pk = bytes.slice(2, 2 + PublicKeyLength);

      let TransmisionKeyLength = bytes[PublicKeyLength + 2];
      key.KeySet.PaymentAddress.Tk = bytes.slice(PublicKeyLength + 3, PublicKeyLength + 3 + TransmisionKeyLength);
    } else if (keyType === ReadonlyKeyType) {
      // if (bytes.length != ReadonlyKeySerializeAddCheckSumSize) {
      //   throw new error("invalid read-only key");
      // }
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

async function NewKey(seed, index = 0, depth = -1) {
  const hdKey = hdkey.fromMasterSeed(seed);

  const childHdKey = hdKey.derive(`m/44'/${BIP44_COIN_TYPE}'/0'/0/${index}`);
  const incognitoKeySet = new KeySet();
  await incognitoKeySet.generateKey(childHdKey.privateKey);

  const incognitoChildKey = new KeyWallet();
  incognitoChildKey.ChildNumber = (new bn(index)).toArray("be", ChildNumberSize);
  incognitoChildKey.ChainCode = childHdKey.chainCode;
  incognitoChildKey.Depth = depth + 1;
  incognitoChildKey.KeySet = incognitoKeySet;

  return incognitoChildKey;
}

export {
  KeyWallet,
  NewKey,
};
