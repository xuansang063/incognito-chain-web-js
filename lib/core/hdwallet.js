import { KeySet } from "@lib/common/keySet";
import Validator from "@lib/utils/validator";
import {
  ChainCodeSize,
  ChildNumberSize,
  PaymentAddressType,
  PaymentAddrSerializeSize,
  PriKeySerializeSize,
  PriKeyType,
  OTAKeySerializeSize,
  OTAKeyType,
  ReadonlyKeySerializeSize,
  ReadonlyKeyType,
} from "./constants";
import { byteToHexString, getShardIDFromLastByte } from "@lib/common/common";
import {
  checkEncode,
  checkSumFirst4Bytes,
  checkDecode,
} from "@lib/common/base58";
import bn from "bn.js";
import {
  ENCODE_VERSION,
  ED25519_KEY_SIZE,
  BIP44_COIN_TYPE,
} from "@lib/common/constants";
import { generateBLSPubKeyB58CheckEncodeFromSeed } from "@lib/common/committeekey";
import { base64Encode, hashSha3BytesToBytes } from "@lib/privacy/utils";
import * as hdkey from "hdkey";

class KeyWallet {
  constructor() {
    this.Depth = 0; // 1 byte
    this.ChildNumber = new Uint8Array(ChildNumberSize); // 4 bytes
    this.ChainCode = new Uint8Array(ChainCodeSize); // 32 bytes
    this.KeySet = new KeySet();
  }

  async fromPrivateKey(privateKey) {
    this.Depth = 0; // 1 byte
    this.ChildNumber = new Uint8Array(ChildNumberSize); // 4 bytes
    this.ChainCode = new Uint8Array(ChainCodeSize); // 32 bytes
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
      if (this.KeySet.PaymentAddress.OTAPublic.length > 0) {
        keyBytes = new Uint8Array(
          PaymentAddrSerializeSize + 1 + ED25519_KEY_SIZE
        );
        keyBytes.set(
          [this.KeySet.PaymentAddress.OTAPublic.length],
          PaymentAddrSerializeSize
        ); // set length OTAPublicKey
        keyBytes.set(
          this.KeySet.PaymentAddress.OTAPublic,
          PaymentAddrSerializeSize + 1
        ); // set OTAPublicKey
      }
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
      offset += ED25519_KEY_SIZE;
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
    } else if (keyType === OTAKeyType) {
      keyBytes = new Uint8Array(OTAKeySerializeSize);
      let offset = 0;
      keyBytes.set([keyType], offset);
      offset += 1;
      keyBytes.set([this.KeySet.OTAKey.Pk.length], offset);
      offset += 1;
      keyBytes.set(this.KeySet.OTAKey.Pk, offset);
      offset += ED25519_KEY_SIZE;
      keyBytes.set([this.KeySet.OTAKey.OTASecret.length], offset);
      offset += 1;
      keyBytes.set(this.KeySet.OTAKey.OTASecret, offset);
      offset += ED25519_KEY_SIZE;
    }
    // Append key bytes to the standard sha3 checksum
    let checksum = checkSumFirst4Bytes(keyBytes);
    let res = new Uint8Array(keyBytes.length + 4);
    res.set(keyBytes, 0);
    res.set(checksum, keyBytes.length);
    return res;
  }

  base58CheckSerialize(keyType) {
    let serializedKey = this.serialize(keyType);
    // do not use legacy encoding
    return checkEncode(serializedKey, ENCODE_VERSION);
  }

  base64CheckSerialize(keyType) {
    let serializedKey = this.serialize(keyType);
    // do not use legacy encoding
    return base64Encode(serializedKey);
  }

  hexSerialize(keyType) {
    let serializedKey = this.serialize(keyType);
    return byteToHexString(serializedKey);
  }

  getPublicKeyByHex() {
    return byteToHexString(this.KeySet.PaymentAddress.Pk);
  }

  getPublicKeyCheckEncode() {
    return checkEncode(this.KeySet.PaymentAddress.Pk, ENCODE_VERSION, true);
  }

  getPublicKeyBase64CheckEncode() {
    return base64Encode(this.KeySet.PaymentAddress.Pk);
  }

  getMiningSeedKey() {
    return hashSha3BytesToBytes(hashSha3BytesToBytes(this.KeySet.PrivateKey));
  }

  async getBLSPublicKeyB58CheckEncode() {
    let miningSeedKey = this.getMiningSeedKey();
    let blsPublicKey = await generateBLSPubKeyB58CheckEncodeFromSeed(
      miningSeedKey
    );
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
      key.KeySet.PaymentAddress.Tk = bytes.slice(
        PublicKeyLength + 3,
        PublicKeyLength + 3 + TransmisionKeyLength
      );
      if (bytes.length > PaymentAddrSerializeSize) {
        key.KeySet.PaymentAddress.OTAPublic = bytes.slice(
          PaymentAddrSerializeSize + 1,
          PaymentAddrSerializeSize + 33
        );
      }
    } else if (keyType === ReadonlyKeyType) {
      let PublicKeyLength = bytes[1];
      key.KeySet.ReadonlyKey.Pk = bytes.slice(2, 2 + PublicKeyLength);

      let ReceivingKeyLength = bytes[PublicKeyLength + 2];
      key.KeySet.ReadonlyKey.Rk = bytes.slice(
        PublicKeyLength + 3,
        PublicKeyLength + 3 + ReceivingKeyLength
      );
    } else if (keyType == OTAKeyType) {
      let PublicKeyLength = bytes[1];
      key.KeySet.OTAKey.Pk = bytes.slice(2, 2 + PublicKeyLength);
      let ReceivingKeyLength = bytes[PublicKeyLength + 2];
      key.KeySet.OTAKey.OTASecret = bytes.slice(
        PublicKeyLength + 3,
        PublicKeyLength + 3 + ReceivingKeyLength
      );
    }

    // validate checksum
    let cs1 = checkSumFirst4Bytes(bytes.slice(0, bytes.length - 4), false);
    let cs2 = bytes.slice(bytes.length - 4);
    if (!cs1.equals(cs2)) {
      // accept checksum from both encodings
      const checkSum = checkSumFirst4Bytes(
        bytes.slice(0, bytes.length - 4),
        true
      );
      if (!checkSum.equals(cs2)) {
        throw new Error("Key deserialize: Wrong checksum!");
      }
    }

    return key;
  }

  static base58CheckDeserialize(str) {
    new Validator("str", str).required().string();
    let bytes;
    try {
      bytes = checkDecode(str).bytesDecoded;
    } catch (e) {
      throw e;
    }
    return KeyWallet.deserialize(bytes);
  }

  static async getKeySetFromPrivateKeyStr(privateKeyStr) {
    new Validator("privateKeyStr", privateKeyStr).required().string();
    let kw;
    try {
      kw = KeyWallet.base58CheckDeserialize(privateKeyStr);
    } catch (e) {
      throw e;
    }
    await kw.KeySet.importFromPrivateKey(kw.KeySet.PrivateKey);
    let paymentAddressStr = kw.base58CheckSerialize(PaymentAddressType);
    return {
      PaymentAddress: paymentAddressStr,
      ShardID: getShardIDFromLastByte(
        kw.KeySet.PaymentAddress.Pk[kw.KeySet.PaymentAddress.Pk.length - 1]
      ),
    };
  }

  toLegacyPaymentAddress(keyString) {
    const w = KeyWallet.base58CheckDeserialize(keyString);
    let keyBytes = new Uint8Array(PaymentAddrSerializeSize);
    let offset = 0;
    keyBytes.set([PaymentAddressType], offset);
    offset += 1;

    keyBytes.set([w.KeySet.PaymentAddress.Pk.length], offset);
    offset += 1;
    keyBytes.set(w.KeySet.PaymentAddress.Pk, offset);
    offset += ED25519_KEY_SIZE;

    keyBytes.set([w.KeySet.PaymentAddress.Tk.length], offset);
    offset += 1;
    keyBytes.set(w.KeySet.PaymentAddress.Tk, offset);
    offset += ED25519_KEY_SIZE;

    // Append key bytes to the standard sha3 checksum
    let checksum = checkSumFirst4Bytes(keyBytes, true);
    let serializedKey = new Uint8Array(keyBytes.length + 4);
    serializedKey.set(keyBytes, 0);
    serializedKey.set(checksum, keyBytes.length);
    return checkEncode(serializedKey, ENCODE_VERSION, true);
  }
}

async function NewKey(seed, index = 0, depth = -1) {
  const hdKey = hdkey.fromMasterSeed(seed);
  const childHdKey = hdKey.derive(`m/44'/${BIP44_COIN_TYPE}'/0'/0/${index}`);
  const incognitoKeySet = new KeySet();
  await incognitoKeySet.generateKey(childHdKey.privateKey);
  const incognitoChildKey = new KeyWallet();
  incognitoChildKey.ChildNumber = new bn(index).toArray("be", ChildNumberSize);
  incognitoChildKey.ChainCode = childHdKey.chainCode;
  incognitoChildKey.Depth = depth + 1;
  incognitoChildKey.KeySet = incognitoKeySet;

  return incognitoChildKey;
}

export { KeyWallet, NewKey };
