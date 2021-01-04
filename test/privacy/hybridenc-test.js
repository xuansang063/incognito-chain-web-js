import {
    hybridEncryption,
    hybridDecryption
} from "../../lib/privacy/hybridEncryption";
import {
    RpcClient
} from "../../lib/rpcclient/rpcclient";

import {
    KeyWallet as keyWallet
} from "../../lib/wallet/hdwallet";
import {
    AccountWallet,
    Wallet
} from "../../lib/wallet/wallet";
import {
    base64Decode,
    bytesToString
} from "../../lib/privacy/utils";
import {
    checkDecode
} from "../../lib/base58";
import {
    PaymentAddressType
} from "../../lib/wallet/constants";

// const rpcClient = new RpcClient("https://mainnet.incognito.org/fullnode");
const rpcClient = new RpcClient("http://localhost:9334");
// const rpcClient = new RpcClient("http://54.39.158.106:20032");
// const rpcClient = new RpcClient("http://172.105.115.134:20004");

let senderPrivateKeyStr;
let senderKeyWallet;
let accountSender;
let senderPaymentAddressStr;
let receiverPaymentAddrStr;

async function setup() {
    senderPrivateKeyStr = "112t8rnXoBXrThDTACHx2rbEq7nBgrzcZhVZV4fvNEcGJetQ13spZRMuW5ncvsKA1KvtkauZuK2jV8pxEZLpiuHtKX3FkKv2uC5ZeRC8L6we";
    senderKeyWallet = keyWallet.base58CheckDeserialize(senderPrivateKeyStr);

    await senderKeyWallet.KeySet.importFromPrivateKey(senderKeyWallet.KeySet.PrivateKey);
    accountSender = new AccountWallet();
    accountSender.key = senderKeyWallet;
    senderPaymentAddressStr = senderKeyWallet.base58CheckSerialize(PaymentAddressType);
    receiverPaymentAddrStr = "12si2KgWLGuhXACeqHGquGpyQy7JZiA5qRTCWW7YTYrEzZBuZC2eGBfckc2NRXkQXiw7XwK2WVfKxC8AcwKGCsyRVr9SR8bN9vTcnk2PPbymztCWadgr9JMP1UY6oSk9XZb56EAKunejzNnmo9Ln";
}

async function TestHybridEncryption() {
    Wallet.RpcClient = rpcClient;
    await setup();

    // sender key (private key)
    // let senderPrivateKeyStr = "112t8rnX7qWSJFCnGBq4YPHYN2D29NmGowC5RSbuDUC8Kg8ywg6GsPda5xRJMAmzmVKwLevdJNi5XfrqHRWDzSGEg37kbsrcWrAEQatR1UQQ";
    // let senderKeyWallet = keyWallet.base58CheckDeserialize(senderPrivateKeyStr);
    // senderKeyWallet.KeySet.importFromPrivateKey(senderKeyWallet.KeySet.PrivateKey);

    // let accountSender = new AccountWallet();
    // accountSender.key = senderKeyWallet;


    let publicKeyBytes = senderKeyWallet.KeySet.PaymentAddress.Tk;
    let msg = [1, 2, 3, 4, 5, 6];
    let ciphertext = await hybridEncryption(publicKeyBytes, msg);
    console.log("ciphertext: ", ciphertext);

    let privateKeyBytes = senderKeyWallet.KeySet.ReadonlyKey.Rk;

    let plaintext = await hybridDecryption(privateKeyBytes, ciphertext);
    console.log("plaintext: ", plaintext);

    // test case 2: 
    // let ciphertextEncoded = "UMuzf2l+rCAIepv2EcjyCAjVnW1CcgpaBzbFqRbnBvZ6fYY3MI/L5Mshnmw3+BLb/wnaCqlU97JYGoDDPgbXGTaJy5jRj5hrc/9GR/Xl1qRtcKY=";
    // let ciphertextBytes = base64Decode(ciphertextEncoded);

    let ciphertextEncoded = "1NU3oSLn9hZi5mnpj7odQGpCYZt74y6zKQ36Ee5chEGddGg4fDPCsZZT3NR95ifevbB8Uzqw6pdmhuzZtXWk4kXZUMm1WSWV4TMjS5RBohNEGhHCtHpqrVyh";
    let ciphertextBytes = checkDecode(ciphertextEncoded).bytesDecoded;
    console.log("ciphertextBytes 2: ", ciphertextBytes);
    console.log("ciphertextBytes 2 len: ", ciphertextBytes.length);
    let plaintext2 = await hybridDecryption(privateKeyBytes, ciphertextBytes);
    console.log("plaintext2: ", plaintext2);
    let str = bytesToString(plaintext2);
    console.log("str:", str);
}

TestHybridEncryption()