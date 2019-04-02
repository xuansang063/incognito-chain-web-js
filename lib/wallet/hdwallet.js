import * as keyset from '../keySet';
import * as constants from './constants';
import * as utils from './utils';
import * as common from '../common';
import * as privacyConstanst from 'privacy-js-lib/lib/constants';
import * as base58 from '../base58';
import CryptoJS from "crypto-js";
import BigInt from "bn.js";


class KeyWallet {
  constructor() {
    this.Depth = 0;              // 1 byte
    this.ChildNumber = new Uint8Array(4);       // 4 bytes
    this.ChainCode = new Uint8Array(32);         // 32 bytes
    this.KeySet = new keyset.KeySet();
  }

  fromSpendingKey(spendingKey) {
    this.Depth = 0;              // 1 byte
    this.ChildNumber = new Uint8Array(4);       // 4 bytes
    this.ChainCode = new Uint8Array(32);         // 32 bytes
    this.KeySet = new keyset.KeySet().importFromPrivateKey(spendingKey);
    return this;
  }

  newChildKey(childIdx) {
    let intermediary = this.getIntermediary(childIdx);
    // console.log("intermediary", childIdx, intermediary);
    let newSeed = intermediary.slice(0, 32);
    let newKeySet = new keyset.KeySet();
    newKeySet.generateKey(newSeed);

    let childKey = new KeyWallet();
    childKey.ChildNumber = (new BigInt(childIdx)).toArray("be", 4);
    childKey.ChainCode = intermediary.slice(32);
    childKey.Depth = this.Depth + 1;
    childKey.KeySet = newKeySet;
    return childKey;
  }

  getIntermediary(childIdx) {
    let childIndexBytes = (new BigInt(childIdx)).toArray();

    let chainCode = this.ChainCode
    let hmac = CryptoJS.HmacSHA512(chainCode, byteArrayToWordArray(childIndexBytes));
    let intermediary = wordArrayToByteArray(hmac)
    return intermediary;
  }

  // Serialize a KeySet to a 78 byte byte slice
  serialize(keyType) {
    // Write fields to buffer in order
    let keyBytes;

    if (keyType === constants.PriKeyType) {
      keyBytes = new Uint8Array(constants.PriKeySerializeSize);
      let offset = 0;
      keyBytes.set([keyType], offset);
      offset += 1;

      keyBytes.set([this.Depth], offset);
      offset += 1;

      keyBytes.set(this.ChildNumber, offset);
      offset += 4;

      keyBytes.set(this.ChainCode, offset);
      offset += 32;

      keyBytes.set([this.KeySet.PrivateKey.length], offset);
      offset += 1;
      keyBytes.set(this.KeySet.PrivateKey, offset);
      console.log("Offset: ", offset);

    } else if (keyType === constants.PaymentAddressType) {
      keyBytes = new Uint8Array(constants.PaymentAddrSerializeSize);
      let offset = 0;
      keyBytes.set([keyType], offset);
      offset += 1;

      keyBytes.set([this.KeySet.PaymentAddress.Pk.length], offset);
      offset += 1;
      keyBytes.set(this.KeySet.PaymentAddress.Pk, offset);
      offset += privacyConstanst.COMPRESS_POINT_SIZE;

      keyBytes.set([this.KeySet.PaymentAddress.Tk.length], offset);
      offset += 1;
      keyBytes.set(this.KeySet.PaymentAddress.Tk, offset);

    } else if (keyType === constants.ReadonlyKeyType) {
      keyBytes = new Uint8Array(constants.ReadonlyKeySerializeSize);
      let offset = 0;
      keyBytes.set([keyType], offset);
      offset += 1;

      keyBytes.set([this.KeySet.ReadonlyKey.Pk.length], offset);
      offset += 1;
      keyBytes.set(this.KeySet.ReadonlyKey.Pk, offset);
      offset += privacyConstanst.COMPRESS_POINT_SIZE;

      keyBytes.set([this.KeySet.ReadonlyKey.Rk.length], offset);
      offset += 1;
      keyBytes.set(this.KeySet.ReadonlyKey.Rk, offset);
    } else if (keyType === constants.PublicKeyType) {
      keyBytes = new Uint8Array(constants.PublicKeySerializeSize);
      let offset = 0;
      keyBytes.set([keyType], offset);
      offset += 1;

      keyBytes.set([this.KeySet.PaymentAddress.Pk.length], offset);
      offset += 1;
      keyBytes.set(this.KeySet.PaymentAddress.Pk, offset);
    }

    // Append key bytes to the standard sha3 checksum
    return utils.addChecksumToBytes(keyBytes);
  }

  base58CheckSerialize(keyType) {
    let serializedKey = this.serialize(keyType);
    return base58.checkEncode(serializedKey, 0x00);
  }

  hexSerialize(keyType) {
    let serializedKey = this.serialize(keyType);
    return common.byteToHexString(serializedKey)
  }

  getPublicKeyByHex() {
    return common.byteToHexString(this.KeySet.PaymentAddress.Pk)
  }

  getPublicKeyCheckEncode() {
    return base58.checkEncode(this.KeySet.PaymentAddress.Pk, 0x00);
  }

  static deserialize(bytes) {
    let key = new KeyWallet();

    // get key type
    let keyType = bytes[0];

    if (keyType === constants.PriKeyType) {
      key.Depth = bytes[1];
      key.ChildNumber = bytes.slice(2, 6);
      key.ChainCode = bytes.slice(6, 38);
      let keyLength = bytes[38];

      key.KeySet.PrivateKey = bytes.slice(39, 39 + keyLength);

    } else if (keyType === constants.PaymentAddressType) {
      let PublicKeyLength = bytes[1];
      key.KeySet.PaymentAddress.Pk = bytes.slice(2, 2 + PublicKeyLength);

      let TransmisionKeyLength = bytes[PublicKeyLength + 2];
      key.KeySet.PaymentAddress.Tk = bytes.slice(PublicKeyLength + 3, PublicKeyLength + 3 + TransmisionKeyLength);
    } else if (keyType === constants.ReadonlyKeyType) {

      let PublicKeyLength = bytes[1];
      key.KeySet.ReadonlyKey.Pk = bytes.slice(2, 2 + PublicKeyLength);

      let ReceivingKeyLength = bytes[PublicKeyLength + 2];
      key.KeySet.ReadonlyKey.Rk = bytes.slice(PublicKeyLength + 3, PublicKeyLength + 3 + ReceivingKeyLength);
    } else if (keyType === constants.PublicKeyType) {
      let PublicKeyLength = bytes[1];
      key.KeySet.PaymentAddress.Pk = bytes.slice(2, 2 + PublicKeyLength);
    }

    // validate checksum
    let cs1 = base58.checkSumFirst4Bytes(bytes.slice(0, bytes.length - 4));
    let cs2 = bytes.slice(bytes.length - 4);

    if (cs1.length !== cs2.length) {
      throw error("Checksum wrong!!!")
    } else {
      for (let i = 0; i < cs1.length; i++) {
        if (cs1[i] !== cs2[i]) {
          throw error("Checksum wrong!!!")
        }
      }
    }
    return key;
  }

  static base58CheckDeserialize(str) {
    let bytes = base58.checkDecode(str).bytesDecoded;
    return this.deserialize(bytes);
  }
}

function NewMasterKey(seed) {
  let hmac = CryptoJS.HmacSHA512("Constant seed", byteArrayToWordArray(seed));
  let intermediary = wordArrayToByteArray(hmac)
  console.log("Master intermediary", intermediary)

  // Split it into our PubKey and chain code
  let keyBytes = intermediary.slice(0, 32)  // use to create master private/public keypair
  let chainCode = intermediary.slice(32) // be used with public PubKey (in keypair) for new child keys
  let keySet = new keyset.KeySet();
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

export {KeyWallet, NewMasterKey, wordArrayToByteArray, wordToByteArray, byteArrayToWordArray};
