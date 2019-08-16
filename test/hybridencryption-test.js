import bn from 'bn.js';
import * as h from "../lib/hybridencryption"
import * as ec from 'privacy-js-lib/lib/ec';
import { checkDecode } from '../lib/base58';
import {KeyWallet} from "../lib/wallet/hdwallet";

const P256 = ec.P256;

// test function for hybridEncrypt
function testHybridEncrypt() {
  let msg = [10, 20];
  let privateKey = new bn(10);
  console.log('Private key : ', privateKey.toArray().join(', '));
  let publicKey = P256.g.mul(privateKey);
  console.log("public key : ", publicKey.compress().join(', '));

  for (let i=0; i<1000; i++){
    let ciphertext = h.hybridEncrypt(msg, publicKey.compress());
    // console.log("Ciphertext msg when encrypt: ", ciphertext.msgEncrypted.join(', '));

    let msgDecrypt = h.hybridDecrypt(ciphertext, privateKey.toArray());

    console.log("msgDecrypt: ", msgDecrypt);


    // console.log('ciphertext: ', ciphertext.toBytes().join(', '));
  }

  // let ciphertext = h.hybridEncrypt(msg, publicKey.compress());
  // console.log("Ciphertext msg when encrypt: ", ciphertext.msgEncrypted.join(', '));

  // console.log('ciphertext: ', ciphertext.toBytes().join(', '));
}

// testHybridEncrypt();

function test2(){
  let keyWallet = KeyWallet.base58CheckDeserialize("1CvjJXCKYU2KBopYvJStPkSYRZdzuuopas8jeepRevxpX8VYwYCTDJxJ719uDbZHvCwEpfYuMWp1fJTfmFW7cexH8THqxMNmotdShYvP");
  let ciphertextBytes;
  try{
    ciphertextBytes = checkDecode("1CxU7BQVb39AwN1dka3VywrMp8VqSXFDaE9Vy3H4VVQu9cSPyzDKbrX1QC5xfL624XBdEEMcgiJXJDWBWBpgRcPju56JQRLaoDAwxuBC5P8ccPbTRdJ2TehPCDWGg7oUtBZRi3TbnEuFDBipkzxYhuv1vCKFzCAqeLK33LrXTDQ").bytesDecoded;
    console.log("ciphertextBytes: ", ciphertextBytes);
  } catch(e){
    console.log("Error: ", e);
  }

  let ciphertext = new (h.Ciphertext)
  ciphertext.fromBytes(ciphertextBytes);
  

  let data = h.hybridDecrypt(ciphertext, keyWallet.KeySet.ReadonlyKey.Rk);
  console.log("data: ", data);

  let random = checkDecode("12oPrsLY1f1MnVyKmfyuWaSMM2XipdQtmeWivyfVF1LZp8Pd9oh");
  console.log("random: ", random);
}

test2();

