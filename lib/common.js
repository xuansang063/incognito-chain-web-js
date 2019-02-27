import * as constants from "privacy-js-lib/lib/constants"

/**
 * @return {number}
 */
function getShardIDFromLastByte(lastByte) {
  return lastByte % constants.SHARD_NUMBER
}

function newHashFromStr(str){
  return [];
}

function toHexString(byteArray) {
  return Array.from(byteArray, function(byte) {
    return ('0' + (byte & 0xFF).toString(16)).slice(-2);
  }).join('')
}

function convertHashToStr(hash){
  let tmpHash = hash;
  for (let i = 0; i < tmpHash.length/2; i++) {
    let tmp = tmpHash[i];
    tmpHash[i] = tmpHash[32-1-i];
    tmpHash[32-1-i] = tmp;
  }
  return toHexString(tmpHash);
}



export {getShardIDFromLastByte, newHashFromStr, convertHashToStr};