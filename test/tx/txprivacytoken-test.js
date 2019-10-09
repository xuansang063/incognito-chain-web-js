import {KeyWallet as keyWallet} from "../../lib/wallet/hdwallet";
import bn from 'bn.js';
import {RpcClient} from "../../lib/rpcclient/rpcclient";
import {TxCustomTokenPrivacy} from "../../lib/tx/txcustomtokenprivacy";
import {CustomTokenInit, CustomTokenTransfer} from '../../lib/tx/constants';
import * as constantsTx from "../../lib/tx/constants";
import { prepareInputForTx, prepareInputForTxPrivacyToken } from "../../lib/tx/utils";

import {PrivacyTokenParamTx} from "../../lib/tx/txcustomkenprivacydata";
import { AccountWallet } from "../../lib/wallet/wallet";

import {PaymentInfo} from '../../lib/key';

const rpcClient = new RpcClient("https://test-node.incognito.org");

async function TestInitPrivacyTokenTx() {
  // payment info for PRV transfer
  let paymentInfos = [];

  // token receiver's key (receiver who create tx)
  let receiverSpendingKeyStr1 = "112t8rnXgFuVb4pfnqh9wkwrAZZRp7WHQVtnHnxBNkaHimBoL42DvsFVLisDqXiTZpnKFAZahQsCaoWdEQ9s77FFPzRey6H9CS7JeC6ipgoB";
  let receiverKeyWallet1 = keyWallet.base58CheckDeserialize(receiverSpendingKeyStr1);
  receiverKeyWallet1.KeySet.importFromPrivateKey(receiverKeyWallet1.KeySet.PrivateKey);
  let receiverAccount = new AccountWallet();
  receiverAccount.key = receiverKeyWallet1;

  let feePRV = new bn(0.5 * 1e9);
  let feeToken = new bn(0);

  try {
    // prepare input for PRV
    console.time("Time for preparing input for fee");
    let input = await prepareInputForTx(receiverSpendingKeyStr1, paymentInfos, feePRV, receiverAccount, rpcClient);
    console.timeEnd("Time for preparing input for fee");

    // prepare token param
    let amountInit = 1000;
    let tokenParams = new PrivacyTokenParamTx();
    tokenParams.propertyName = "tp1";
    tokenParams.propertySymbol = "tp1";
    tokenParams.amount = amountInit;
    tokenParams.tokenTxType = CustomTokenInit;
    tokenParams.receivers = [new PaymentInfo(receiverKeyWallet1.KeySet.PaymentAddress, amountInit)];

    // get list of privacy tokens
    let resp = await rpcClient.listPrivacyCustomTokens();
    let listPrivacyCustomToken = resp.listPrivacyToken;

    // init tx
    let tx = new TxCustomTokenPrivacy(rpcClient);
    console.time("Time for creating tx custom token");
    await tx.init(input.senderKeySet.PrivateKey, input.paymentAddrSerialize, paymentInfos, input.inputCoins, input.inputCoinStrs, feePRV, feeToken, tokenParams, listPrivacyCustomToken, null, false);
    console.timeEnd("Time for creating tx custom token");
    console.log("***************Tx: ", tx);

    // send tx
    await rpcClient.sendRawTxCustomTokenPrivacy(tx);

  } catch (e) {
    console.log(e);
  }
}

// TestInitPrivacyTokenTx();


async function TestTransferPrivacyTokenTx() {
  // payment info for PRV transfer
  let paymentInfos = [];

  // sender key (private key)
  let senderSpendingKeyStr1 = "112t8rnXgFuVb4pfnqh9wkwrAZZRp7WHQVtnHnxBNkaHimBoL42DvsFVLisDqXiTZpnKFAZahQsCaoWdEQ9s77FFPzRey6H9CS7JeC6ipgoB";
  let senderKeyWallet1 = keyWallet.base58CheckDeserialize(senderSpendingKeyStr1);
  senderKeyWallet1.KeySet.importFromPrivateKey(senderKeyWallet1.KeySet.PrivateKey);
  let senderAccount = new AccountWallet();
  senderAccount.key = senderKeyWallet1;
  
  // receiver key (payment address)
  let receiverPaymentAddrStr = "1Uv3c4hAXqNcxyFhKGwBzGXQ6qdR89nrawqSz7WmcQEX4yurCEVEZMDm1x7g9vJnHHy4Lno73aJhaJAf8fhGgPexmCpu5HuiXU94reXAC";
  let receiverKeyWallet = keyWallet.base58CheckDeserialize(receiverPaymentAddrStr);
  let receiverPaymentAddr = receiverKeyWallet.KeySet.PaymentAddress;

  let feePRV = new bn(0);
  let feePToken = new bn(0);

  // prepare token param
  let amountTransfer = 10;
  let tokenParams = new PrivacyTokenParamTx();
  tokenParams.propertyID = "e7ad84e064ef0f51728c6ba43dcf35a31dab6697982650348c4106c5939e6cfd";
  tokenParams.propertyName = "tp1";
  tokenParams.propertySymbol = "tp1";
  tokenParams.amount = amountTransfer;
  tokenParams.tokenTxType = constantsTx.CustomTokenTransfer;
  tokenParams.receivers = [new PaymentInfo(receiverPaymentAddr, new bn(amountTransfer))];

  // prepare input
  let inputForNormalTx = await prepareInputForTx(senderSpendingKeyStr1, paymentInfos, feePRV, senderAccount, rpcClient);
  let inputForTxCustomTokenPrivacy = await prepareInputForTxPrivacyToken(tokenParams, senderAccount, rpcClient, feePToken);

  tokenParams.tokenInputs = inputForTxCustomTokenPrivacy.tokenInputs;

  // init tx
  let txCustomTokenPrivacy = new TxCustomTokenPrivacy(rpcClient);
  await txCustomTokenPrivacy.init(senderKeyWallet1.KeySet.PrivateKey,
    inputForNormalTx.paymentAddrSerialize,
    paymentInfos,
    inputForNormalTx.inputCoins,
    inputForNormalTx.inputCoinStrs,
    feePRV,
    feePToken,
    tokenParams,
    inputForTxCustomTokenPrivacy.listPrivacyToken, null, true);


  console.log("Tx privacy custom token: ", txCustomTokenPrivacy);

  // send tx
  await rpcClient.sendRawTxCustomTokenPrivacy(txCustomTokenPrivacy);
}

TestTransferPrivacyTokenTx();

// async function TestTxBurningRequest() {
//   let n = 0;
//   let paymentInfos = new Array(n);
//   // paymentInfos[0] = new key.PaymentInfo(receiverKeyWallet1.KeySet.PaymentAddress, new BN.BN(2300));

//   // HN2
//   let senderSpendingKeyStr1 = "112t8rqGc71CqjrDCuReGkphJ4uWHJmiaV7rVczqNhc33pzChmJRvikZNc3Dt5V7quhdzjWW9Z4BrB2BxdK5VtHzsG9JZdZ5M7yYYGidKKZV";
//   let senderKeyWallet1 = keyWallet.base58CheckDeserialize(senderSpendingKeyStr1);
//   // import key set
//   senderKeyWallet1.KeySet.importFromPrivateKey(senderKeyWallet1.KeySet.PrivateKey);

//   console.log("Payment address : ", senderKeyWallet1.KeySet.PaymentAddress);

//   // HN1
//   let receiverSpendingKeyStr1 = "112t8rqnMrtPkJ4YWzXfG82pd9vCe2jvWGxqwniPM5y4hnimki6LcVNfXxN911ViJS8arTozjH4rTpfaGo5i1KKcG1ayjiMsa4E3nABGAqQh";
//   let receiverKeyWallet1 = keyWallet.base58CheckDeserialize(receiverSpendingKeyStr1);
//   // import key set
//   receiverKeyWallet1.KeySet.importFromPrivateKey(receiverKeyWallet1.KeySet.PrivateKey);

//   // receivers token
//   let receivers = new Array(1);
//   receivers[0] = new PaymentInfo(receiverKeyWallet1.KeySet.PaymentAddress, new bn(10));


//   // prepare token param
//   let amountTransfer = 10;
//   let tokenParams = new PrivacyTokenParamTx();
//   tokenParams.propertyID = "56783B1532273081182E0DBA547CA564A6E71270580B75D6D06CD3A4CBE66377";
//   tokenParams.propertyName = "tp1";
//   tokenParams.propertySymbol = "tp1";
//   tokenParams.amount = amountTransfer;
//   tokenParams.tokenTxType = constantsTx.CustomTokenTransfer;
//   tokenParams.receivers = receivers;

//   let inputForNormalTx = await rpcClient.prepareInputForTx(senderSpendingKeyStr1, paymentInfos);

//   let inputForTxCustomTokenPrivacy = await rpcClient.prepareInputForTxPrivacyToken(senderSpendingKeyStr1, tokenParams);

//   let txCustomTokenPrivacy = new TxCustomTokenPrivacy(new RpcClient("http://localhost:9334"));
//   tokenParams.tokenInputs = inputForTxCustomTokenPrivacy.tokenInputs;

//   await txCustomTokenPrivacy.init(senderKeyWallet1.KeySet.PrivateKey,
//     inputForNormalTx.paymentAddrSerialize,
//     paymentInfos,
//     inputForNormalTx.inputCoins,
//     inputForNormalTx.inputCoinStrs,
//     new bn(0),
//     tokenParams,
//     inputForTxCustomTokenPrivacy.listCustomToken, null, true);

//   // console.timeEnd("Time for creating tx custom token");

//   console.log("Tx privacy custom token: ", txCustomTokenPrivacy);

//   // console.log("***************Tx: ", tx);
//   await rpcClient.sendRawTxCustomTokenPrivacy(txCustomTokenPrivacy);
// }

// TestTxCustomTokenPrivacyTransfer();