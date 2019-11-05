import { Wallet, DefaultStorage } from '../../lib/wallet/wallet'
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
  wallet2.init("1", 1, "Wallet", new DefaultStorage())
  // wallet2.Storage = storage
  // await wallet2.loadWallet("12345678")

  wallet2.createNewAccount("Test 2")
  // let privKey = wallet2.exportAccountPrivateKey(0)

  let accounts = wallet2.listAccount();
  console.log("accounts: ", accounts);
  
  let account2 = await wallet2.listAccountWithBLSPubKey();
  console.log("accounts: ", account2);


  wallet2.save("1");
}
// TestInitWallet()

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

  wallet.import(words, "1", 1, "Wallet", new DefaultStorage())

  // wallet2.createNewAccount("Test 2")
  // // let privKey = wallet2.exportAccountPrivateKey(0)

  // let accounts = wallet2.listAccount();
  // console.log("accounts: ", accounts);
  
  // let account2 = await wallet2.listAccountWithBLSPubKey();
  // console.log("accounts: ", account2);
  wallet.save("1");

  console.log("Wallet: ", wallet);
}
TestImportWallet()

async function TestImportAccount(){
  Wallet.RpcClient = rpcClient;

  await sleep(5000);

  let passphrase = "1";
  let wallet = new Wallet();
  wallet.init(passphrase, 1, "Wallet", new DefaultStorage())

  wallet.importAccount("12Ryp47jXJfkz5Cketp4D9U7uTH4hFgFUVUEzq6k5ikvAZ94JucsYbi235siCMud5GdtRi1DoSecsTD2nkiic9TH7YNkLEoEhrvxvwt", "Hien", passphrase);

  console.log("Wallet: ", wallet.MasterAccount.child[1].key);

}

// TestImportAccount()