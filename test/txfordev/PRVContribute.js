import { Wallet } from '../../lib/wallet/wallet'
import { KeyWallet as keyWallet } from "../../lib/wallet/hdwallet";
import { AccountWallet } from "../../lib/wallet/accountWallet";
import { RpcClient } from "../../lib/rpcclient/rpcclient";
const fs = require('fs');

Wallet.RpcClient = new RpcClient("https://mainnet.incognito.org/fullnode");
// Wallet.RpcClient = new RpcClient("https://test-node.incognito.org");

async function sleep(sleepTime) {
  return new Promise(resolve => setTimeout(resolve, sleepTime));
}

async function PRVContribute() {
  await sleep(5000);

  // TODO 1. need to fill in your private key
  let privateKeyStr = "";
  let senderKeyWallet = keyWallet.base58CheckDeserialize(privateKeyStr);
  senderKeyWallet.KeySet.importFromPrivateKey(senderKeyWallet.KeySet.PrivateKey);

  let accountSender = new AccountWallet();
  accountSender.key = senderKeyWallet;

  let fee = 100;
  // TODO 2. need to fill in your contribution pair ID
  let pdeContributionPairID = "";     

  // TODO 3. need to fill in contribution amount
  let contributedAmount = 200;        

  // create and send contribution tx
  try {
    let response = await accountSender.createAndSendTxWithNativeTokenContribution(
      fee, pdeContributionPairID, contributedAmount
    );

    console.log("You added liquidity sucessfully with TxID: ", response.txId);
  } catch (e) {
    console.log("Error when contribution: ", e);
  }
}

PRVContribute();