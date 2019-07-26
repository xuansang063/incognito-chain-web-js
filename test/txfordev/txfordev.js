import { Wallet, DefaultStorage } from '../../lib/wallet/wallet'
import { KeyWallet as keyWallet } from "../../lib/wallet/hdwallet";
import { AccountWallet } from "../../lib/wallet/accountWallet";
import * as key from "../../lib/key";
import bn from 'bn.js';
import { RpcClient } from "../../lib/rpcclient/rpcclient";
import { REPL_MODE_SLOPPY } from 'repl';
const fs = require('fs');

Wallet.RpcClient = new RpcClient("https://test-node.incognito.org");
// Wallet.RpcClient = new RpcClient("http://localhost:9334");

async function SendPRVForMultiUsers() {
    // load file paymentAddr.json to set payment infos
     let jsonString = fs.readFileSync('./test/txfordev/paymentAddr.json');

    let data = JSON.parse(jsonString);
    console.log("Data AAA: ", data);

    // set private for sender
    let senderSpendingKeyStr = "112t8rnajMFdaHBqUTEaENTSP5jDroeMnMtKuF6vgf6frxkQc3fYzxsWZc9VRbT4dNArgVjHLng4MwXYvTCfKRvW6hi2aqWNChveot4rETiq";
    let senderKeyWallet = keyWallet.base58CheckDeserialize(senderSpendingKeyStr);
    senderKeyWallet.KeySet.importFromPrivateKey(senderKeyWallet.KeySet.PrivateKey);

    let accountSender = new AccountWallet();
    accountSender.key = senderKeyWallet;

    let fee = 1000000000; // nano PRV
    let isPrivacy = true;

    try{
        let response = await accountSender.createAndSendConstant(data.paymentInfos, fee, isPrivacy, "");
        console.log("congratulations to you!")
        console.log("Response: ", response);
    } catch(e){
        console.log("Sorry. You can not send this transaction. Please try again. Fighting");
    }
}

SendPRVForMultiUsers();

