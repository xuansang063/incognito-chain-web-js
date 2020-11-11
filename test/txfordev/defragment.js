import { Wallet } from '../../lib/wallet/wallet'
import { KeyWallet as keyWallet } from "../../lib/wallet/hdwallet";
import { AccountWallet } from "../../lib/wallet/accountWallet";
import { RpcClient } from "../../lib/rpcclient/rpcclient";

Wallet.RpcClient = new RpcClient("https://mainnet.incognito.org/fullnode");
// Wallet.RpcClient = new RpcClient("https://test-node.incognito.org");

async function sleep(sleepTime) {
  return new Promise(resolve => setTimeout(resolve, sleepTime));
}

async function Defragment() {
  await sleep(8000);
  // TODO 1. need to fill in your private key
  const privateKeyStr = "";
  const senderKeyWallet = keyWallet.base58CheckDeserialize(privateKeyStr);
  await senderKeyWallet.KeySet.importFromPrivateKey(senderKeyWallet.KeySet.PrivateKey);

  let accountSender = new AccountWallet();
  accountSender.key = senderKeyWallet;

  const fee = 100;
  const responses = await accountSender.defragmentNativeCoin(fee);
  console.log("List Tx", responses.map(res => res.txId));
}

Defragment();
