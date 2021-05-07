const { Wallet, KeyWallet: keyWallet, AccountWallet, types, init } = require('../..');
const { RpcClient } = types;
const fs = require('fs');

// Wallet.RpcClient = new RpcClient("https://mainnet.incognito.org/fullnode");
// Wallet.RpcClient = new RpcClient("https://test-node.incognito.org");
Wallet.RpcClient = new RpcClient('http://139.162.55.124:8334');

async function PTokenContribute() {
  await init();

  // contributor
  // TODO 1: fill in your private key
  let privateKeyStr = "";
  // let senderKeyWallet = keyWallet.base58CheckDeserialize(privateKeyStr);
  // await senderKeyWallet.KeySet.importFromPrivateKey(senderKeyWallet.KeySet.PrivateKey);

  let accountSender = new AccountWallet(Wallet);
  await accountSender.setKey(privateKeyStr);

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
    let response = await accountSender.createAndSendPTokenContributionTx({
        transfer: { fee: feeNativeToken, tokenID: tokenParam.TokenID },
        extra: { pairID: pdeContributionPairID, contributedAmount }
    })

    // (
    //   tokenParam, feeNativeToken, feePToken, pdeContributionPairID, contributedAmount
    // );

    console.log("You added liquidity sucessfully with TxID: ", response.txId);
  } catch (e) {
    console.log("Error when sending tx: ", e);
  }
}

PTokenContribute();

