import { KeyWallet as keyWallet } from "../../lib/wallet/hdwallet";
import { AccountWallet, Wallet } from "../../lib/wallet/wallet";
import { RpcClient } from "../../lib/rpcclient/rpcclient";
import { CustomTokenInit, CustomTokenTransfer } from "../../lib/tx/constants";
import { PaymentAddressType } from "../../lib/wallet/constants";
import {getEstimateFee, getEstimateFeeForSendingToken} from "../../lib/tx/utils";

const rpcClient = new RpcClient("https://dev-test-node.incognito.org");
// const rpcClient = new RpcClient("http://localhost:9334");

async function sleep(sleepTime) {
  return new Promise(resolve => setTimeout(resolve, sleepTime));
}

async function TestGetEstimateFee(){
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
    let fee = await getEstimateFee(from, to, amount, accountSender, isPrivacy, rpcClient);
    console.log("fee: ", fee);
}

TestGetEstimateFee();

async function TestGetEstimateFeeForSendingToken(){
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
  let amountTransfer = 100;
  let isPrivacyForPToken = true;
  let feeToken = 0;

  let tokenParams = {
    Privacy: true,
    TokenID: "51753277b5066ecbacb9bbb822812b88a3c8272c3d6b563a6a52a7d9e192f436",
    TokenName: "Rose",
    TokenSymbol: "Rose",
    TokenTxType: CustomTokenTransfer,
    TokenAmount: amountTransfer,
    TokenReceivers: {
      PaymentAddress: receiverPaymentAddressStr,
      Amount: amountTransfer
    }
  }

  // customTokenParams = null, privacyTokenParams = null, isGetTokenFee = false
  let fee = await getEstimateFeeForSendingToken(from, to, amount, tokenParams, senderPrivateKeyStr, accountSender, rpcClient, isPrivacyForPToken, feeToken);
  console.log("fee: ", fee);
}

TestGetEstimateFeeForSendingToken();