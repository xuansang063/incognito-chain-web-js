const { Wallet, KeyWallet: keyWallet, AccountWallet, types, init } = require('../..');
const { RpcClient } = types;
const fs = require('fs');

// Wallet.RpcClient = new RpcClient("https://mainnet.incognito.org/fullnode");
// Wallet.RpcClient = new RpcClient("https://test-node.incognito.org");
Wallet.RpcClient = new RpcClient('http://139.162.55.124:8334');

async function sleep(sleepTime) {
  return new Promise(resolve => setTimeout(resolve, sleepTime));
}

async function Defragment() {
  await init();
  // TODO 1. need to fill in your private key
  const privateKeyStr = "";
  // const senderKeyWallet = keyWallet.base58CheckDeserialize(privateKeyStr);
  // await senderKeyWallet.KeySet.importFromPrivateKey(senderKeyWallet.KeySet.PrivateKey);

  let accountSender = new AccountWallet(Wallet);
  await accountSender.setKey(privateKeyStr);

  const fee = 100;
  const responses = await accountSender.defragmentNativeCoin(fee);
  console.log("List Tx", responses)//.map(res => res.txId));
}

Defragment();
