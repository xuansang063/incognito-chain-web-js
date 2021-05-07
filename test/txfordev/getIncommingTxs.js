const { Wallet, KeyWallet: keyWallet, AccountWallet, types, init } = require('../..');
const { RpcClient } = types;
const fs = require('fs');

// Wallet.RpcClient = new RpcClient("https://mainnet.incognito.org/fullnode");
// Wallet.RpcClient = new RpcClient("https://test-node.incognito.org");
Wallet.RpcClient = new RpcClient('http://139.162.55.124:8334');

async function GetIncommingTxs() {
    await init();

    // Todo: Fill in your private key
    let senderSpendingKeyStr = "";
    // let senderKeyWallet = keyWallet.base58CheckDeserialize(senderSpendingKeyStr);
    // await senderKeyWallet.KeySet.importFromPrivateKey(senderKeyWallet.KeySet.PrivateKey);

    let accountSender = new AccountWallet(Wallet);
    await accountSender.setKey(senderSpendingKeyStr);

    let receivedTxs = await accountSender.getReceivedTransaction();
    console.log(JSON.stringify(receivedTxs, null, 2));

    // write result to file
    let filenameResult = "./getincommingtxs.txt";
    fs.openSync(filenameResult, "w");
    fs.writeFileSync(filenameResult, JSON.stringify(receivedTxs));
}

GetIncommingTxs();
