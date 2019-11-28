import { Wallet, DefaultStorage } from '../../lib/wallet/wallet'
import { KeyWallet as keyWallet } from "../../lib/wallet/hdwallet";
import { AccountWallet } from "../../lib/wallet/accountWallet";
import { RpcClient } from "../../lib/rpcclient/rpcclient";
import { AST_Array } from 'terser';
import {sleep, csvJSON} from "./utils";
const fs = require('fs');

Wallet.RpcClient = new RpcClient("https://mainnet.incognito.org/fullnode");
// Wallet.RpcClient = new RpcClient("https://test-node.incognito.org");
// Wallet.RpcClient = new RpcClient("http://localhost:9334");
// const rpcClient = new RpcClient("http://54.39.158.106:20032");

async function SendPRVToReceivers() {
    let data = csvJSON('./test/txfordev/sendPRVPayload.csv');
    console.log("data: ", data);
    let paymentInfos = JSON.parse(data);
    await sleep(5000);

    for (let i = 0; i < paymentInfos.length; i++) {
        paymentInfos[i].amount = parseInt(paymentInfos[i].amount);
    }

    // set private for sender
    let senderSpendingKeyStr = "";
    let senderKeyWallet = keyWallet.base58CheckDeserialize(senderSpendingKeyStr);
    senderKeyWallet.KeySet.importFromPrivateKey(senderKeyWallet.KeySet.PrivateKey);
    let accountSender = new AccountWallet();
    accountSender.key = senderKeyWallet;

    let fee = 20; // nano PRV
    let isPrivacy = true;

    let offset = 0;
    let maxReceivers = 25;  // except change UTXO for sender
    let isDone = false;
    let count = 0;
    while (!isDone) {
        let paymentInfoTmp;
        if (paymentInfos.length >= offset + maxReceivers){
            paymentInfoTmp = paymentInfos.slice(offset, offset + maxReceivers);
            offset = offset + maxReceivers;
        } else{
            paymentInfoTmp = paymentInfos.slice(offset, paymentInfos.length);
           isDone = true;     
        }
        count += paymentInfoTmp.length;

        try {
            let response = await accountSender.createAndSendNativeToken(paymentInfoTmp, fee, isPrivacy, "");
            console.log("congratulations to you! Create transaction successfully! ^.^")
            console.log("Response: ", response);
            console.log("Number of payment transfer: ", count);

            // waiting for creating next transaction
            if (!isDone){
                console.log("WAITING FOR CREATING NEXT TRANSACTION..................");
                await sleep(2*60*1000);
            }
        } catch (e) {
            console.log("Sorry. You can not send this transaction. Please try again. Fighting ^.^");
        }
    }
}

SendPRVToReceivers();

