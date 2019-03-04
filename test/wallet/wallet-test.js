import {Wallet, DefaultStorage} from '../../lib/wallet/wallet'
import {KeyWallet as keyWallet} from "../../lib/wallet/hdwallet";
import * as key from "../../lib/key";
import bn from 'bn.js';

async function Test() {
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

Test()

async function TestWallet() {
  let storage = new DefaultStorage();
  let priK = "112t8rqGc71CqjrDCuReGkphJ4uWHJmiaV7rVczqNhc33pzChmJRvikZNc3Dt5V7quhdzjWW9Z4BrB2BxdK5VtHzsG9JZdZ5M7yYYGidKKZV";
  let wallet = new Wallet();
  wallet.init("12345678", 0, "Wallet", storage);
  wallet.importAccount(priK, "Dat", "12345678");
  let n = 1;
  let paymentInfos = new Array(n);

  //HN2
  let receiverSpendingKeyStr1 = "112t8rqnMrtPkJ4YWzXfG82pd9vCe2jvWGxqwniPM5y4hnimki6LcVNfXxN911ViJS8arTozjH4rTpfaGo5i1KKcG1ayjiMsa4E3nABGAqQh";
  let receiverKeyWallet1 = keyWallet.base58CheckDeserialize(receiverSpendingKeyStr1);
  // import key set
  receiverKeyWallet1.KeySet.importFromPrivateKey(receiverKeyWallet1.KeySet.PrivateKey);
  paymentInfos[0] = new key.PaymentInfo(receiverKeyWallet1.KeySet.PaymentAddress, new bn(2300));
  wallet.MasterAccount.child[1].createAndSendConstant(paymentInfos);
  let balance = await wallet.MasterAccount.child[1].getBalance();
  console.log(balance)
}

// TestWallet();


