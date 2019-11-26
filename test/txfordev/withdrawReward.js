import { Wallet } from '../../lib/wallet/wallet'
import { KeyWallet as keyWallet } from "../../lib/wallet/hdwallet";
import { AccountWallet } from "../../lib/wallet/accountWallet";
import { RpcClient } from "../../lib/rpcclient/rpcclient";
import { PaymentAddressType } from '../../lib/wallet/constants';
const fs = require('fs');

// Wallet.RpcClient = new RpcClient("https://mainnet.incognito.org/fullnode");
Wallet.RpcClient = new RpcClient("https://test-node.incognito.org");
// Wallet.RpcClient = new RpcClient("http://54.39.158.106:20032");
// Wallet.RpcClient = new RpcClient("http://localhost:9334");

async function sleep(sleepTime) {
  return new Promise(resolve => setTimeout(resolve, sleepTime));
}

async function MultiWithdrawReward() {
  // load file privateKeyListForWithdraw.json to get private key
  let jsonString = fs.readFileSync('./test/txfordev/privateKeyListForWithdraw.json');

  let data = JSON.parse(jsonString);
  console.log("Data multi withdraw reward: ", data);

  await sleep(5000);
  let wrongCount = 0;

  // tokenID string, default is "", withdraw reward PRV
  let tokenIDStr = "";

  for (let i = 0; i < data.privateKeys.length; i++) {
    // set private for funder
    let senderPrivateKeyStr = data.privateKeys[i];
    let senderKeyWallet = keyWallet.base58CheckDeserialize(senderPrivateKeyStr);
    senderKeyWallet.KeySet.importFromPrivateKey(senderKeyWallet.KeySet.PrivateKey);
    let senderPaymentAddressStr = senderKeyWallet.base58CheckSerialize(PaymentAddressType);
    let accountFunder = new AccountWallet();
    accountFunder.key = senderKeyWallet;

    // get reward amount 
    let amountReward = 0;
    try {
      amountReward = await AccountWallet.getRewardAmount(senderPaymentAddressStr, false, tokenIDStr);
      console.log("amountReward: ", amountReward);
    } catch (e) {
      console.log("Error get reward amount: ", e);
    }

    if (amountReward > 0) {
      try {
        let response = await accountFunder.createAndSendWithdrawRewardTx(tokenIDStr);
        console.log("congratulations to you! Withdraw successfully! ^.^")
        console.log("Response: ", response);
      } catch (e) {
        wrongCount++;
        console.log(e);
        console.log("Sorry. You can not send this transaction. Please try again. Fighting ^.^");
      }
    }
    
    await sleep(1000);
  }
  console.log("Running withdraw amount test with wrong count: ", wrongCount);
}

MultiWithdrawReward();

