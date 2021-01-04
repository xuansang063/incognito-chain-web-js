import { Wallet, DefaultStorage, getShardIDFromLastByte } from '../../lib/wallet/wallet'
import { RpcClient } from "../../lib/rpcclient/rpcclient";

const rpcClient = new RpcClient("https://test-node.incognito.org");
async function sleep(sleepTime) {
  return new Promise(resolve => setTimeout(resolve, sleepTime));
}


async function TestInitWallet() {
  Wallet.RpcClient = rpcClient;

  await sleep(5000);
  // let wallet = new Wallet()
  // let storage = new DefaultStorage();
  // wallet.init("12345678", 0, "Wallet", storage);
  // wallet.save("12345678")

  let wallet2 = new Wallet()
  wallet2.init("1", new DefaultStorage(), 1, "Wallet");
  // wallet2.Storage = storage
  // await wallet2.loadWallet("12345678")

  await wallet2.createNewAccount("Test 2");
  // let privKey = wallet2.exportAccountPrivateKey(0)
  let accounts = wallet2.listAccount();
  console.log("accounts: ", accounts);
  
  let account2 = await wallet2.listAccountWithBLSPubKey();
  console.log("accounts: ", account2);


  wallet2.save("1");
}
TestInitWallet();

async function TestImportWallet() {
  Wallet.RpcClient = rpcClient;

  await sleep(5000);

  let wallet = new Wallet();

  let words = [
    "ability",
    "able",
    "about",
    "above",
    "absent",
    "absorb",
    "abstract",
    "absurd",
    "abuse",
    "access",
    "accident",
    "account"
  ];
  console.log("typeof words: ", typeof words);

  words = words.join(" ");

  await wallet.import(words, "1", 3, "Wallet", new DefaultStorage(), 3);

  // wallet2.createNewAccount("Test 2")
  // // let privKey = wallet2.exportAccountPrivateKey(0)

  // let accounts = wallet2.listAccount();
  // console.log("accounts: ", accounts);
  
  // let account2 = await wallet2.listAccountWithBLSPubKey();
  // console.log("accounts: ", account2);
  wallet.save("1");

  console.log("Wallet: ", wallet);
  let childs = wallet.MasterAccount.child;
  for (let i=0; i<childs.length; i++){
    let pk = childs[i].key.KeySet.PaymentAddress.Pk;
    console.log("Last byte: ", getShardIDFromLastByte(pk[pk.length -1]));
  }
}
TestImportWallet();

async function TestImportAccount(){
  Wallet.RpcClient = rpcClient;

  await sleep(5000);

  let passphrase = "1";
  let wallet = new Wallet();
  wallet.init(passphrase, new DefaultStorage(), 1, "Wallet");

  await wallet.importAccount("112t8rnbcZ92v5omVfbXf1gu7j7S1xxr2eppxitbHfjAMHWdLLBjBcQSv1X1cKjarJLffrPGwBhqZzBvEeA9PhtKeM8ALWiWjhUzN5Fi6WVC", "Hien", passphrase);
  await wallet.createNewAccount("FIRST ACCOUNT");
  console.log("Wallet: ", wallet.MasterAccount.child[1].key);

}

TestImportAccount();