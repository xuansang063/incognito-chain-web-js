import * as ec from 'privacy-js-lib/lib/ec';
import * as constants from 'privacy-js-lib/lib/constants';
import * as key from '../key';
import * as keySet from '../keySet';
import * as privacyUtils from 'privacy-js-lib/lib/privacy_utils';
import * as zkpPayment from '../payment';
import * as schnorr from '../schnorr';
import * as elGamal from '../elgamal';
import * as base58 from '../base58';
import * as coin from '../coin';

import bn from 'bn.js';
import {getShardIDFromLastByte, convertHashToStr, hexStringToByte} from '../common';

import * as constantsTx from './constants';

const P256 = ec.P256;
const TxVersion = 1;
const ConstantID = new Uint8Array(32);
ConstantID[0] = 4;

class Tx {
  constructor(rpcClient) {
    // Basic data
    this.version = 0;
    this.type = '';
    this.lockTime = 0;
    this.fee = 0;
    this.info = [];

    // Sign and Privacy proof
    this.sigPubKey = [];
    this.sig = [];
    this.proof = null;

    this.pubKeyLastByteSender = 0x00;

    // metadata
    this.metadata = null;

    this.sigPrivKey = []; // is ALWAYS private property of struct, if privacy: 64 bytes, and otherwise, 32 bytes
    this.rpcClient = rpcClient;

    this.hashValue = null;// temp to store hash of tx
  }

  async init(senderSK, paymentAddressStr, paymentInfo, inputCoins, inputCoinStrs, fee, hasPrivacy, tokenID, metaData) {
    console.log("FEE: ", fee);

    // console.log("Len input coin: ", inputCoins.length);

    let start = new Date().getTime();
    let i;
    // set version tx
    this.version = TxVersion;

    // set lock time
    if (this.lockTime === 0) {
      this.lockTime = new Date().getTime();
    }

    // generate sender's key set from senderSK
    let senderKeySet = new keySet.KeySet().importFromPrivateKey(senderSK);

    // get public key's last byte of sender
    let senderPK = senderKeySet.PaymentAddress.Pk;
    let pkLastByteSender = senderPK[senderPK.length - 1];

    // init info of tx
    let pubKeyData = P256.decompress(senderKeySet.PaymentAddress.Pk);
    let transmissionKeyPoint = P256.decompress(senderKeySet.PaymentAddress.Tk);
    this.info = elGamal.encrypt(transmissionKeyPoint, pubKeyData);

    //set meta data
    this.metadata = metaData;

    // check whether tx is custom token tx or not
    if (inputCoins.length === 0 && fee.cmp(new bn(0)) === 0) {
      console.log("CREATE TX CUSTOM TOKEN");
      this.fee = fee;
      this.sigPrivKey = senderSK;
      this.pubKeyLastByteSender = pkLastByteSender;

      this.sign(hasPrivacy);
      return;
    }

    // set type tx
    this.type = constantsTx.TxNormalType;

    // set shard id
    let shardID = getShardIDFromLastByte(pkLastByteSender);

    // Calculate sum of all output coins' value
    let sumOutputValue = new bn(0);
    for (i = 0; i < paymentInfo.length; i++) {
      if (paymentInfo[i].Amount.cmp(new bn.BN(0)) === -1) {
        throw new Error("output coin's value is less than 0");
      }
      sumOutputValue = sumOutputValue.add(paymentInfo[i].Amount);
    }

    // Calculate sum of all input coins' value
    let sumInputValue = new bn(0);
    // console.log("CREATING TX: ------ INPUT COIN LEN",   inputCoins.length);
    for (i = 0; i < inputCoins.length; i++) {
      sumInputValue = sumInputValue.add(inputCoins[i].coinDetails.value);
    }

    // Calculate over balance, it will be returned to sender
    let overBalance = sumInputValue.sub(sumOutputValue);
    overBalance = overBalance.sub(fee);

    if (overBalance.lt(new bn.BN(0))) {
      throw new Error("Input value less than output value");
    }

    console.log("Check balance ok!!!!!");


    let commitmentIndices = []; // array index random of commitments in db
    let myCommitmentIndices = []; // index in array index random of commitment in db
    let commitmentProving = [];

    // get commitment list from db for proving
    // call api to random commitments list

    // console.log("my Commitment: ", inputCoins[0].coinDetails.coinCommitment);
    if (hasPrivacy) {
      let randCommitments = await this.rpcClient.randomCommitmentsProcess(paymentAddressStr, inputCoinStrs, tokenID);
      // for (let i = 0; i < randCommitments.commitments.length; i++) {
      //   console.log("randCommitments : ", randCommitments.commitments[i].compress().join(", "));
      // }
      // console.log("randCommitments: ", randCommitments.commitments);
      // console.log();
      // console.log();
      commitmentIndices = randCommitments.commitmentIndices; // array index random of commitments in db
      myCommitmentIndices = randCommitments.myCommitmentIndices; // index in array index random of commitment in db
      commitmentProving = randCommitments.commitments;

      console.log("Random commitment ok!!!!!");

      // Check number of list of random commitments, list of random commitment indices
      if (commitmentIndices.length !== inputCoins.length * constants.CM_RING_SIZE) {
        throw new Error("Invalid random commitments");
      }

      if (myCommitmentIndices.length !== inputCoins.length) {
        throw new Error("Number of list my commitment indices must be equal to number of input coins");
      }
    }

    // set tokenID for constant
    if (tokenID === null) {
      tokenID = ConstantID;
    }

    // if overBalance > 0, create a new payment info with pk is sender's pk and amount is overBalance
    if (overBalance.gt(0)) {
      let changePaymentInfo = new key.PaymentInfo();
      changePaymentInfo.Amount = overBalance;
      changePaymentInfo.PaymentAddress = senderKeySet.PaymentAddress;
      paymentInfo.push(changePaymentInfo);
    }

    // create new output coins
    let outputCoins = new Array(paymentInfo.length);

    // generates SNDs for output coins
    let ok = true;
    let sndOuts = new Array(paymentInfo.length);
    // let sndOutStrs = new Array(paymentInfo.length);

    while (ok) {
      let sndOut = new bn(0);
      for (i = 0; i < paymentInfo.length; i++) {
        sndOut = privacyUtils.randScalar();
        let sndOutStrs = base58.checkEncode(sndOut.toArray(), constants.PRIVACY_VERSION);

        while (true) {
          // call api to check SND existence
          let res = await this.rpcClient.hasSNDerivator(paymentAddressStr, [sndOutStrs]);

          // if sndOut existed, then re-random it
          if (res.existed[0]) {
            sndOut = privacyUtils.randScalar();
            sndOutStrs = base58.checkEncode(sndOut.toArray(), constants.PRIVACY_VERSION);
          } else {
            break
          }
        }
        sndOuts[i] = sndOut;
      }

      // if sndOuts has two elements that have same value, then re-generates it
      ok = privacyUtils.checkDuplicateBigIntArray(sndOuts);
      if (ok) {
        sndOuts = new Array(paymentInfo.length);
      }
    }

    console.log("Create new output coins ok!!!!!");

    // create new output coins with info: Pk, value, last byte of pk, snd
    for (i = 0; i < paymentInfo.length; i++) {
      outputCoins[i] = new coin.OutputCoin();
      outputCoins[i].coinDetails.value = paymentInfo[i].Amount;
      outputCoins[i].coinDetails.publicKey = P256.decompress(paymentInfo[i].PaymentAddress.Pk);
      outputCoins[i].coinDetails.snderivator = sndOuts[i];
    }

    // assign fee tx
    this.fee = fee;

    // create zero knowledge proof of payment
    this.proof = new zkpPayment.PaymentProof();

    // prepare witness for proving
    let witness = new zkpPayment.PaymentWitness();
    witness.init(hasPrivacy, new bn(senderSK, 'be', constants.BIG_INT_SIZE), inputCoins, outputCoins, pkLastByteSender, commitmentProving, commitmentIndices, myCommitmentIndices, fee);

    console.log("Init witness ok!!!!!");
    console.time("Proving:");
    this.proof = witness.prove(hasPrivacy);
    console.timeEnd("Proving:");
    console.log("Proving ok!!!!!");

    // set private key for signing tx
    if (hasPrivacy) {
      this.sigPrivKey = new Uint8Array(2 * constants.BIG_INT_SIZE);
      this.sigPrivKey.set(senderSK, 0);
      this.sigPrivKey.set(witness.randSK.toArray('be', constants.BIG_INT_SIZE), senderSK.length);

      // encrypt coin details (randomness)
      // hide information of output coins except coin commitments, public key, snDerivators
      for (i = 0; i < this.proof.outputCoins.length; i++) {
        this.proof.outputCoins[i].encrypt(paymentInfo[i].PaymentAddress.Tk);
        this.proof.outputCoins[i].coinDetails.serialNumber = null;
        this.proof.outputCoins[i].coinDetails.value = 0;
        this.proof.outputCoins[i].coinDetails.randomness = null;
      }

      // hide information of input coins except serial number of input coins
      for (i = 0; i < this.proof.inputCoins.length; i++) {
        this.proof.inputCoins[i].coinDetails.coinCommitment = null;
        this.proof.inputCoins[i].coinDetails.value = 0;
        this.proof.inputCoins[i].coinDetails.snderivator = null;
        this.proof.inputCoins[i].coinDetails.publicKey = null;
        this.proof.inputCoins[i].coinDetails.randomness = null;
      }

    } else {
      this.sigPrivKey = new Uint8Array(constants.BIG_INT_SIZE + 1);
      this.sigPrivKey.set(senderSK, 0);
      this.sigPrivKey.set(new bn(0).toArray(), senderSK.length);
    }

    // sign tx
    console.log("signing ......");
    this.pubKeyLastByteSender = pkLastByteSender;
    this.sign();
    console.log("TX normal: ", this.proof);

    console.log("signing ok!!!!!");

    let end = new Date().getTime();
    console.log("Creating tx time: ", end - start);
    console.log("**** DONE CREATING TX ****");

    return null;
  }

  convertTxToByte() {
    console.log("CONVERTING TX TO BYTE ..... ");
    this.info = privacyUtils.convertUint8ArrayToArray(this.info);
    this.sigPubKey = privacyUtils.convertUint8ArrayToArray(this.sigPubKey);
    this.sig = privacyUtils.convertUint8ArrayToArray(this.sig);
    if (this.proof !== null) {
      this.proof = base58.checkEncode(this.proof.toBytes(), constants.PRIVACY_VERSION);
    }
    console.log("Fee before: ", this.fee);
    if (this.fee != null) {
      this.fee = this.fee.toNumber();
    }

    console.log("Fee after : ", this.fee);

    this.hashValue = "";
    return this;
  };

  sign = () => {
    console.time("Sign time:");
    //Check input transaction

    if (this.sig.length !== 0) {
      throw new Error("input transaction must be an unsigned one")
    }

    /****** using Schnorr signature *******/
      // sign with sigPrivKey
      // prepare private key for Schnorr
    let sk = new bn(this.sigPrivKey.slice(0, constants.BIG_INT_SIZE));
    let r = new bn(this.sigPrivKey.slice(constants.BIG_INT_SIZE));

    let sigKey = new schnorr.SchnPrivKey(sk, r);

    // save public key for verification signature tx
    this.sigPubKey = sigKey.PK.PK.compress();
    // console.log('sig PubKey: ', this.sigPubKey);

    // signing
    // console.log("HASH tx: ", this.hash().join(', '));
    let hashTx = this.hash();
    console.log("Hash normal tx when signing: ", hashTx);
    console.log("HASH TX DONE!!!!!!");

    this.sig = sigKey.sign(hashTx);
    console.log("SIGNING OK!!!!!!");
    console.timeEnd("Sign time:");

    return null
  };

  // toString converts tx to string
  toString = () => {
    console.log("CONVERTING TX TO STRING FOR HASHING.....");
    let record = this.version.toString();
    // console.log("this.version.toString(): ", this.version.toString());

    record += this.lockTime.toString();
    // console.log("this.lockTime.toString(): ", this.lockTime.toString());

    if (this.fee == null) {
      record += "0";
    } else {
      record += this.fee.toString();
    }
    // console.log("this.fee.toString(): ", this.fee.toString());

    if (this.proof != null) {
      let bytes = this.proof.toBytes()

      console.log("[STAKING TX] Proof bytes before hash tx to sign: ", bytes.join(" "));
      let tmp = base58.checkEncode(bytes, constants.PRIVACY_VERSION);
      console.log("[STAKING TX] Proof base 58:", tmp);
      record += tmp
    }

    console.log("CONVERTING TX TO STRING FOR HASHING DONE!!!!!!!");

    // todo:
    if (this.metadata != null) {
      let tmp = this.metadata.Type.toString();
      tmp = privacyUtils.stringToBytes(tmp);
      tmp = privacyUtils.hashBytesToBytes(tmp);
      console.log("Meta data after hashing: ", tmp);
      record += convertHashToStr(tmp);
    }
    return record;
  };

  // hash hashes tx string to 32-byte hashing value
  hash = () => {
    console.log("HASHING TX.....", this);
    let hash = null;
    if (this.hashValue == null) {
      let str = this.toString();
      console.log("[TEST] TX toString(): ", str);

      let bytes = privacyUtils.stringToBytes(str)
      console.log("[TEST] TX Convert string to bytes : ", bytes.join(" "));
      
      hash = privacyUtils.hashBytesToBytes(bytes);
      this.hashValue = hash;
    } else {
      hash = this.hashValue;
    }
    return hash;
  };

  // getTxActualSize computes the actual size of a given transaction in kilobyte
  getTxActualSize() {
    let sizeTx = 1 + this.type.length + this.lockTime.toString().length + (this.fee ? this.fee.toString().length : 1) + this.info.length;
    sizeTx += this.sigPubKey.length + this.sig.length;

    if (this.proof !== null) {
      sizeTx += this.proof.toBytes();
    }

    sizeTx += 1;

    if (this.metadata !== null) {
      // TODO 0xjackpolope
    }

    return Math.ceil(sizeTx / 1024);
  };
}

export {Tx};
