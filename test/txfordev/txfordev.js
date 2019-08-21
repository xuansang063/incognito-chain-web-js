import { Wallet, DefaultStorage } from '../../lib/wallet/wallet'
import { KeyWallet as keyWallet } from "../../lib/wallet/hdwallet";
import { AccountWallet } from "../../lib/wallet/accountWallet";
import { RpcClient } from "../../lib/rpcclient/rpcclient";
const fs = require('fs');

Wallet.RpcClient = new RpcClient("https://test-node.incognito.org");
// Wallet.RpcClient = new RpcClient("http://localhost:9334");

async function SendPRVForMultiUsers() {
    // load file paymentAddr.json to set payment infos
     let jsonString = fs.readFileSync('./test/txfordev/paymentAddr.json');

    let data = JSON.parse(jsonString);
    console.log("Data AAA: ", data);

    // set private for sender
    let senderSpendingKeyStr = "112t8rnXQ8kbdo6jMvGJC8M9diyCxuVLDPXHZJaaaGTvX32Nfo2rMCMx8PhjV3EhXQQ9ouWcVFSYvSLoBf65LLNFzZEUu5exUx5nJGCNFPk5";
    let senderKeyWallet = keyWallet.base58CheckDeserialize(senderSpendingKeyStr);
    senderKeyWallet.KeySet.importFromPrivateKey(senderKeyWallet.KeySet.PrivateKey);

    let accountSender = new AccountWallet();
    accountSender.key = senderKeyWallet;

    let fee = 500000000; // nano PRV
    let isPrivacy = true;

    try {
        let response = await accountSender.createAndSendConstant(data.paymentInfos, fee, isPrivacy, "");
        console.log("congratulations to you! Create transaction successfully! ^.^")
        console.log("Response: ", response);
        // await sleep(2*60*1000);
    } catch(e){
        console.log("Sorry. You can not send this transaction. Please try again. Fighting ^.^");
    }    
}

SendPRVForMultiUsers();

