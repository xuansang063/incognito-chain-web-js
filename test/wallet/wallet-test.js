import {Wallet, DefaultStorage} from '../../lib/wallet/wallet'

function Test() {
  let wallet = new Wallet()
  let storage = new DefaultStorage();
  wallet.init("12345678", 0, "Wallet", storage);
  wallet.save("12345678")

  let wallet2 = new Wallet()
  wallet2.Storage = storage
  wallet2.loadWallet("12345678")

  wallet2.createNewAccount("Test 2")
  let privKey = wallet2.exportAccount(0)
  console.log(privKey);
  console.log("End test")
}

Test();


