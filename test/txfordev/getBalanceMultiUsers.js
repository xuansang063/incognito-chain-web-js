const { Wallet, KeyWallet: keyWallet, AccountWallet, types, init } = require('../..');
const { RpcClient } = types;
const fs = require('fs');

// Wallet.RpcClient = new RpcClient("https://mainnet.incognito.org/fullnode");
// Wallet.RpcClient = new RpcClient("https://test-node.incognito.org");
Wallet.RpcClient = new RpcClient('http://139.162.55.124:8334');

async function GetBalanceMultiUsers() {
  // load file paymentAddr.json to set payment infos
  let jsonString = fs.readFileSync('./test/txfordev/getBalanceMultiUsers.json');

  let data = JSON.parse(jsonString);
  console.log("Data multi staking: ", data);

  await init();

  for (let i = 0; i < data.privateKeys.length; i++) {
    // set private for funder
    let funderPrivateKeyStr = data.privateKeys[i];
    // let funderKeyWallet = keyWallet.base58CheckDeserialize(funderPrivateKeyStr);
    // funderKeyWallet.KeySet.importFromPrivateKey(funderKeyWallet.KeySet.PrivateKey);

    let accountFunder = new AccountWallet(Wallet);
    await accountFunder.setKey(funderPrivateKeyStr);

    let expectedBalance = 1 * 1e9;
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

