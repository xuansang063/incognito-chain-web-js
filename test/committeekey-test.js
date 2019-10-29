import { generateCommitteeKeyFromHashPrivateKey} from "../lib/committeekey";
import {KeyWallet} from "../lib/wallet/hdwallet";
import {checkDecode, checkEncode} from "../lib/base58";
import { hashSha3BytesToBytes } from "../lib/privacy/utils";
import { convertHashToStr } from "../lib/common";


async function sleep(sleepTime) {
    return new Promise(resolve => setTimeout(resolve, sleepTime));
}

async function testCommitteeKey(){
    await sleep(5000);


    let privateKey = "112t8rqFtYxrQ18ae52tQrCj7kr5HUhL1RXoq2JvTeaJNEcXgQys8B48KFFDFdHsK3CRuiwmmjuPMstkfowfHYHWZG46Pofmo8wKuKH7domP";
    // generate committee key
    let keyWallet = KeyWallet.base58CheckDeserialize(privateKey);

    let privateKeyBytes = keyWallet.KeySet.PrivateKey;
    console.log("keyWallet.KeySet.PrivateKey:", keyWallet.KeySet.PrivateKey);
    console.log("len priavte key :", privateKeyBytes.length);
    // console.log("keyWallet.KeySet.PrivateKey:", )
    let hash = checkEncode(hashSha3BytesToBytes(hashSha3BytesToBytes(keyWallet.KeySet.PrivateKey)), 0);
    console.log("HAhs: ", hash);




    // let hash = checkDecode(convertHashToStr(hashSha3BytesToBytes(hashSha3BytesToBytes(privateKeyBytes)))).bytesDecoded;
    // console.log("HAsh: ", hash);
    // let committeeKey = KeyWallet.KeySet.generateCommitteeKeyFromHashPrivateKey(hash);
    // console.log("committeeKey: ", committeeKey);


    // // let candidateHashPrivateKey = "12nV4WFAjMCYue9ShY6qoQ9bVNiJ95xXMq2eau3rMHHFTiwdjxT";
    // let candidatePaymentAddress = "1Uv3bzbfQK3Pwh1VCJmkfqbJ2JMAWCotowapUsKm6U47v62d5Lq1bvczNxzriJhQTQ96JBPp6EqetjCuSdVamzU377tb89cvtvuMehNTP";

    
    
    // let publicKeyBytes = keyWallet.KeySet.PaymentAddress.Pk;
    // console.log("publicKeyBytes: ", publicKeyBytes.join(" "));

    // let candidateHashPrivateKeyBytes = checkDecode(candidateHashPrivateKey).bytesDecoded;

    // console.log("generateCommitteeKeyFromHashPrivateKey")
    // let committeeKey = await generateCommitteeKeyFromHashPrivateKey(candidateHashPrivateKeyBytes, publicKeyBytes);
    // console.log("committeeKey: ", committeeKey);
}

testCommitteeKey();