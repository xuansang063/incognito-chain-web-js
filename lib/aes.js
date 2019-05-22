import sjcl from 'privacy-js-lib/lib/sjcl';
import { randBytes } from 'privacy-js-lib/lib/privacy_utils';
import { AES_BLOCK_SIZE } from 'privacy-js-lib/lib/constants';

class AES {
    constructor(key) {
        // key is a 32-byte array
        this.key = new sjcl.cipher.aes(sjcl.codec.bytes.toBits(key));
    };

    encrypt(data) {
        // data is a byte array of arbitrary length
        var iv = new Uint8Array(AES_BLOCK_SIZE + data.length);
        iv.set(randBytes(AES_BLOCK_SIZE), 0);
        iv.set(sjcl.codec.bytes.fromBits(sjcl.mode.ctr.encrypt(this.key, sjcl.codec.bytes.toBits(data), sjcl.codec.bytes.toBits(iv.slice(0, AES_BLOCK_SIZE)))), AES_BLOCK_SIZE);
        return iv;
    }

    decrypt(data) {
        var iv = data.slice(0, AES_BLOCK_SIZE);
        var ct = data.slice(AES_BLOCK_SIZE, data.length);
        return sjcl.codec.bytes.fromBits(sjcl.mode.ctr.decrypt(this.key, sjcl.codec.bytes.toBits(ct), sjcl.codec.bytes.toBits(iv)));
    }
}

// let aes = new AES(randBytes());
// console.log(aes.decrypt(aes.encrypt([0,2,3,4,5,6])));

export { AES };