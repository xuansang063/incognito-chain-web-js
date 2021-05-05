const { Wallet, KeyWallet: keyWallet, AccountWallet, types, init } = require('../..');
const { RpcClient } = types;
const {sleep, csvJSON} = require("./utils");
const fs = require('fs');

// Wallet.RpcClient = new RpcClient("https://mainnet.incognito.org/fullnode");
// Wallet.RpcClient = new RpcClient("https://test-node.incognito.org");
Wallet.RpcClient = new RpcClient('http://139.162.55.124:8334');

async function SendPRVToReceivers() {
    let data = csvJSON('./test/txfordev/sendPRVPayload.csv');
    console.log("data: ", data);
    let paymentInfos = JSON.parse(data);
    await init();

    // for (let i = 0; i < paymentInfos.length; i++) {
    //     paymentInfos[i].amount = parseInt(paymentInfos[i].amount);
    // }

    // TODO: set private key of sender
    let senderSpendingKeyStr = "";
    // let senderKeyWallet = keyWallet.base58CheckDeserialize(senderSpendingKeyStr);
    // await senderKeyWallet.KeySet.importFromPrivateKey(senderKeyWallet.KeySet.PrivateKey);
    let accountSender = new AccountWallet(Wallet);
    await accountSender.setKey(senderSpendingKeyStr);

    let fee = 100; // nano PRV
    let isPrivacy = true;

    let offset = 0;
    let maxReceivers = 20;  // except change UTXO for sender
    let isDone = false;
    let count = 0;
    let loopNumber = 0;

    while (!isDone) {
        let paymentInfoTmp;
        if (paymentInfos.length >= offset + maxReceivers){
            paymentInfoTmp = paymentInfos.slice(offset, offset + maxReceivers);
            offset = offset + maxReceivers;
        } else{
            paymentInfoTmp = paymentInfos.slice(offset, paymentInfos.length);
            isDone = true;
        }
        console.log("================== Round ", loopNumber, " ==================");
        console.log("Payment infos: ", paymentInfoTmp);
        count += paymentInfoTmp.length;

        try {
            let response = await accountSender.createAndSendNativeToken({ transfer: { prvPayments: paymentInfoTmp, fee }});
            console.log("congratulations to you! Create transaction successfully! ^.^")
            console.log("Response: ", response);
            console.log("Total Number payment transfer: ", count);
            loopNumber++;

            // waiting for creating next transaction
            if (!isDone){
                console.log("WAITING FOR CREATING NEXT TRANSACTION..................");
                await accountSender.waitTx(response.Response.txId, 5);
                // await sleep(5*60*1000);
            } else {
                console.log("DONE!!!");
            }
        } catch (e) {
            console.log("Sorry. You can not send this transaction. Please try again. Fighting ^.^");
        }
    }
}

SendPRVToReceivers();

