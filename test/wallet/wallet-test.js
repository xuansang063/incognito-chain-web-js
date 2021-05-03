const { Wallet, Transactor : AccountWallet, types, constants, utils } = require('../../');
const { RpcClient, DefaultStorage } = types;
const { getShardIDFromLastByte } = utils;
// const rpcClient = new RpcClient("http://test-node.incognito.org");

async function TestInitWallet() {
  // let wallet = new Wallet()
  // let storage = new DefaultStorage();
  // wallet.init("12345678", 0, "Wallet", storage);
  // wallet.save("12345678")

  let wallet2 = new Wallet()
  await wallet2.init("1", new DefaultStorage(), 1, "Wallet")
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

async function TestImportWallet() {
  let wallet = new Wallet();

  let words = 'bronze shop similar cannon diesel argue timber upon flash fancy lawn avocado';
  console.log("typeof words: ", typeof words);
  await wallet.import(words, "1", "Wallet", new DefaultStorage());

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

async function TestImportAccount(){
  let passphrase = "1";
  let wallet = new Wallet();
  await wallet.init(passphrase, new DefaultStorage(), 1, "Wallet")

  await wallet.importAccount("112t8rne7fpTVvSgZcSgyFV23FYEv3sbRRJZzPscRcTo8DsdZwstgn6UyHbnKHmyLJrSkvF13fzkZ4e8YD5A2wg8jzUZx6Yscdr4NuUUQDAt", "Hien", passphrase);

  console.log("Wallet: ", wallet.MasterAccount.child[1].key);

}

module.exports = {
  TestInitWallet,
  TestImportWallet,
  TestImportAccount
}