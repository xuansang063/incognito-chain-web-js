import bn from 'bn.js';
import * as ec from 'privacy-js-lib/lib/ec';
import * as privacyUtils from 'privacy-js-lib/lib/privacy_utils';
import * as constants from 'privacy-js-lib/lib/constants';

// PrivateKey sk <-- Zn
// PublicKey  pk <-- G*sk
// Plaintext M is a EllipticPoint
// Ciphertext contains 2 EllipticPoint C1, C2
// C1 = G*k
// C2 = pk*k + M
// k <-- Zn is a secret random number

function derivePublicKey(privateKeyBytesArrays) {
    let privateKey = new bn(privateKeyBytesArrays, 10, 'be');
    return ec.P256.g.mul(privateKey);
}

function encrypt(publicKey, data) {
    if (!data.isSafe()) {
        throw new Error("Data is not safe on P256!");
    }
    let k = privacyUtils.randScalar(32);
    let C1 = ec.P256.g.mul(k);
    let C2 = (publicKey.mul(k)).add(data);
    let res = new Uint8Array(constants.COMPRESS_POINT_SIZE * 2);
    res.set(C1.compress(), 0);
    res.set(C2.compress(), constants.COMPRESS_POINT_SIZE);
    return res;
}

function decrypt(privateKeyBytesArrays, ElgamalCipherText) {
    if (ElgamalCipherText.length != constants.ELGAMAL_CIPHERTEXT_SIZE) {
        throw new Error("Cipher in inputs is not Elgamal's ciphertext!");
    }
    let privateKey = new bn(privateKeyBytesArrays, 10, 'be');
    try {
        let C1 = ec.P256.decompress(ElgamalCipherText.slice(0, constants.COMPRESS_POINT_SIZE));
        let C2 = ec.P256.decompress(ElgamalCipherText.slice(constants.COMPRESS_POINT_SIZE, 2 * constants.COMPRESS_POINT_SIZE));
        return C2.sub(C1.mul(privateKey));
    } catch (error) {
        throw error;
    }
}

export {
    derivePublicKey,
    encrypt,
    decrypt
}