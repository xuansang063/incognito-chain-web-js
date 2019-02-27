import bn from 'bn.js';
import * as h from "../lib/hybridencryption"
import * as ec from 'privacy-js-lib/lib/ec';

const P256 = ec.P256;

// test function for hybridEncrypt
function testHybridEncrypt() {
  let msg = [10, 20];
  let privateKey = new bn(10);
  console.log('Private key : ', privateKey.toArray().join(', '));
  let publicKey = P256.g.mul(privateKey);
  console.log("public key : ", publicKey.compress().join(', '));

  let ciphertext = h.hybridEncrypt(msg, publicKey.compress());
  console.log("Ciphertext msg when encrypt: ", ciphertext.msgEncrypted.join(', '));

  console.log('ciphertext: ', ciphertext.toBytes().join(', '));
}

testHybridEncrypt();