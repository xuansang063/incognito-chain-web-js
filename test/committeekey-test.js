import { generateCommitteeFromHashPrivateKey} from "../lib/committeekey";
import {KeyWallet} from "../lib/wallet/hdwallet";
import {checkDecode} from "../lib/base58";


function testCommitteeKey(){
    let candidateHashPrivateKey = "1TQxX6EFXRcU2FUQmbWozSRtPsgbFutWZbeBSM5jrk2mYGQYEz";
    let candidatePaymentAddress = "1Uv4ZQWnE2j832G4NDkceANsMpEFZWHaGtquKzgYdw2XKS1Zrvre5Bxfr4eBUm87Xt7vdYakjuXmfKyEXkJVpo3fJR2fM2nhHiEiGPuKr";

    // generate committee key
    let keyWallet = KeyWallet.base58CheckDeserialize(candidatePaymentAddress);
    let publicKeyBytes = keyWallet.KeySet.PaymentAddress.Pk;

    let candidateHashPrivateKeyBytes = checkDecode(candidateHashPrivateKey).bytesDecoded;

    let committeeKey = generateCommitteeFromHashPrivateKey(candidateHashPrivateKeyBytes, publicKeyBytes);
    console.log("committeeKey: ", committeeKey);
}

testCommitteeKey();