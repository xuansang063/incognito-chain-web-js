import { hybridEncryption, hybridDecryption } from "../../lib/privacy/hybridEncryption";
import {RpcClient} from "../../lib/rpcclient/rpcclient";

import { KeyWallet as keyWallet } from "../../lib/wallet/hdwallet";
import { AccountWallet, Wallet } from "../../lib/wallet/wallet";
 
// const rpcClient = new RpcClient("https://mainnet.incognito.org/fullnode");
const rpcClient = new RpcClient("https://test-node.incognito.org");
// const rpcClient = new RpcClient("http://54.39.158.106:20032");
// const rpcClient = new RpcClient("http://172.105.115.134:20004");

async function sleep(sleepTime) {
  return new Promise(resolve => setTimeout(resolve, sleepTime));
}

async function TestHybridEncryption() {
  Wallet.RpcClient = rpcClient;
  await sleep(5000);

  // sender key (private key)
  let senderPrivateKeyStr = "112t8rnX7qWSJFCnGBq4YPHYN2D29NmGowC5RSbuDUC8Kg8ywg6GsPda5xRJMAmzmVKwLevdJNi5XfrqHRWDzSGEg37kbsrcWrAEQatR1UQQ";
  let senderKeyWallet = keyWallet.base58CheckDeserialize(senderPrivateKeyStr);
  senderKeyWallet.KeySet.importFromPrivateKey(senderKeyWallet.KeySet.PrivateKey);

  let accountSender = new AccountWallet();
  accountSender.key = senderKeyWallet;


  let publicKeyBytes = senderKeyWallet.KeySet.PaymentAddress.Tk;
  let msg = [1, 2, 3, 4, 5, 6];
  let ciphertext = await hybridEncryption(publicKeyBytes, msg);
  console.log("ciphertext: ", ciphertext);

  let privateKeyBytes = senderKeyWallet.KeySet.ReadonlyKey.Rk;

  let plaintext = await hybridDecryption(privateKeyBytes, ciphertext);
  console.log("plaintext: ", plaintext);
}

TestHybridEncryption()