import { generateECDSAKeyPair } from "privacy-js-lib/lib/ecdsa";
import { generateBLSKeyPair } from "privacy-js-lib/lib/bls";
import { stringToBytes, convertUint8ArrayToArray } from "privacy-js-lib/lib/privacy_utils";
import { checkEncode } from "./base58.js";
import { ENCODE_VERSION } from "./constants";
import json from 'circular-json';
import { base64ArrayBuffer } from "./common";

// hashPrivateKey 
async function generateCommitteeKeyFromHashPrivateKey(hashPrivateKeyBytes, publicKeyBytes) {
    let incPubKey = convertUint8ArrayToArray(publicKeyBytes);

    let blsKeyPair;
    try {
        blsKeyPair = await generateBLSKeyPair(hashPrivateKeyBytes);
    } catch (e) {
        throw e;
    }

    let ecdsaKeyPair = generateECDSAKeyPair(hashPrivateKeyBytes);

    let miningPubKey = {
        "bls": base64ArrayBuffer(blsKeyPair.blsPublicKey),
        "dsa": base64ArrayBuffer(ecdsaKeyPair.ecdsaPublicKey)
    };

    console.log("HHH mining pub key bls: ", blsKeyPair.blsPublicKey.join(", "));
    console.log("HHH mining pub key dsa: ", ecdsaKeyPair.ecdsaPublicKey.join(", "));
    console.log("HHH incognito pub key: ", incPubKey.join(", "));

    let committeeKey = {
        IncPubKey: base64ArrayBuffer(incPubKey),
        MiningPubKey: miningPubKey,
    }

    // JSON marshal commiteeKey 
    let keyStr = json.stringify(committeeKey);
    let encodedKey = checkEncode(stringToBytes(keyStr), ENCODE_VERSION);

    return encodedKey;
}

// async function generateBLSKeyPair(seed) {
//     let blsKeyPair;
//     try{
//         blsKeyPair = await generateBLSKeyPair(seed);
//     } catch(e){
//         throw e;
//     }
//     return blsKeyPair;
// }

async function generateBLSPubKeyB58CheckEncodeFromSeed(seed) {
    let blsKeyPair = await generateBLSKeyPair(seed);
    let blsPublicKey = convertUint8ArrayToArray(blsKeyPair.blsPublicKey);
    return checkEncode(blsPublicKey, ENCODE_VERSION);
}

export {
    generateCommitteeKeyFromHashPrivateKey,
    generateBLSPubKeyB58CheckEncodeFromSeed,
};