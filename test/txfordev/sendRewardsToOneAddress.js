import { Wallet } from '../../lib/wallet/wallet'
import { KeyWallet as keyWallet } from "../../lib/wallet/hdwallet";
import { AccountWallet } from "../../lib/wallet/accountWallet";
import { RpcClient } from "../../lib/rpcclient/rpcclient";
const fs = require('fs');

// Wallet.RpcClient = new RpcClient("https://mainnet.incognito.org/fullnode");
// Wallet.RpcClient = new RpcClient("https://test-node.incognito.org");
Wallet.RpcClient = new RpcClient("http://51.83.36.184:20001");
// Wallet.RpcClient = new RpcClient("http://localhost:9334");

async function sleep(sleepTime) {
  return new Promise(resolve => setTimeout(resolve, sleepTime));
}

async function SendRewardsToOneAddress() {
  // load file sendRewardsToOneAddress.json to get fromAddress and toAddress
  let jsonString = fs.readFileSync('./test/txfordev/sendRewardsToOneAddress.json');

  let data = JSON.parse(jsonString);
  

  let toAddress = data.toAddress;
  let fromAddressList = data.fromAddress;

  await sleep(5000);
 
  //  tokenID, default null for PRV
  let tokenID = null;

  let feePRV = 200;      // nano PRV
  let isPrivacyPRV = true;
  let isPrivacyPToken = true;  

  let totalTransfer = 0;
  let numTxSuccess  = 0;

  for (let i = 0; i < fromAddressList.length; i++) {
    // set private key of sender
    let senderPrivateKeyStr = fromAddressList[i];
    let senderKeyWallet = keyWallet.base58CheckDeserialize(senderPrivateKeyStr);
    senderKeyWallet.KeySet.importFromPrivateKey(senderKeyWallet.KeySet.PrivateKey);

    let accountSender = new AccountWallet();
    accountSender.key = senderKeyWallet;

    // get balance
    let balance = await accountSender.getBalance(tokenID);
   
    // create tx transfering reward to toAddress
    if (balance > 0) {
      if (tokenID == null){
        let amountTransfer = balance - feePRV;
        let paymentInfo = [{
          "paymentAddressStr": toAddress,
          "amount": amountTransfer,
        }]
        try {
          let response = await accountSender.createAndSendNativeToken(paymentInfo, feePRV, isPrivacyPRV);
          if (response.txId != null){
            
            numTxSuccess++;
            totalTransfer = totalTransfer + amountTransfer;
          }
        } catch(e) {
          
          break;
        }
      } else{
        
        break;
      }
    } else {
      
    }
    await sleep(1000);
  }

  
  
}

SendRewardsToOneAddress();

