import bn from 'bn.js';
import * as ec from 'privacy-js-lib/lib/ec';
import * as constants from 'privacy-js-lib/lib/constants';
import * as privacyUtils from 'privacy-js-lib/lib/privacy_utils';
import {PedCom} from 'privacy-js-lib/lib/pedersen';
import * as hybridEnc from './hybridencryption';
import {getShardIDFromLastByte} from './common';

const P256 = ec.P256;
const zeroPoint = P256.curve.point(0, 0);

class Coin {
  constructor() {
    this.publicKey = zeroPoint;
    this.coinCommitment = zeroPoint;
    this.snderivator = new bn(0);
    this.serialNumber = zeroPoint;
    this.randomness = new bn(0);
    this.value = new bn(0);
    this.info = new Uint8Array(0);
    return this;
  }

  set(publicKey, coinCommitment, snd, serialNumber, randomness, value, info) {
    this.publicKey = publicKey;
    this.snderivator = snd;
    this.serialNumber = serialNumber;
    this.randomness = randomness;
    this.value = value;
    this.info = info;
    if (coinCommitment !== null) {
      this.coinCommitment = coinCommitment;
    } else {
      this.commitAll();
      this.commitAll();
    }

    return this;
  }

  // hash hashes coin bytes to 32 bytes array
  hash() {
    return utils.hashBytesToBytes(this.toBytes())
  }

  // toBytes converts coin to bytes array
  toBytes() {
    let partialBytes = new Array(7);
    let totalSize = 0;

    // Public key
    if (this.publicKey !== null) {
      partialBytes[0] = new Uint8Array(34);
      partialBytes[0].set([constants.COMPRESS_POINT_SIZE], 0);
      partialBytes[0].set(this.publicKey.compress(), 1);
      totalSize += 34
    } else {
      partialBytes[0] = new Uint8Array(1);
      partialBytes[0].set([0], 0);
      totalSize += 1
    }

    // Coin commitment
    if (this.coinCommitment !== null) {
      partialBytes[1] = new Uint8Array(34);
      partialBytes[1].set([constants.COMPRESS_POINT_SIZE], 0);
      partialBytes[1].set(this.coinCommitment.compress(), 1);
      totalSize += 34
    } else {
      partialBytes[1] = new Uint8Array(1);
      partialBytes[1].set([0], 0);
      totalSize += 1
    }

    // serial number derivator
    if (this.snderivator !== null) {
      partialBytes[2] = new Uint8Array(33);
      partialBytes[2].set([constants.BIG_INT_SIZE], 0);
      partialBytes[2].set(this.snderivator.toArray(), 1);
      totalSize += 33
    } else {
      partialBytes[2] = new Uint8Array(1);
      partialBytes[2].set([0], 0);
      totalSize += 1
    }

    // Serial number
    if (this.serialNumber !== null) {
      partialBytes[3] = new Uint8Array(34);
      partialBytes[3].set([constants.COMPRESS_POINT_SIZE], 0);
      partialBytes[3].set(this.serialNumber.compress(), 1);
      totalSize += 34
    } else {
      partialBytes[3] = new Uint8Array(1);
      partialBytes[3].set([0], 0);
      totalSize += 1
    }

    // randomness
    if (this.randomness !== null) {
      partialBytes[4] = new Uint8Array(33);
      partialBytes[4].set([constants.BIG_INT_SIZE], 0);
      partialBytes[4].set(this.randomness.toArray(), 1);
      totalSize += 33
    } else {
      partialBytes[4] = new Uint8Array(1);
      partialBytes[4].set([0], 0);
      totalSize += 1
    }

    // value
    if (this.value > 0) {
      let valueBytes = this.value.toArray();
      let valueBytesLen = valueBytes.length;

      partialBytes[5] = new Uint8Array(1 + valueBytesLen);
      partialBytes[5].set([valueBytesLen], 0);
      partialBytes[5].set(valueBytes, 1);
      totalSize = totalSize + 1 + valueBytesLen
    } else {
      partialBytes[5] = new Uint8Array(1);
      partialBytes[5].set([0], 0);
      totalSize += 1
    }

    // info
    if (this.info.length > 0) {
      let infoLen = this.info.length;

      partialBytes[6] = new Uint8Array(1 + infoLen);
      partialBytes[6].set([infoLen], 0);
      partialBytes[6].set(this.info, 1);
      totalSize = totalSize + 1 + infoLen
    } else {
      partialBytes[6] = new Uint8Array(1);
      partialBytes[6].set([0], 0);
      totalSize += 1
    }

    let bytes = new Uint8Array(totalSize);
    let index = 0;
    for (let i = 0; i < partialBytes.length; i++) {
      bytes.set(partialBytes[i], index);
      index += partialBytes[i].length;
    }
    return bytes;
  }

  // fromBytes(bytes) {
  //     if (bytes.length === 0) {
  //         return null
  //     }
  //
  //     // Parse Public key
  //     let offset = 0;
  //     let lenField = bytes[offset];
  //     offset += 1;
  //     if (lenField) {
  //         this.Pk = P256.decompress(bytes.slice(offset, offset + lenField));
  //         offset += lenField;
  //     }
  //
  //     // Parse Coin commitment
  //     lenField = bytes[offset];
  //     offset += 1;
  //     if (lenField) {
  //         this.coinCommitment = P256.decompress(bytes.slice(offset, offset + lenField));
  //         offset += lenField;
  //     }
  //
  //     // Parse snderivator
  //     lenField = bytes[offset];
  //     offset += 1;
  //     if (lenField) {
  //         this.snderivator = new BigInt(bytes.slice(offset, offset + lenField));
  //         offset += lenField;
  //     }
  //
  //     // Parse Serial number
  //     lenField = bytes[offset];
  //     offset += 1;
  //     if (lenField) {
  //         this.serialNumber = P256.decompress(bytes.slice(offset, offset + lenField));
  //         offset += lenField;
  //     }
  //
  //     // Parse randomness
  //     lenField = bytes[offset];
  //     offset += 1;
  //     if (lenField) {
  //         this.randomness = new BigInt(bytes.slice(offset, offset + lenField));
  //         offset += lenField;
  //     }
  //
  //     // Parse value
  //     lenField = bytes[offset];
  //     offset += 1;
  //     if (lenField) {
  //         this.value = new BigInt(bytes.slice(offset, offset + lenField));
  //         offset += lenField;
  //     }
  //
  //     // Parse value
  //     lenField = bytes[offset];
  //     offset += 1;
  //     if (lenField) {
  //         this.info = bytes.slice(offset, offset + lenField);
  //     }
  //     return this;
  // }

  // eq return true if this = targetCoin
  eq(targetCoin) {
    if (!this.publicKey.eq(targetCoin.Pk)) {
      return false;
    }
    if (!this.coinCommitment.eq(targetCoin.coinCommitment)) {
      return false;
    }
    if (!this.snderivator.eq(targetCoin.snderivator)) {
      return false;
    }
    if (!this.serialNumber.eq(targetCoin.serialNumber)) {
      return false;
    }
    if (!this.randomness.eq(targetCoin.randomness)) {
      return false;
    }
    if (!this.value.eq(targetCoin.value)) {
      return false;
    }
    return true;
  }

  commitAll() {
    let shardId = getShardIDFromLastByte(this.getPubKeyLastByte());
    let values = [new bn(0), this.value, this.snderivator, new bn(shardId), this.randomness];
    this.coinCommitment = PedCom.commitAll(values);
    this.coinCommitment = this.coinCommitment.add(this.publicKey)

  }

  getPubKeyLastByte() {
    let pubKeyBytes = this.publicKey.compress();
    return pubKeyBytes[pubKeyBytes.length - 1];
  }
}

class InputCoin {
  constructor() {
    this.coinDetails = new Coin();
    return this;
  }

  // toBytes converts input coin to bytes array
  toBytes() {
    return this.coinDetails.toBytes();
  }
}

class OutputCoin {
  constructor() {
    this.coinDetails = new Coin();
    this.coinDetailsEncrypted = new hybridEnc.Ciphertext();
    return this;
  }

  // toBytes converts output coin to bytes array
  toBytes() {
    let coinDetailsEncryptedBytes;
    if (!this.coinDetailsEncrypted.isNull()) {
      let ciphertextBytes = this.coinDetailsEncrypted.toBytes();
      let ciphertextBytesLen = ciphertextBytes.length;

      coinDetailsEncryptedBytes = new Uint8Array(ciphertextBytesLen + 1);
      coinDetailsEncryptedBytes.set([ciphertextBytesLen], 0);
      coinDetailsEncryptedBytes.set(ciphertextBytes, 1);
    } else {
      coinDetailsEncryptedBytes = new Uint8Array(1);
      coinDetailsEncryptedBytes.set([0], 0);
    }
    let coinDetailsEncryptedBytesLen = coinDetailsEncryptedBytes.length;

    let coinDetailBytes = this.coinDetails.toBytes();

    let bytes = new Uint8Array(coinDetailsEncryptedBytesLen + coinDetailBytes.length + 1);
    bytes.set(coinDetailsEncryptedBytes, 0);
    bytes.set([coinDetailBytes.length], coinDetailsEncryptedBytesLen);
    bytes.set(coinDetailBytes, coinDetailsEncryptedBytesLen + 1);

    return bytes;
  }

  // // fromBytes reverts output coin from bytes array
  // fromBytes(bytes) {
  //     if (bytes.length === 0){
  //         return this;
  //     }
  //
  //     let offset = 0;
  //     let lenCoinDetailEncrypted = bytes[offset];
  //     offset += 1;
  //     if (lenCoinDetailEncrypted) {
  //         this.coinDetailsEncrypted = new coinDetailsEncrypted();
  //         this.coinDetailsEncrypted.fromBytes(bytes.slice(offset, offset + lenCoinDetailEncrypted));
  //         offset += lenCoinDetailEncrypted;
  //     }
  //
  //     let lenCoinDetail = bytes[offset];
  //     offset += 1;
  //     if (lenCoinDetail) {
  //         this.coinDetails = new Coin();
  //         this.coinDetails.fromBytes(bytes.slice(offset, offset + lenCoinDetail));
  //     }
  //
  //     return this;
  // }

  // encrypt encrypts output coins using recipient transmission key
  encrypt(recipientTK) {
    let valueBytes = this.coinDetails.value.toArray();
    let randomnessBytes = privacyUtils.addPaddingBigInt(this.coinDetails.randomness, constants.BIG_INT_SIZE);
    let msg = new Uint8Array(valueBytes.length + constants.BIG_INT_SIZE);
    msg.set(randomnessBytes, 0);
    msg.set(valueBytes, constants.BIG_INT_SIZE);

    this.coinDetailsEncrypted = hybridEnc.hybridEncrypt(msg, recipientTK)
  }
}

export {Coin, InputCoin, OutputCoin};






