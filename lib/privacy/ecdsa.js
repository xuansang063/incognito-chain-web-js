
// const secp256k1 = new Elliptic('secp256k1');
const { hashKeccakBytesToBytes } = require("./utils");

let ell = import('elliptic');

// generateECDSAKeyPair generates ECDSA key pair from seed
function generateECDSAKeyPair(seed) {
    let hash = hashKeccakBytesToBytes(seed);
    return ell.then(m => {
		return new m.ec('secp256k1');
	})
    .then(secp256k1 => {
	    let keyPair = secp256k1.keyFromPrivate(hash);
	    let privateKey = keyPair.getPrivate();
	    let publicKey = keyPair.getPublic();

	    return {
	        ecdsaPrivateKey: privateKey.toArray(),
	        ecdsaPublicKey: publicKey.encodeCompressed()
	    }
	})
}

export {
    generateECDSAKeyPair,
}