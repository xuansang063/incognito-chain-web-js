
import { KeyWallet as keyWallet } from "../../lib/wallet/hdwallet";
import { AccountWallet, Wallet } from "../../lib/wallet/wallet";
import { RpcClient } from "../../lib/rpcclient/rpcclient";
import { CustomTokenInit, CustomTokenTransfer } from "../../lib/tx/constants";
import { PaymentAddressType } from "../../lib/wallet/constants";

const rpcClient = new RpcClient("https://dev-test-node.incognito.org");
// const rpcClient = new RpcClient("http://localhost:9334");

async function sleep(sleepTime) {
  return new Promise(resolve => setTimeout(resolve, sleepTime));
}

async function TestGetRewardAmount() {
  Wallet.RpcClient = rpcClient;
  // HN1 change money
  let senderSpendingKeyStr = "112t8rnXgFuVb4pfnqh9wkwrAZZRp7WHQVtnHnxBNkaHimBoL42DvsFVLisDqXiTZpnKFAZahQsCaoWdEQ9s77FFPzRey6H9CS7JeC6ipgoB";
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
  // sender key
  let senderSpendingKeyStr = "112t8rnZ8iwXxHCW1ERzvVWxzhXDFNePExNWWfqSoBnhaemft7KYfpW7M79Jk8SbhDnSWP5ZeQnwKB2Usg1vvLosZoLJeBt36He1iDv5iFYg";
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
  // sender key
  let senderSpendingKeyStr = "112t8rqJHgJp2TPpNpLNx34aWHB5VH5Pys3hVjjhhf9tctVeCNmX2zQLBqzHau6LpUbSV52kXtG2hRZsuYWkXWF5kw2v24RJq791fWmQxVqy";
  let senderKeyWallet = keyWallet.base58CheckDeserialize(senderSpendingKeyStr);
  senderKeyWallet.KeySet.importFromPrivateKey(senderKeyWallet.KeySet.PrivateKey);

  let accountSender = new AccountWallet();
  accountSender.key = senderKeyWallet;

  // create and send burning request tx
  let response0;
  try {
    response0 = await accountSender.createAndSendBurningRequestTx(
      [],
      { "Privacy": true, "TokenID": "96c63625c29d146fedca606dd64ab86e561c5ca0e691d21bd66448e5a80b03d9", "TokenName": "Phuong", "TokenSymbol": "pHPV", "TokenTxType": 1, "TokenAmount": 100000000, "TokenReceivers": { "PaymentAddress": "", "Amount": 100000000 } },
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
  let senderPrivateKeyStr = "112t8rnX7qWSJFCnGBq4YPHYN2D29NmGowC5RSbuDUC8Kg8ywg6GsPda5xRJMAmzmVKwLevdJNi5XfrqHRWDzSGEg37kbsrcWrAEQatR1UQQ";
  let senderKeyWallet = keyWallet.base58CheckDeserialize(senderPrivateKeyStr);
  senderKeyWallet.KeySet.importFromPrivateKey(senderKeyWallet.KeySet.PrivateKey);

  let accountSender = new AccountWallet();
  accountSender.key = senderKeyWallet;

  // receiver key (payment address)
  let receiverPaymentAddrStr = "12RwVaYc4PtbPqvsoMMjuL8SGcKe75pp8Kh94yDVz92YU9hwhkVzsYcT3D49k5ykjJjeH6umqwrjr6bQg3rLeik3TbjDG2RwFXyKbPn";
  // let receiverKeyWallet = keyWallet.base58CheckDeserialize(receiverPaymentAddrStr);
  // let receiverPaymentAddr = receiverKeyWallet.KeySet.PaymentAddress;

  let fee = 0.5 * 1e9;
  let isPrivacy = true;
  let info = "";
  let amountTransfer = 0.5 * 1e9; // in nano PRV

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

//tokenID : 8d96b28046157d2b293925410638783a34ccab12969e0402e8f34b0d0cff57eb
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
    TokenID: "4cd7d5c072a888cc1998049e68d0a3e7df51ab3d41755536e7863f98f04b45db",
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
  let hasPrivacyForPRV = true;

  try {
    await accountSender.createAndSendPrivacyToken(paymentInfos, tokenParams, feePRV, feePToken, hasPrivacyForPRV, hasPrivacyForToken, "");
  } catch (e) {
    console.log("Error when transfering ptoken: ", e);
  }
}

// TestCreateAndSendPrivacyTokenTransfer();


async function TestCreateAndSendStakingTx() {
  Wallet.RpcClient = rpcClient;
  // staker
  let senderSpendingKeyStr = "112t8rnXgFuVb4pfnqh9wkwrAZZRp7WHQVtnHnxBNkaHimBoL42DvsFVLisDqXiTZpnKFAZahQsCaoWdEQ9s77FFPzRey6H9CS7JeC6ipgoB";
  let senderKeyWallet = keyWallet.base58CheckDeserialize(senderSpendingKeyStr);
  senderKeyWallet.KeySet.importFromPrivateKey(senderKeyWallet.KeySet.PrivateKey);
  let senderPaymentAddressStr = senderKeyWallet.base58CheckSerialize(PaymentAddressType);

  let accountSender = new AccountWallet();
  accountSender.key = senderKeyWallet;

  let param = { type: 0 };
  let fee = 1;
  let candidatePaymentAddress = senderPaymentAddressStr;
  let candidateMiningSeedKey = "12nV4WFAjMCYue9ShY6qoQ9bVNiJ95xXMq2eau3rMHHFTiwdjxT";
  let rewardReceiverPaymentAddress = senderPaymentAddressStr;
  let autoReStaking = false;

  await sleep(5000);

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
  let senderPrivateKeyStr = "112t8rnX7qWSJFCnGBq4YPHYN2D29NmGowC5RSbuDUC8Kg8ywg6GsPda5xRJMAmzmVKwLevdJNi5XfrqHRWDzSGEg37kbsrcWrAEQatR1UQQ";
  let senderKeyWallet = keyWallet.base58CheckDeserialize(senderPrivateKeyStr);
  senderKeyWallet.KeySet.importFromPrivateKey(senderKeyWallet.KeySet.PrivateKey);

  let accountSender = new AccountWallet();
  accountSender.key = senderKeyWallet;

  // receiver key (payment address)
  // let receiverPaymentAddrStr = "12RwVaYc4PtbPqvsoMMjuL8SGcKe75pp8Kh94yDVz92YU9hwhkVzsYcT3D49k5ykjJjeH6umqwrjr6bQg3rLeik3TbjDG2RwFXyKbPn";
  // let receiverKeyWallet = keyWallet.base58CheckDeserialize(receiverPaymentAddrStr);
  // let receiverPaymentAddr = receiverKeyWallet.KeySet.PaymentAddress;

  // let fee = 0.5 * 1e9;
  // let isPrivacy = true;
  // let info = "";
  // let amountTransfer = 1 * 1e9; // in nano PRV

  // let paymentInfosParam = [];
  // paymentInfosParam[0] = {
  //   "paymentAddressStr": receiverPaymentAddrStr,
  //   "amount": amountTransfer
  // };

  let tokenID = "4cd7d5c072a888cc1998049e68d0a3e7df51ab3d41755536e7863f98f04b45db";

  // create and send PRV
  try {
    let balance = await accountSender.getBalance(tokenID);
    console.log("balance: ", balance);
  } catch (e) {
    console.log("Error when get balance: ", e);
  }
}

// TestGetBalance();
