import { Wallet, DefaultStorage } from '../../lib/wallet/wallet'
import { KeyWallet as keyWallet } from "../../lib/wallet/hdwallet";
import { AccountWallet } from "../../lib/wallet/accountWallet";
import * as key from "../../lib/key";
import bn from 'bn.js';
import { RpcClient } from "../../lib/rpcclient/rpcclient";
import { PaymentAddressType } from '../../lib/wallet/constants';
import { ENCODE_VERSION } from '../../lib/constants';
import {checkEncode} from "../../lib/base58";
import { SSL_OP_EPHEMERAL_RSA } from 'constants';
const fs = require('fs');

// Wallet.RpcClient = new RpcClient("https://mainnet.incognito.org/fullnode");
Wallet.RpcClient = new RpcClient("https://test-node.incognito.org");
// Wallet.RpcClient = new RpcClient("http://54.39.158.106:20032");
// Wallet.RpcClient = new RpcClient("http://localhost:9334");

async function sleep(sleepTime) {
  return new Promise(resolve => setTimeout(resolve, sleepTime));
}

async function SendRewardsToOneAddress() {
  // load file paymentAddr.json to set payment infos
  let jsonString = fs.readFileSync('./test/txfordev/privateKeyListForWithdraw.json');

  let data = JSON.parse(jsonString);
  console.log("Data private key list: ", data);

  await sleep(5000);

  // 1. need to fill in payment address of receiver
  let paymentAddressReceiver = "";
 
  // 2. tokenID, default null for PRV
  let tokenID = null;

  let feePRV = 10;      // nano PRV
  let isPrivacyPRV = true;
  let isPrivacyPToken = true;  

  let totalTransfer = 0;
  let numTxSuccess  = 0;

  for (let i = 0; i < data.privateKeys.length; i++) {
    // set private for funder
    let senderPrivateKeyStr = data.privateKeys[i];
    let senderKeyWallet = keyWallet.base58CheckDeserialize(senderPrivateKeyStr);
    senderKeyWallet.KeySet.importFromPrivateKey(senderKeyWallet.KeySet.PrivateKey);

    let accountSender = new AccountWallet();
    accountSender.key = senderKeyWallet;

    // get balance
    let balance = await accountSender.getBalance(tokenID);
   
    // create tx transfering reward to paymentAddressReceiver
    if (balance > 0) {
      if (tokenID == null){
        let amountTransfer = balance - feePRV;
        let paymentInfo = [{
          "paymentAddressStr": paymentAddressReceiver,
          "amount": amountTransfer,
        }]
        let response = await accountSender.createAndSendNativeToken(paymentInfo, feePRV, isPrivacyPRV);
        if (response.txId != null){
          numTxSuccess++;
          totalTransfer = totalTransfer + amountTransfer;
        }
      } else{
        console.log("Coming soon");
        break;
      }
    }
    await sleep(1000);
  }

  console.log("****** Total transfer to receiver address: ", totalTransfer);
  console.log("****** Number successful transactions: ", numTxSuccess);
}

SendRewardsToOneAddress();

