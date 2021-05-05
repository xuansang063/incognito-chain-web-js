const { Wallet, KeyWallet: keyWallet, AccountWallet, types, init } = require('../..');
const { RpcClient } = types;
const fs = require('fs');
const bn = require('bn.js');

// Wallet.RpcClient = new RpcClient("https://mainnet.incognito.org/fullnode");
// Wallet.RpcClient = new RpcClient("https://test-node.incognito.org");
Wallet.RpcClient = new RpcClient('http://139.162.55.124:8334');

async function TestMultiCreateAndSendNativeToken() {
    await init();

    // sender key (private key)
    let senderPrivateKeyStr = "112t8rnX7qWSJFCnGBq4YPHYN2D29NmGowC5RSbuDUC8Kg8ywg6GsPda5xRJMAmzmVKwLevdJNi5XfrqHRWDzSGEg37kbsrcWrAEQatR1UQQ";
    // let senderKeyWallet = keyWallet.base58CheckDeserialize(senderPrivateKeyStr);
    // await senderKeyWallet.KeySet.importFromPrivateKey(senderKeyWallet.KeySet.PrivateKey);

    let accountSender = new AccountWallet(Wallet);
    accountSender.setKey(senderPrivateKeyStr);

    // receiver key (payment address)
    let receiverPaymentAddrStr = "12Ryp47jXJfkz5Cketp4D9U7uTH4hFgFUVUEzq6k5ikvAZ94JucsYbi235siCMud5GdtRi1DoSecsTD2nkiic9TH7YNkLEoEhrvxvwt";
    // let receiverKeyWallet = keyWallet.base58CheckDeserialize(receiverPaymentAddrStr);
    // let receiverPaymentAddr = receiverKeyWallet.KeySet.PaymentAddress;

    let fee = 0.5 * 1e9;
    let isPrivacy = true;
    let info = "";
    let amountTransfer = 100 * 1e9; // in nano PRV
    amountTransfer = new bn(amountTransfer)

    let paymentInfosParam = [];
    paymentInfosParam[0] = {
        "PaymentAddress": receiverPaymentAddrStr,
        "Amount": amountTransfer.toString(),
        "Message": "rose's so cute"
    };

    let countSuccess = 0;

    for (let i = 0; i < 5; i++) {
        // get balcance before sending tx
        let responseBalanceBefore = await accountSender.getBalance();
        const balanceBefore = new bn(responseBalanceBefore);

        // create and send PRV
        let response;
        try {
            response = await accountSender.createAndSendNativeToken({ transfer: { prvPayments: paymentInfosParam, fee, info }, extra: { isEncryptMessage: true }});
        } catch (e) {
            console.log("Error when send PRV: ", e);
        }

        let expectedBalance = balanceBefore.sub(amountTransfer).subn(fee);

        let { balance } = await accountSender.waitBalanceChange();
        balance = new bn(balance);
        if (!balance.eq(balanceBefore)) {
            console.error(`Unexpected balance change! ${balance.toString()} vs ${expectedBalance.toString()}`);
            console.error(`Tx creation log: ${response}`);
            continue;
        }
        countSuccess++;
        console.log("Send tx 1 done, txID: ", response.txId);
    }

    console.log("countSuccess: ", countSuccess);
}

TestMultiCreateAndSendNativeToken()
