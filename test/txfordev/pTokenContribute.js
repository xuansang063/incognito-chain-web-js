import { Wallet } from '../../lib/wallet/wallet'
import { KeyWallet as keyWallet } from "../../lib/wallet/hdwallet";
import { AccountWallet } from "../../lib/wallet/accountWallet";
import { RpcClient } from "../../lib/rpcclient/rpcclient";
import { PaymentAddressType } from '../../lib/wallet/constants';
const fs = require('fs');

Wallet.RpcClient = new RpcClient("https://mainnet.incognito.org/fullnode");
// Wallet.RpcClient = new RpcClient("https://test-node.incognito.org");

async function sleep(sleepTime) {
  return new Promise(resolve => setTimeout(resolve, sleepTime));
}

async function PTokenContribute() {
  await sleep(5000);
  
  // contributor
  // 1. need to fill in your private key
  let privateKeyStr = "";
  let senderKeyWallet = keyWallet.base58CheckDeserialize(privateKeyStr);
  senderKeyWallet.KeySet.importFromPrivateKey(senderKeyWallet.KeySet.PrivateKey);

  let accountSender = new AccountWallet();
  accountSender.key = senderKeyWallet;

  let feeNativeToken = 10;  
  let feePToken = 0;
  let pdeContributionPairID = "";     // 2. need to fill in your contribution pair ID
  let contributedAmount = 500;        // 3. need to fill in contribution amount

  let tokenParam = {
    Privacy: true,
    TokenID: "",            // 4. need to fill in token 
    TokenName: "",
    TokenSymbol: ""
  }

  // create and send staking tx
  try {
    await accountSender.createAndSendPTokenContributionTx(
      tokenParam, feeNativeToken, feePToken, pdeContributionPairID, contributedAmount
    );
  } catch (e) {
    console.log("Error when staking: ", e);
  }
}

PTokenContribute();

