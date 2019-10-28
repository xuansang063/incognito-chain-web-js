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

Wallet.RpcClient = new RpcClient("https://mainnet.incognito.org/fullnode");
// Wallet.RpcClient = new RpcClient("http://54.39.158.106:20032");
// Wallet.RpcClient = new RpcClient("http://localhost:9334");

async function sleep(sleepTime) {
  return new Promise(resolve => setTimeout(resolve, sleepTime));
}

async function MultiStaking() {
  // load file paymentAddr.json to set payment infos
  let jsonString = fs.readFileSync('./test/txfordev/privateKeyList.json');

  let data = JSON.parse(jsonString);
  console.log("Data multi staking: ", data);

  await sleep(5000);
  let wrongCount = 0;

  for (let i = 0; i < data.privateKeys.length; i++) {
    // set private for funder
    let funderPrivateKeyStr = data.privateKeys[i];
    let funderKeyWallet = keyWallet.base58CheckDeserialize(funderPrivateKeyStr);
    funderKeyWallet.KeySet.importFromPrivateKey(funderKeyWallet.KeySet.PrivateKey);
    let funderPaymentAddressStr = funderKeyWallet.base58CheckSerialize(PaymentAddressType);

    let accountFunder = new AccountWallet();
    accountFunder.key = funderKeyWallet;

    let fee = 0.5 * 1e9; // nano PRV
    let param = {
      type: 0
    };
    
    let candidatePaymentAddress = funderPaymentAddressStr;
    let rewardReceiverPaymentAddress = funderPaymentAddressStr;
    let candidateMiningSeedKey = checkEncode(funderKeyWallet.getMiningSeedKey(), ENCODE_VERSION);
    let autoReStaking = true;

    try {
      let response = await accountFunder.createAndSendStakingTx(param, fee, candidatePaymentAddress,  candidateMiningSeedKey, rewardReceiverPaymentAddress, autoReStaking);
      console.log("congratulations to you! Stake successfully! ^.^")
      console.log("Response: ", response);
    } catch (e) {
      wrongCount++;
      console.log(e);
      console.log("Sorry. You can not send this transaction. Please try again. Fighting ^.^");
    }
    await sleep(1000);
  }
  console.log("Running staking test with wrong count: ", wrongCount);
}

MultiStaking();

