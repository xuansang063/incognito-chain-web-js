const { Wallet, KeyWallet: keyWallet, AccountWallet, types, init, constants } = require('../..');
const { RpcClient } = types;
const fs = require('fs');

// Wallet.RpcClient = new RpcClient("https://mainnet.incognito.org/fullnode");
// Wallet.RpcClient = new RpcClient("https://test-node.incognito.org");
Wallet.RpcClient = new RpcClient('http://139.162.55.124:8334');

async function MultiWithdrawReward() {
  // load file withdrawReward.json to get private key
  let jsonString = fs.readFileSync('./test/txfordev/withdrawReward.json');

  let data = JSON.parse(jsonString);
  console.log("Data multi withdraw reward: ", data);

  await init();
  let wrongCount = 0;

  // tokenID string, default is "", withdraw reward PRV
  let tokenIDStr = "";

  for (let i = 0; i < data.privateKeys.length; i++) {
    // set private for funder
    let senderPrivateKeyStr = data.privateKeys[i];
    // let senderKeyWallet = keyWallet.base58CheckDeserialize(senderPrivateKeyStr);
    // await senderKeyWallet.KeySet.importFromPrivateKey(senderKeyWallet.KeySet.PrivateKey);
    
    let accountFunder = new AccountWallet();
    await accountFunder.setKey(senderPrivateKeyStr);
    let senderPaymentAddressStr = accountFunder.key.base58CheckSerialize(constants.PaymentAddressType);

    // get reward amount
    let amountReward = 0;
    try {
      amountReward = await accountFunder.getRewardAmount(senderPaymentAddressStr, false, tokenIDStr);
      console.log("amountReward: ", amountReward);
    } catch (e) {
      console.log("Error get reward amount: ", e);
    }

    if (amountReward > 0) {
      try {
        let response = await accountFunder.createAndSendWithdrawRewardTx({ transfer: { fee: 100, tokenID: tokenIDStr }});
        console.log("congratulations to you! Withdraw successfully! ^.^")
        console.log("Response: ", response);
      } catch (e) {
        wrongCount++;
        console.log(e);
        console.log("Sorry. You can not send this transaction. Please try again. Fighting ^.^");
      }
    }

    await accountFunder.waitTx(response.Response.txId, 2);
  }
  console.log("Running withdraw amount test with wrong count: ", wrongCount);
}

MultiWithdrawReward();

