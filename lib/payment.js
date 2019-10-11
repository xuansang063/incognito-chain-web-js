import { estimateMultiRangeProofSize } from 'privacy-js-lib/lib/zkps/aggregatedrange_utils';
import { 
  INPUT_COINS_NO_PRIVACY_SIZE,
  OUTPUT_COINS_NO_PRIVACY_SIZE,
  INPUT_COINS_PRIVACY_SIZE,
  OUTPUT_COINS_PRIVACY_SIZE,
  ED25519_KEY_SIZE,
} from './constants';
import {
  UINT64_SIZE
} from 'privacy-js-lib/lib/constants';

import {
  CM_RING_SIZE,
  ONE_OF_MANY_PROOF_SIZE,
  SN_PRIVACY_PROOF_SIZE,
  SN_NO_PRIVACY_PROOF_SIZE
} from 'privacy-js-lib/lib/zkps/constants';

function estimateProofSize(nInput, nOutput, hasPrivacy) {
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
    let sizeOutputCoins = nOutput * OUTPUT_COINS_PRIVACY_SIZE;

    let sizeComOutputValue = nOutput * ED25519_KEY_SIZE;
    let sizeComOutputSND = nOutput * ED25519_KEY_SIZE;
    let sizeComOutputShardID = nOutput * ED25519_KEY_SIZE;

    let sizeComInputSK = ED25519_KEY_SIZE;
    let sizeComInputValue = nInput * ED25519_KEY_SIZE;
    let sizeComInputSND = nInput * ED25519_KEY_SIZE;
    let sizeComInputShardID = ED25519_KEY_SIZE;

    let sizeCommitmentIndices = nInput * CM_RING_SIZE * UINT64_SIZE;

    let sizeProof = sizeOneOfManyProof + sizeSNPrivacyProof +
      sizeComOutputMultiRangeProof + sizeInputCoins + sizeOutputCoins +
      sizeComOutputValue + sizeComOutputSND + sizeComOutputShardID +
      sizeComInputSK + sizeComInputValue + sizeComInputSND + sizeComInputShardID +
      sizeCommitmentIndices + flagSize;
    return sizeProof
  }

  export { estimateProofSize };
