import { generateCommitteeKeyFromHashPrivateKey} from "../lib/committeekey";
import {KeyWallet} from "../lib/wallet/hdwallet";
import {checkDecode} from "../lib/base58";

async function sleep(sleepTime) {
    return new Promise(resolve => setTimeout(resolve, sleepTime));
}

async function testCommitteeKey(){
    let candidateHashPrivateKey = "1TQxX6EFXRcU2FUQmbWozSRtPsgbFutWZbeBSM5jrk2mYGQYEz";
    let candidatePaymentAddress = "1Uv4ZQWnE2j832G4NDkceANsMpEFZWHaGtquKzgYdw2XKS1Zrvre5Bxfr4eBUm87Xt7vdYakjuXmfKyEXkJVpo3fJR2fM2nhHiEiGPuKr";

    console.log("Wait for WASM be started");
    await sleep(5000);

    // generate committee key
    let keyWallet = KeyWallet.base58CheckDeserialize(candidatePaymentAddress);
    let publicKeyBytes = keyWallet.KeySet.PaymentAddress.Pk;
    console.log("publicKeyBytes: ", publicKeyBytes.join(" "));

    let candidateHashPrivateKeyBytes = checkDecode(candidateHashPrivateKey).bytesDecoded;

    console.log("generateCommitteeKeyFromHashPrivateKey")
    let committeeKey = await generateCommitteeKeyFromHashPrivateKey(candidateHashPrivateKeyBytes, publicKeyBytes);
    console.log("committeeKey: ", committeeKey);
}

testCommitteeKey();