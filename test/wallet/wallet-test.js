import {Wallet, DefaultStorage} from '../../lib/wallet/wallet'

async function Test() {
  // let ID  = "1AF5782F86BDA63F884C7D8F872FF135A6F567FC0932DA3A675ECB2DD344DA40";
  // let tokenBalance = await wallet.getCustomTokenBalance(priK,ID);
  // console.log(tokenBalance);
  //
  //
  // let wallet2 = new Wallet()
  // let privateKey = '112t8rqGc71CqjrDCuReGkphJ4uWHJmiaV7rVczqNhc33pzChmJRvikZNc3Dt5V7quhdzjWW9Z4BrB2BxdK5VtHzsG9JZdZ5M7yYYGidKKZV'
  // let balance = await wallet2.getBalance(privateKey);
  // console.log(balance);
  // console.log(privKey);
  // let balance = await  wallet.getBalance()
  // console.log(balance);

  // wallet.save("12345678")
  //
  // let wallet2 = new Wallet()
  // wallet2.Storage = storage
  // wallet2.loadWallet("12345678")
  //
  // wallet2.createNewAccount("Test 2")
  // let privKey = wallet2.exportAccount(0)
  // console.log(privKey);
  // console.log("End test")
}

async function TestWallet() {
  let storage = new DefaultStorage();
  let priK = "112t8rqGc71CqjrDCuReGkphJ4uWHJmiaV7rVczqNhc33pzChmJRvikZNc3Dt5V7quhdzjWW9Z4BrB2BxdK5VtHzsG9JZdZ5M7yYYGidKKZV";
  let wallet = new Wallet();
  wallet.init("12345678", 0, "Wallet", storage);
  wallet.importAccount(priK, "Dat", "12345678");
  let balance = await wallet.MasterAccount.child[1].getBalance();
  console.log(balance)
}

TestWallet();


