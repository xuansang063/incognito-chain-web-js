
import { KeyWallet as keyWallet } from "../../lib/wallet/hdwallet";
import { AccountWallet, Wallet } from "../../lib/wallet/wallet";
import { RpcClient } from "../../lib/rpcclient/rpcclient";
import { CustomTokenInit, CustomTokenTransfer } from "../../lib/tx/constants";
import { PaymentAddressType } from "../../lib/wallet/constants";
import {ENCODE_VERSION} from "../../lib/constants";
import {checkEncode} from "../../lib/base58";

// const rpcClient = new RpcClient("https://mainnet.incognito.org/fullnode");
// const rpcClient = new RpcClient("https://test-node.incognito.org");
// const rpcClient = new RpcClient("http://54.39.158.106:20032");
const rpcClient = new RpcClient("http://172.105.115.134:20004");

async function sleep(sleepTime) {
  return new Promise(resolve => setTimeout(resolve, sleepTime));
}


async function TestGetRewardAmount() {
  Wallet.RpcClient = rpcClient;
  await sleep(5000);
  // HN1 change money
  let senderSpendingKeyStr = "112t8rnX7qWSJFCnGBq4YPHYN2D29NmGowC5RSbuDUC8Kg8ywg6GsPda5xRJMAmzmVKwLevdJNi5XfrqHRWDzSGEg37kbsrcWrAEQatR1UQQ";
  let senderKeyWallet = keyWallet.base58CheckDeserialize(senderSpendingKeyStr);
  senderKeyWallet.KeySet.importFromPrivateKey(senderKeyWallet.KeySet.PrivateKey);

  let accountSender = new AccountWallet();
  accountSender.key = senderKeyWallet;

  // get reward amount
  let response0;
  try {
    response0 = await accountSender.getRewardAmount(false, "");
  } catch (e) {
    console.log(e);
  }

  console.log("REsponse getRewardAmount: ", response0);
}

// TestGetRewardAmount();

async function TestCreateAndSendRewardAmountTx() {
  Wallet.RpcClient = rpcClient;
  await sleep(5000);
  // sender key
  let senderSpendingKeyStr = "112t8rnX7qWSJFCnGBq4YPHYN2D29NmGowC5RSbuDUC8Kg8ywg6GsPda5xRJMAmzmVKwLevdJNi5XfrqHRWDzSGEg37kbsrcWrAEQatR1UQQ";
  let senderKeyWallet = keyWallet.base58CheckDeserialize(senderSpendingKeyStr);
  senderKeyWallet.KeySet.importFromPrivateKey(senderKeyWallet.KeySet.PrivateKey);

  let accountSender = new AccountWallet();
  accountSender.key = senderKeyWallet;

  // create and send constant tx
  let response;
  try {
    response = await accountSender.createAndSendWithdrawRewardTx("");
  } catch (e) {
    console.log(e);
  }

  console.log("Response createAndSendWithdrawRewardTx: ", response);
}

// TestCreateAndSendRewardAmountTx();

async function TestBurningRequestTx() {
  Wallet.RpcClient = rpcClient;
  await sleep(5000);
  // sender key
  let senderSpendingKeyStr = "112t8rnX7qWSJFCnGBq4YPHYN2D29NmGowC5RSbuDUC8Kg8ywg6GsPda5xRJMAmzmVKwLevdJNi5XfrqHRWDzSGEg37kbsrcWrAEQatR1UQQ";
  let senderKeyWallet = keyWallet.base58CheckDeserialize(senderSpendingKeyStr);
  senderKeyWallet.KeySet.importFromPrivateKey(senderKeyWallet.KeySet.PrivateKey);

  let accountSender = new AccountWallet();
  accountSender.key = senderKeyWallet;

  // create and send burning request tx
  let response0;
  try {
    response0 = await accountSender.createAndSendBurningRequestTx(
      [],
      { "Privacy": true, "TokenID": "51753277b5066ecbacb9bbb822812b88a3c8272c3d6b563a6a52a7d9e192f436", "TokenName": "Rose", "TokenSymbol": "Rose", "TokenTxType": 1, "TokenAmount": 100, "TokenReceivers": { "PaymentAddress": "", "Amount": 100 } },
      0,
      0,
      "d5808Ba261c91d640a2D4149E8cdb3fD4512efe4",
    );
  } catch (e) {
    console.log(e);
  }

  console.log("Response createAndSendBurningRequestTx: ", response0);
}

// TestBurningRequestTx();

async function TestStakerStatus() {
  Wallet.RpcClient = rpcClient;
  // sender key
  let senderSpendingKeyStr = "112t8rnYZr2s7yMuD8V2VtXxEAWPbRjE4ycQbpuQktKADoJYiKxbCxgefjGQG64YbufDPdbTHxhczS8ucQWcXnp84X74PxSW7Kb2VsaSPZ48";
  let senderKeyWallet = keyWallet.base58CheckDeserialize(senderSpendingKeyStr);
  senderKeyWallet.KeySet.importFromPrivateKey(senderKeyWallet.KeySet.PrivateKey);

  let accountSender = new AccountWallet();
  accountSender.key = senderKeyWallet;

  await sleep(5000);

  // get staker status
  let response0;
  try {
    response0 = await accountSender.stakerStatus();
  } catch (e) {
    console.log(e);
  }

  console.log("REsponse status staker: ", response0);
}

// TestStakerStatus();

async function TestCreateAndSendNativeToken() {
  Wallet.RpcClient = rpcClient;
  await sleep(5000);

  // sender key (private key)
  let senderPrivateKeyStr = "";
  let senderKeyWallet = keyWallet.base58CheckDeserialize(senderPrivateKeyStr);
  senderKeyWallet.KeySet.importFromPrivateKey(senderKeyWallet.KeySet.PrivateKey);

  let accountSender = new AccountWallet();
  accountSender.key = senderKeyWallet;

  // receiver key (payment address)
  let receiverPaymentAddrStr = "12S3PBj1WpsyueZFmspmbeorDJV51JfzYLLLi39mpj5bRFn8vxi2PX898hQeg7Squ9J9n699rcju6t9SyTy92GyF7mownE1qLUnoSE8";
  // let receiverKeyWallet = keyWallet.base58CheckDeserialize(receiverPaymentAddrStr);
  // let receiverPaymentAddr = receiverKeyWallet.KeySet.PaymentAddress;

  let fee = 0.5 * 1e9;
  let isPrivacy = true;
  let info = "";
  let amountTransfer = 100 * 1e9; // in nano PRV

  let paymentInfosParam = [];
  paymentInfosParam[0] = {
    "paymentAddressStr": receiverPaymentAddrStr,
    "amount": amountTransfer
  };

  // create and send PRV
  try {
    await accountSender.createAndSendNativeToken(paymentInfosParam, fee, isPrivacy, info);
  } catch (e) {
    console.log("Error when send PRV: ", e);
  }
  console.log("Send tx 1 done");

  // await sleep(40000);

  // create and send PRV
  // try {
  //   await accountSender.createAndSendNativeToken(paymentInfosParam, fee, isPrivacy, info);
  // } catch (e) {
  //   console.log("Error when send PRV: ", e);
  // }
  // console.log("Send tx 2 done");
}

// TestCreateAndSendNativeToken();

async function TestCreateAndSendPrivacyTokenInit() {
  Wallet.RpcClient = rpcClient;
  await sleep(5000);
  // sender key (private key)
  let senderSpendingKeyStr = "112t8rnX7qWSJFCnGBq4YPHYN2D29NmGowC5RSbuDUC8Kg8ywg6GsPda5xRJMAmzmVKwLevdJNi5XfrqHRWDzSGEg37kbsrcWrAEQatR1UQQ";
  let senderKeyWallet = keyWallet.base58CheckDeserialize(senderSpendingKeyStr);
  senderKeyWallet.KeySet.importFromPrivateKey(senderKeyWallet.KeySet.PrivateKey);
  let senderPaymentAddressStr = senderKeyWallet.base58CheckSerialize(PaymentAddressType);

  let accountSender = new AccountWallet();
  accountSender.key = senderKeyWallet;

  // payment info for PRV
  let paymentInfos = [];

  // prepare token param for tx privacy token init
  let amountInit = 1000;
  let tokenParams = {
    Privacy: true,
    TokenID: "",
    TokenName: "Rose",
    TokenSymbol: "Rose",
    TokenTxType: CustomTokenInit,
    TokenAmount: amountInit,
    TokenReceivers: {
      PaymentAddress: senderPaymentAddressStr,
      Amount: amountInit
    }
  }

  let feePRV = 0;
  let feePToken = 0;
  let hasPrivacyForToken = false;
  let hasPrivacyForNativeToken = false;

  try {
    await accountSender.createAndSendPrivacyToken(paymentInfos, tokenParams, feePRV, feePToken, hasPrivacyForNativeToken, hasPrivacyForToken, "");
  } catch (e) {
    console.log("Error when initing ptoken: ", e);
  }
}

// tokenID: 51753277b5066ecbacb9bbb822812b88a3c8272c3d6b563a6a52a7d9e192f436 Rose
// txID: f0f0b918eb159928635ec12540afee68a21f4a4ca8b1954486c9858a2a68d8f5

// TestCreateAndSendPrivacyTokenInit();

async function TestCreateAndSendPrivacyTokenTransfer() {
  Wallet.RpcClient = rpcClient;
  await sleep(5000);
  // sender key (private key)
  let senderSpendingKeyStr = "112t8rnX7qWSJFCnGBq4YPHYN2D29NmGowC5RSbuDUC8Kg8ywg6GsPda5xRJMAmzmVKwLevdJNi5XfrqHRWDzSGEg37kbsrcWrAEQatR1UQQ";
  let senderKeyWallet = keyWallet.base58CheckDeserialize(senderSpendingKeyStr);
  senderKeyWallet.KeySet.importFromPrivateKey(senderKeyWallet.KeySet.PrivateKey);

  let accountSender = new AccountWallet();
  accountSender.key = senderKeyWallet;

  // receivers (payment address)
  let receiverPaymentAddressStr = "12RwVaYc4PtbPqvsoMMjuL8SGcKe75pp8Kh94yDVz92YU9hwhkVzsYcT3D49k5ykjJjeH6umqwrjr6bQg3rLeik3TbjDG2RwFXyKbPn";
  // let receiverKeyWallet = keyWallet.base58CheckDeserialize(receiverPaymentAddressStr);

  // payment info for PRV
  let paymentInfos = [];
  let amountTransfer = 10;

  // prepare token param for tx custom token init
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

  let feePRV = 0;
  let feePToken = 5;
  let hasPrivacyForToken = true;
  let hasPrivacyForPRV = false;

  // try {
    await accountSender.createAndSendPrivacyToken(paymentInfos, tokenParams, feePRV, feePToken, hasPrivacyForPRV, hasPrivacyForToken, "");
  // } catch (e) {
  //   console.log("Error when transfering ptoken: ", e);
  //   throw e;
  // }
}

// TestCreateAndSendPrivacyTokenTransfer();


async function TestCreateAndSendStakingTx() {
  Wallet.RpcClient = rpcClient;
  await sleep(5000);
  // staker
  let senderSpendingKeyStr = "112t8rnh9vKeWh8n7JoSoVfhP42zzqyhcrETuHo5V5r9J7GtjwT2hXGjSTGHBc2KF7fxh93iyea3fe3xR1QVEB41qS7eXj7LYsiW2jSqjbPd";
  let senderKeyWallet = keyWallet.base58CheckDeserialize(senderSpendingKeyStr);
  senderKeyWallet.KeySet.importFromPrivateKey(senderKeyWallet.KeySet.PrivateKey);
  let senderPaymentAddressStr = senderKeyWallet.base58CheckSerialize(PaymentAddressType);

  let accountSender = new AccountWallet();
  accountSender.key = senderKeyWallet;

  let param = { type: 0 };
  let fee = 30;
  let candidatePaymentAddress = senderPaymentAddressStr;
  // let candidateMiningSeedKey = "12VH5z8JCn9B8SyHvB3aYP4ZGr1Wf9Rywx2ZSBe3eQneADzJ3bL";
  let rewardReceiverPaymentAddress = senderPaymentAddressStr;
  let autoReStaking = true;

  let candidateMiningSeedKey = checkEncode(accountSender.key.getMiningSeedKey(), ENCODE_VERSION);

  // create and send staking tx
  try {
    await accountSender.createAndSendStakingTx(param, fee, candidatePaymentAddress, candidateMiningSeedKey, rewardReceiverPaymentAddress, autoReStaking);
  } catch (e) {
    console.log("Error when staking: ", e);
  }
}

// TestCreateAndSendStakingTx();

async function TestDefragment() {
  Wallet.RpcClient = rpcClient;
  // sender
  let senderSpendingKeyStr = "112t8rnXgFuVb4pfnqh9wkwrAZZRp7WHQVtnHnxBNkaHimBoL42DvsFVLisDqXiTZpnKFAZahQsCaoWdEQ9s77FFPzRey6H9CS7JeC6ipgoB";
  let senderKeyWallet = keyWallet.base58CheckDeserialize(senderSpendingKeyStr);
  senderKeyWallet.KeySet.importFromPrivateKey(senderKeyWallet.KeySet.PrivateKey);

  let accountSender = new AccountWallet();
  accountSender.key = senderKeyWallet;

  // create and send defragment tx
  let response;
  try {
    response = await accountSender.defragment(100, 2, true);
  } catch (e) {
    console.log(e);
  }

  console.log("REsponse defragment: ", response);
}

// TestDefragment();


async function TestGetBalance() {
  Wallet.RpcClient = rpcClient;
  await sleep(5000);

  // sender key (private key)
  let senderPrivateKeyStr = "112t8rqFtYxrQ18ae52tQrCj7kr5HUhL1RXoq2JvTeaJNEcXgQys8B48KFFDFdHsK3CRuiwmmjuPMstkfowfHYHWZG46Pofmo8wKuKH7domP";
  let senderKeyWallet = keyWallet.base58CheckDeserialize(senderPrivateKeyStr);
  senderKeyWallet.KeySet.importFromPrivateKey(senderKeyWallet.KeySet.PrivateKey);

  let accountSender = new AccountWallet();
  accountSender.key = senderKeyWallet;

  let tokenID = "4cd7d5c072a888cc1998049e68d0a3e7df51ab3d41755536e7863f98f04b45db";

  // create and send PRV
  try {
    let balance = await accountSender.getBalance(null);
    console.log("balance: ", balance);
  } catch (e) {
    console.log("Error when get balance: ", e);
  }
}

// TestGetBalance();



/************************* DEX **************************/

async function TestCreateAndSendPRVContributionTx() {
  Wallet.RpcClient = rpcClient;
  await sleep(5000);
  // staker
  let senderSpendingKeyStr = "112t8rnX7qWSJFCnGBq4YPHYN2D29NmGowC5RSbuDUC8Kg8ywg6GsPda5xRJMAmzmVKwLevdJNi5XfrqHRWDzSGEg37kbsrcWrAEQatR1UQQ";
  let senderKeyWallet = keyWallet.base58CheckDeserialize(senderSpendingKeyStr);
  senderKeyWallet.KeySet.importFromPrivateKey(senderKeyWallet.KeySet.PrivateKey);
  // let senderPaymentAddressStr = senderKeyWallet.base58CheckSerialize(PaymentAddressType);

  let accountSender = new AccountWallet();
  accountSender.key = senderKeyWallet;

  let fee = 1500000;
  let pdeContributionPairID = "123";
  // let contributorAddressStr = senderPaymentAddressStr;
  let contributedAmount = 100;

  // create and send staking tx
  try {
    await accountSender.createAndSendTxWithNativeTokenContribution(
      fee, pdeContributionPairID, contributedAmount
    );
  } catch (e) {
    console.log("Error when staking: ", e);
  }
}

// TestCreateAndSendPRVContributionTx();

// async function TestCreateAndSendPRVContributionTx() {
//   Wallet.RpcClient = rpcClient;
//   await sleep(5000);
//   // staker
//   let senderSpendingKeyStr = "112t8rnX7qWSJFCnGBq4YPHYN2D29NmGowC5RSbuDUC8Kg8ywg6GsPda5xRJMAmzmVKwLevdJNi5XfrqHRWDzSGEg37kbsrcWrAEQatR1UQQ";
//   let senderKeyWallet = keyWallet.base58CheckDeserialize(senderSpendingKeyStr);
//   senderKeyWallet.KeySet.importFromPrivateKey(senderKeyWallet.KeySet.PrivateKey);
//   // let senderPaymentAddressStr = senderKeyWallet.base58CheckSerialize(PaymentAddressType);

//   let accountSender = new AccountWallet();
//   accountSender.key = senderKeyWallet;

//   let feeNativeToken = 1500000;
//   let pdeContributionPairID = "123";
//   let contributedAmount = 100;

//   let tokenParam = {
//     TokenID: "51753277b5066ecbacb9bbb822812b88a3c8272c3d6b563a6a52a7d9e192f436",
//     TokenName: "Rose",
//     TokenSymbol: "Rose"
//   }

//   // create and send staking tx
//   try {
//     await accountSender.createAndSendPTokenContributionTx(
//       tokenParam, feeNativeToken, pdeContributionPairID, contributedAmount
//     );
//   } catch (e) {
//     console.log("Error when staking: ", e);
//   }
// }

async function TestCreateAndSendNativeTokenTradeRequestTx() {
  Wallet.RpcClient = rpcClient;
  await sleep(5000);
  // staker
  let senderSpendingKeyStr = "112t8rnX7qWSJFCnGBq4YPHYN2D29NmGowC5RSbuDUC8Kg8ywg6GsPda5xRJMAmzmVKwLevdJNi5XfrqHRWDzSGEg37kbsrcWrAEQatR1UQQ";
  let senderKeyWallet = keyWallet.base58CheckDeserialize(senderSpendingKeyStr);
  senderKeyWallet.KeySet.importFromPrivateKey(senderKeyWallet.KeySet.PrivateKey);
  // let senderPaymentAddressStr = senderKeyWallet.base58CheckSerialize(PaymentAddressType);

  let accountSender = new AccountWallet();
  accountSender.key = senderKeyWallet;

  let fee = 1500000;
  let sellAmount = 1;
  let tokenIDToBuyStr = "5b10f8579937a34ff5d01cf23bbf6b90bcba793c67193d6edb99f6eb7679dcac";

  // create and send staking tx
  try {
    await accountSender.createAndSendNativeTokenTradeRequestTx(
      fee, tokenIDToBuyStr, sellAmount
    );
  } catch (e) {
    console.log("Error when staking: ", e);
  }
}

// TestCreateAndSendNativeTokenTradeRequestTx();


async function TestSendRawTx() {
  Wallet.RpcClient = rpcClient;
  await sleep(5000);

  let txInJson = `{
    "Fee": 18446744073709552000,
    "Info": "",
    "LockTime": 1572503084,
    "Metadata": {
        "SellAmount": 20000000000,
        "TokenIDToBuyStr": "e111605a8d2d300de9a323fc314c50fa3412047c2cef85be0ddfb7deb8c3885d",
        "TokenIDToSellStr": "0000000000000000000000000000000000000000000000000000000000000004",
        "TraderAddressStr": "12RxDkxyDdPFUAiE9Fhq8BnqrFvRe9YcTGEd8JwYrWkwK4cD2JX2QPG7MKuhUbp13vgB7Tpsvmf85BLr4AvGPaXVF3FuHGt2bdM7spG",
        "Type": 91
    },
    "Proof": "AAABwMn1BI01HGNRoFK9SKf3nFg10kVi4N9gaBHGyin/W6q3ecHoiCOVm/VGO8lkNEdopa0FuG+F5b/RziN35jFzc9DSLlYQK0bnZddo3IFY1IUrxtYiEinCg5H/TOecRI3VAYHwCCQAm9yzZKnlve6d+pN9OuFgV50qi1JozBmn8PDUcmWVfiRC05K+oQNuhnLWYIklR5qZ4sg4pJAHAGiwANwy3rMjXrqHagvHCZIPxZLQGAW9037gzcu0xVNb7QK7CQAAAawgecHoiCOVm/VGO8lkNEdopa0FuG+F5b/RziN35jFzc9AgfJi42/Y17XgO015gAryjTDc3gROL2AAiJikVGaZmbmog0i5WECtG52XXaNyBWNSFK8bWIhIpwoOR/0znnESN1QEgyfUEjTUcY1GgUr1Ip/ecWDXSRWLg32BoEcbKKf9bqrcgiLxNpA3k1kTTzXhL/xi27YfjQTid2FnRk+mpkLL9Tw8FF0h259gAAo4AjCBjt/ahRKzk3pkJrCfQ9adPCwJyQfFFVSjBaMdPRgQ1ACAlHfyXiHMXOaHtMJg9PRL7ZcJu81e0JZ+ok+C7uP23byD69QlsF3mSLa92CvstBZGBZUBPsOqYmFmIcGum7u2bDAAg9beWBaFpf6SLzSrxapQjaC5Vm1LSg/eie33Oln0q2AcFBKgXyAAAjgCMIHnB6IgjlZv1RjvJZDRHaKWtBbhvheW/0c4jd+Yxc3PQIP92RVLQNJFiGj0FAIvJpp5xCSJNCe3ivJ0Ex9PaAfyuIBM1MnLtB7yxNXu5eFFQ/P2obE51qq21rp1SNW4pDXsHACAi39A+xXNp5YfXvH4mgj4jZf2iHn2hwf7+sH1t+y1mCgUSoF8f2QAAAAAAAAAA",
    "PubKeyLastByteSender": 208,
    "Sig": "MS1D+OQuJPTrmIzrSI89fvvcwIVO+k2fx1q1r4ykRADBRoQL1Bw/1DCTQMC3Bb1PsVDsfKCxthHiLHyPZn+uCQ==",
    "SigPubKey": "ecHoiCOVm/VGO8lkNEdopa0FuG+F5b/RziN35jFzc9A=",
    "Type": "n",
    "Version": 1
}`;

let res;
try {
  res = await Wallet.RpcClient.sendRawTx2(txInJson);
} catch(e){
  console.log("Error: ", e);
}
  
  console.log("res: ", res);
}

TestSendRawTx();
