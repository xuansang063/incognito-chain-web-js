import { Wallet } from '../../lib/wallet/wallet'
import { KeyWallet as keyWallet } from "../../lib/wallet/hdwallet";
import { AccountWallet } from "../../lib/wallet/accountWallet";
import { RpcClient } from "../../lib/rpcclient/rpcclient";

Wallet.RpcClient = new RpcClient("https://mainnet.incognito.org/fullnode");
// Wallet.RpcClient = new RpcClient("https://testnet.incognito.org/fullnode");

async function sleep(sleepTime) {
  return new Promise(resolve => setTimeout(resolve, sleepTime));
}

async function Defragment() {
  await sleep(8000);
  // TODO 1. FILL YOUR PRIVATE KEY
  const privateKeyStr = "112t8ro7bsF9uitHsbaWX9kfcuDKqr3vphwfupKyqPL3YhvBwgtgtvtDCWLdrH6MJ4RHRtfWKMBjP86sewLqKLKVDD1QHLysLfRZLWzYg3Er";
  const senderKeyWallet = keyWallet.base58CheckDeserialize(privateKeyStr);
  senderKeyWallet.KeySet.importFromPrivateKey(senderKeyWallet.KeySet.PrivateKey);

  let accountSender = new AccountWallet();
  accountSender.key = senderKeyWallet;

  const fee = 100;
  const responses = await accountSender.defragmentNativeCoin(fee, true, 50);
  console.log("Defragment UTXOs successfully with TxIDs", responses.map(res => res.txId));
}

Defragment();
