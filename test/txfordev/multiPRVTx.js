import { Wallet, DefaultStorage } from '../../lib/wallet/wallet'
import { KeyWallet as keyWallet } from "../../lib/wallet/hdwallet";
import { AccountWallet } from "../../lib/wallet/accountWallet";
import { RpcClient } from "../../lib/rpcclient/rpcclient";
import { AST_Array } from 'terser';
const fs = require('fs');

Wallet.RpcClient = new RpcClient("https://test-node.incognito.org");

async function TestCreateAndSendNativeToken() {
    Wallet.RpcClient = rpcClient;
    // Wallet.ShardNumber = 1;
    await sleep(5000);
  
    // sender key (private key)
    let senderPrivateKeyStr = "112t8roafGgHL1rhAP9632Yef3sx5k8xgp8cwK4MCJsCL1UWcxXvpzg97N4dwvcD735iKf31Q2ZgrAvKfVjeSUEvnzKJyyJD3GqqSZdxN4or";
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
      // "message": "rose's so cute"
    };

    let countSuccess = 0;

    for (let i = 0; i < 100; i++){
        // get balcance before sending tx
        let responseBalanceBefore = await accountSender.getBalance();

        // create and send PRV
        let response ;
        try {
            response = await accountSender.createAndSendNativeToken(paymentInfosParam, fee, isPrivacy, info);
        } catch (e) {
            console.log("Error when send PRV: ", e);
        }

        let expectedBalance = responseBalanceBefore - amountTransfer - fee;

        while(true){
            let responseBalanceAfter = await accountSender.getBalance();
            if (responseBalanceAfter != expectedBalance){
                console.log("Waiting....");
            } else{
                countSuccess++;
                break;
            }
        }
        console.log("Send tx 1 done");
    }

    console.log("countSuccess: ", countSuccess);
  }