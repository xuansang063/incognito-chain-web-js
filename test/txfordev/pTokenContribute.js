import { Wallet } from '../../lib/wallet/wallet'
import { KeyWallet as keyWallet } from "../../lib/wallet/hdwallet";
import { AccountWallet } from "../../lib/wallet/accountWallet";
import { RpcClient } from "../../lib/rpcclient/rpcclient";
import { PaymentAddressType } from '../../lib/wallet/constants';
const fs = require('fs');

Wallet.RpcClient = new RpcClient("https://mainnet.incognito.org/fullnode");
// Wallet.RpcClient = new RpcClient("https://testnet.incognito.org/fullnode");

async function sleep(sleepTime) {
  return new Promise(resolve => setTimeout(resolve, sleepTime));
}

async function PTokenContribute() {
  await sleep(5000);
  
  // contributor
  // TODO 1: fill in your private key
  let privateKeyStr = "";
  let senderKeyWallet = keyWallet.base58CheckDeserialize(privateKeyStr);
  senderKeyWallet.KeySet.importFromPrivateKey(senderKeyWallet.KeySet.PrivateKey);

  let accountSender = new AccountWallet();
  accountSender.key = senderKeyWallet;

  let feeNativeToken = 100;  
  let feePToken = 0;
  // TODO 2: fill in your contribution pair ID
  let pdeContributionPairID = "";    

  // TODO 3: fill in contribution amount in nano unit
  let contributedAmount = 500;    
  
  // TODO 4: fill in TokenID that you want to add 
  let tokenParam = {
    Privacy: true,
    TokenID: "",            
    TokenName: "",
    TokenSymbol: ""
  }

  // create and send contribution tx
  try {
    let response = await accountSender.createAndSendPTokenContributionTx(
      tokenParam, feeNativeToken, feePToken, pdeContributionPairID, contributedAmount
    );

    console.log("You added liquidity sucessfully with TxID: ", response.txId);
  } catch (e) {
    console.log("Error when sending tx: ", e);
  }
}

PTokenContribute();

