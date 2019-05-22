import bn from 'bn.js';
import { P256 } from 'privacy-js-lib/lib/ec';
import { randScalar } from 'privacy-js-lib/lib/privacy_utils';
import { COMPRESS_POINT_SIZE, ELGAMAL_CIPHERTEXT_SIZE } from 'privacy-js-lib/lib/constants';

// PrivateKey sk <-- Zn
// Pk  pk <-- G*sk
// Plaintext M is a EllipticPoint
// Ciphertext contains 2 EllipticPoint C1, C2
// C1 = G*k
// C2 = pk*k + M
// k <-- Zn is a secret random number

function encrypt(publicKey, data) {
    if (!data.isSafe()) {
        throw new Error("Data is not safe on P256!");
    }

    let k = randScalar();
    let C1 = P256.g.mul(k);
    let C2 = (publicKey.mul(k)).add(data);

    let res = new Uint8Array(COMPRESS_POINT_SIZE * 2);
    res.set(C1.compress(), 0);
    res.set(C2.compress(), COMPRESS_POINT_SIZE);
    return res;
}

function decrypt(privateKeyBytes, ciphertext) {
    if (ciphertext.length != ELGAMAL_CIPHERTEXT_SIZE) {
        throw new Error("Ciphertext in inputs is not Elgamal's ciphertext!");
    }

    let privateKey = new bn(privateKeyBytes, 10, 'be');

    try {
        let C1 = P256.decompress(ciphertext.slice(0, COMPRESS_POINT_SIZE));
        let C2 = P256.decompress(ciphertext.slice(COMPRESS_POINT_SIZE, 2 * COMPRESS_POINT_SIZE));
        
        return C2.sub(C1.mul(privateKey));
    } catch (error) {
        throw error;
    }
}

export {
    encrypt,
    decrypt
}