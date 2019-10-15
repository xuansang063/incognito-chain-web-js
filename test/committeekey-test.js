import { generateCommitteeKeyFromHashPrivateKey} from "../lib/committeekey";
import {KeyWallet} from "../lib/wallet/hdwallet";
import {checkDecode} from "../lib/base58";

async function sleep(sleepTime) {
    return new Promise(resolve => setTimeout(resolve, sleepTime));
}

async function testCommitteeKey(){
    let candidateHashPrivateKey = "12nV4WFAjMCYue9ShY6qoQ9bVNiJ95xXMq2eau3rMHHFTiwdjxT";
    let candidatePaymentAddress = "1Uv3bzbfQK3Pwh1VCJmkfqbJ2JMAWCotowapUsKm6U47v62d5Lq1bvczNxzriJhQTQ96JBPp6EqetjCuSdVamzU377tb89cvtvuMehNTP";

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