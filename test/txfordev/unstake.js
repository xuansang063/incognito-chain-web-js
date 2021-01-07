import { Wallet } from '../../lib/wallet/wallet'
import { KeyWallet as keyWallet } from "../../lib/wallet/hdwallet";
import { AccountWallet } from "../../lib/wallet/accountWallet";
import { RpcClient } from "../../lib/rpcclient/rpcclient";
import { PaymentAddressType } from '../../lib/wallet/constants';
import {ENCODE_VERSION} from "../../lib/constants";
import {checkEncode} from "../../lib/base58";
const fs = require('fs');

Wallet.RpcClient = new RpcClient("https://mainnet.incognito.org/fullnode");
// Wallet.RpcClient = new RpcClient("https://test-node.incognito.org");
// Wallet.RpcClient = new RpcClient("http://54.39.158.106:20032");
// Wallet.RpcClient = new RpcClient("http://localhost:9334");

async function sleep(sleepTime) {
  return new Promise(resolve => setTimeout(resolve, sleepTime));
}

async function MultiUnstake() {
  // load file withdrawReward.json to get private key
  let jsonString = fs.readFileSync('./test/txfordev/withdrawReward.json');

  let data = JSON.parse(jsonString);
  console.log("Data multi unstaking: ", data);

  await sleep(5000);
  let totalSuccess = 0;
  let feeNativeToken = 2;

  for (let i = 0; i < data.privateKeys.length; i++) {
    // set private for funder
    
    let senderPrivateKeyStr = data.privateKeys[i];
    console.log("private key - i ", senderPrivateKeyStr, i);
    let senderKeyWallet = keyWallet.base58CheckDeserialize(senderPrivateKeyStr);
    senderKeyWallet.KeySet.importFromPrivateKey(senderKeyWallet.KeySet.PrivateKey);
    let senderPaymentAddressStr = senderKeyWallet.base58CheckSerialize(PaymentAddressType);
    let accountFunder = new AccountWallet();
    accountFunder.key = senderKeyWallet;

    let candidatePaymentAddress = senderPaymentAddressStr;
    let candidateMiningSeedKey = checkEncode(accountFunder.key.getMiningSeedKey(), ENCODE_VERSION);

    // create and send staking tx
    try {
      await accountFunder.createAndSendStopAutoStakingTx(feeNativeToken, candidatePaymentAddress, candidateMiningSeedKey);
      totalSuccess++;
    } catch (e) {
      console.log("Error when unstaking: ", e);
    }
    
    await sleep(1000);
  }
  console.log("totalSuccess: ", totalSuccess);
}

MultiUnstake();

