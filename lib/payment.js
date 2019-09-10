import bn from 'bn.js';
import { P256 } from 'privacy-js-lib/lib/ec';
import { AggregatedRangeWitness } from 'privacy-js-lib/lib/zkps/aggregatedrange';
import { SNNoPrivacyWitness } from 'privacy-js-lib/lib/zkps/snnoprivacy';
import { SNPrivacyWitness } from 'privacy-js-lib/lib/zkps/snprivacy';
import { OneOutOfManyWitness } from 'privacy-js-lib/lib/zkps/oneoutofmany';
import { estimateMultiRangeProofSize } from 'privacy-js-lib/lib/zkps/aggregatedrange_utils';
import { PedCom } from 'privacy-js-lib/lib/pedersen';
import { randScalar, intToByteArr, addPaddingBigInt } from 'privacy-js-lib/lib/privacy_utils';
import { getShardIDFromLastByte } from './common';
import { 
  NUM_PROOF_PROPERTIES,
  INPUT_COINS_NO_PRIVACY_SIZE,
  OUTPUT_COINS_NO_PRIVACY_SIZE,
  INPUT_COINS_PRIVACY_SIZE,
  OUTPUT_COINS_CONSTANTS_SIZE,
} from './constants';
import {
  SK, SHARD_ID, VALUE, SND,
  COMPRESS_POINT_SIZE,
  UINT64_SIZE
} from 'privacy-js-lib/lib/constants';

import {
  CM_RING_SIZE,
  ONE_OF_MANY_PROOF_SIZE,
  SN_PRIVACY_PROOF_SIZE,
  SN_NO_PRIVACY_PROOF_SIZE
} from 'privacy-js-lib/lib/zkps/constants';


class PaymentWitness {
  constructor() {
    this.spendingKey = new bn(0);
    this.randSK = new bn(0);

    this.inputCoins = []; // []*privacy.InputCoin
    this.outputCoins = []; // []*privacy.OutputCoin

    this.commitmentIndices = []; // []*bigint
    this.myCommitmentIndices = []; // []uint64
    this.oneOfManyWitness = []; // []*OneOutOfManyWitness
    this.serialNumberWitness = []; // []*PKSNPrivacyWitness
    this.snNoPrivacyWitness = []; // []*snNoPrivacyWitness
    this.aggregatedRangeWitness = null;

    this.comOutputValue = []; // []*privacy.EllipticPoint
    this.comOutputSND = []; // []*privacy.EllipticPoint
    this.comOutputShardID = []; // []*privacy.EllipticPoint

    this.comInputSK = null;
    this.comInputValue = []; // []*privacy.EllipticPoint
    this.comInputSND = []; // []*privacy.EllipticPoint
    this.comInputShardID = null;
  }

  init(hasPrivacy, spendingKey, inputCoins, outputCoins, pkLastByteSender, commitments, commitmentIndices, myCommitmentIndices) {
    for (let i = 0; i< commitments.length; i++){
      console.log("AAA commitment i: ", commitments[i].compress())
    }
    // console.log("AAA commitments: ", commitments);
    console.log("AAA commitmentIndices: ", commitmentIndices);
    console.log("AAA myCommitmentIndices: ", myCommitmentIndices);

    let numInputCoin = inputCoins.length;

    // no privacy
    if (!hasPrivacy) {
      // random randomness and calculate coin commitments for output coins
      for (let i = 0; i < outputCoins.length; i++) {
        outputCoins[i].coinDetails.randomness = randScalar();
        outputCoins[i].coinDetails.commitAll();
      }

      this.spendingKey = spendingKey;
      this.inputCoins = inputCoins;
      this.outputCoins = outputCoins;

      let publicKey = inputCoins && inputCoins.length > 0 && inputCoins[0].coinDetails.publicKey;

      /***** Build witness for proving that serial number is derived from the committed derivator for each input coins *****/
      this.snNoPrivacyWitness = new Array(numInputCoin);
      for (let i = 0; i < inputCoins.length; i++) {
        this.snNoPrivacyWitness[i] = new SNNoPrivacyWitness();
        this.snNoPrivacyWitness[i].set(inputCoins[i].coinDetails.serialNumber, publicKey, inputCoins[i].coinDetails.snderivator, this.spendingKey)
      }
      return null
    }

    // has privacy
    this.spendingKey = spendingKey;
    this.inputCoins = inputCoins;
    this.outputCoins = outputCoins;
    this.commitmentIndices = commitmentIndices;
    this.myCommitmentIndices = myCommitmentIndices;

    // save rand SK for Schnorr signature
    this.randSK = randScalar();
    // calculate sk commitment of input coins
    this.comInputSK = PedCom.commitAtIndex(this.spendingKey, this.randSK, SK);

    // calculate shard id commitment of input coins
    let randInputShardID = randScalar();
    let shardID = getShardIDFromLastByte(pkLastByteSender);
    this.comInputShardID = PedCom.commitAtIndex(new bn(shardID), randInputShardID, SHARD_ID);

    this.comInputValue = new Array(numInputCoin);
    this.comInputSND = new Array(numInputCoin);
    let randInputValue = new Array(numInputCoin);
    let randInputSND = new Array(numInputCoin);

    // cmInputValueAll is sum of all input coins' value commitments
    let cmInputValueAll = P256.curve.point(0, 0);
    let randInputValueAll = new bn(0);

    // Summing all commitments of each input coin into one commitment and proving the knowledge of its Openings
    let cmInputSum = new Array(numInputCoin);
    let randInputSum = new Array(numInputCoin);

    // randInputSumAll is sum of all randomess of coin commitments
    let randInputSumAll = new bn(0);

    let commitmentTemps = new Array(numInputCoin);
    let randInputIsZero = new Array(numInputCoin);

    this.oneOfManyWitness = new Array(numInputCoin);
    this.serialNumberWitness = new Array(numInputCoin);

    let preIndex = 0;
    for (let i = 0; i < numInputCoin; i++) {
      // commit each component of coin commitment
      randInputValue[i] = randScalar();
      randInputSND[i] = randScalar();

      this.comInputValue[i] = PedCom.commitAtIndex(inputCoins[i].coinDetails.value, randInputValue[i], VALUE);
      this.comInputSND[i] = PedCom.commitAtIndex(inputCoins[i].coinDetails.snderivator, randInputSND[i], SND);

      cmInputValueAll = cmInputValueAll.add(this.comInputValue[i]);

      randInputValueAll = randInputValueAll.add(randInputValue[i]);
      randInputValueAll = randInputValueAll.umod(P256.n);

      /***** Build witness for proving one-out-of-N commitments is a commitment to the coins being spent *****/
      cmInputSum[i] = this.comInputSK.add(this.comInputValue[i]);
      cmInputSum[i] = cmInputSum[i].add(this.comInputSND[i]);
      cmInputSum[i] = cmInputSum[i].add(this.comInputShardID);

      randInputSum[i] = this.randSK;
      randInputSum[i] = randInputSum[i].add(randInputValue[i]);
      randInputSum[i] = randInputSum[i].add(randInputSND[i]);
      randInputSum[i] = randInputSum[i].add(randInputShardID);
      randInputSum[i] = randInputSum[i].mod(P256.n);

      randInputSumAll = randInputSumAll.add(randInputSum[i]);
      randInputSumAll = randInputSumAll.umod(P256.n);

      // commitmentTemps is a list of commitments for protocol one-out-of-N
      commitmentTemps[i] = new Array(CM_RING_SIZE);

      randInputIsZero[i] = inputCoins[i].coinDetails.randomness;
      randInputIsZero[i] = randInputIsZero[i].sub(randInputSum[i]);
      randInputIsZero[i] = randInputIsZero[i].umod(P256.n);

      for (let j = 0; j < CM_RING_SIZE; j++) {
        commitmentTemps[i][j] = commitments[preIndex + j].sub(cmInputSum[i]);
      }

      let indexIsZero = myCommitmentIndices[i] % CM_RING_SIZE;

      this.oneOfManyWitness[i] = new OneOutOfManyWitness();
      this.oneOfManyWitness[i].set(commitmentTemps[i], randInputIsZero[i], indexIsZero);
      preIndex = CM_RING_SIZE * (i + 1);
      // ---------------------------------------------------

      /***** Build witness for proving that serial number is derived from the committed derivator *****/
      this.serialNumberWitness[i] = new SNPrivacyWitness();
      this.serialNumberWitness[i].set(inputCoins[i].coinDetails.serialNumber, this.comInputSK, this.comInputSND[i],
        spendingKey, this.randSK, inputCoins[i].coinDetails.snderivator, randInputSND[i])

      // ---------------------------------------------------
    }

    let numOutputCoin = this.outputCoins.length;

    let randOutputValue = new Array(numOutputCoin);
    let randOutputSND = new Array(numOutputCoin);
    let randOutputShardID = new Array(numOutputCoin);
    let cmOutputValue = new Array(numOutputCoin);
    let cmOutputSND = new Array(numOutputCoin);
    let cmOutputShardID = new Array(numOutputCoin);

    let cmOutputSum = new Array(numOutputCoin);
    let randOutputSum = new Array(numOutputCoin);

    // cmOutputValueAll is sum of all value coin commitments
    let cmOutputValueAll = P256.curve.point(0, 0);
    let randOutputValueAll = new bn(0);

    for (let i = 0; i < numOutputCoin; i++) {
      if (i === numOutputCoin - 1) {
        randOutputValue[i] = randInputValueAll.sub(randOutputValueAll);
        randOutputValue[i] = randOutputValue[i].umod(P256.n);
      } else {
        randOutputValue[i] = randScalar();
      }

      randOutputSND[i] = randScalar();
      randOutputShardID[i] = randScalar();

      cmOutputValue[i] = PedCom.commitAtIndex(outputCoins[i].coinDetails.value, randOutputValue[i], VALUE);
      cmOutputSND[i] = PedCom.commitAtIndex(outputCoins[i].coinDetails.snderivator, randOutputSND[i], SND);

      let shardID = getShardIDFromLastByte(outputCoins[i].coinDetails.getPubKeyLastByte());
      cmOutputShardID[i] = PedCom.commitAtIndex(new bn(shardID), randOutputShardID[i], SHARD_ID);

      randOutputSum[i] = randOutputValue[i].add(randOutputSND[i]);
      randOutputSum[i] = randOutputSum[i].add(randOutputShardID[i]);
      randOutputSum[i] = randOutputSum[i].umod(P256.n);

      cmOutputSum[i] = cmOutputValue[i].add(cmOutputSND[i]);
      cmOutputSum[i] = cmOutputSum[i].add(outputCoins[i].coinDetails.publicKey);
      cmOutputSum[i] = cmOutputSum[i].add(cmOutputShardID[i]);

      cmOutputValueAll = cmOutputValueAll.add(cmOutputValue[i]);
      randOutputValueAll = randOutputValueAll.add(randOutputValue[i]);
      randOutputValueAll = randOutputValueAll.umod(P256.n);
      // calculate final commitment for output coins
      outputCoins[i].coinDetails.coinCommitment = cmOutputSum[i];
      outputCoins[i].coinDetails.randomness = randOutputSum[i];
    }

    // For aggregated range Protocol
    // proving each output value is less than vmax
    // proving sum of output values is less than vmax
    let outputValue = new Array(numOutputCoin);
    for (let i = 0; i < numOutputCoin; i++) {
      outputValue[i] = outputCoins[i].coinDetails.value;
    }
    this.aggregatedRangeWitness = new AggregatedRangeWitness();
    this.aggregatedRangeWitness.set(outputValue, randOutputValue);
    // ---------------------------------------------------

    // save partial commitments (value, input, shardID)
    this.comOutputValue = cmOutputValue;
    this.comOutputSND = cmOutputSND;
    this.comOutputShardID = cmOutputShardID;
    return null;
  }

  async prove(hasPrivacy) {
    let proof = new PaymentProof();
    proof.commitmentIndices = this.commitmentIndices;

    proof.inputCoins = this.inputCoins;
    proof.outputCoins = this.outputCoins;

    proof.comOutputValue = this.comOutputValue;
    proof.comOutputSND = this.comOutputSND;
    proof.comOutputShardID = this.comOutputShardID;

    proof.comInputSK = this.comInputSK;
    proof.comInputValue = this.comInputValue;
    proof.comInputSND = this.comInputSND;
    proof.comInputShardID = this.comInputShardID;

    let numInputCoins = this.inputCoins.length;

    // if hasPrivacy == false, don't need to create the zero knowledge proof
    // proving user has spending key corresponding with public key in input coins
    // is proved by signing with spending key
    if (!hasPrivacy) {
      // Proving that serial number is derived from the committed derivator
      proof.snNoPrivacyProof = new Array(numInputCoins);

      for (let i = 0; i < numInputCoins; i++) {
        proof.snNoPrivacyProof[i] = this.snNoPrivacyWitness[i].prove();
      }
      return proof;
    }

    // if hasPrivacy == true
    proof.oneOfManyProof = new Array(numInputCoins);
    proof.serialNumberProof = new Array(numInputCoins);

    console.time("One of many and serial number proof: ")

    for (let i = 0; i < numInputCoins; i++) {
      // Proving one-out-of-N commitments is a commitment to the coins being spent
      let oneOfMany = await this.oneOfManyWitness[i].prove();
      console.log("oneOfMany: ", oneOfMany)
      if (oneOfMany.err === null) {
        proof.oneOfManyProof[i] = oneOfMany.proof;
      }
      console.log("One of many done!!!!");

      // Proving that serial number is derived from the committed derivator
      proof.serialNumberProof[i] = this.serialNumberWitness[i].prove();
      console.log("serial number done!!!!");
    }
    console.timeEnd("One of many and serial number proof: ")

    console.time("Aggregated range proof: ")

    // Proving that each output values and sum of them does not exceed v_max
    proof.aggregatedRangeProof = await this.aggregatedRangeWitness.prove();
    console.timeEnd("Aggregated range proof: ")
    console.log("proof.aggregatedRangeProof: ", proof.aggregatedRangeProof);
    console.log("Aggregated range done!!!!");

    return proof;
  }
}

class PaymentProof {
  constructor() {
    // for input coins
    this.oneOfManyProof = []; //[]*OneOutOfManyProof
    this.serialNumberProof = []; // []*PKSNPrivacyProof
    // it is exits when tx has no privacy
    this.snNoPrivacyProof = []; //[]*snNoPrivacyProof

    // for output coins
    // for proving each value and sum of them are less than a threshold value
    this.aggregatedRangeProof = null;

    this.inputCoins = []; //[]*privacy.InputCoin
    this.outputCoins = []; //[]*privacy.OutputCoin

    this.comOutputValue = []; //   []*privacy.EllipticPoint
    this.comOutputSND = []; //    []*privacy.EllipticPoint
    this.comOutputShardID = []; // []*privacy.EllipticPoint

    this.comInputSK = null;
    this.comInputValue = []; //  []*privacy.EllipticPoint
    this.comInputSND = []; //   []*privacy.EllipticPoint
    this.comInputShardID = null;

    this.commitmentIndices = []; // big int array
  }

  toBytes() {
    console.log("CONVERTING PAYMENT PROOF TO BYTE.....");
    console.time("CONVERTING PAYMENT PROOF TO BYTE");
    let hasPrivacy = this.oneOfManyProof.length > 0;
    let paymentProofSize = 0;

    let partialBytes = new Array(NUM_PROOF_PROPERTIES);

    // OneOfManyProof
    let oneOfManyArrLen = this.oneOfManyProof.length;
    partialBytes[0] = new Uint8Array(1 + 2 * oneOfManyArrLen + oneOfManyArrLen * ONE_OF_MANY_PROOF_SIZE);
    partialBytes[0].set([oneOfManyArrLen], 0);
    let offset = 1;
    for (let i = 0; i < oneOfManyArrLen; i++) {
      partialBytes[0].set(intToByteArr(ONE_OF_MANY_PROOF_SIZE), offset);
      offset += 2;
      console.log("this.oneOfManyProof[i]: ", this.oneOfManyProof[i]);
      partialBytes[0].set(this.oneOfManyProof[i].toBytes(), offset);
      offset += ONE_OF_MANY_PROOF_SIZE;
    }
    paymentProofSize += partialBytes[0].length;

    // SerialNumberProofSize
    let serialNumberArrLen = this.serialNumberProof.length;
    partialBytes[1] = new Uint8Array(1 + 2 * serialNumberArrLen + serialNumberArrLen * SN_PRIVACY_PROOF_SIZE);
    partialBytes[1].set([serialNumberArrLen], 0);
    offset = 1;
    for (let i = 0; i < serialNumberArrLen; i++) {
      partialBytes[1].set(intToByteArr(SN_PRIVACY_PROOF_SIZE), offset);
      offset += 2;
      partialBytes[1].set(this.serialNumberProof[i].toBytes(), offset);
      offset += SN_PRIVACY_PROOF_SIZE;
    }
    paymentProofSize += partialBytes[1].length;

    // serialNumber NoPrivacy ProofSize
    let snNoPrivacyArrLen = this.snNoPrivacyProof.length;
    partialBytes[2] = new Uint8Array(1 + snNoPrivacyArrLen + snNoPrivacyArrLen * SN_NO_PRIVACY_PROOF_SIZE);
    partialBytes[2].set([snNoPrivacyArrLen], 0);
    offset = 1;
    for (let i = 0; i < snNoPrivacyArrLen; i++) {
      partialBytes[2].set([SN_NO_PRIVACY_PROOF_SIZE], offset);
      offset += 1;
      partialBytes[2].set(this.snNoPrivacyProof[i].toBytes(), offset);
      offset += SN_NO_PRIVACY_PROOF_SIZE;
    }
    paymentProofSize += partialBytes[2].length;

    // ComOutputMultiRangeProofSize
    if (hasPrivacy) {
      let comOutputMultiRangeProof = this.aggregatedRangeProof.toBytes();
      partialBytes[3] = new Uint8Array(2 + comOutputMultiRangeProof.length);
      partialBytes[3].set(intToByteArr(comOutputMultiRangeProof.length), 0);
      partialBytes[3].set(comOutputMultiRangeProof, 2);
    } else {
      partialBytes[3] = new Uint8Array(2);
      partialBytes[3].set([0, 0], 0);
    }
    paymentProofSize += partialBytes[3].length;

    // InputCoins
    let inputCoinArrLen = this.inputCoins.length;
    console.log("inputCoinArrLen: ", inputCoinArrLen);
    let inputCoinBytesTmp = new Array(inputCoinArrLen);
    let inputCoinBytesSize = 0;
    for (let i = 0; i < inputCoinArrLen; i++) {
      inputCoinBytesTmp[i] = this.inputCoins[i].toBytes();
      inputCoinBytesSize += inputCoinBytesTmp[i].length;
    }

    partialBytes[4] = new Uint8Array(1 + inputCoinArrLen + inputCoinBytesSize);
    partialBytes[4].set([inputCoinArrLen], 0);
    offset = 1;
    for (let i = 0; i < inputCoinArrLen; i++) {
      partialBytes[4].set([inputCoinBytesTmp[i].length], offset);
      offset += 1;
      partialBytes[4].set(inputCoinBytesTmp[i], offset);
      offset += inputCoinBytesTmp[i].length;
    }
    paymentProofSize += partialBytes[4].length;

    // OutputCoins
    let outputCoinArr = this.outputCoins.length;
    let outputCoinBytesTmp = new Array(outputCoinArr);
    let outputCoinBytesSize = 0;
    for (let i = 0; i < outputCoinArr; i++) {
      outputCoinBytesTmp[i] = this.outputCoins[i].toBytes();
      outputCoinBytesSize += outputCoinBytesTmp[i].length;
    }

    partialBytes[5] = new Uint8Array(1 + outputCoinArr + outputCoinBytesSize);
    partialBytes[5].set([outputCoinArr], 0);
    offset = 1;
    for (let i = 0; i < outputCoinArr; i++) {
      partialBytes[5].set([outputCoinBytesTmp[i].length], offset);
      offset += 1;
      partialBytes[5].set(outputCoinBytesTmp[i], offset);
      offset += outputCoinBytesTmp[i].length;
    }
    paymentProofSize += partialBytes[5].length;

    // ComOutputValue
    let comOutputValueArrLen = this.comOutputValue.length;
    partialBytes[6] = new Uint8Array(1 + comOutputValueArrLen + comOutputValueArrLen * COMPRESS_POINT_SIZE);
    partialBytes[6].set([comOutputValueArrLen], 0);
    offset = 1;
    for (let i = 0; i < comOutputValueArrLen; i++) {
      partialBytes[6].set([COMPRESS_POINT_SIZE], offset);
      offset += 1;
      partialBytes[6].set(this.comOutputValue[i].compress(), offset);
      offset += COMPRESS_POINT_SIZE;
    }
    paymentProofSize += partialBytes[6].length;

    // ComOutputSND
    let comOutputSNDArr = this.comOutputSND.length;
    partialBytes[7] = new Uint8Array(1 + comOutputSNDArr + comOutputSNDArr * COMPRESS_POINT_SIZE);
    partialBytes[7].set([comOutputSNDArr], 0);
    offset = 1;
    for (let i = 0; i < comOutputSNDArr; i++) {
      partialBytes[7].set([COMPRESS_POINT_SIZE], offset);
      offset += 1;
      partialBytes[7].set(this.comOutputSND[i].compress(), offset);
      offset += COMPRESS_POINT_SIZE;
    }
    paymentProofSize += partialBytes[7].length;

    // ComOutputShardID
    let comOutputShardIDArrLen = this.comOutputShardID.length;
    partialBytes[8] = new Uint8Array(1 + comOutputShardIDArrLen + comOutputShardIDArrLen * COMPRESS_POINT_SIZE);
    partialBytes[8].set([comOutputShardIDArrLen], 0);
    offset = 1;
    for (let i = 0; i < comOutputShardIDArrLen; i++) {
      partialBytes[8].set([COMPRESS_POINT_SIZE], offset);
      offset += 1;
      partialBytes[8].set(this.comOutputShardID[i].compress(), offset);
      offset += COMPRESS_POINT_SIZE;
    }
    paymentProofSize += partialBytes[8].length;

    // ComInputSK
    if (this.comInputSK !== null) {
      partialBytes[9] = new Uint8Array(1 + COMPRESS_POINT_SIZE);
      partialBytes[9].set([COMPRESS_POINT_SIZE], 0);
      partialBytes[9].set(this.comInputSK.compress(), 1);
    } else {
      partialBytes[9] = new Uint8Array(1);
      partialBytes[9].set([0], 0);
    }
    paymentProofSize += partialBytes[9].length;

    // ComInputValue
    let comInputValueArrLen = this.comInputValue.length;
    partialBytes[10] = new Uint8Array(1 + comInputValueArrLen + comInputValueArrLen * COMPRESS_POINT_SIZE);
    partialBytes[10].set([comInputValueArrLen], 0);
    offset = 1;
    for (let i = 0; i < comInputValueArrLen; i++) {
      partialBytes[10].set([COMPRESS_POINT_SIZE], offset);
      offset += 1;
      partialBytes[10].set(this.comInputValue[i].compress(), offset);
      offset += COMPRESS_POINT_SIZE;
    }
    paymentProofSize += partialBytes[10].length;

    // ComInputSND
    let comInputSNDArrLen = this.comInputSND.length;
    partialBytes[11] = new Uint8Array(1 + comInputSNDArrLen + comInputSNDArrLen * COMPRESS_POINT_SIZE);
    partialBytes[11].set([comInputSNDArrLen], 0);
    offset = 1;
    for (let i = 0; i < comInputSNDArrLen; i++) {
      partialBytes[11].set([COMPRESS_POINT_SIZE], offset);
      offset += 1;
      partialBytes[11].set(this.comInputSND[i].compress(), offset);
      offset += COMPRESS_POINT_SIZE;
    }
    paymentProofSize += partialBytes[11].length;

    // ComInputShardID
    if (this.comInputShardID !== null) {
      partialBytes[12] = new Uint8Array(1 + COMPRESS_POINT_SIZE);
      partialBytes[12].set([COMPRESS_POINT_SIZE], 0);
      partialBytes[12].set(this.comInputShardID.compress(), 1);
    } else {
      partialBytes[12] = new Uint8Array(1);
      partialBytes[12].set([0], 0);
    }
    paymentProofSize += partialBytes[12].length;

    // convert commitment index to bytes array
    partialBytes[13] = new Uint8Array(this.commitmentIndices.length * UINT64_SIZE);
    offset = 0;
    for (let i = 0; i < this.commitmentIndices.length; i++) {
      partialBytes[13].set(addPaddingBigInt(new bn(this.commitmentIndices[i]), UINT64_SIZE), offset);
      offset += UINT64_SIZE;
    }
    paymentProofSize += partialBytes[13].length;

    let bytes = new Uint8Array(paymentProofSize);
    let index = 0;
    for (let i = 0; i < NUM_PROOF_PROPERTIES; i++) {
      bytes.set(partialBytes[i], index);
      index += partialBytes[i].length;
    }

    // console.log("proof size: ", bytes.length);
    // console.log("proof: ", [...bytes].join(', '));
    console.timeEnd("CONVERTING PAYMENT PROOF TO BYTE");
    console.log("CONVERTING PAYMENT PROOF TO BYTE DONE!!!!");

    return bytes;
  }

  static estimateProofSize(nInput, nOutput, hasPrivacy) {
    if (!hasPrivacy) {
      let flagSize = 14 + 2 * nInput + nOutput;
      let sizeSNNoconstantsProof = nInput * SN_NO_PRIVACY_PROOF_SIZE;
      let sizeInputCoins = nInput * INPUT_COINS_NO_PRIVACY_SIZE;
      let sizeOutputCoins = nOutput * OUTPUT_COINS_NO_PRIVACY_SIZE;
      let sizeProof = flagSize + sizeSNNoconstantsProof + sizeInputCoins + sizeOutputCoins;
      return sizeProof
    }
    let flagSize = 14 + 7 * nInput + 4 * nOutput;
    let sizeOneOfManyProof = nInput * ONE_OF_MANY_PROOF_SIZE;
    let sizeSNPrivacyProof = nInput * SN_PRIVACY_PROOF_SIZE;
    let sizeComOutputMultiRangeProof = estimateMultiRangeProofSize(nOutput);

    let sizeInputCoins = nInput * INPUT_COINS_PRIVACY_SIZE;
    let sizeOutputCoins = nOutput * OUTPUT_COINS_CONSTANTS_SIZE;

    let sizeComOutputValue = nOutput * COMPRESS_POINT_SIZE;
    let sizeComOutputSND = nOutput * COMPRESS_POINT_SIZE;
    let sizeComOutputShardID = nOutput * COMPRESS_POINT_SIZE;

    let sizeComInputSK = COMPRESS_POINT_SIZE;
    let sizeComInputValue = nInput * COMPRESS_POINT_SIZE;
    let sizeComInputSND = nInput * COMPRESS_POINT_SIZE;
    let sizeComInputShardID = COMPRESS_POINT_SIZE;

    let sizeCommitmentIndices = nInput * CM_RING_SIZE * UINT64_SIZE;

    let sizeProof = sizeOneOfManyProof + sizeSNPrivacyProof +
      sizeComOutputMultiRangeProof + sizeInputCoins + sizeOutputCoins +
      sizeComOutputValue + sizeComOutputSND + sizeComOutputShardID +
      sizeComInputSK + sizeComInputValue + sizeComInputSND + sizeComInputShardID +
      sizeCommitmentIndices + flagSize;
    return sizeProof
  }
}

export {
  PaymentWitness,
  PaymentProof
};
