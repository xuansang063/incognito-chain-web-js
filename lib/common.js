import * as constants from "privacy-js-lib/lib/constants"
import * as privacyUtils from 'privacy-js-lib/lib/privacy_utils';

const HASH_SIZE = 32;

const MAX_HASH_STRING_SIZE = HASH_SIZE * 2;

/**
 * @return {number}
 */
function getShardIDFromLastByte(lastByte) {
    return lastByte % constants.SHARD_NUMBER
}


// function toHexString(byteArray) {
//     return Array.from(byteArray, function (byte) {
//         return ('0' + (byte & 0xFF).toString(16)).slice(-2);
//     }).join('')
// }

function convertHashToStr(hash) {
    let tmpHash = hash.slice();
    for (let i = 0; i < tmpHash.length / 2; i++) {
        let tmp = tmpHash[i];
        tmpHash[i] = tmpHash[HASH_SIZE - 1 - i];
        tmpHash[HASH_SIZE - 1 - i] = tmp;
    }
    return byteToHexString(tmpHash);
}

function byteToHexString(uint8arr) {
    if (!uint8arr) {
        return '';
    }

    var hexStr = '';
    for (var i = 0; i < uint8arr.length; i++) {
        var hex = (uint8arr[i] & 0xff).toString(16);
        hex = (hex.length === 1) ? '0' + hex : hex;
        hexStr += hex;
    }

    return hexStr.toUpperCase();
}

function hexStringToByte(str) {
    if (!str) {
        return new Uint8Array();
    }

    var a = [];
    for (var i = 0, len = str.length; i < len; i+=2) {
        a.push(parseInt(str.substr(i,2),16));
    }

    return new Uint8Array(a);
}

// function parseHexString(str) {
//     var result = [];
//     while (str.length >= 8) {
//         result.push(parseInt(str.substring(0, 8), 16));
//
//         str = str.substring(8, str.length);
//     }
//
//     return result;
// }
//
// function createHexString(arr) {
//     let result = "";
//     let z;
//
//     for (let i = 0; i < arr.length; i++) {
//         let str = arr[i].toString(16);
//
//         z = 8 - str.length + 1;
//         str = Array(z).join("0") + str;
//
//         result += str;
//     }
//
//     return result;
// }

function newHashFromStr(str) {
    let bytes = hexStringToByte(str);
    for (let i = 0; i < bytes.length / 2; i++) {
        let tmp = bytes[i];
        bytes[i] = bytes[HASH_SIZE - 1 - i];
        bytes[HASH_SIZE - 1 - i] = tmp;
    }
    return bytes;
}

export {getShardIDFromLastByte, newHashFromStr, convertHashToStr, hexStringToByte};