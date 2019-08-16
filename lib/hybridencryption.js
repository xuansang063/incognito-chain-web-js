import { P256 } from 'privacy-js-lib/lib/ec';
import { addPaddingBigInt } from 'privacy-js-lib/lib/privacy_utils';
import { BIG_INT_SIZE } from 'privacy-js-lib/lib/constants';
import { AES } from './aes';
import { encrypt, decrypt } from './elgamal';
import { ELGAMAL_CIPHERTEXT_SIZE} from './constants';

class Ciphertext {
  // constructor initializes a new empty ciphertext
  constructor() {
    this.msgEncrypted = [];
    this.symKeyEncrypted = [];
  }

  // isNull returns true if msgEncrypted or symKeyEncrypted are empty, false otherwise
  isNull() {
    return this.msgEncrypted.length === 0 || this.symKeyEncrypted.length === 0;
  }

  // toBytes converts a ciphertext to a byte array
  toBytes() {
    let bytes = new Uint8Array(this.msgEncrypted.length + this.symKeyEncrypted.length);
    bytes.set(this.symKeyEncrypted, 0);
    bytes.set(this.msgEncrypted, this.symKeyEncrypted.length);
    return bytes;
  }

  fromBytes(bytes){
    this.symKeyEncrypted = bytes.slice(0, ELGAMAL_CIPHERTEXT_SIZE);
    this.msgEncrypted = bytes.slice(ELGAMAL_CIPHERTEXT_SIZE);
  }
}

// hybridEncrypt encrypts msg with publicKey using ElGamal cryptosystem
function hybridEncrypt(msg, publicKey) {
  // Initialize a ciphertext
  let ciphertext = new Ciphertext();

  // Generate a AES key as the abscissa of a random elliptic point
  let aesKeyPoint = P256.randomize();
  let aesKeyByte = addPaddingBigInt(aesKeyPoint.getX(), BIG_INT_SIZE);

  // Encrypt msg using aesKeyByte
  let aesScheme = new AES(aesKeyByte);
  ciphertext.msgEncrypted = aesScheme.encrypt(msg);

  // Encrypt aesKeyByte using ElGamal cryptosystem
  let publicKeyPoint = P256.decompress(publicKey);
  ciphertext.symKeyEncrypted = encrypt(publicKeyPoint, aesKeyPoint);

  return ciphertext
}

function hybridDecrypt(ciphertext, privateKeyBytes) {
  let aesKeyPoint = decrypt(privateKeyBytes, ciphertext.symKeyEncrypted);
  let aesKeyByte = addPaddingBigInt(aesKeyPoint.getX(), BIG_INT_SIZE);

  // Encrypt msg using aesKeyByte
  let aesScheme = new AES(aesKeyByte);
  let msg = aesScheme.decrypt(ciphertext.msgEncrypted);

  return msg;
}

export {
  Ciphertext,
  hybridEncrypt,
  hybridDecrypt
};