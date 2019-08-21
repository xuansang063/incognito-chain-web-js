import { generateECDSAKeyPair } from "privacy-js-lib/lib/ecdsa";
import { generateBLSKeyPair } from "privacy-js-lib/lib/bls";
import {stringToBytes} from "privacy-js-lib/lib/privacy_utils";
import {checkEncode} from "./base58.js";
import { ENCODE_VERSION } from "./constants";

// hashPrivateKey 
function generateCommitteeFromHashPrivateKey(hashPrivateKeyBytes, publicKeyBytes){
    let incPubKey =  publicKeyBytes;

    let blsKeyPair = generateBLSKeyPair(hashPrivateKeyBytes);
    let ecdsaKeyPair = generateECDSAKeyPair(hashPrivateKeyBytes);

    let miningPubKey = new Map();
    miningPubKey.set("bls", blsKeyPair.blsPublicKey);
    miningPubKey.set("dsa", ecdsaKeyPair.ecdsaPublicKey);

    console.log("mining pub key: ", miningPubKey);

    let committeeKey = {
        IncPubKey : incPubKey,
        MiningPubKey : miningPubKey,
    }

    // JSON marshal commiteeKey 
    let keyStr = JSON.stringify(committeeKey);

    // 
    let encodedKey = checkEncode(stringToBytes(keyStr), ENCODE_VERSION)
    console.log("encodedKey: ", encodedKey);
    return encodedKey;
}

export {
    generateCommitteeFromHashPrivateKey,
};