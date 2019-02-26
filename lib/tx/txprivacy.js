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
import {getShardIDFromLastByte} from '../common';
import {RpcClient} from "../rpcclient/rpcclient"

const P256 = ec.P256;
const TxVersion = 1;
const ConstantID = new Uint8Array(32);
ConstantID[0] = 4;

const TxNormalType = 'n';

class Tx {
  constructor(rpcUrl) {

    console.log("bbbbbbbbbb: ", this);
    // Basic data
    this.Version = 0;
    this.Type = '';
    this.LockTime = 0;
    this.Fee = 0;
    this.Info = [];

    // Sign and Privacy proof
    this.SigPubKey = [];
    this.Sig = [];
    this.Proof = new zkpPayment.PaymentProof();

    this.PubKeyLastByteSender = 0x00;

    // Metadata
    this.Metadata = null;

    this.sigPrivKey = []; // is ALWAYS private property of struct, if privacy: 64 bytes, and otherwise, 32 bytes
    this.rpcClient = new RpcClient()
  }

  async init(input, paymentInfo, fee, hasPrivacy, db, tokenID, metaData) {

    let senderSK = input.senderKeySet.PrivateKey;
    let paymentAddress = input.paymentAddrSerialize;
    let inputCoins = input.inputCoins;
    let inputCoinStrs = input.inputCoinStrs;

    let start = new Date().getTime();
    let i;
    // set version tx
    this.Version = TxVersion;

    // set tokenID for constant
    if (tokenID === null) {
      tokenID = ConstantID;
    }

    // set lock time
    if (this.LockTime === 0) {
      this.LockTime = parseInt(new Date().getTime() / 1000);
    }

    // generate sender's key set from senderSK
    let senderKeySet = new keySet.KeySet().importFromPrivateKey(senderSK);

    // get public key's last byte of sender
    let senderPK = senderKeySet.PaymentAddress.PublicKey;
    let pkLastByteSender = senderPK[senderPK.length - 1];

    // init info of tx
    let pubKeyData = P256.decompress(senderKeySet.PaymentAddress.PublicKey);
    let transmissionKeyPoint = P256.decompress(senderKeySet.PaymentAddress.TransmissionKey);
    this.Info = elGamal.encrypt(transmissionKeyPoint, pubKeyData);

    //set meta data
    this.Metadata = metaData;

    // check whether tx is custom token tx or not
    if (inputCoins.length === 0 && fee === 0 && !hasPrivacy) {
      console.log("CREATE TX CUSTOM TOKEN");
      this.Fee = fee;
      this.sigPrivKey = senderSK;
      this.PubKeyLastByteSender = pkLastByteSender;

      this.sign(hasPrivacy);
      return;
    }

    // set type tx
    this.Type = TxNormalType;

    // set shard id
    let shardID = getShardIDFromLastByte(pkLastByteSender);

    // Calculate sum of all output coins' value
    let sumOutputValue = new bn(0);
    for (i = 0; i < paymentInfo.length; i++) {
      if (paymentInfo[i].Amount.cmp(new bn.BN(0)) === -1) {
        return new Error("output coin's value is less than 0");
      }
      sumOutputValue = sumOutputValue.add(paymentInfo[i].Amount);
    }

    // Calculate sum of all input coins' value
    let sumInputValue = new bn(0);
    // console.log("CREATING TX: ------ INPUT COIN LEN",   inputCoins.length);
    for (i = 0; i < inputCoins.length; i++) {
      sumInputValue = sumInputValue.add(inputCoins[i].CoinDetails.Value);
    }

    // Calculate over balance, it will be returned to sender
    let overBalance = sumInputValue.sub(sumOutputValue);
    overBalance = overBalance.sub(fee);

    if (overBalance.lt(new bn.BN(0))) {
      return new Error("Input value less than output value");
    }

    let commitmentIndices = []; // array index random of commitments in db
    let myCommitmentIndices = []; // index in array index random of commitment in db
    let commitmentProving = [];

    // get commitment list from db for proving
    // call api to random commitments list

    // console.log("my Commitment: ", inputCoins[0].CoinDetails.CoinCommitment);
    if (hasPrivacy) {
      let randCommitments = await this.rpcClient.randomCommitmentsProcess(paymentAddress, inputCoinStrs);
      // for (let i = 0; i < randCommitments.commitments.length; i++) {
      //   console.log("randCommitments : ", randCommitments.commitments[i].compress().join(", "));
      // }
      // console.log("randCommitments: ", randCommitments.commitments);
      // console.log();
      // console.log();
      commitmentIndices = randCommitments.commitmentIndices; // array index random of commitments in db
      myCommitmentIndices = randCommitments.myCommitmentIndices; // index in array index random of commitment in db
      commitmentProving = randCommitments.commitments;

      // Check number of list of random commitments, list of random commitment indices
      if (commitmentIndices.length !== inputCoins.length * constants.CM_RING_SIZE) {
        return new Error("Invalid random commitments");
      }

      if (myCommitmentIndices.length !== inputCoins.length) {
        return new Error("Number of list my commitment indices must be equal to number of input coins");
      }
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
          let res = await this.rpcClient.hasSNDerivator(paymentAddress, [sndOutStrs]);

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

    // create new output coins with info: Pk, value, last byte of pk, snd
    for (i = 0; i < paymentInfo.length; i++) {
      outputCoins[i] = new coin.OutputCoin();
      outputCoins[i].CoinDetails.Value = paymentInfo[i].Amount;
      outputCoins[i].CoinDetails.PublicKey = P256.decompress(paymentInfo[i].PaymentAddress.PublicKey);
      outputCoins[i].CoinDetails.SNDerivator = sndOuts[i];
    }

    // assign fee tx
    this.Fee = fee;

    // create zero knowledge proof of payment
    this.Proof = new zkpPayment.PaymentProof();

    // prepare witness for proving
    let witness = new zkpPayment.PaymentWitness();
    witness.init(hasPrivacy, new bn(senderSK, 'be', constants.BIG_INT_SIZE), inputCoins, outputCoins, pkLastByteSender, commitmentProving, commitmentIndices, myCommitmentIndices, fee);

    this.Proof = witness.prove(hasPrivacy);

    // set private key for signing tx
    if (hasPrivacy) {
      this.sigPrivKey = new Uint8Array(2 * constants.BIG_INT_SIZE);
      this.sigPrivKey.set(senderSK, 0);
      this.sigPrivKey.set(witness.randSK.toArray('be', constants.BIG_INT_SIZE), senderSK.length);

      // encrypt coin details (Randomness)
      // hide information of output coins except coin commitments, public key, snDerivators
      for (i = 0; i < this.Proof.outputCoins.length; i++) {
        this.Proof.outputCoins[i].encrypt(paymentInfo[i].PaymentAddress.TransmissionKey);
        this.Proof.outputCoins[i].CoinDetails.SerialNumber = null;
        this.Proof.outputCoins[i].CoinDetails.Value = 0;
        this.Proof.outputCoins[i].CoinDetails.Randomness = null;
      }

      // hide information of input coins except serial number of input coins
      for (i = 0; i < this.Proof.inputCoins.length; i++) {
        this.Proof.inputCoins[i].CoinDetails.CoinCommitment = null;
        this.Proof.inputCoins[i].CoinDetails.Value = 0;
        this.Proof.inputCoins[i].CoinDetails.SNDerivator = null;
        this.Proof.inputCoins[i].CoinDetails.PublicKey = null;
        this.Proof.inputCoins[i].CoinDetails.Randomness = null;
      }

    } else {
      this.sigPrivKey = new Uint8Array(constants.BIG_INT_SIZE + 1);
      this.sigPrivKey.set(senderSK, 0);
      this.sigPrivKey.set(new bn(0).toArray(), senderSK.length);
    }

    // sign tx
    this.PubKeyLastByteSender = pkLastByteSender;
    this.sign();

    let end = new Date().getTime();
    console.log("Creating tx time: ", end - start);
    console.log("**** DONE CREATING TX ****");

    return null;
  }

  convertTxToByte() {
    this.Info = privacyUtils.convertUint8ArrayToArray(this.Info);
    this.SigPubKey = privacyUtils.convertUint8ArrayToArray(this.SigPubKey);
    this.Sig = privacyUtils.convertUint8ArrayToArray(this.Sig);

    this.Proof = base58.checkEncode(this.Proof.toBytes(), constants.PRIVACY_VERSION);
    this.Fee = 0;

    // this.Proof = privacyUtils.convertUint8ArrayToArray(this.Proof.toBytes());
    return this;
  }

  sign() {
    //Check input transaction

    if (this.Sig.length !== 0) {
      return new Error("input transaction must be an unsigned one")
    }

    /****** using Schnorr signature *******/
      // sign with sigPrivKey
      // prepare private key for Schnorr
    let sk = new bn(this.sigPrivKey.slice(0, constants.BIG_INT_SIZE));
    let r = new bn(this.sigPrivKey.slice(constants.BIG_INT_SIZE));

    let sigKey = new schnorr.SchnPrivKey(sk, r);

    // save public key for verification signature tx
    this.SigPubKey = sigKey.PK.PK.compress();
    // console.log('Sig PubKey: ', this.SigPubKey);

    // signing
    console.log("HASH tx: ", this.hash().join(', '));
    this.Sig = sigKey.sign(this.hash());
    return null
  }

  // toString converts tx to string
  toString() {
    let record = this.Version.toString();
    // console.log("this.Version.toString(): ", this.Version.toString());

    record += this.LockTime.toString();
    // console.log("this.LockTime.toString(): ", this.LockTime.toString());

    record += this.Fee.toString();
    // console.log("this.Fee.toString(): ", this.Fee.toString());

    if (this.Proof != null) {
      record += base58.checkEncode(this.Proof.toBytes(), constants.PRIVACY_VERSION);
    }
    // if (this.Metadata != null) {
    //     record += this.Metadata;
    // }
    return record;
  }

  // hash hashes tx string to 32-byte hashing value
  hash = () => {
    console.log('aaaaaaaa', this instanceof Tx);
    return privacyUtils.hashBytesToBytes(privacyUtils.stringToBytes(this.toString()));
  }

  // getTxActualSize computes the actual size of a given transaction in kilobyte
  getTxActualSize() {
    let sizeTx = 1 + this.Type.length + this.LockTime.toString().length + this.Fee.toString().length + this.Info.length;
    sizeTx += this.SigPubKey.length + this.Sig.length;

    if (this.Proof !== null) {
      sizeTx += this.Proof.toBytes();
    }

    sizeTx += 1;

    if (this.Metadata !== null) {
      // TODO 0xjackpolope
    }

    return Math.ceil(sizeTx / 1024);
  }
}

export {Tx};