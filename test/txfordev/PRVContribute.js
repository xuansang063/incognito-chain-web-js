const { Wallet, KeyWallet: keyWallet, AccountWallet, types, init } = require('../..');
const { RpcClient } = types;
const fs = require('fs');

// Wallet.RpcClient = new RpcClient("https://mainnet.incognito.org/fullnode");
// Wallet.RpcClient = new RpcClient("https://test-node.incognito.org");
Wallet.RpcClient = new RpcClient('http://139.162.55.124:8334');

async function PRVContribute() {
  await init();

  // TODO 1. need to fill in your private key
  let privateKeyStr = "";
  // let senderKeyWallet = keyWallet.base58CheckDeserialize(privateKeyStr);
  // await senderKeyWallet.KeySet.importFromPrivateKey(senderKeyWallet.KeySet.PrivateKey);

  let accountSender = new AccountWallet(Wallet);
  await accountSender.setKey(privateKeyStr);

  let fee = 100;
  // TODO 2. need to fill in your contribution pair ID
  let pdeContributionPairID = "";

  // TODO 3. need to fill in contribution amount
  let contributedAmount = 200;

  // create and send contribution tx
  try {
    let response = await accountSender.createAndSendTxWithContribution({
        transfer: { fee, tokenID: null },
        extra: { pairID: pdeContributionPairID, contributedAmount }
    });
    // createAndSendTxWithNativeTokenContribution(
    //   fee, pdeContributionPairID, contributedAmount
    // );

    console.log("You added liquidity sucessfully with TxID: ", response.txId);
  } catch (e) {
    console.log("Error when contribution: ", e);
  }
}

PRVContribute();
