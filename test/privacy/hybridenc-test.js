import { hybridEncryption, hybridDecryption } from "../../lib/privacy/hybridEncryption";
import {RpcClient} from "../../lib/rpcclient/rpcclient";

import { KeyWallet as keyWallet } from "../../lib/wallet/hdwallet";
import { AccountWallet, Wallet } from "../../lib/wallet/wallet";
import { base64Decode } from "../../lib/privacy/utils";
 
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
  let senderPrivateKeyStr = "112t8rnaWQbUWmdGZW2LtF2dzBFVfWBBzH3xviG7TWvwCVNZ3tPygcTKK8kv4jzYQwHo3BDZvERWJHL9Kp9AhAMtG4my9GoARtXDxTUyWSRD";
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


  // test case 2: 
  let ciphertextEncoded = "3ZFYQsVwPl6Bw648vdgbsnns73orkchJcC/lNEFOfiZRhneFRfE91dpFICLA7OM8rX1lEmsMaywhSAQ3W23IWfumCGFe5t0OEnA/hv7oDWbw7RV+JzwCojLdu+TiXQ==";
  let ciphertextBytes = base64Decode(ciphertextEncoded);
  let plaintext2 = await hybridDecryption(privateKeyBytes, ciphertextBytes);
  console.log("plaintext2: ", plaintext2);
}

TestHybridEncryption()