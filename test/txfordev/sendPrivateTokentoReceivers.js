const { Wallet, KeyWallet: keyWallet, AccountWallet, types, init } = require('../..');
const { RpcClient } = types;
const {sleep, csvJSON} = require("./utils");
const fs = require('fs');

// Wallet.RpcClient = new RpcClient("https://mainnet.incognito.org/fullnode");
// Wallet.RpcClient = new RpcClient("https://test-node.incognito.org");
Wallet.RpcClient = new RpcClient('http://139.162.55.124:8334');

async function SendPrivacyTokenToReceivers() {
    let data = csvJSON('./test/txfordev/sendPrivateTokenPayload.csv');
    await init();

    console.log("data: ", data);

    let paymentInfos = JSON.parse(data);

    // for (let i = 0; i < paymentInfos.length; i++) {
    //     paymentInfos[i].amount = parseInt(paymentInfos[i].amount);
    // }

    // TODO 1. need to fill Private Key
    let senderSpendingKeyStr = "";
    // TODO 2. need to fill token ID, default pUSDT
    let tokenID = "716fd1009e2a1669caacc36891e707bfdf02590f96ebd897548e8963c95ebac0";

    // let senderKeyWallet = keyWallet.base58CheckDeserialize(senderSpendingKeyStr);
    // await senderKeyWallet.KeySet.importFromPrivateKey(senderKeyWallet.KeySet.PrivateKey);
    let accountSender = new AccountWallet(Wallet);
    await accountSender.setKey(senderSpendingKeyStr);

    let feePRV = 100;
    let feePToken = 0;
    let hasPrivacyForToken = true;
    let hasPrivacyForPRV = true;

    let offset = 0;
    let maxReceivers = 20;
    let isDone = false;
    let count = 0;
    let loopNumber = 0;
    while (!isDone) {
        let paymentInfoTmp;
        if (paymentInfos.length >= offset + maxReceivers) {
            paymentInfoTmp = paymentInfos.slice(offset, offset + maxReceivers);
            offset = offset + maxReceivers;
        } else {
            paymentInfoTmp = paymentInfos.slice(offset, paymentInfos.length);
            isDone = true;
        }

        console.log("================== Round ", loopNumber, " ==================");
        console.log("Payment infos: ", paymentInfoTmp);

        try {
            let tokenParams = {
                Privacy: true,
                TokenID: tokenID,
                TokenName: "",
                TokenSymbol: "",
                TokenTxType: CustomTokenTransfer,
                TokenAmount: 0,
                TokenReceivers: []
            }
            let tokenPayments = []

            for (let i = 0; i < paymentInfoTmp.length; i++) {
                tokenPayments[i] = {
                    PaymentAddress: paymentInfoTmp[i].paymentAddressStr,
                    Amount: paymentInfoTmp[i].amount,
                    Message: ""
                }
            }

            let response = await accountSender.createAndSendPrivacyToken({ transfer: { prvPayments: [], tokenID, fee: feePRV, info: "" }, extra: { isEncryptMessage: true, isEncryptMessageToken: true }});
            console.log("Response from sending tx: ", response);
            console.log("Congrats!!! Create transaction successfully! ^.^")

            count += paymentInfoTmp.length;
            loopNumber++;

            console.log("Total Number payment transfer: ", count);
            if (!isDone) {
                console.log("WAITING FOR CREATING NEXT TRANSACTION..................");
                await accountSender.waitTx(response.Response.txId, 5);
                // await sleep(5 * 60 * 1000);
            } else {
                console.log("DONE!!!");
            }
        } catch (e) {
            console.log("Sorry!!! You cannot send this transaction. Please try again. ^.^", e);
        }
    }
}

SendPrivacyTokenToReceivers();

