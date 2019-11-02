import { Wallet } from '../../lib/wallet/wallet'
import { KeyWallet as keyWallet } from "../../lib/wallet/hdwallet";
import { AccountWallet } from "../../lib/wallet/accountWallet";
import { RpcClient } from "../../lib/rpcclient/rpcclient";
const fs = require('fs');

// Wallet.RpcClient = new RpcClient("https://mainnet.incognito.org/fullnode");
Wallet.RpcClient = new RpcClient("https://test-node.incognito.org");
// Wallet.RpcClient = new RpcClient("http://54.39.158.106:20032");
// Wallet.RpcClient = new RpcClient("http://localhost:9334");

async function sleep(sleepTime) {
  return new Promise(resolve => setTimeout(resolve, sleepTime));
}

async function GetBalanceMultiUsers() {
  // load file paymentAddr.json to set payment infos
  let jsonString = fs.readFileSync('./test/txfordev/privateKeyList.json');

  let data = JSON.parse(jsonString);
  console.log("Data multi staking: ", data);

  await sleep(5000);

  for (let i = 0; i < data.privateKeys.length; i++) {
    // set private for funder
    let funderPrivateKeyStr = data.privateKeys[i];
    let funderKeyWallet = keyWallet.base58CheckDeserialize(funderPrivateKeyStr);
    funderKeyWallet.KeySet.importFromPrivateKey(funderKeyWallet.KeySet.PrivateKey);

    let accountFunder = new AccountWallet();
    accountFunder.key = funderKeyWallet;

    let expectedBalance = 1755 * 1e9;
    let wrongCount = 0;

    try {
      let response = await accountFunder.getBalance();
      if (response != expectedBalance){
        console.log("[RES] Private key ", data.privateKeys[i], "has : ", response);
        wrongCount++;
      } else{

        console.log("Has expected amoount : ", data.privateKeys[i]);
      }
    } catch (e) {
      console.log(e);
      console.log("Sorry. You can not send this transaction. Please try again. Fighting ^.^");
    }

    console.log("Running get balance test with wrong count: ", wrongCount);
  }
}

GetBalanceMultiUsers();

