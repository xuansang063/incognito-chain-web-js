import { generateECDSAKeyPair } from "privacy-js-lib/lib/ecdsa";
import { generateBLSKeyPair } from "privacy-js-lib/lib/bls";
import {stringToBytes, convertUint8ArrayToArray} from "privacy-js-lib/lib/privacy_utils";
import {checkEncode} from "./base58.js";
import { ENCODE_VERSION } from "./constants";
import json from 'circular-json';

// hashPrivateKey 
async function generateCommitteeKeyFromHashPrivateKey(hashPrivateKeyBytes, publicKeyBytes){
    let incPubKey =  convertUint8ArrayToArray(publicKeyBytes);

    let blsKeyPair;
    try{
        blsKeyPair = await generateBLSKeyPair(hashPrivateKeyBytes);
    } catch(e){
        throw e;
    }
    
    let ecdsaKeyPair = generateECDSAKeyPair(hashPrivateKeyBytes);

    let miningPubKey = {
        "bls" : convertUint8ArrayToArray(blsKeyPair.blsPublicKey),
        "dsa": convertUint8ArrayToArray(ecdsaKeyPair.ecdsaPublicKey)
    };

    // console.log("mining pub key bls: ", miningPubKey["bls"].join(", "));
    // console.log("mining pub key dsa: ", miningPubKey["dsa"].join(", "));
    // console.log("incognito pub key: ", incPubKey.join(", "));

    let committeeKey = {
        IncPubKey : incPubKey,
        MiningPubKey : miningPubKey,
    }

    // JSON marshal commiteeKey 
    let keyStr = json.stringify(committeeKey);
    let encodedKey = checkEncode(stringToBytes(keyStr), ENCODE_VERSION);

    return encodedKey;
}

export {
    generateCommitteeKeyFromHashPrivateKey,
};