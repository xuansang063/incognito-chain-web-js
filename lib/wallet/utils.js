import * as base58 from '../base58';
import Identicon from "identicon.js";

function addChecksumToBytes(data) {
  let checksum = base58.checkSumFirst4Bytes(data);

  let res = new Uint8Array(data.length + 4);
  res.set(data, 0);
  res.set(checksum, data.length);
  return res;
}

function genImageFromStr(str, size){
  // create a base64 encoded PNG
  let data = new Identicon(str, size).toString();

  return "data:image/png;base64," + data;
}

export  {addChecksumToBytes, genImageFromStr};