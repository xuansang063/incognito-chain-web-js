import { KeyWallet as keyWallet } from "../../lib/wallet/hdwallet";
import { AccountWallet, Wallet } from "../../lib/wallet/wallet";
import { RpcClient } from "../../lib/rpcclient/rpcclient";
import fs from 'fs';

// Todo: choose your network
// const rpcClient = new RpcClient("https://mainnet.incognito.org/fullnode");
const rpcClient = new RpcClient("https://test-node.incognito.org");

async function sleep(sleepTime) {
    return new Promise(resolve => setTimeout(resolve, sleepTime));
}

async function GetIncommingTxs() {
    Wallet.RpcClient = rpcClient;
    await sleep(5000);

    // Todo: Fill in your private key
    let senderSpendingKeyStr = "";
    let senderKeyWallet = keyWallet.base58CheckDeserialize(senderSpendingKeyStr);
    senderKeyWallet.KeySet.importFromPrivateKey(senderKeyWallet.KeySet.PrivateKey);

    let accountSender = new AccountWallet();
    accountSender.key = senderKeyWallet;

    let receivedTxs = await accountSender.getReceivedTransaction();
    

    // write result to file
    let filenameResult = "./getincommingtxs.txt";
    fs.openSync(filenameResult, "w");
    fs.writeFileSync(filenameResult, JSON.stringify(receivedTxs));
}

GetIncommingTxs();
