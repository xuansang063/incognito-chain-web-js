import { Wallet, DefaultStorage } from '../../lib/wallet/wallet'
import { KeyWallet as keyWallet } from "../../lib/wallet/hdwallet";
import { AccountWallet } from "../../lib/wallet/accountWallet";
import { RpcClient } from "../../lib/rpcclient/rpcclient";
import { AST_Array } from 'terser';
const fs = require('fs');

// Wallet.RpcClient = new RpcClient("https://test-node.incognito.org");
const rpcClient = new RpcClient("http://54.39.158.106:9334");

async function sleep(sleepTime) {
    return new Promise(resolve => setTimeout(resolve, sleepTime));
}

async function TestMultiCreateAndSendNativeToken() {
    Wallet.RpcClient = rpcClient;
    // Wallet.ShardNumber = 1;
    await sleep(5000);

    // sender key (private key)
    let senderPrivateKeyStr = "112t8rnX7qWSJFCnGBq4YPHYN2D29NmGowC5RSbuDUC8Kg8ywg6GsPda5xRJMAmzmVKwLevdJNi5XfrqHRWDzSGEg37kbsrcWrAEQatR1UQQ";
    let senderKeyWallet = keyWallet.base58CheckDeserialize(senderPrivateKeyStr);
    senderKeyWallet.KeySet.importFromPrivateKey(senderKeyWallet.KeySet.PrivateKey);

    let accountSender = new AccountWallet();
    accountSender.key = senderKeyWallet;

    // receiver key (payment address)
    let receiverPaymentAddrStr = "12Ryp47jXJfkz5Cketp4D9U7uTH4hFgFUVUEzq6k5ikvAZ94JucsYbi235siCMud5GdtRi1DoSecsTD2nkiic9TH7YNkLEoEhrvxvwt";
    // let receiverKeyWallet = keyWallet.base58CheckDeserialize(receiverPaymentAddrStr);
    // let receiverPaymentAddr = receiverKeyWallet.KeySet.PaymentAddress;

    let fee = 0.5 * 1e9;
    let isPrivacy = true;
    let info = "";
    let amountTransfer = 100 * 1e9; // in nano PRV

    let paymentInfosParam = [];
    paymentInfosParam[0] = {
        "paymentAddressStr": receiverPaymentAddrStr,
        "amount": amountTransfer,
        "message": "rose's so cute"
    };

    let countSuccess = 0;

    for (let i = 0; i < 5; i++) {
        // get balcance before sending tx
        let responseBalanceBefore = await accountSender.getBalance();

        // create and send PRV
        let response;
        try {
            response = await accountSender.createAndSendNativeToken(paymentInfosParam, fee, isPrivacy, info, true);
        } catch (e) {
            console.log("Error when send PRV: ", e);
        }

        let expectedBalance = responseBalanceBefore - amountTransfer - fee;

        while (true) {
            let responseBalanceAfter = await accountSender.getBalance();
            if (responseBalanceAfter != expectedBalance) {
                console.log("Waiting....");
            } else {
                countSuccess++;
                break;
            }
        }
        console.log("Send tx 1 done, txID: ", response.txId);
    }

    console.log("countSuccess: ", countSuccess);
}

TestMultiCreateAndSendNativeToken()