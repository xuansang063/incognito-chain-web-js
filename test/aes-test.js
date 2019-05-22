var fs = require("fs");
var path = require("path");
import CryptoJS from "crypto-js";

let password = '1';

function FullEncryption() {
    var fullText = fs.readFileSync(path.resolve(__dirname, "text_b.txt"));
    console.log("fullText size: ", fullText.length);


    fullText = JSON.stringify(fullText);
    console.time("Full encrypt: ");
    var fullCiphertext = CryptoJS.AES.encrypt(fullText, password);
    console.timeEnd("Full encrypt: ");

    // fullCiphertext = fullCiphertext.toString();

    console.time("Full decrypt: ");
    var fullEncrypted = CryptoJS.AES.decrypt(fullCiphertext, password);
    console.timeEnd("Full decrypt: ");

    // console.log("fullEncrypted: ", fullEncrypted.toString().substr(0, 10));
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

PartialEncryption()
