import elliptic from 'elliptic';

const EdDSA = elliptic.eddsa;

const EC = new EdDSA('ed25519');

var key = EC.keyFromSecret([ 1,2,3 ]);

alert(key);
