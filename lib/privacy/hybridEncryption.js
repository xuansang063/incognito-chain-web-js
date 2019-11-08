import { ED25519_KEY_SIZE } from './constants';
import { convertUint8ArrayToArray } from './utils';

const { base64Decode, base64Encode } = require('./utils');

// publicKeyBytes is public key encryption, it is a 32-byte array
// msg is a bytes array 
// returns ciphertext in bytes array 
async function hybridEncryption(publicKeyBytes, msg) {
    let dataBytes = new Uint8Array(publicKeyBytes.length + msg.length);
    dataBytes.set(publicKeyBytes, 0);
    dataBytes.set(msg, ED25519_KEY_SIZE);
    let dataEncoded = base64Encode(convertUint8ArrayToArray(dataBytes));

    if (typeof hybridEncryptionASM === "function") {
        let ciphertextEncoded = await hybridEncryptionASM(dataEncoded);
        let ciphertextBytes = base64Decode(ciphertextEncoded);
        return ciphertextBytes;
    } else {
        throw new Error("Can not encrypt message with public key");
    }
}

// publicKeyBytes is public key encryption, it is a 32-byte array
// msg is a bytes array  
// returns plaintext in bytes array
async function hybridDecryption(privateKeyBytes, ciphertextBytes) {
    let dataBytes = new Uint8Array(privateKeyBytes.length + ciphertextBytes.length);
    dataBytes.set(privateKeyBytes, 0);
    dataBytes.set(ciphertextBytes, ED25519_KEY_SIZE);
    let dataEncoded = base64Encode(convertUint8ArrayToArray(dataBytes));

    if (typeof hybridDecryptionASM === "function") {
        let plainTextEncoded = await hybridDecryptionASM(dataEncoded);
        let plainTextBytes = base64Decode(plainTextEncoded);
        return plainTextBytes;
    } else {
        throw new Error("Can not encrypt message with public key");
    }
}

export {
    hybridEncryption, hybridDecryption
}