import {KeyWallet as keyWallet} from "../../lib/wallet/hdwallet";
import {AccountWallet, Wallet} from "../../lib/wallet/wallet";
import {RpcClient} from "../../lib/rpcclient/rpcclient";
import {CustomTokenInit, CustomTokenTransfer} from "../../lib/tx/constants";
import {PaymentAddressType} from "../../lib/wallet/constants";
import {ENCODE_VERSION} from "../../lib/constants";
import {checkEncode} from "../../lib/base58";

// const rpcClient = new RpcClient("https://mainnet.incognito.org/fullnode");
const rpcClient = new RpcClient("https://testnet.incognito.org/fullnode");
// const rpcClient = new RpcClient("http://localhost:9998");
// const rpcClient = new RpcClient("https://dev-test-node.incognito.org");
// const rpcClient = new RpcClient("http://54.39.158.106:9334");

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
      {
        "Privacy": true,
        "TokenID": "51753277b5066ecbacb9bbb822812b88a3c8272c3d6b563a6a52a7d9e192f436",
        "TokenName": "Rose",
        "TokenSymbol": "Rose",
        "TokenTxType": 1,
        "TokenAmount": 100,
        "TokenReceivers": {"PaymentAddress": "", "Amount": 100}
      },
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
  await sleep(10000);

  // sender key (private key)
  let senderPrivateKeyStr = "112t8rnjeorQyyy36Vz5cqtfQNoXuM7M2H92eEvLWimiAtnQCSZiP2HXpMW7mECSRXeRrP8yPwxKGuziBvGVfmxhQJSt2KqHAPZvYmM1ZKwR";
  let senderKeyWallet = keyWallet.base58CheckDeserialize(senderPrivateKeyStr);
  senderKeyWallet.KeySet.importFromPrivateKey(senderKeyWallet.KeySet.PrivateKey);

  let accountSender = new AccountWallet();
  accountSender.key = senderKeyWallet;

  // receiver key (payment address)
  let receiverPaymentAddrStr = "12Rwz4HXkVABgRnSb5Gfu1FaJ7auo3fLNXVGFhxx1dSytxHpWhbkimT1Mv5Z2oCMsssSXTVsapY8QGBZd2J4mPiCTzJAtMyCzb4dDcy";
  // let receiverKeyWallet = keyWallet.base58CheckDeserialize(receiverPaymentAddrStr);
  // let receiverPaymentAddr = receiverKeyWallet.KeySet.PaymentAddress;

  // get balance

  let balance = await accountSender.getBalance();
  console.log("AAA balance: ", balance);

  let fee = 5;
  let isPrivacy = false;
  let info = "";
  let amountTransfer = 1 * 1e9; // in nano PRV

  let paymentInfosParam = [];
  paymentInfosParam[0] = {
    "paymentAddressStr": receiverPaymentAddrStr,
    "amount": amountTransfer,
    // "message": "A mouse is so cute A mouse is so cute A mouse is so cute A mouse is so cute A mouse is so cute A mouse is so cute A mouse is so cute"
  };

  // create and send PRV
  try {
    let res = await accountSender.createAndSendNativeToken(paymentInfosParam, fee, isPrivacy, info, false);
    console.log('Send tx succesfully with TxID: ', res.txId);
  } catch (e) {
    console.log("Error when send PRV: ", e);
  }
  console.log("Send tx 1 done");
}

// TestCreateAndSendNativeToken();

async function TestCreateAndSendPrivacyTokenInit() {
  Wallet.RpcClient = rpcClient;
  await sleep(5000);
  // sender key (private key)
  let senderSpendingKeyStr = "112t8rnjeorQyyy36Vz5cqtfQNoXuM7M2H92eEvLWimiAtnQCSZiP2HXpMW7mECSRXeRrP8yPwxKGuziBvGVfmxhQJSt2KqHAPZvYmM1ZKwR";
  let senderKeyWallet = keyWallet.base58CheckDeserialize(senderSpendingKeyStr);
  senderKeyWallet.KeySet.importFromPrivateKey(senderKeyWallet.KeySet.PrivateKey);
  let senderPaymentAddressStr = senderKeyWallet.base58CheckSerialize(PaymentAddressType);

  let accountSender = new AccountWallet();
  accountSender.key = senderKeyWallet;

  // payment info for PRV
  let paymentInfos = [];

  // prepare token param for tx privacy token init
  let amountInit = 100000;
  let tokenParams = {
    Privacy: true,
    TokenID: "",
    TokenName: "Rose",
    TokenSymbol: "Rose",
    TokenTxType: CustomTokenInit,
    TokenAmount: amountInit,
    TokenReceivers: [{
      PaymentAddress: senderPaymentAddressStr,
      Amount: amountInit
    }]
  }

  let feePRV = 10;
  let feePToken = 0;
  let hasPrivacyForToken = false;
  let hasPrivacyForNativeToken = false;

  try {
    let res = await accountSender.createAndSendPrivacyToken(paymentInfos, tokenParams, feePRV, feePToken, hasPrivacyForNativeToken, hasPrivacyForToken, "");
    console.log('Send tx succesfully with TxID: ', res.txId);
  } catch (e) {
    console.log("Error when initing ptoken: ", e);
  }
}

// TestCreateAndSendPrivacyTokenInit();

async function TestCreateAndSendPrivacyTokenTransfer() {
  Wallet.RpcClient = rpcClient;
  await sleep(5000);
  // sender key (private key)
  let senderSpendingKeyStr = "112t8rnjeorQyyy36Vz5cqtfQNoXuM7M2H92eEvLWimiAtnQCSZiP2HXpMW7mECSRXeRrP8yPwxKGuziBvGVfmxhQJSt2KqHAPZvYmM1ZKwR";
  let senderKeyWallet = keyWallet.base58CheckDeserialize(senderSpendingKeyStr);
  senderKeyWallet.KeySet.importFromPrivateKey(senderKeyWallet.KeySet.PrivateKey);

  let accountSender = new AccountWallet();
  accountSender.key = senderKeyWallet;

  // receivers (payment address)
  let receiverPaymentAddressStr = "12Rwz4HXkVABgRnSb5Gfu1FaJ7auo3fLNXVGFhxx1dSytxHpWhbkimT1Mv5Z2oCMsssSXTVsapY8QGBZd2J4mPiCTzJAtMyCzb4dDcy";
  // let receiverKeyWallet = keyWallet.base58CheckDeserialize(receiverPaymentAddressStr);

  // payment info for PRV
  // let paymentInfos = [{
  //   paymentAddressStr: receiverPaymentAddressStr,
  //   amount: 5,
  //   message: "ABC"
  // }];
  let paymentInfos = [];
  let amountTransfer = 1000;

  // prepare token param for tx custom token init
  let tokenParams = {
    Privacy: true,
    TokenID: "a7668c4648ffdbf3f5e0ec6e324edbaa892da52096af10da6414190712b90d44",
    TokenName: "",
    TokenSymbol: "",
    TokenTxType: CustomTokenTransfer,
    TokenAmount: amountTransfer,
    TokenReceivers: [{
      PaymentAddress: receiverPaymentAddressStr,
      Amount: amountTransfer,
      Message: "ABC"
    }]
  }

  let feePRV = 10;
  let feePToken = 0;
  let hasPrivacyForToken = true;
  let hasPrivacyForPRV = true;

  // try {
    let res =  await accountSender.createAndSendPrivacyToken(paymentInfos, tokenParams, feePRV, feePToken, hasPrivacyForPRV, hasPrivacyForToken, "", true, true);
    console.log('Send tx succesfully with TxID: ', res.txId);
  // } catch (e) {
  //   console.log("Error when transfering ptoken: ", e);
  //   throw e;
  // }

  return;
}

// TestCreateAndSendPrivacyTokenTransfer();


async function TestCreateAndSendStakingTx() {
  Wallet.RpcClient = rpcClient;
  await sleep(5000);
  // staker
  let senderSpendingKeyStr = "112t8rnjeorQyyy36Vz5cqtfQNoXuM7M2H92eEvLWimiAtnQCSZiP2HXpMW7mECSRXeRrP8yPwxKGuziBvGVfmxhQJSt2KqHAPZvYmM1ZKwR";
  let senderKeyWallet = keyWallet.base58CheckDeserialize(senderSpendingKeyStr);
  senderKeyWallet.KeySet.importFromPrivateKey(senderKeyWallet.KeySet.PrivateKey);
  let senderPaymentAddressStr = senderKeyWallet.base58CheckSerialize(PaymentAddressType);

  let accountSender = new AccountWallet();
  accountSender.key = senderKeyWallet;

  let param = {type: 0};
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


async function TestCreateAndSendStopAutoStakingTx() {
  Wallet.RpcClient = rpcClient;
  await sleep(5000);
  // staker
  let senderSpendingKeyStr = "";
  let senderKeyWallet = keyWallet.base58CheckDeserialize(senderSpendingKeyStr);
  senderKeyWallet.KeySet.importFromPrivateKey(senderKeyWallet.KeySet.PrivateKey);
  let senderPaymentAddressStr = senderKeyWallet.base58CheckSerialize(PaymentAddressType);

  let accountSender = new AccountWallet();
  accountSender.key = senderKeyWallet;

  let fee = 5;
  let candidatePaymentAddress = senderPaymentAddressStr;
  let candidateMiningSeedKey = checkEncode(accountSender.key.getMiningSeedKey(), ENCODE_VERSION);

  // create and send staking tx
  try {
    await accountSender.createAndSendStopAutoStakingTx(fee, candidatePaymentAddress, candidateMiningSeedKey);
  } catch (e) {
    console.log("Error when staking: ", e);
  }
}

// TestCreateAndSendStopAutoStakingTx();

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
  let senderPrivateKeyStr = "112t8rnYcipb3f1tZ1nN5H9ekjX5H93pX9zpHNhDZN6UAjkRLSM1nfearhQTBijJufkZSFgRp7y1yvoS38wbG51j6wCX8GL4748Zd4r8u7TG";
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

async function TestGetAllPrivacyTokenBalance() {
  Wallet.RpcClient = rpcClient;
  await sleep(5000);

  // sender key (private key)
  let senderPrivateKeyStr = "112t8rnX7qWSJFCnGBq4YPHYN2D29NmGowC5RSbuDUC8Kg8ywg6GsPda5xRJMAmzmVKwLevdJNi5XfrqHRWDzSGEg37kbsrcWrAEQatR1UQQ";
  let senderKeyWallet = keyWallet.base58CheckDeserialize(senderPrivateKeyStr);
  senderKeyWallet.KeySet.importFromPrivateKey(senderKeyWallet.KeySet.PrivateKey);

  let accountSender = new AccountWallet();
  accountSender.key = senderKeyWallet;

  // create and send PRV
  try {
    let result = await accountSender.getAllPrivacyTokenBalance();
    console.log("result: ", result);
  } catch (e) {
    console.log("Error when get balance: ", e);
  }
}

// TestGetAllPrivacyTokenBalance();


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
  let senderSpendingKeyStr = "112t8rnewVmmbP8poZSRmUvmohTYo2GG5qfmfHhWHZja3tvCLYLWXFwb1LZgFRMN6BA4hXioDqvBUMpajJBiNi7PAmryfAz2eNXiQ1xxvTV7";
  let senderKeyWallet = keyWallet.base58CheckDeserialize(senderSpendingKeyStr);
  senderKeyWallet.KeySet.importFromPrivateKey(senderKeyWallet.KeySet.PrivateKey);
  // let senderPaymentAddressStr = senderKeyWallet.base58CheckSerialize(PaymentAddressType);

  let accountSender = new AccountWallet();
  accountSender.key = senderKeyWallet;

  let fee = 5;
  let sellAmount = 1000000000;
  let tokenIDToBuyStr = "b2655152784e8639fa19521a7035f331eea1f1e911b2f3200a507ebb4554387b";
  let minAcceptableAmount = 4943987;
  let tradingFee = 2500000;

  // create and send staking tx
  try {
    let res = await accountSender.createAndSendNativeTokenTradeRequestTx(
      fee, tokenIDToBuyStr, sellAmount, minAcceptableAmount, tradingFee
    );

    console.log("RES: ", res);

    // replace
    // let newFee = fee *2;
    // let newFeePToken = 0 * 2;

    // let response2 =  await accountSender.replaceTx(res.txId, newFee, newFeePToken);
    // console.log("Send tx 2 done : ", response2);
  } catch (e) {
    console.log("Error when trading native token: ", e);
  }
}

// TestCreateAndSendNativeTokenTradeRequestTx();

async function TestCreateAndSendPTokenTradeRequestTx() {
  Wallet.RpcClient = rpcClient;
  await sleep(5000);
  // staker
  let senderSpendingKeyStr = "";
  let senderKeyWallet = keyWallet.base58CheckDeserialize(senderSpendingKeyStr);
  senderKeyWallet.KeySet.importFromPrivateKey(senderKeyWallet.KeySet.PrivateKey);
  // let senderPaymentAddressStr = senderKeyWallet.base58CheckSerialize(PaymentAddressType);

  let accountSender = new AccountWallet();
  accountSender.key = senderKeyWallet;

  let feePRV = 10;
  let feePToken = 0;
  let sellAmount = 300000000;
  let tokenIDToBuyStr = "0000000000000000000000000000000000000000000000000000000000000004";
  let minAcceptableAmount = 680000000000;
  let tradingFee = 0;

  let tokenParams = {
    Privacy: true,
    TokenID: "716fd1009e2a1669caacc36891e707bfdf02590f96ebd897548e8963c95ebac0",
    TokenName: "",
    TokenSymbol: ""
  }

  // create and send staking tx
  try {
    let res = await accountSender.createAndSendPTokenTradeRequestTx(
      tokenParams, feePRV, feePToken, tokenIDToBuyStr, sellAmount, minAcceptableAmount, tradingFee
    );
    console.log("REs: ", res);

    // replace tx
  //   let newFee = feePRV *2;
  // let newFeePToken = feePToken * 2;
  // let newInfo = "abc";
  // let newMessageForNativeToken = "Incognito-chain";
  // let newMessageForPToken = "Incognito-chain";
  // let isEncryptMessageForPToken = false;
  // let isEncryptMessageForNativeToken = false;

  //   let response2 =  await accountSender.replaceTx(res.txId, newFee, newFeePToken, 
  //     newInfo, newMessageForNativeToken, isEncryptMessageForNativeToken, newMessageForPToken, isEncryptMessageForPToken);
  //   console.log("Send tx 2 done : ", response2);
  } catch (e) {
    console.log("Error when trading native token: ", e);
  }
}

// TestCreateAndSendPTokenTradeRequestTx();


async function GetListReceivedTx() {
  Wallet.RpcClient = rpcClient;
  await sleep(5000);

  let senderSpendingKeyStr = "";
  let senderKeyWallet = keyWallet.base58CheckDeserialize(senderSpendingKeyStr);
  senderKeyWallet.KeySet.importFromPrivateKey(senderKeyWallet.KeySet.PrivateKey);

  let accountSender = new AccountWallet();
  accountSender.key = senderKeyWallet;

  let receivedTxs = await accountSender.getReceivedTransaction();
  console.log(JSON.stringify(receivedTxs, null, 2));
}

// GetListReceivedTx();



/******************************** REPLACE TRANSACTION *********************************/
async function TestReplaceNormalTx() {
  Wallet.RpcClient = rpcClient;
  await sleep(5000);

  // sender key (private key)
  let senderPrivateKeyStr = "112t8rnX7qWSJFCnGBq4YPHYN2D29NmGowC5RSbuDUC8Kg8ywg6GsPda5xRJMAmzmVKwLevdJNi5XfrqHRWDzSGEg37kbsrcWrAEQatR1UQQ";
  let senderKeyWallet = keyWallet.base58CheckDeserialize(senderPrivateKeyStr);
  senderKeyWallet.KeySet.importFromPrivateKey(senderKeyWallet.KeySet.PrivateKey);

  let accountSender = new AccountWallet();
  accountSender.key = senderKeyWallet;

  // receiver key (payment address)
  let receiverPaymentAddrStr = "12S4NL3DZ1KoprFRy1k5DdYSXUq81NtxFKdvUTP3PLqQypWzceL5fBBwXooAsX5s23j7cpb1Za37ddmfSaMpEJDPsnJGZuyWTXJSZZ5";
  // let receiverKeyWallet = keyWallet.base58CheckDeserialize(receiverPaymentAddrStr);
  // let receiverPaymentAddr = receiverKeyWallet.KeySet.PaymentAddress;

  let fee = 5;
  let isPrivacy = true;
  let info = "abc";
  let amountTransfer = 100 * 1e9; // in nano PRV

  let paymentInfosParam = [];
  paymentInfosParam[0] = {
    "paymentAddressStr": receiverPaymentAddrStr,
    "amount": amountTransfer
  };

  // create and send PRV
  let response;
  try {
    response = await accountSender.createAndSendNativeToken(paymentInfosParam, fee, isPrivacy, info);
  } catch (e) {
    console.log("Error when send PRV: ", e);
  }
  console.log("Send tx 1 done: ", response);

  // await sleep(40000);

  // let newFee = fee*2;
  // let newInfo = "test replace tx";
  // let newMessage = "Rose";

  // // replace tx
  // let respone2;
  // try {
  //   respone2 = await accountSender.replaceTx(response.txId, newFee, 0, newInfo, newMessage);
  // } catch (e) {
  //   console.log("Error when replace tx: ", e);
  // }
  // console.log("Send tx 2 done, ", respone2);
}

// TestReplaceNormalTx();

async function TestCreateAndSendReplacePrivacyTokenTransfer() {
  Wallet.RpcClient = rpcClient;
  await sleep(5000);
  // sender key (private key)
  let senderSpendingKeyStr = "112t8rnX7qWSJFCnGBq4YPHYN2D29NmGowC5RSbuDUC8Kg8ywg6GsPda5xRJMAmzmVKwLevdJNi5XfrqHRWDzSGEg37kbsrcWrAEQatR1UQQ";
  let senderKeyWallet = keyWallet.base58CheckDeserialize(senderSpendingKeyStr);
  senderKeyWallet.KeySet.importFromPrivateKey(senderKeyWallet.KeySet.PrivateKey);
  let senderPaymentAddressStr = senderKeyWallet.base58CheckSerialize(PaymentAddressType);


  let accountSender = new AccountWallet();
  accountSender.key = senderKeyWallet;

  // receivers (payment address)
  let receiverPaymentAddressStr = "12Ryp47jXJfkz5Cketp4D9U7uTH4hFgFUVUEzq6k5ikvAZ94JucsYbi235siCMud5GdtRi1DoSecsTD2nkiic9TH7YNkLEoEhrvxvwt";
  // let receiverKeyWallet = keyWallet.base58CheckDeserialize(receiverPaymentAddressStr);

  // payment info for PRV
  let paymentInfos = [{
    paymentAddressStr: receiverPaymentAddressStr,
    amount: 5,
    message: "ABC"
  }];
  // let paymentInfos = [];
  let amountTransfer = 5;
  // prepare token param for tx custom token init
  let tokenParams = {
    Privacy: true,
    TokenID: "6856a8f22c3660d87ee7c5da914e4452ab245c07ecc4c3bae08ab3e0c67f81bd",
    TokenName: "D",
    TokenSymbol: "D",
    TokenTxType: CustomTokenTransfer,
    TokenAmount: amountTransfer,
    TokenReceivers: [{
      PaymentAddress: receiverPaymentAddressStr,
      Amount: amountTransfer,
      Message: "ABC"
    }]
  }

  let feePRV = 5;
  let feePToken = 0;
  let hasPrivacyForToken = true;
  let hasPrivacyForPRV = true;

  // try {
  let response1 =  await accountSender.createAndSendPrivacyToken(paymentInfos, tokenParams, feePRV, feePToken, hasPrivacyForPRV, hasPrivacyForToken, "", true, true);
  console.log("Send tx 1 done : ", response1);
  // } catch (e) {
  //   console.log("Error when transfering ptoken: ", e);
  //   throw e;
  // }

  let newFee = feePRV *2;
  let newFeePToken = feePToken * 2;
  let newInfo = "abc";
  let newMessageForNativeToken = "Incognito-chain";
  let newMessageForPToken = "Incognito-chain";
  let isEncryptMessageForPToken = false;
  let isEncryptMessageForNativeToken = false;

  let response2 =  await accountSender.replaceTx(response1.txId, newFee, newFeePToken, 
    newInfo, newMessageForNativeToken, isEncryptMessageForNativeToken, 
    newMessageForPToken, isEncryptMessageForPToken);
  console.log("Send tx 2 done : ", response2);
}

// TestCreateAndSendReplacePrivacyTokenTransfer();

async function TestGetOutputCoins(){
  Wallet.RpcClient = rpcClient;
  await sleep(5000);
  // sender key (private key)
  let senderSpendingKeyStr = "";
  let senderKeyWallet = keyWallet.base58CheckDeserialize(senderSpendingKeyStr);
  senderKeyWallet.KeySet.importFromPrivateKey(senderKeyWallet.KeySet.PrivateKey);
  // let senderPaymentAddressStr = senderKeyWallet.base58CheckSerialize(PaymentAddressType);


  let accountSender = new AccountWallet();
  accountSender.key = senderKeyWallet;

  let allCoins = await accountSender.getAllOutputCoins(null, Wallet.RpcClient);
  console.log("allCoins: ", allCoins);
}

// TestGetOutputCoins()

