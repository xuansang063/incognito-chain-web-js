import bn from 'bn.js';
import { P256 } from 'privacy-js-lib/lib/ec';
import { PRIVACY_VERSION, COMPRESS_POINT_SIZE, BIG_INT_SIZE } from 'privacy-js-lib/lib/constants';
import { addPaddingBigInt } from 'privacy-js-lib/lib/privacy_utils';
import { PedCom } from 'privacy-js-lib/lib/pedersen';
import { hybridEncrypt } from './hybridencryption';
import { getShardIDFromLastByte } from './common';
import { checkEncode} from './base58';
import { NUM_COIN_PROPERTIES } from './constants';

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

  convertCoinToEncodedObj(){
    let res = {};
    res.publicKey = checkEncode(this.publicKey.compress(), PRIVACY_VERSION);
    res.coinCommitment = checkEncode(this.coinCommitment.compress(), PRIVACY_VERSION);
    res.snderivator = checkEncode(this.snderivator.toArray(), PRIVACY_VERSION );
    res.serialNumber = checkEncode(this.serialNumber.compress(), PRIVACY_VERSION);
    res.randomness = checkEncode(this.randomness.toArray(), PRIVACY_VERSION);
    res.value = checkEncode(this.value.toArray(), PRIVACY_VERSION);
    res.info = checkEncode(this.info, PRIVACY_VERSION )

    return res;
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
    }

    return this;
  } 

  // hash hashes coin bytes to 32 bytes array
  hash() {
    return utils.hashSha3BytesToBytes(this.toBytes())
  }

  // toBytes converts coin to bytes array
  toBytes() {
    let partialBytes = new Array(NUM_COIN_PROPERTIES);
    let totalSize = 0;

    // Public key
    if (this.publicKey !== null) {
      partialBytes[0] = new Uint8Array(COMPRESS_POINT_SIZE + 1);
      partialBytes[0].set([COMPRESS_POINT_SIZE], 0);
      partialBytes[0].set(this.publicKey.compress(), 1);
      totalSize += COMPRESS_POINT_SIZE + 1
    } else {
      partialBytes[0] = new Uint8Array(1);
      partialBytes[0].set([0], 0);
      totalSize += 1
    }

    // Coin commitment
    if (this.coinCommitment !== null) {
      partialBytes[1] = new Uint8Array(COMPRESS_POINT_SIZE + 1);
      partialBytes[1].set([COMPRESS_POINT_SIZE], 0);
      partialBytes[1].set(this.coinCommitment.compress(), 1);
      totalSize += COMPRESS_POINT_SIZE + 1
    } else {
      partialBytes[1] = new Uint8Array(1);
      partialBytes[1].set([0], 0);
      totalSize += 1
    }

    // serial number derivator
    if (this.snderivator !== null) {
      partialBytes[2] = new Uint8Array(BIG_INT_SIZE + 1);
      partialBytes[2].set([BIG_INT_SIZE], 0);
      partialBytes[2].set(this.snderivator.toArray(), 1);
      totalSize += BIG_INT_SIZE + 1
    } else {
      partialBytes[2] = new Uint8Array(1);
      partialBytes[2].set([0], 0);
      totalSize += 1
    }

    // Serial number
    if (this.serialNumber !== null) {
      partialBytes[3] = new Uint8Array(COMPRESS_POINT_SIZE + 1);
      partialBytes[3].set([COMPRESS_POINT_SIZE], 0);
      partialBytes[3].set(this.serialNumber.compress(), 1);
      totalSize += COMPRESS_POINT_SIZE + 1
    } else {
      partialBytes[3] = new Uint8Array(1);
      partialBytes[3].set([0], 0);
      totalSize += 1
    }

    // randomness
    if (this.randomness !== null) {
      partialBytes[4] = new Uint8Array(BIG_INT_SIZE + 1);
      partialBytes[4].set([BIG_INT_SIZE], 0);
      partialBytes[4].set(this.randomness.toArray(), 1);
      totalSize += BIG_INT_SIZE + 1
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

  // eq return true if this = targetCoin
  eq(targetCoin) {
    if (!this.publicKey.eq(targetCoin.publicKey)) {
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
    return (this.value.eq(targetCoin.value));
  }

  commitAll() {
    let shardId = getShardIDFromLastByte(this.getPubKeyLastByte());
    this.coinCommitment = PedCom.commitAll([new bn(0), this.value, this.snderivator, new bn(shardId), this.randomness]);
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

  convertInputCoinToEncodedObj(){
    let res = new InputCoin();
    res.coinDetails = this.coinDetails;
    res.coinDetails = res.coinDetails.convertCoinToEncodedObj();
    return res;
  }
}

class OutputCoin {
  constructor() {
    this.coinDetails = new Coin();
    this.coinDetailsEncrypted = null;
    return this;
  }

  // toBytes converts output coin to bytes array
  toBytes() {
    let coinDetailsEncryptedBytes;

    if (this.coinDetailsEncrypted !== null ){
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

  // encrypt encrypts output coins using recipient transmission key
  encrypt(recipientTK) {
    let valueBytes = this.coinDetails.value.toArray();
    let randomnessBytes = addPaddingBigInt(this.coinDetails.randomness, BIG_INT_SIZE);

    let msg = new Uint8Array(valueBytes.length + BIG_INT_SIZE);
    msg.set(randomnessBytes, 0);
    msg.set(valueBytes, BIG_INT_SIZE);

    this.coinDetailsEncrypted = hybridEncrypt(msg, recipientTK)
  }
}

export { Coin, InputCoin, OutputCoin };






