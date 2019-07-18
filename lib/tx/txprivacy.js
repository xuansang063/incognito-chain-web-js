import bn from 'bn.js';
import { P256 } from 'privacy-js-lib/lib/ec';
import { BIG_INT_SIZE, CM_RING_SIZE } from 'privacy-js-lib/lib/constants';
import { stringToBytes, hashSha3BytesToBytes, randScalar, checkDuplicateBigIntArray, convertUint8ArrayToArray } from "privacy-js-lib/lib/privacy_utils";
import { PaymentInfo } from '../key';
import { KeySet } from '../keySet';
import { PaymentWitness, PaymentProof } from '../payment';
import { SchnPrivKey } from '../schnorr';
import { encrypt } from '../elgamal';
import { checkEncode } from '../base58';
import { OutputCoin } from '../coin';
import { convertHashToStr } from '../common';
import { ENCODE_VERSION } from '../constants';
import { TxNormalType, TxVersion, MaxInfoSize } from './constants';
import { MaxTxSize } from '../wallet/constants';
import { hybridEncrypt } from '../hybridencryption';

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

    this.sigPrivKey = [];   // is ALWAYS private property of struct, if privacy: 64 bytes, and otherwise, 32 bytes
    this.rpcClient = rpcClient;

    this.hashValue = null;  // temp to store hash of tx
  }

  async init(senderSK, paymentAddressStr, paymentInfo, inputCoins, inputCoinStrs, fee, hasPrivacy, tokenID, metaData, info = "") {
    let start = new Date().getTime();
    let i;
    // set version tx
    this.version = TxVersion;

    // set lock time in second
    if (this.lockTime === 0) {
      this.lockTime = parseInt(new Date().getTime() / 1000);
    }

    // generate sender's key set from senderSK
    let senderKeySet = new KeySet().importFromPrivateKey(senderSK);

    // get public key's last byte of sender
    let senderPK = senderKeySet.PaymentAddress.Pk;
    let pkLastByteSender = senderPK[senderPK.length - 1];

    // init info of tx
    // let pubKeyData = P256.decompress(senderKeySet.PaymentAddress.Pk);
    // let transmissionKeyPoint = P256.decompress(senderKeySet.PaymentAddress.Tk);
        
    // let encryptedInfo = hybridEncrypt(infoBytes, senderKeySet.PaymentAddress.Tk);
    // this.info = encryptedInfo.toBytes();
    
    let infoBytes = stringToBytes(info);

    if (infoBytes.length > MaxInfoSize) {
      throw new Error("Length info was exeed MaxInfoSize bytes");
    }
    console.log("infoBytes: ", infoBytes);

    this.info = infoBytes;
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
    this.type = TxNormalType;

    // set shard id
    // let shardID = getShardIDFromLastByte(pkLastByteSender);

    // Calculate sum of all output coins' value
    let sumOutputValue = new bn(0);
    for (i = 0; i < paymentInfo.length; i++) {
      if (paymentInfo[i].Amount.cmp(new bn(0)) === -1) {
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

    if (overBalance.lt(new bn(0))) {
      throw new Error("Input value less than output value");
    }

    console.log("Check balance ok!!!!!");

    let commitmentIndices = []; // array index random of commitments in db
    let myCommitmentIndices = []; // index in array index random of commitment in db
    let commitmentProving = [];

    // get commitment list from db for proving
    // call api to random commitments list
    if (hasPrivacy) {
      let response;
      try{
        response = await this.rpcClient.randomCommitmentsProcess(paymentAddressStr, inputCoinStrs, tokenID);
      } catch(e){
        throw e;
      }
      
      commitmentIndices = response.commitmentIndices; // array index random of commitments in db
      myCommitmentIndices = response.myCommitmentIndices; // index in array index random of commitment in db
      commitmentProving = response.commitments;

      console.log("Random commitment ok!!!!!");

      // Check number of list of random commitments, list of random commitment indices
      if (commitmentIndices.length !== inputCoins.length * CM_RING_SIZE) {
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
      let changePaymentInfo = new PaymentInfo();
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
        sndOut = randScalar();
        let sndOutStrs = checkEncode(sndOut.toArray(), ENCODE_VERSION);

        while (true) {
          // call api to check SND existence
          let res;
          try {
            res = await this.rpcClient.hasSNDerivator(paymentAddressStr, [sndOutStrs]);
          } catch(e){
            throw e;
          }
          
          // if sndOut existed, then re-random it
          if (res.existed[0]) {
            sndOut = randScalar();
            sndOutStrs = checkEncode(sndOut.toArray(), ENCODE_VERSION);
          } else {
            break
          }
        }
        sndOuts[i] = sndOut;
      }

      // if sndOuts has two elements that have same value, then re-generates it
      ok = checkDuplicateBigIntArray(sndOuts);
      if (ok) {
        sndOuts = new Array(paymentInfo.length);
      }
    }

    console.log("Create new output coins ok!!!!!");

    // create new output coins with info: Pk, value, last byte of pk, snd
    for (i = 0; i < paymentInfo.length; i++) {
      outputCoins[i] = new OutputCoin();
      outputCoins[i].coinDetails.value = paymentInfo[i].Amount;
      outputCoins[i].coinDetails.publicKey = P256.decompress(paymentInfo[i].PaymentAddress.Pk);
      outputCoins[i].coinDetails.snderivator = sndOuts[i];
    }

    // assign fee tx
    this.fee = fee;

    // create zero knowledge proof of payment
    this.proof = new PaymentProof();

    // prepare witness for proving
    let witness = new PaymentWitness();
    witness.init(hasPrivacy, new bn(senderSK, 'be', BIG_INT_SIZE), inputCoins, outputCoins, pkLastByteSender, commitmentProving, commitmentIndices, myCommitmentIndices);

    console.log("Init witness ok!!!!!");
    console.time("Proving:");
    this.proof = await witness.prove(hasPrivacy);
    console.timeEnd("Proving:");
    console.log("Proving ok!!!!!");

    // set private key for signing tx
    if (hasPrivacy) {
      this.sigPrivKey = new Uint8Array(2 * BIG_INT_SIZE);
      this.sigPrivKey.set(senderSK, 0);
      this.sigPrivKey.set(witness.randSK.toArray('be', BIG_INT_SIZE), senderSK.length);

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
      this.sigPrivKey = new Uint8Array(BIG_INT_SIZE + 1);
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

    let txSize = this.getTxActualSize(); 
    console.log("TX actual size when create tx: ", txSize);

    // check tx size 
    if (txSize > MaxTxSize){
      throw new Error("Tx size is too large!")
    }
    return null;
  }

  // convertTxToByte converts tx to bytes array before sending tx
  convertTxToByte() {
    this.info = convertUint8ArrayToArray(this.info);
    this.sigPubKey = convertUint8ArrayToArray(this.sigPubKey);
    this.sig = convertUint8ArrayToArray(this.sig);

    if (this.proof) {
      this.proof = checkEncode(this.proof.toBytes(), ENCODE_VERSION);
    }

    if (this.fee) {
      this.fee = this.fee.toNumber();
    }

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
    let sk = new bn(this.sigPrivKey.slice(0, BIG_INT_SIZE));
    let r = new bn(this.sigPrivKey.slice(BIG_INT_SIZE));

    let sigKey = new SchnPrivKey(sk, r);

    // save public key for verification signature tx
    this.sigPubKey = sigKey.PK.PK.compress();

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
    record += this.lockTime.toString();

    if (this.fee == null) {
      record += "0";
    } else {
      record += this.fee.toString();
    }

    if (this.proof != null) {
      let proofBytes = this.proof.toBytes();
      let proofBytesEncoded = checkEncode(proofBytes, ENCODE_VERSION);
      record += proofBytesEncoded;
    }

    console.log("CONVERTING TX TO STRING FOR HASHING DONE!!!!!!!");

    if (this.metadata != null) {
      let tmp = this.metadata.Type.toString();
      tmp = hashSha3BytesToBytes(stringToBytes(tmp));
      console.log("Meta data after hashing: ", tmp);
      record += convertHashToStr(tmp);
    }
    return record;
  };

  // hash hashes tx string to 32-byte hashing value
  hash = () => {
    let hash = null;

    if (this.hashValue == null) {
      let str = this.toString();
      let bytes = stringToBytes(str);

      hash = hashSha3BytesToBytes(bytes);
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
      sizeTx += this.proof.toBytes().length;
    }

    sizeTx += 1;

    if (this.metadata) {
      if (this.metadata.Type){
        sizeTx += this.metadata.Type.toString().length;
      }
    }

    return Math.ceil(sizeTx / 1024);
  };
}

export { Tx };
