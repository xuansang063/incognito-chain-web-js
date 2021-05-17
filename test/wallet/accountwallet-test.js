const {
  Wallet,
  Account: AccountWallet,
  types,
  constants,
  utils,
  init,
} = require("../../");
const { KeyWallet, RpcClient } = types;
const { PaymentAddressType, PRVIDSTR, ENCODE_VERSION, PrivacyVersion } =
  constants;
const { base58CheckEncode: checkEncode } = utils;

// const rpcClient = new RpcClient("https://mainnet.incognito.org/fullnode");
// const rpcClient = new RpcClient("https://testnet.incognito.org/fullnode");
// const rpcClient = new RpcClient("http://localhost:9334");
// const rpcClient = new RpcClient("https://dev-test-node.incognito.org");
// const rpcClient = new RpcClient("http://54.39.158.106:9334");
// const rpcClient = new RpcClient("http://139.162.55.124:8334");   // dev-net
const rpcClient = "http://139.162.55.124:8334";
const rpcCoinService = "http://51.161.119.66:9009"; //dev-test-coin-service
const privacyVersion = 2;

let wallet;
let senderPrivateKeyStr;
let senderKeyWallet;
let accountSender;
let senderPaymentAddressStr;
let receiverPaymentAddrStr;
let receiverPaymentAddrStr2;

let tokenID, secondTokenID;
async function setup() {
  await init();
  tokenID = "";
  secondTokenID =
    "46107357c32ffbb04d063cf8a08749cba83546a67e299fb9ffcc2a9955df4736";
  // await sleep(10000);
  wallet = new Wallet();
  // senderPrivateKeyStr =
  //   "1139jtfTYJysjtddB4gFs6n3iW8YiDeFKWcKyufRmsb2fsDssj3BWCYXSmNtTR277MqQgHeiXpTWGit9r9mBUJfoyob5besrF9AW9HpLC4Nf";
  senderPrivateKeyStr =
    "112t8rns2sxbuHFAAhtMksGhK9S1mFcyiGpKypzJuXJSmHZE8d4SqM3XNSy6i9QacqTeVmrneuEmNzF1kcwAvvf6d137PVJun1qnsxKr1gW6";
  accountSender = new AccountWallet(Wallet);
  accountSender.setRPCCoinServices(rpcCoinService);
  accountSender.setPrivacyVersion(privacyVersion);
  accountSender.setRPCClient(rpcClient);
  await accountSender.setKey(senderPrivateKeyStr);
  senderPaymentAddressStr =
    accountSender.key.base58CheckSerialize(PaymentAddressType);
  // await accountSender.submitKeyAndSync([PRVIDSTR, tokenID, secondTokenID]);
  receiverPaymentAddrStr =
    "12shR6fDe7ZcprYn6rjLwiLcL7oJRiek66ozzYu3B3rBxYXkqJeZYj6ZWeYy4qR4UHgaztdGYQ9TgHEueRXN7VExNRGB5t4auo3jTgXVBiLJmnTL5LzqmTXezhwmQvyrRjCbED5xVWf4ETHbRCSP";
  receiverPaymentAddrStr2 =
    "12sm28usKxzw8HuwGiEojZZLWgvDinAkmZ3NvBNRQLuPrf5LXNLXVXiu4VBCMVDrDm97qjLrgFck3P36UTSWfqNX1PBP9PBD78Cpa95em8vcnjQrnwDNi8EdkdkSA6CWcs4oFatQYze7ETHAUBKH";
}
async function TestGetBalance() {
  await setup();
  // create and send PRV
  try {
    const key = await accountSender.getDeserializeInformation();
    console.log("key", key);
    let balance = await accountSender.getBalance();
    console.log("balance: ", balance.toString());
  } catch (e) {
    console.log("Error when get balance: ", e);
  }
}
async function TestGetAllPrivacyTokenBalance() {
  await setup();
  // create and send PRV
  try {
    let result = await accountSender.getAllPrivacyTokenBalance();
    console.log("result: ", result);
  } catch (e) {
    console.log("Error when get balance: ", e);
  }
}
async function TestGetRewardAmount() {
  await setup();
  // get reward amount
  let response0;
  try {
    response0 = await accountSender.getRewardAmount(false, "");
  } catch (e) {
    console.log(e);
  }
  console.log("Response getRewardAmount: ", response0);
}
async function TestCreateAndSendRewardAmountTx() {
  await setup();

  let fee = 10;
  let response;
  try {
    response = await accountSender.createAndSendWithdrawRewardTx({
      transfer: { fee },
    });
    console.log("Response createAndSendWithdrawRewardTx: ", response);
    return response.Response.txId;
  } catch (e) {
    console.log(e);
    throw e;
  }
}
async function TestBurningRequestTx() {
  await setup();

  let fee = 20;
  // create and send burning request tx
  let response;
  try {
    response = await accountSender.createAndSendBurningRequestTx({
      transfer: { fee, tokenID },
      extra: {
        remoteAddress: "d5808Ba261c91d640a2D4149E8cdb3fD4512efe4",
        burnAmount: 100,
      },
    });
    console.log("Response createAndSendBurningRequestTx: ", response);
    return response.Response.txId;
  } catch (e) {
    // this tx specifically depends on bridge config, so we let it skip and review manually
    console.error(e);
    // throw e;
  }
}
async function TestStakerStatus() {
  // sender key
  await setup();

  // get staker status
  let response0;
  try {
    response0 = await accountSender.stakerStatus();
  } catch (e) {
    console.log(e);
  }

  console.log("Response status staker: ", response0);
}
async function TestCreateAndSendNativeToken() {
  await setup();
  let fee = 100;
  let info = "INFOFO";
  let amountTransfer = 1e9; // in nano PRV
  console.log("Will Transfer: ", amountTransfer);
  let paymentInfosParam = [];
  paymentInfosParam[0] = {
    PaymentAddress: receiverPaymentAddrStr,
    Amount: amountTransfer,
    Message: "ABC",
  };
  // create and send PRV
  try {
    let res = await accountSender.createAndSendNativeToken({
      transfer: { prvPayments: paymentInfosParam, fee, info },
      extra: { isEncryptMessage: true, txType: 0 },
    });
    console.log("Send tx succesfully with TxID: ", res.Response.txId);
    return res.Response.txId;
  } catch (e) {
    console.log("Error when send PRV: ", e);
    throw e;
  }
}
async function TestSendMultiple() {
  await setup();

  let info = "";

  const receivers = [
    "12shR6fDe7ZcprYn6rjLwiLcL7oJRiek66ozzYu3B3rBxYXkqJeZYj6ZWeYy4qR4UHgaztdGYQ9TgHEueRXN7VExNRGB5t4auo3jTgXVBiLJmnTL5LzqmTXezhwmQvyrRjCbED5xVWf4ETHbRCSP",
    "12sm28usKxzw8HuwGiEojZZLWgvDinAkmZ3NvBNRQLuPrf5LXNLXVXiu4VBCMVDrDm97qjLrgFck3P36UTSWfqNX1PBP9PBD78Cpa95em8vcnjQrnwDNi8EdkdkSA6CWcs4oFatQYze7ETHAUBKH",
  ];
  const amount = 1 * 1e9;
  const paymentInfos = receivers.map((item) => ({
    PaymentAddress: item,
    Amount: amount,
  }));
  try {
    const res = await accountSender.createAndSendNativeToken({
      transfer: { prvPayments: paymentInfos, fee: 100, info },
    });
    console.log("Send tx succesfully with TxID: ", res.Response.txId);
    return res.Response.txId;
  } catch (e) {
    console.log("error:", e);
    throw e;
  }
}
async function TestCreateAndSendConversion() {
  await setup();
  let fee = 100;
  let info = "";
  console.log("Will convert all PRV");

  let paymentInfosParam = [];

  // create and send PRV
  try {
    let res = await accountSender.createAndSendConvertTx({
      transfer: { prvPayments: paymentInfosParam, fee, info },
      extra: { isEncryptMessage: true },
    });
    console.log("Send tx succesfully with TxID: ", res.Response.txId);
    return res.Response.txId;
  } catch (e) {
    console.log("Error when send PRV: ", e);
    throw e;
  }
}
async function TestCreateAndSendTokenConversion() {
  await setup();
  let fee = 100;
  let info = "";
  // use the global var tokenID instead
  // let tokenID = "89eddbfac0e6c4827f378c4c453c9011c2b78e50cc54479d70914c505946d526";
  console.log("Will convert all coins of token", tokenID);

  // PRV for fee, token for convert. So no payment info needed
  let paymentInfo = [];
  let tokenPaymentInfo = [];

  // create and send PRV
  try {
    let res = await accountSender.createAndSendTokenConvertTx({
      transfer: {
        tokenID,
        prvPayments: paymentInfo,
        tokenPayments: tokenPaymentInfo,
        fee,
        info,
      },
      extra: { isEncryptMessageToken: true },
    });
    console.log("Send tx succesfully with TxID: ", res.Response.txId);
    return res.Response.txId;
  } catch (e) {
    console.log("Error when send PRV: ", e);
    throw e;
  }
}

async function TestCreateAndSendPrivacyTokenInit() {
  await setup();
  // payment info for PRV
  let paymentInfos = [];
  // prepare token param for tx privacy token init
  let amountInit = 10000;
  let tokenParams = {
    TokenID: "",
    TokenName: "Rose1",
    TokenSymbol: "RSE",
    TokenTxType: CustomTokenInit,
    Amount: amountInit,
  };
  let tokenPaymentInfo = [
    {
      PaymentAddress: senderPaymentAddressStr,
      Amount: amountInit,
      Message: "Your token",
    },
  ];

  let feePRV = 50;

  try {
    let res = await accountSender.newToken({
      transfer: { tokenPayments: tokenPaymentInfo, fee: feePRV },
      extra: {
        tokenName: tokenParams.TokenName,
        tokenSymbol: tokenParams.TokenSymbol,
      },
    });
    console.log("Send tx succesfully with TxID: ", res.Response.txId);
    console.log("Waiting for new token balance to update");
    const change = await accountSender.waitBalanceChange(res.TokenID);
    console.log(change);
    return {
      tokenID: res.TokenID,
      Response: res.Response,
    };
  } catch (e) {
    console.log("Error when initing ptoken: ", e);
    throw e;
  }
}

async function TestCreateAndSendPrivacyTokenTransfer() {
  await setup();
  let paymentInfos = [];
  let amountTransfer = 69;
  // prepare token param for tx custom token init
  let tokenPaymentInfo = [
    {
      PaymentAddress: receiverPaymentAddrStr,
      Amount: amountTransfer,
      Message: "Transfer ptoken",
    },
  ];
  let feePRV = 10;
  let hasPrivacy = true;
  await accountSender.resetProgressTx();
  try {
    let res = await accountSender.createAndSendPrivacyToken({
      transfer: {
        tokenID,
        prvPayments: paymentInfos,
        tokenPayments: tokenPaymentInfo,
        fee: feePRV,
        info: "SOME INFO WHEN TRANSFERRING TOKEN",
      },
    });
    console.log("Send tx succesfully with TxID: ", res);
    return res.Response.txId;
  } catch (e) {
    console.log("Error when transferring ptoken: ", e);
    throw e;
  }
}

async function TestMultipleSendPrivacyToken() {
  await setup();

  let paymentInfos = [];
  let amountTransfer = 100;

  // prepare token param for tx custom token init
  let tokenPaymentInfo = [
    {
      PaymentAddress: receiverPaymentAddrStr,
      Amount: amountTransfer,
      Message: "Transfer ptoken",
    },
    {
      PaymentAddress: receiverPaymentAddrStr2,
      Amount: amountTransfer,
      Message: "Transfer ptoken 2",
    },
  ];

  let feePRV = 10;

  try {
    let res = await accountSender.createAndSendPrivacyToken({
      transfer: {
        tokenID,
        prvPayments: paymentInfos,
        tokenPayments: tokenPaymentInfo,
        fee: feePRV,
      },
    });
    console.log("Send tx succesfully with TxID: ", res.Response.txId);
    return res.Response.txId;
  } catch (e) {
    console.log("Error when transferring ptoken: ", e);
    throw e;
  }
}
async function TestCreateAndSendStakingTx() {
  await setup();

  let param = {
    type: 0,
  };
  let fee = 30;
  let candidatePaymentAddress = senderPaymentAddressStr;
  // let candidateMiningSeedKey = "12VH5z8JCn9B8SyHvB3aYP4ZGr1Wf9Rywx2ZSBe3eQneADzJ3bL";
  let rewardReceiverPaymentAddress = senderPaymentAddressStr;
  let autoReStaking = true;

  let candidateMiningSeedKey = checkEncode(
    accountSender.key.getMiningSeedKey(),
    ENCODE_VERSION
  );

  // create and send staking tx
  try {
    let response = await accountSender.createAndSendStakingTx({
      transfer: { fee },
      extra: {
        candidatePaymentAddress,
        candidateMiningSeedKey,
        rewardReceiverPaymentAddress,
        autoReStaking,
        stakingType: param.type,
      },
    });
    return response.Response.txId;
  } catch (e) {
    console.log("Error when staking: ", e);
    throw e;
  }
}
async function TestCreateAndSendStopAutoStakingTx() {
  await setup();
  let fee = 5;
  let candidatePaymentAddress = senderPaymentAddressStr;
  let candidateMiningSeedKey = checkEncode(
    accountSender.key.getMiningSeedKey(),
    ENCODE_VERSION
  );

  // create and send staking tx
  try {
    let response = await accountSender.createAndSendStopAutoStakingTx({
      transfer: { fee },
      extra: { candidatePaymentAddress, candidateMiningSeedKey },
    });
    return response.Response.txId;
  } catch (e) {
    console.log("Error when staking: ", e);
    throw e;
  }
}
async function TestDefragment() {
  await setup();
  // create and send defragment tx
  let response;
  try {
    response = await accountSender.defragmentNativeCoin({
      transfer: { fee: 100 },
    });
  } catch (e) {
    console.log(e);
    throw e;
  }

  console.log("Response defragment: ", response);
}
async function TestMakeFragments() {
  await setup();
  const senders = [
    "112t8rnZDRztVgPjbYQiXS7mJgaTzn66NvHD7Vus2SrhSAY611AzADsPFzKjKQCKWTgbkgYrCPo9atvSMoCf9KT23Sc7Js9RKhzbNJkxpJU6",
  ];

  let utxos = 0;
  // the address of our testing Account; it will receive a lot of 'fragments'
  const receiver =
    "12sxXUjkMJZHz6diDB6yYnSjyYcDYiT5QygUYFsUbGUqK8PH8uhxf4LePiAE8UYoDcNkHAdJJtT1J6T8hcvpZoWLHAp8g6h1BQEfp4h5LQgEPuhMpnVMquvr1xXZZueLhTNCXc8fkVXseeVAGCt8";

  const amountTransfer = 200;
  let paymentInfos = new Array(30);
  paymentInfos.fill({
    PaymentAddress: receiver,
    Amount: amountTransfer,
  });

  while (utxos < 150) {
    for (const sender of senders) {
      let accountSender = new AccountWallet(Wallet);
      await accountSender.setKey(sender);

      // create and send PRV
      let res = await accountSender.createAndSendNativeToken({
        transfer: { prvPayments: paymentInfos, fee: 100, info: "Fragment" },
      });
      console.log("Send tx succesfully with TxID: ", res.Response.txId);
      await accountSender.waitTx(res.Response.txId, 3);
    }

    utxos += paymentInfos.length * senders.length;
    console.log("NEW UTXOs", utxos);
  }
}
/************************* DEX **************************/

async function TestCustomContribution(
  pdeContributionPairID,
  contributingTokenID,
  contributedAmount
) {
  await setup();
  let fee = 50;
  // let pdeContributionPairID = "123";
  // let contributedAmount = 1000000;

  try {
    let response = await accountSender.createAndSendTxWithContribution({
      transfer: { fee, tokenID: contributingTokenID },
      extra: { pairID: pdeContributionPairID, contributedAmount },
    });
    return response.Response.txId;
  } catch (e) {
    console.log("Error when staking: ", e);
    throw e;
  }
}
async function TestCustomTradeRequest() {
  // tokenIDToSellStr,
  // tokenIDToBuyStr,
  // sellAmount,
  // minAcceptableAmount
  await setup();
  let fee = 100;
  let tradingFee = 1000;
  let sellAmount = 1e9;
  let minAcceptableAmount = 100;
  // let tokenIDToSellStr = tokenID;
  // let tokenIDToBuyStr = null;
  // create and send staking tx
  const tokenIDToBuy =
    "b49af494a0703d9bd7366dfc29ec2c270efd4c3fb210a91081b419a4e356e22e";
  const tokenIDToSell =
    "0000000000000000000000000000000000000000000000000000000000000004";
  try {
    let res = await accountSender.createAndSendTradeRequestTx({
      transfer: { fee },
      extra: {
        tokenIDToBuy,
        sellAmount,
        minAcceptableAmount,
        tradingFee,
        tokenIDToSell,
      },
    });
    return res;
    console.log("RESPONSE: ", res);
  } catch (e) {
    console.log("Error when trading native token: ", e);
    throw e;
  }
}

async function TestCreateAndSendPDEWithdrawTx() {
  await setup();
  let fee = 10;
  let withdrawShareAmount = 500;
  let tokenID1 = null;
  let tokenID2 = tokenID;

  try {
    let res = await accountSender.createAndSendWithdrawDexTx({
      transfer: { fee },
      extra: {
        tokenIDs: [tokenID1, tokenID2],
        withdrawalShareAmt: withdrawShareAmount,
      },
    });
    return res.Response.txId;
  } catch (e) {
    console.log("Error when withdrawing pdex: ", e);
    throw e;
  }
}
async function TestGetOutputCoins() {
  await setup();
  // get all PRV coins from both versions (including spent coins)
  let allCoins = await accountSender.fetchOutputCoins(null, -1);
  console.log("allCoins: ", allCoins);
}

async function GetListReceivedTx() {
  await setup();
  try {
    let receivedTxs = await accountSender.getReceivedTransaction();
    console.log(receivedTxs);
  } catch (e) {
    throw e;
  }
}

async function GetUnspentCoinV1() {
  await setup();
  try {
    accountSender.useCoinsService = true;
    await accountSender.getAllUnspentCoinsV1();
  } catch (e) {
    throw e;
  }
}

async function TestCreateAndSendConvertTx() {
  let fee = 100;
  let info = "";
  console.log("Will convert all PRV");
  let paymentInfosParam = [];

  // create and send PRV
  try {
    let res = await accountSender.createAndSendConvertTx({
      transfer: { prvPayments: paymentInfosParam, fee, info },
      extra: { isEncryptMessage: true },
    });
    // console.log("Send tx succesfully with TxID: ", res.Response.txId);
    // return res.Response.txId;
  } catch (e) {
    console.log("Error when send PRV: ", e);
    throw e;
  }
}
async function ConvertAllToken() {
  await setup();
  try {
    accountSender.useCoinsService = true;
    await accountSender.convertAllToken();
  } catch (e) {
    throw e;
  }
}

// to run this test flow, make sure the Account has enough PRV to stake & some 10000 of this token; both are version 1
// tokenID = "084bf6ea0ad2e54a04a8e78c15081376dbdfc2ef2ce6d151ebe16dc59eae4a47";
async function MainRoutine() {
  console.log("BEGIN WEB WALLET TEST");
  // sequential execution of tests; the wait might still be too short
  try {
    // return await ConvertAllToken();
    // return await TestGetBalance();
    // let txh;
    // txh = await TestCustomTradeRequest(null, tokenID, 10000, 800);
    // console.log(txh);
    // return;
    return await TestGetBalance();
    // return await TestCreateAndSendNativeToken();
    // await TestCreateAndSendPrivacyTokenTransfer();
    // await GetUnspentCoinV1();
    // await TestCreateAndSendConvertTx();
    await TestGetAllPrivacyTokenBalance();
    txh = await TestCreateAndSendConversion();
    await accountSender.waitTx(txh, 5);
    txh = await TestCreateAndSendNativeToken();
    await accountSender.waitTx(txh, 5);

    // txh = await TestCreateAndSendStakingTx();
    // await accountSender.waitTx(txh, 5);
    await GetListReceivedTx();
    await TestStakerStatus();
    await accountSender.waitTx(txh, 10);
    txh = await TestCreateAndSendTokenConversion();
    await accountSender.waitTx(txh, 5);
    // txh = await TestCreateAndSendStopAutoStakingTx();
    // await accountSender.waitTx(txh, 5);
    // deprecated init-token method
    // let temp = await TestCreateAndSendPrivacyTokenInit();
    // await accountSender.waitTx(temp.Response.txId, 5);
    txh = await TestSendMultiple();
    await accountSender.waitTx(txh, 5);
    // burning will return an error since this is not a bridge token
    txh = await TestBurningRequestTx();
    if (txh) {
      await accountSender.waitTx(txh, 5);
    }
    txh = await TestCreateAndSendPrivacyTokenTransfer();
    await accountSender.waitTx(txh, 5);

    // tokenID = temp.tokenID;
    // console.log("New token", temp.tokenID);
    // txh = await TestCreateAndSendPrivacyTokenTransfer();
    await accountSender.waitTx(txh, 5);
    await TestGetOutputCoins();
  } catch (e) {
    console.log("Test failed");
    console.error(e);
    throw e;
  }
  console.log("END WEB WALLET TEST");
}
MainRoutine();

// to run this test flow, make sure the Account has about 2.5mil PRV, 120k of each of FIRST and SECOND token; all version 2
async function PDERoutine() {
  console.log("BEGIN PDE TEST");
  try {
    let txh;
    // // 10:1 ratio; contribute 1mil PRV and 100k token
    txh = await TestCustomContribution("first-prv", null, 1000000);
    // console.debug(txh);
    await accountSender.waitTx(txh, 5);
    txh = await TestCustomContribution("first-prv", tokenID, 100000);
    await accountSender.waitTx(txh, 5);
    // sell 10000 PRV for at least 800 token
    txh = await TestCustomTradeRequest(null, tokenID, 10000, 800);
    await accountSender.waitTx(txh, 5);
    // sell 1000 token for at least 8000 PRV
    txh = await TestCustomTradeRequest(tokenID, null, 1000, 8000);
    // the final wait time is extended to accomodate beacon response delay
    await accountSender.waitTx(txh, 15);

    // to cross trade, we need the above pair and a new second-prv pair
    // also 10:1 ratio
    txh = await TestCustomContribution("second-prv", null, 1000000);
    await accountSender.waitTx(txh, 5);
    txh = await TestCustomContribution("second-prv", secondTokenID, 100000);
    await accountSender.waitTx(txh, 5);
    // sell 15000 FIRST for at least 14000 SECOND
    txh = await TestCustomTradeRequest(tokenID, secondTokenID, 15000, 10000);
    await accountSender.waitTx(txh, 5);
    // sell 5000 SECOND for at least 4000 PRV
    txh = await TestCustomTradeRequest(secondTokenID, tokenID, 5000, 3000);
    await accountSender.waitTx(txh, 15);

    // withdraw some from the first pair
    txh = await TestCreateAndSendPDEWithdrawTx();
    await accountSender.waitTx(txh, 5);
    // deprecated test flows
    // await TestCreateAndSendPRVContributionTx();
    // await wallet.sleep(10000);
    // await TestCreateAndSendPTokenContributionTx();
    // await wallet.sleep(30000);
    // await TestCreateAndSendNativeTokenTradeRequestTx();
    // await wallet.sleep(30000);
    // await TestCreateAndSendPTokenTradeRequestTx();
    // await wallet.sleep(100000);

    console.log("Remember to check the balance of these accounts");
  } catch (e) {
    console.log("Test failed");
    console.error(e);
    throw e;
  }
  console.log("END PDE TEST");
}
// PDERoutine();

// to use this test flow, make sure acc1 has some 10000s in PRV in version 2 coins
async function DefragmentRoutine() {
  console.log("BEGIN DEFRAG TEST");
  try {
    await TestMakeFragments();
    // await wallet.sleep(20000);
    await TestDefragment();
  } catch (e) {
    console.log("Test failed");
    console.error(e);
    throw e;
  }
  console.log("END DEFRAG TEST");
}
// DefragmentRoutine()

module.exports = {
  MainRoutine,
  PDERoutine,
  DefragmentRoutine,
};
