var fs = require("fs");
var path = require("path");
import CryptoJS from "crypto-js";
import {AES} from '../lib/aes';
import {hashBytesToBytes, stringToBytes} from "privacy-js-lib/lib/privacy_utils";

let password = '1';

function FullEncryption() {
    var fullText = fs.readFileSync(path.resolve(__dirname, "text_b.txt"));
    console.log("fullText size: ", fullText.length);
    // var fullText = "abc";

    fullText = JSON.stringify(fullText);
    console.time("Full encrypt: ");
    var fullCiphertext = CryptoJS.AES.encrypt(fullText, password);
    console.timeEnd("Full encrypt: ");

    // console.log("fullCiphertext: ", fullCiphertext);
    // console.log("fullCiphertext.toString(): ", fullCiphertext.toString());

    // fullCiphertext = fullCiphertext.toString();

    console.time("Full decrypt: ");
    var fullEncrypted = CryptoJS.AES.decrypt(fullCiphertext.toString(), password);
    console.timeEnd("Full decrypt: ");

    console.log("fullEncrypted: ", fullEncrypted.toString(CryptoJS.enc.Utf8));
}

// FullEncryption()

function encryptAsync(data) {
    return new Promise((resolve) => {
        setImmediate(() => resolve(CryptoJS.AES.encrypt(data, password)));
    })
}

function decryptAsync(ciphertext) {
    return new Promise((resolve) => {
        setImmediate(() => resolve(CryptoJS.AES.decrypt(ciphertext, password)));
    })
}

async function PartialEncryption() {
    var partialFile = [];
    for (let i = 0; i < 5; i++) {
        partialFile[i] = fs.readFileSync(path.resolve(__dirname, `text_b${i + 1}.txt`));
        console.log("partialFile size: ", partialFile[i].length);
        partialFile[i] = JSON.stringify(partialFile[i]);
    }

    var partialCiphertext = [];
    console.time("Partial encrypt: ");
    var tasks = partialFile.map(encryptAsync);
    partialCiphertext = await Promise.all(tasks);
    console.timeEnd("Partial encrypt: ");

    // for (let i = 0; i < 5; i++) {
    //     partialCiphertext[i] = partialCiphertext[i].toString();
    // }

    var partialEncrypted = [];
    console.time("Partial decrypt: ");
    tasks = partialCiphertext.map(decryptAsync);
    await Promise.all(tasks);
    console.timeEnd("Partial decrypt: ");

    // for (let i = 0; i < 5; i++) {
    //     console.log("partialEncrypted[i] ", partialEncrypted[i].toString());
    // }
}

// PartialEncryption()


function FullEncryptionAES() {

    let key = hashBytesToBytes(stringToBytes(password));

    let aes = new AES(key);

    // let fullText = fs.readFileSync(path.resolve(__dirname, "./text-file/text.txt"));
    // console.log("fullText size: ", fullText.length);

    var fullText = "abc";
    fullText = stringToBytes(fullText);
    console.log("fullText: ", fullText);

    // fullText = JSON.stringify(fullText);
    console.time("Full encrypt: ");
    var fullCiphertext = aes.encrypt(fullText);
    console.timeEnd("Full encrypt: ");

    // console.log("fullCiphertext: ", fullCiphertext);
    // console.log("fullCiphertext.toString(): ", fullCiphertext.toString());

    // fullCiphertext = fullCiphertext.toString();

    console.time("Full decrypt: ");
    var fullEncrypted = aes.decrypt(fullCiphertext);
    console.timeEnd("Full decrypt: ");

    console.log("fullEncrypted: ", fullEncrypted);
}

FullEncryptionAES()



