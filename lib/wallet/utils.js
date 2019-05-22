import { checkSumFirst4Bytes } from '../base58';

function addChecksumToBytes(data) {
  let checksum = checkSumFirst4Bytes(data);

  let res = new Uint8Array(data.length + 4);
  res.set(data, 0);
  res.set(checksum, data.length);
  return res;
}

export  { addChecksumToBytes };