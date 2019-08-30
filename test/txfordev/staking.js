import { Wallet, DefaultStorage } from '../../lib/wallet/wallet'
import { KeyWallet as keyWallet } from "../../lib/wallet/hdwallet";
import { AccountWallet } from "../../lib/wallet/accountWallet";
import * as key from "../../lib/key";
import bn from 'bn.js';
import { RpcClient } from "../../lib/rpcclient/rpcclient";
import { PaymentAddressType } from '../../lib/wallet/constants';
const fs = require('fs');

Wallet.RpcClient = new RpcClient("https://test-node.incognito.org");
// Wallet.RpcClient = new RpcClient("http://localhost:9334");

async function MultiStaking() {
  // load file paymentAddr.json to set payment infos
  let jsonString = fs.readFileSync('./test/txfordev/privateKeyStaking.json');

  let data = JSON.parse(jsonString);
  console.log("Data AAA: ", data);

  for (let i = 0; i < data.privateKeys.length; i++) {
    // set private for funder
    let funderPrivateKeyStr = data.privateKeys[i];
    let funderKeyWallet = keyWallet.base58CheckDeserialize(funderPrivateKeyStr);
    funderKeyWallet.KeySet.importFromPrivateKey(funderKeyWallet.KeySet.PrivateKey);
    let funderPaymentAddressStr = funderKeyWallet.base58CheckSerialize(PaymentAddressType);

    let accountFunder = new AccountWallet();
    accountFunder.key = funderKeyWallet;

    let fee = 500000000; // nano PRV
    let param = {
      type: 0
    };
    let isRewardFunder = false;
    let candidatePaymentAddress = funderPaymentAddressStr;

    try {
      let response = await accountFunder.createAndSendStakingTx(param, fee, candidatePaymentAddress, isRewardFunder);
      console.log("congratulations to you! Stake successfully! ^.^")
      console.log("Response: ", response);
    } catch (e) {
      console.log("Sorry. You can not send this transaction. Please try again. Fighting ^.^");
    }
  }
}

MultiStaking();

