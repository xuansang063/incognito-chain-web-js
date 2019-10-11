import { KeyWallet as keyWallet } from "../../lib/wallet/hdwallet";
import { AccountWallet, Wallet } from "../../lib/wallet/wallet";
import { RpcClient } from "../../lib/rpcclient/rpcclient";
import { CustomTokenTransfer, CustomTokenInit } from "../../lib/tx/constants";
import { getEstimateFee, getEstimateFeeForPToken, getMaxWithdrawAmount } from "../../lib/tx/utils";

const rpcClient = new RpcClient("https://dev-test-node.incognito.org");
// const rpcClient = new RpcClient("http://localhost:9334");

async function sleep(sleepTime) {
  return new Promise(resolve => setTimeout(resolve, sleepTime));
}

async function TestGetEstimateFee() {
  Wallet.RpcClient = rpcClient;
  await sleep(5000);
  // sender key (private key)
  let senderPrivateKeyStr = "112t8rnX7qWSJFCnGBq4YPHYN2D29NmGowC5RSbuDUC8Kg8ywg6GsPda5xRJMAmzmVKwLevdJNi5XfrqHRWDzSGEg37kbsrcWrAEQatR1UQQ";
  let senderKeyWallet = keyWallet.base58CheckDeserialize(senderPrivateKeyStr);
  senderKeyWallet.KeySet.importFromPrivateKey(senderKeyWallet.KeySet.PrivateKey);

  let accountSender = new AccountWallet();
  accountSender.key = senderKeyWallet;

  let from = "12S4NL3DZ1KoprFRy1k5DdYSXUq81NtxFKdvUTP3PLqQypWzceL5fBBwXooAsX5s23j7cpb1Za37ddmfSaMpEJDPsnJGZuyWTXJSZZ5";
  let to = "12Ryp47jXJfkz5Cketp4D9U7uTH4hFgFUVUEzq6k5ikvAZ94JucsYbi235siCMud5GdtRi1DoSecsTD2nkiic9TH7YNkLEoEhrvxvwt";
  let amount = 1000000000;
  let isPrivacy = true;
  // customTokenParams = null, privacyTokenParams = null, isGetTokenFee = false
  let fee = await getEstimateFee(from, to, amount, accountSender, isPrivacy, false, rpcClient);
  console.log("fee: ", fee);
}

// TestGetEstimateFee();

async function TestGetEstimateFeeForPToken() {
  Wallet.RpcClient = rpcClient;
  await sleep(5000);
  // sender key (private key)
  let senderPrivateKeyStr = "112t8rnX7qWSJFCnGBq4YPHYN2D29NmGowC5RSbuDUC8Kg8ywg6GsPda5xRJMAmzmVKwLevdJNi5XfrqHRWDzSGEg37kbsrcWrAEQatR1UQQ";
  let senderKeyWallet = keyWallet.base58CheckDeserialize(senderPrivateKeyStr);
  senderKeyWallet.KeySet.importFromPrivateKey(senderKeyWallet.KeySet.PrivateKey);

  let accountSender = new AccountWallet();
  accountSender.key = senderKeyWallet;

  console.log("accountSender: ", accountSender);
  console.log("accountSender.key: ", accountSender.key);

  let from = "12S4NL3DZ1KoprFRy1k5DdYSXUq81NtxFKdvUTP3PLqQypWzceL5fBBwXooAsX5s23j7cpb1Za37ddmfSaMpEJDPsnJGZuyWTXJSZZ5";
  let to = "12Ryp47jXJfkz5Cketp4D9U7uTH4hFgFUVUEzq6k5ikvAZ94JucsYbi235siCMud5GdtRi1DoSecsTD2nkiic9TH7YNkLEoEhrvxvwt";
  let amountTransfer = 100;
  let isPrivacyForPToken = true;
  let feeToken = 0;

  //Todo: check with isGetTokenFee = true
  let isGetTokenFee = true;

  let tokenParams = {
    Privacy: true,
    TokenID: "7ff6af1d9e92a572365ffc48a815e2b5cc6ea7d19ad5460df3986ab309439289",
    TokenName: "Rose 2",
    TokenSymbol: "Rose 2",
    TokenTxType: CustomTokenTransfer,
    TokenAmount: amountTransfer,
    TokenReceivers: {
      PaymentAddress: to,
      Amount: amountTransfer
    }
  }

  // customTokenParams = null, privacyTokenParams = null, isGetTokenFee = false
  let fee = await getEstimateFeeForPToken(from, to, amountTransfer, tokenParams, accountSender, rpcClient,false , isPrivacyForPToken, feeToken, isGetTokenFee);
  console.log("fee: ", fee);
}

// TestGetEstimateFeeForPToken();

async function TestGetEstimateFeeForPTokenInit() {
  Wallet.RpcClient = rpcClient;
  await sleep(5000);
  // sender key (private key)
  let senderPrivateKeyStr = "112t8rnX7qWSJFCnGBq4YPHYN2D29NmGowC5RSbuDUC8Kg8ywg6GsPda5xRJMAmzmVKwLevdJNi5XfrqHRWDzSGEg37kbsrcWrAEQatR1UQQ";
  let senderKeyWallet = keyWallet.base58CheckDeserialize(senderPrivateKeyStr);
  senderKeyWallet.KeySet.importFromPrivateKey(senderKeyWallet.KeySet.PrivateKey);

  let accountSender = new AccountWallet();
  accountSender.key = senderKeyWallet;

  console.log("accountSender: ", accountSender);
  console.log("accountSender.key: ", accountSender.key);

  let from = "12S4NL3DZ1KoprFRy1k5DdYSXUq81NtxFKdvUTP3PLqQypWzceL5fBBwXooAsX5s23j7cpb1Za37ddmfSaMpEJDPsnJGZuyWTXJSZZ5";
  let to = "12Ryp47jXJfkz5Cketp4D9U7uTH4hFgFUVUEzq6k5ikvAZ94JucsYbi235siCMud5GdtRi1DoSecsTD2nkiic9TH7YNkLEoEhrvxvwt";
  let amountTransfer = 1000;
  let isPrivacyForPToken = true;
  let feeToken = 0;

  //Todo: check with isGetTokenFee = true
  let isGetTokenFee = true;

  let tokenParams = {
    Privacy: true,
    TokenID: "",
    TokenName: "Rose",
    TokenSymbol: "Rose",
    TokenTxType: CustomTokenInit,
    TokenAmount: amountTransfer,
    TokenReceivers: {
      PaymentAddress: to,
      Amount: amountTransfer
    }
  }

  // customTokenParams = null, privacyTokenParams = null, isGetTokenFee = false
  let fee = await getEstimateFeeForPToken(from, from, amountTransfer, tokenParams, accountSender, rpcClient,false , isPrivacyForPToken, feeToken, isGetTokenFee);
  console.log("fee: ", fee);
}

TestGetEstimateFeeForPTokenInit();

async function TestGetMaxWithdrawAmount() {
  Wallet.RpcClient = rpcClient;
  await sleep(5000);
  // sender key (private key)
  let senderPrivateKeyStr = "112t8rnX7qWSJFCnGBq4YPHYN2D29NmGowC5RSbuDUC8Kg8ywg6GsPda5xRJMAmzmVKwLevdJNi5XfrqHRWDzSGEg37kbsrcWrAEQatR1UQQ";
  let senderKeyWallet = keyWallet.base58CheckDeserialize(senderPrivateKeyStr);
  senderKeyWallet.KeySet.importFromPrivateKey(senderKeyWallet.KeySet.PrivateKey);

  let accountSender = new AccountWallet();
  accountSender.key = senderKeyWallet;

  console.log("accountSender: ", accountSender);
  console.log("accountSender.key: ", accountSender.key);

  let from = "12S4NL3DZ1KoprFRy1k5DdYSXUq81NtxFKdvUTP3PLqQypWzceL5fBBwXooAsX5s23j7cpb1Za37ddmfSaMpEJDPsnJGZuyWTXJSZZ5";
  let to = "12Ryp47jXJfkz5Cketp4D9U7uTH4hFgFUVUEzq6k5ikvAZ94JucsYbi235siCMud5GdtRi1DoSecsTD2nkiic9TH7YNkLEoEhrvxvwt";
  let amountTransfer = 100;
  let isPrivacyForPToken = true;

  //Todo: check with isGetTokenFee = true
  let isGetTokenFee = true;

  let tokenParams = {
    Privacy: true,
    TokenID: "7ff6af1d9e92a572365ffc48a815e2b5cc6ea7d19ad5460df3986ab309439289",
    TokenName: "Rose 2",
    TokenSymbol: "Rose 2",
    TokenTxType: CustomTokenTransfer,
    TokenAmount: amountTransfer,
    TokenReceivers: {
      PaymentAddress: to,
      Amount: amountTransfer
    }
  }

  // customTokenParams = null, privacyTokenParams = null, isGetTokenFee = false
  let result = await getMaxWithdrawAmount(from, to, tokenParams, accountSender, rpcClient, isPrivacyForPToken);
  console.log("result: ", result);
}

// TestGetMaxWithdrawAmount();