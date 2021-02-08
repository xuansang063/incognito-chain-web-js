import { Wallet } from '../../lib/wallet/wallet'
import { KeyWallet as keyWallet } from "../../lib/wallet/hdwallet";
import { AccountWallet } from "../../lib/wallet/accountWallet";
import { RpcClient } from "../../lib/rpcclient/rpcclient";

Wallet.RpcClient = new RpcClient("https://mainnet.incognito.org/fullnode");
// Wallet.RpcClient = new RpcClient("https://test-node.incognito.org");
// Wallet.RpcClient = new RpcClient("http://51.83.36.184:20001");

async function sleep(sleepTime) {
  return new Promise(resolve => setTimeout(resolve, sleepTime));
}

async function Defragment() {
  // load file sendRewardsToOneAddress.json to get fromAddress and toAddress
  let jsonString = fs.readFileSync('./test/txfordev/defragment.json');

  let data = JSON.parse(jsonString);
  console.log("Data from Json file: ", data);

  let fromAddressList = data.fromAddress;

  await sleep(5000);

  let feePRV = 200;      // nano PRV

  for (let i = 0; i < fromAddressList.length; i++) {
    // set private key of sender
    let senderPrivateKeyStr = fromAddressList[i];
    let senderKeyWallet = keyWallet.base58CheckDeserialize(senderPrivateKeyStr);
    await senderKeyWallet.KeySet.importFromPrivateKey(senderKeyWallet.KeySet.PrivateKey);

    let accountSender = new AccountWallet();
    accountSender.key = senderKeyWallet;
    try {
      const responses = await accountSender.defragmentNativeCoin(feePRV);
      console.log("Defragment successful account index", i, " - List TxID: ", responses.map(res => res.txId));
    } catch(e) {
      console.log(e);
    }
  }
}

Defragment();
