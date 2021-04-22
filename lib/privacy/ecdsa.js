
const { hashKeccakBytesToBytes } = require("./utils");
// load dynamically
let ell = import('elliptic');

async function generateECDSAKeyPair(seed) {
    const { ec: EC } = await ell;
    const secp256k1 = new EC('secp256k1');
    let hash = hashKeccakBytesToBytes(seed);
    let keyPair = secp256k1.keyFromPrivate(hash);
    let privateKey = keyPair.getPrivate();
    let publicKey = keyPair.getPublic();

    return {
        ecdsaPrivateKey: privateKey.toArray(),
        ecdsaPublicKey: publicKey.encodeCompressed()
    }
}

export {
    generateECDSAKeyPair,
}