import { checkSumFirst4Bytes } from '../base58';
import { PrivacyUnit } from './constants';

function addChecksumToBytes(data) {
  let checksum = checkSumFirst4Bytes(data);

  let res = new Uint8Array(data.length + 4);
  res.set(data, 0);
  res.set(checksum, data.length);
  return res;
}

/**
 * 
 * @param {nanoAmountPRV : number} nanoAmountPRV 
 */
const toPRV = (nanoAmountPRV) => parseFloat(nanoAmountPRV / PrivacyUnit);

/**
 * 
 * @param {amountPRV : number} amountPRV 
 */
const toNanoPRV = (amountPRV) =>  Number(amountPRV * PrivacyUnit);

export  { addChecksumToBytes, toPRV, toNanoPRV };