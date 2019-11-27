import {Wallet} from '../../lib/wallet/wallet'
import {KeyWallet as keyWallet} from "../../lib/wallet/hdwallet";
import {AccountWallet} from "../../lib/wallet/accountWallet";
import {RpcClient} from "../../lib/rpcclient/rpcclient";
import {CustomTokenTransfer} from "../../lib/tx/constants";

const fs = require('fs');

// Wallet.RpcClient = new RpcClient("https://mainnet.incognito.org/fullnode");
Wallet.RpcClient = new RpcClient("https://test-node.incognito.org");
// Wallet.RpcClient = new RpcClient("http://localhost:9334");
// const rpcClient = new RpcClient("http://54.39.158.106:20032");

async function sleep(sleepTime) {
    return new Promise(resolve => setTimeout(resolve, sleepTime));
}

function csvJSON(filename) {
    let csv = fs.readFileSync(filename).toString();
    var lines = csv.split("\n");

    var result = [];
    var headers = lines[0].split(",");
    for (var i = 1; i < lines.length; i++) {
        var obj = {};
        var currentline = lines[i].split(",");

        for (var j = 0; j < headers.length; j++) {
            obj[headers[j]] = currentline[j];
        }

        result.push(obj);
    }
    return JSON.stringify(result).toString(); //JSON
}

async function SendPrivacyTokenToReceivers() {
    let data = csvJSON('./test/txfordev/sendPrivateTokenPayload.csv');
    await sleep(5000);

    console.log("data: ", data);

    let paymentInfos = JSON.parse(data);

    for (let i = 0; i < paymentInfos.length; i++) {
        paymentInfos[i].amount = parseInt(paymentInfos[i].amount);
    }

    // 1. need to fill Private Key
    let senderSpendingKeyStr = "";
    // 2. need to fill token ID, default pUSDT
    let tokenID = "716fd1009e2a1669caacc36891e707bfdf02590f96ebd897548e8963c95ebac0";

    let senderKeyWallet = keyWallet.base58CheckDeserialize(senderSpendingKeyStr);
    senderKeyWallet.KeySet.importFromPrivateKey(senderKeyWallet.KeySet.PrivateKey);
    let accountSender = new AccountWallet();
    accountSender.key = senderKeyWallet;

    let feePRV = 20;
    let feePToken = 0;
    let hasPrivacyForToken = true;
    let hasPrivacyForPRV = true;

    let offset = 0;
    let maxReceivers = 25; 
    let isDone = false;
    let count = 0;
    while (!isDone) {
        let paymentInfoTmp;
        if (paymentInfos.length >= offset + maxReceivers) {
            paymentInfoTmp = paymentInfos.slice(offset, offset + maxReceivers);
            offset = offset + maxReceivers;
        } else {
            paymentInfoTmp = paymentInfos.slice(offset, paymentInfos.length);
            isDone = true;
        }

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

            for (let i = 0; i < paymentInfoTmp.length; i++) {
                tokenParams.TokenReceivers[i] = {
                    PaymentAddress: paymentInfoTmp[i].paymentAddressStr,
                    Amount: paymentInfoTmp[i].amount,
                    Message: ""
                }
            }

            let response = await accountSender.createAndSendPrivacyTokenS([], tokenParams, feePRV, feePToken, hasPrivacyForPRV, hasPrivacyForToken, "", true, true);
            console.log("Response: ", response);
            console.log("Congrats!!! Create transaction successfully! ^.^")

            count += paymentInfoTmp.length;
           
            console.log("Total Number payment transfer: ", count);
            if (!isDone) {
                console.log("WAITING FOR CREATING NEXT TRANSACTION..................");
                await sleep(2 * 60 * 1000);
            }
        } catch (e) {
            console.log("Sorry!!! You cannot send this transaction. Please try again. Fighting ^.^");
        }
    }
}

SendPrivacyTokenToReceivers();

