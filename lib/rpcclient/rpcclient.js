import {RPCHttpService} from './rpchttpservice';
import * as base58 from "../base58";
import * as constants from 'privacy-js-lib/lib/constants';
import json from 'circular-json';
import {KeyWallet as keyWallet} from "../wallet/hdwallet";
import * as constantsWallet from '../wallet/constants';
import * as constantsTx from '../tx/constants';
import {knapsack, greedy} from '../knapsack';
import BN from "bn.js"
import * as coin from '../coin';
import * as ec from "privacy-js-lib/lib/ec";
import * as privacyUtils from 'privacy-js-lib/lib/privacy_utils';
import * as zkp from 'privacy-js-lib/lib/zkps/utils'
import {TxTokenVin, TxTokenVout} from "../tx/txcustomtokendata";
import * as common from "../common";
import * as key from "../key";
import {CustomTokenPrivacyParamTx, Wallet} from "../wallet/wallet";
import {CustomTokenParamTx} from '../tx/txcustomtokendata'

let bn = require('bn.js');
const P256 = ec.P256;

class RpcClient {
  constructor(url, user, password) {
    this.rpcHttpService = new RPCHttpService(url, user, password)
  }

  getOutputCoin = async (paymentAdrr, viewingKey, tokenID = null) => {
    let data = {
      "jsonrpc": "1.0",
      "method": "listoutputcoins",
      "params": [
        0,
        999999,
        [{
          // "PaymentAddress":"1Uv3VB24eUszt5xqVfB87ninDu7H43gGxdjAUxs9j9JzisBJcJr7bAJpAhxBNvqe8KNjM5G9ieS1iC944YhPWKs3H2US2qSqTyyDNS4Ba",
          // "ReadonlyKey":"1CvjKR6j8VfrNdr55RicSN9CK6kyhRHGzDhfq9Lwru6inWS5QBNJE2qvSfDUz7ZpVwBjMUoSQp6FDdaa9WjjQymN8BRpVczD5dmiEzw2"
          "PaymentAddress": paymentAdrr,
          "ReadonlyKey": viewingKey,
        }],
      ],
      "id": 1
    };
    if (tokenID != null) {
      data["params"][3] = tokenID;
    }
    let that = this;
    const response = await this.rpcHttpService.postRequest(data);

    if (response.status !== 200) {
      return {
        outCoins: [],
        err: new Error("Can't request API")
      }
    } else {
      return {
        outCoins: response.data.Result.Outputs[viewingKey],
        err: null
      }
    }
  };

  // hasSerialNumber return true if snd existed in database
  hasSerialNumber = async (paymentAddr, serialNumberStrs, tokenID = null) => {
    console.time("Has serila number " + tokenID);
    const data = {
      "jsonrpc": "1.0",
      "method": "hasserialnumbers",
      "params": [
        // ["1Uv3VB24eUszt5xqVfB87ninDu7H43gGxdjAUxs9j9JzisBJcJr7bAJpAhxBNvqe8KNjM5G9ieS1iC944YhPWKs3H2US2qSqTyyDNS4Ba",        // paynment address
        // ["15mm7h9mRRyWH7S2jU4p9brQ8zeomooAHhQpRsruoWgA6hKHCuV", "15mm7h9mRRyWH7S2jU4p9brQ8zeomooAHhQpRsruoWgA6hKHCuV"]],     // array of serial number strings

        paymentAddr,
        serialNumberStrs,
      ],
      "id": 1
    };
    if (tokenID != null) {
      data["params"][2] = tokenID;
    }

    const response = await this.rpcHttpService.postRequest(data);

    // console.log("Response: ", response);
    if (response.status !== 200) {
      console.timeEnd("Has serila number " + tokenID);
      return {
        existed: [],
        err: new Error("Can't request API")
      }
    } else {
      console.timeEnd("Has serila number " + tokenID);
      return {
        existed: response.data.Result,
        err: null
      }
    }
  };

  // hasSNDerivator return true if snd existed in database
  hasSNDerivator = async (paymentAddr, snds, tokenID = null) => {
    //todo:

    const data = {
      "jsonrpc": "1.0",
      "method": "hassnderivators",
      "params": [
        // ["1Uv3VB24eUszt5xqVfB87ninDu7H43gGxdjAUxs9j9JzisBJcJr7bAJpAhxBNvqe8KNjM5G9ieS1iC944YhPWKs3H2US2qSqTyyDNS4Ba",        // paynment address
        // ["15mm7h9mRRyWH7S2jU4p9brQ8zeomooAHhQpRsruoWgA6hKHCuV", "15mm7h9mRRyWH7S2jU4p9brQ8zeomooAHhQpRsruoWgA6hKHCuV"]],     // array of serial number strings

        paymentAddr,
        snds,
      ],
      "id": 1
    };
    if (tokenID != null) {
      data["params"][2] = tokenID;
    }

    const response = await this.rpcHttpService.postRequest(data);

    // console.log("Response: ", response);
    if (response.status !== 200) {
      return {
        existed: [],
        err: new Error("Can't request API")
      }
    } else {
      return {
        existed: response.data.Result,
        err: null
      }
    }
  };

  // randomCommitmentsProcess randoms list commitment for proving
  randomCommitmentsProcess = async (paymentAddr, inputCoinStrs, tokenID = null) => {
    const data = {
      "jsonrpc": "1.0",
      "method": "randomcommitments",
      "params": [
        paymentAddr,
        inputCoinStrs,
      ],
      "id": 1
    };
    if (tokenID != null) {
      data["params"][2] = tokenID;
    }

    const response = await this.rpcHttpService.postRequest(data);

    // console.log("Response: ", response);
    if (response.status !== 200) {
      return {
        commitmentIndices: [],
        commitments: [],
        myCommitmentIndices: [],
        err: new Error("Can't request API")
      }
    } else {

      let commitmentStrs = response.data.Result.Commitments;

      // deserialize commitments
      let commitments = new Array(commitmentStrs.length);
      for (let i = 0; i < commitments.length; i++) {
        let res = base58.checkDecode(commitmentStrs[i]);

        if (res.version !== constants.PRIVACY_VERSION) {
          return {
            commitmentIndices: [],
            commitments: [],
            myCommitmentIndices: [],
            err: new Error("Base58 check decode wrong version")
          }
        }

        commitments[i] = P256.decompress(res.bytesDecoded);
      }

      return {
        commitmentIndices: response.data.Result.CommitmentIndices,
        commitments: commitments,
        myCommitmentIndices: response.data.Result.MyCommitmentIndexs,
        err: null
      }
    }
  };

  prepareInputForTx = async (spendingKeyStr, paymentInfos) => {
    // spendingKeyStr = "112t8rqGc71CqjrDCuReGkphJ4uWHJmiaV7rVczqNhc33pzChmJRvikZNc3Dt5V7quhdzjWW9Z4BrB2BxdK5VtHzsG9JZdZ5M7yYYGidKKZV";
    // spendingKeyStr = "112t8rqnMrtPkJ4YWzXfG82pd9vCe2jvWGxqwniPM5y4hnimki6LcVNfXxN911ViJS8arTozjH4rTpfaGo5i1KKcG1ayjiMsa4E3nABGAqQh";

    // deserialize spending key string to key wallet
    let myKeyWallet = keyWallet.base58CheckDeserialize(spendingKeyStr);

    // import key set
    myKeyWallet.KeySet.importFromPrivateKey(myKeyWallet.KeySet.PrivateKey);

    // console.log("Private key: ", myKeyWallet.KeySet.PrivateKey.join(', '));

    // serialize payment address, readonlyKey
    let paymentAddrSerialize = myKeyWallet.base58CheckSerialize(constantsWallet.PaymentAddressType);
    let readOnlyKeySerialize = myKeyWallet.base58CheckSerialize(constantsWallet.ReadonlyKeyType);
    // console.log("paymentAddrSerialize: ", paymentAddrSerialize);
    // console.log("readOnlyKeySerialize: ", readOnlyKeySerialize);

    // get all output coins of spendingKey
    let res = await this.getOutputCoin(paymentAddrSerialize, readOnlyKeySerialize);
    let allOutputCoinStrs;
    // console.log("res :",res);
    if (res.err === null) {
      allOutputCoinStrs = res.outCoins
      console.log("allOutputCoinStrs :", allOutputCoinStrs);
    } else {
      throw new Error('ERR when call API get output: ', res.err);
    }

    if (allOutputCoinStrs.length == 0) {
      throw new Error('Have no item in list output coins');
    }

    console.log("list out put coin: ", allOutputCoinStrs);

    // parse input coin from string
    let inputCoins = this.parseInputCoinFromEncodedObject(allOutputCoinStrs, myKeyWallet);
    console.log("Inputcoins after parseInputCoinFromEncodedObject: ", inputCoins);

    // get unspent coin from list all of output coins
    let resGetUnspentCoin = await this.getUnspentCoin(inputCoins, paymentAddrSerialize, allOutputCoinStrs);
    let unspentCoins = resGetUnspentCoin.unspentCoin;
    console.log("Unspent coin: ", unspentCoins);

    // calculate amount which need to be spent
    let amount = new BN(0);
    for (let i = 0; i < paymentInfos.length; i++) {
      amount = amount.add(paymentInfos[i].Amount);
    }

    let inputCoinsToSpent;
    let bestCoinToSpent;
    try {
      bestCoinToSpent = this.chooseBestCoinToSpent(unspentCoins, amount);
      console.log("bestCoinToSpent", bestCoinToSpent);
      inputCoinsToSpent = bestCoinToSpent.resultOutputCoins;
    } catch (e) {
      console.log("bestCoinToSpent", e)
      throw e;
    }

    if (inputCoinsToSpent.length == 0 && amount.cmp(new BN(0)) != 0) {
      throw new Error("Not enough coin")
    }
    let inputCoinsToSpentStr = this.parseInputCoinToEncodedObject(inputCoinsToSpent);
    console.log("input coin to spent serialize: ", inputCoinsToSpentStr);

    // get coin to spent using Knapsack
    return {
      senderKeySet: myKeyWallet.KeySet,
      paymentAddrSerialize: paymentAddrSerialize,
      inputCoins: inputCoinsToSpent,
      inputCoinStrs: inputCoinsToSpentStr
    };
  };

  // chooseBestCoinToSpent return list of coin to spent using Knapsack and Greedy algorithm
  chooseBestCoinToSpent = (inputCoins, amount) => {
    console.time("chooseBestCoinToSpent")
    console.log("chooseBestCoinToSpent - inputCoins", inputCoins)
    console.log("chooseBestCoinToSpent - amount", amount)
    if (amount.cmp(new BN(0)) === 0) {
      return {
        resultOutputCoins: [],
        remainOutputCoins: inputCoins,
        totalResultOutputCoinAmount: 0
      }
    }
    let incoinUnknapsack = [];
    let incoinKnapsack = [];
    let valueKnapsack = [];
    let resultOutputCoins = [];
    let remainOutputCoins = [];
    let sumvalueKnapsack = new BN(0);

    for (let i = 0; i < inputCoins.length; i++) {
      if (inputCoins[i].coinDetails.value.cmp(amount) > 0) {
        incoinUnknapsack.push(inputCoins[i]);
      } else {
        sumvalueKnapsack = sumvalueKnapsack.add(inputCoins[i].coinDetails.value);
        valueKnapsack.push(inputCoins[i].coinDetails.value.toNumber());
        incoinKnapsack.push(inputCoins[i]);
      }
    }

    let target = sumvalueKnapsack.clone().sub(amount);
    let totalResultOutputCoinAmount = new BN(0);

    console.log("sumvalueKnapsack", sumvalueKnapsack)
    console.log("target", target)

    if (target.cmpn(1000) > 0) {
      console.log("target.cmpn(1000) > 0")
      inputCoins.sort(function (a, b) {
        return a.coinDetails.value.cmp(b.coinDetails.value)
      });
      console.log("inputCoins after sort", inputCoins)
      let choice = greedy(inputCoins, amount);
      console.log("choice", choice)
      for (let i = 0; i <= choice; i++) {
        totalResultOutputCoinAmount = totalResultOutputCoinAmount.add(inputCoins[i].coinDetails.value);
        resultOutputCoins.push(inputCoins[i]);
      }
      for (let i = choice + 1; i < inputCoins.length; i++) {
        remainOutputCoins.push(inputCoins[i]);
      }
    } else if (target.cmpn(0) > 0) {
      console.log("target.cmpn(0) > 0")
      let choices = knapsack(valueKnapsack, target.toNumber());

      for (let i = 0; i < valueKnapsack.length; i++) {
        if (choices[i]) {
          totalResultOutputCoinAmount = totalResultOutputCoinAmount.addn(valueKnapsack[i]);
          resultOutputCoins.push(inputCoins[i]);
        } else {
          remainOutputCoins.push(inputCoins[i]);
        }
      }
    } else if (target === 0) {
      console.log("target === 0")
      totalResultOutputCoinAmount = sumvalueKnapsack;
      resultOutputCoins = incoinKnapsack;
      remainOutputCoins = incoinUnknapsack;
    } else {
      console.log("target else")
      console.log("incoinUnknapsack", incoinUnknapsack)
      if (incoinUnknapsack.length === 0) {
        console.timeEnd("chooseBestCoinToSpent")
        throw new Error("Not enough coin");
      } else {
        let iMin = 0;
        for (let i = 1; i < incoinUnknapsack.length; i++) {
          iMin = (incoinUnknapsack[i].coinDetails.value.cmp(incoinUnknapsack[iMin].coinDetails.value) < 0) ? (i) : (iMin);
        }
        resultOutputCoins.push(incoinUnknapsack[iMin]);
        totalResultOutputCoinAmount = incoinUnknapsack[iMin].coinDetails.value.clone();
        for (let i = 0; i < incoinUnknapsack.length; i++) {
          if (i !== iMin) {
            remainOutputCoins.push(incoinUnknapsack[i]);
          }
        }
      }
    }
    console.timeEnd("chooseBestCoinToSpent")
    return {
      resultOutputCoins: resultOutputCoins,
      remainOutputCoins: remainOutputCoins,
      totalResultOutputCoinAmount: totalResultOutputCoinAmount
    };
  };

  // parseInputCoinFromEncodedObject convert input coin string to struct
  parseInputCoinFromEncodedObject = (serializedObjects, keyWallet) => {
    let inputCoins = new Array(serializedObjects.length);

    console.log("Spending key when parseInputCoinFromSerializedObject: ", keyWallet.KeySet.PrivateKey);

    let spendingKeyBN = new BN(keyWallet.KeySet.PrivateKey);

    for (let i = 0; i < serializedObjects.length; i++) {
      let tmp = base58.checkDecode(serializedObjects[i].PublicKey);
      console.log("res decode public key: ", tmp);
      let publicKeyDecode = tmp.bytesDecoded;
      let commitmentDecode = base58.checkDecode(serializedObjects[i].CoinCommitment).bytesDecoded;
      let sndDecode = base58.checkDecode(serializedObjects[i].SNDerivator).bytesDecoded;
      let randDecode = base58.checkDecode(serializedObjects[i].Randomness).bytesDecoded;

      inputCoins[i] = new coin.InputCoin();
      debugger;

      inputCoins[i].coinDetails.publicKey = P256.decompress(publicKeyDecode);
      inputCoins[i].coinDetails.coinCommitment = P256.decompress(commitmentDecode);
      inputCoins[i].coinDetails.snderivator = new BN(sndDecode);
      inputCoins[i].coinDetails.randomness = new BN(randDecode);
      inputCoins[i].coinDetails.value = new BN(serializedObjects[i].Value);
      inputCoins[i].coinDetails.info = base58.checkDecode(serializedObjects[i].Info).bytesDecoded;
      // inputCoins[i].coinDetails.set(P256.decompress(publicKeyDecode),
      //   P256.decompress(commitmentDecode),
      //   new BN(sndDecode),
      //   null,
      //   new BN(randDecode),
      //   new BN(serializedObjects[i].Value),
      //   base58.checkDecode(serializedObjects[i].Info).bytesDecoded);

      // calculate serial number for all of output coins

      console.time("Derive: " + i);
      inputCoins[i].coinDetails.serialNumber = P256.g.derive(spendingKeyBN, new BN(inputCoins[i].coinDetails.snderivator));
      console.timeEnd("Derive: " + i);
    }

    return inputCoins;
  };

  // ParseCoinFromStr convert input coin string to struct
  parseInputCoinToEncodedObject = (coins) => {
    let coinStrs = new Array(coins.length);

    for (let i = 0; i < coinStrs.length; i++) {
      // let publicKeyDecode = base58.checkDecode(coinStrs[i].PublicKey).bytesDecoded;
      // let commitmentDecode = base58.checkDecode(coinStrs[i].CoinCommitment).bytesDecoded;
      // let sndDecode = base58.checkDecode(coinStrs[i].SNDerivator).bytesDecoded;
      // let randDecode = base58.checkDecode(coinStrs[i].Randomness).bytesDecoded;

      // coinStrs[i] = new coin.Coin();
      coinStrs[i] = new Object();
      coinStrs[i].PublicKey = base58.checkEncode(coins[i].coinDetails.publicKey.compress(), constants.PRIVACY_VERSION);
      coinStrs[i].CoinCommitment = base58.checkEncode(coins[i].coinDetails.coinCommitment.compress(), constants.PRIVACY_VERSION);
      coinStrs[i].SNDerivator = base58.checkEncode(coins[i].coinDetails.snderivator.toArray(), constants.PRIVACY_VERSION);
      coinStrs[i].Randomness = base58.checkEncode(coins[i].coinDetails.randomness.toArray(), constants.PRIVACY_VERSION);
      coinStrs[i].SerialNumber = null;
      coinStrs[i].Value = coins[i].coinDetails.value;
      coinStrs[i].Info = base58.checkEncode(coins[i].coinDetails.info, constants.PRIVACY_VERSION);
    }

    return coinStrs;
  };

  // getUnspentCoin returns unspent coins
  getUnspentCoin = async (inputCoins, paymentAddrSerialize, inCoinStrs) => {
    console.time("Getunspent coin:")
    let unspentCoin = new Array();
    let unspentCoinStrs = new Array();

    let serialNumberStrs = new Array(inputCoins.length);

    for (let i = 0; i < inputCoins.length; i++) {
      serialNumberStrs[i] = base58.checkEncode(inputCoins[i].coinDetails.serialNumber.compress(), 0x00);
    }

    // check whether each input coin is spent or not
    let res = await this.hasSerialNumber(paymentAddrSerialize, serialNumberStrs);
    let existed = [];
    if (res.err !== null) {
      throw new Error('ERR when call API has serial number: ', res.err);
    } else {
      existed = res.existed;
    }

    if (existed.length != inputCoins.length) {
      throw new Error("Wrong response when check has serial number");
    }

    for (let i = 0; i < existed.length; i++) {
      if (!existed[i]) {
        unspentCoin.push(inputCoins[i]);
        unspentCoinStrs.push(inCoinStrs[i]);
      }
    }
    // console.log("unspent input coin: ", unspentCoin);
    // console.log("unspent input coin len : ", unspentCoin.length);
    console.timeEnd("Getunspent coin:")
    return {
      unspentCoin: unspentCoin,
      unspentCoinStrs: unspentCoinStrs
    };
  };

  // getUnspentPrivacyCustomToken returns unspent privacy custom token
  getUnspentPrivacyCustomToken = async (inputCoins, paymentAddrSerialize, inCoinStrs, tokenID = null) => {
    let unspentCoin = new Array();
    let unspentCoinStrs = new Array();

    let serialNumberStrs = new Array(inputCoins.length);

    for (let i = 0; i < inputCoins.length; i++) {
      serialNumberStrs[i] = base58.checkEncode(inputCoins[i].coinDetails.serialNumber.compress(), 0x00);
    }

    // check whether each input coin is spent or not
    let res = await this.hasSerialNumber(paymentAddrSerialize, serialNumberStrs, tokenID);
    let existed = [];
    if (res.err !== null) {
      console.log('ERR when call API has serial number: ', res.err);
    } else {
      existed = res.existed;
    }

    for (let i = 0; i < existed.length; i++) {
      if (!existed[i]) {
        unspentCoin.push(inputCoins[i]);
        unspentCoinStrs.push(inCoinStrs[i]);
      }
    }
    // console.log("unspent input coin: ", unspentCoin);
    // console.log("unspent input coin len : ", unspentCoin.length);
    return {
      unspentCoin: unspentCoin,
      unspentCoinStrs: unspentCoinStrs
    };
  };

  sendRawTx = async (tx) => {

    console.log("SENDING TX ........");
    // hide private key for signing
    delete tx.sigPrivKey;

    // convert tx to json
    let txJson = json.stringify(tx.convertTxToByte());
    // console.log("txJson: ", txJson);

    // base58 check encode tx json
    console.log("converting tx to json .....");
    let serializedTxJson = base58.checkEncode(privacyUtils.stringToBytes(txJson), constants.PRIVACY_VERSION);
    // console.log("tx json serialize: ", serializedTxJson);

    const data = {
      "jsonrpc": "1.0",
      "method": "sendtransaction",
      "params": [
        serializedTxJson,
      ],
      "id": 1
    };

    // call API to send tx
    console.log("calling api to send tx .....");
    const response = await this.rpcHttpService.postRequest(data);
    // console.log("response send tx: ", response);

    if (response.status !== 200 || response.data.Result === null) {
      return {
        txId: null,
        err: new Error("Can't request API"),
        id: null,
      }
    } else {
      console.log("**** SENDING TX SUCCESS****");
      return {
        txId: response.data.Result.TxID,
        err: response.data.Error,
        id: response.data.Id,
      }
    }
  };

  // for tx custom token
  sendRawTxCustomToken = async (tx) => {
    // hide private key for signing
    delete tx.sigPrivKey;

    // convert tx to json
    let txJson = JSON.stringify(tx.convertTxCustomTokenToByte());
    console.log("txJson: ", txJson);

    let txBytes = privacyUtils.stringToBytes(txJson);
    console.log('TxBytes: ', txBytes.join(', '));
    console.log('TxBytes len : ', txBytes.length);

    // base58 check encode tx json
    let serializedTxJson = base58.checkEncode(txBytes, constants.PRIVACY_VERSION);
    // console.log("tx json serialize: ", serializedTxJson);

    const data = {
      "jsonrpc": "1.0",
      "method": "sendrawcustomtokentransaction",
      "params": [
        serializedTxJson,
      ],
      "id": 1
    };

    // call API to send tx
    const response = await this.rpcHttpService.postRequest(data);
    console.log("response when send custom token tx: ", response);

    if (response.status !== 200 || response.data.Result === null) {
      console.log("Err when send custom token: ", response.data.Error);
      return {
        txId: null,
        err: new Error("Can't request API"),
        id: null,
      }
    } else {
      console.log("**** SENDING TX CUSTOM TOKEN SUCCESS****");
      return {
        txId: response.data.Result,
        err: response.data.Error,
        id: response.data.Id,
      }
    }
  };

  // for tx custom token
  sendRawTxCustomTokenPrivacy = async (tx) => {
    // hide private key for signing
    delete tx.sigPrivKey;
    delete tx.txTokenPrivacyData.txNormal.sigPrivKey;

    // convert tx to json
    let txJson = JSON.stringify(tx.convertTxCustomTokenPrivacyToByte());
    console.log("txJson: ", txJson);

    let txBytes = privacyUtils.stringToBytes(txJson);
    console.log('TxBytes: ', txBytes.join(', '));
    console.log('TxBytes len : ', txBytes.length);

    // base58 check encode tx json
    let serializedTxJson = base58.checkEncode(txBytes, constants.PRIVACY_VERSION);
    // console.log("tx json serialize: ", serializedTxJson);

    const data = {
      "jsonrpc": "1.0",
      "method": "sendrawprivacycustomtokentransaction",
      "params": [
        serializedTxJson,
      ],
      "id": 1
    };

    // call API to send tx
    const response = await this.rpcHttpService.postRequest(data);
    // console.log("response send tx: ", response);

    if (response.status !== 200 || response.data.Result === null) {
      return {
        txId: null,
        err: new Error("Can't request API"),
        id: null,
      }
    } else {
      console.log("**** SENDING TX CUSTOM TOKEN SUCCESS****");
      return {
        txId: response.data.Result.TxID,
        err: response.data.Error,
        id: response.data.Id,
      }
    }
  };

  listCustomTokens = async () => {

    const data = {
      "jsonrpc": "1.0",
      "method": "listcustomtoken",
      "params": [],
      "id": 1
    };

    // call API to send tx
    const response = await this.rpcHttpService.postRequest(data);
    console.log("response send tx: ", response);


    // return {
    //   abc: 1
    // };

    if (response.status !== 200) {
      return {
        err: new Error("Can't request API")
      }
    } else {
      return {
        listCustomToken: response.data.Result.ListCustomToken,
        err: response.data.Error,
        id: response.data.Id,
      }
    }
  };

  listPrivacyCustomTokens = async () => {

    const data = {
      "jsonrpc": "1.0",
      "method": "listprivacycustomtoken",
      "params": [],
      "id": 1
    };

    // call API to send tx
    const response = await this.rpcHttpService.postRequest(data);
    console.log("response send tx: ", response);
    if (response.status !== 200) {
      return {
        err: new Error("Can't request API")
      }
    } else {
      console.log("**** SENDING TX CUSTOM TOKEN SUCCESS****");
      return {
        listCustomToken: response.data.Result.ListCustomToken,
        err: response.data.Error,
        id: response.data.Id,
      }
    }
  };

  getUnspentCustomToken = async (paymentAddrSerialize, tokenIDStr) => {
    const data = {
      "jsonrpc": "1.0",
      "method": "listunspentcustomtoken",
      "params": [paymentAddrSerialize, tokenIDStr],
      "id": 1
    };

    // call API to send tx
    const response = await this.rpcHttpService.postRequest(data);
    // console.log("response send tx: ", response);

    if (response.status !== 200 || response.data.Result === null) {
      return {
        listUnspentCustomToken: null,
        err: new Error("Can't request API"),
        id: null
      }
    } else {
      // console.log("Response: ", response.data.Result);
      // console.log("**** SENDING TX CUSTOM TOKEN SUCCESS****");
      return {
        listUnspentCustomToken: response.data.Result,
        err: response.data.Error,
        id: response.data.Id,
      }
    }
  };

  prepareInputForCustomTokenTx = async (spendingKeyStr, tokenParams) => {
    let senderKeyWallet = keyWallet.base58CheckDeserialize(spendingKeyStr);
    senderKeyWallet.KeySet.importFromPrivateKey(senderKeyWallet.KeySet.PrivateKey);

    switch (tokenParams.tokenTxType) {
      case constantsTx.CustomTokenInit: {
        let response;
        try {
          response = await this.listCustomTokens();
          // console.log("REsponse prepare: ", response);
        } catch (e) {
          throw e;
        }

        let listCustomToken = response.listCustomToken;
        return {
          listCustomToken: listCustomToken,
          tokenVins: null,
        }
      }
      case constantsTx.CustomTokenTransfer: {
        let response = await this.listCustomTokens();
        let listCustomToken = response.listCustomToken;

        // sum of custom tokens' value in tokenParams.receivers
        let vOutAmount = 0;
        for (let i = 0; i < tokenParams.receivers.length; i++) {
          vOutAmount += tokenParams.receivers[i].value;
        }

        let response2 = await this.getUnspentCustomToken(senderKeyWallet.base58CheckSerialize(constantsWallet.PaymentAddressType),
          tokenParams.propertyID);

        let listUnspentCustomToken = response2.listUnspentCustomToken;

        // console.log("List : ", listUnspentCustomToken);

        if (listUnspentCustomToken.length === 0) {
          throw new Error("Balance of token is zero");
        }

        let tokenVins = new Array(0);
        let vinAmount = 0;

        for (let i = 0; i < listUnspentCustomToken.length; i++) {
          vinAmount += listUnspentCustomToken[i].Value;

          let tokenVoutsTmp = new TxTokenVout();
          tokenVoutsTmp.set(senderKeyWallet.KeySet.PaymentAddress, listUnspentCustomToken[i].Value);

          let tokenVinTmp = new TxTokenVin();
          tokenVinTmp.txCustomTokenID = common.newHashFromStr(listUnspentCustomToken[i].TxCustomTokenID);
          tokenVinTmp.voutIndex = listUnspentCustomToken[i].Index;
          tokenVinTmp.paymentAddress = senderKeyWallet.KeySet.PaymentAddress;
          // console.log(":senderKeyWallet1.KeySet.PaymentAddress: ", senderKeyWallet.KeySet.PaymentAddress);

          let signature = senderKeyWallet.KeySet.sign(tokenVoutsTmp.hash());
          tokenVinTmp.signature = base58.checkEncode(signature, constants.PRIVACY_VERSION);

          tokenVins.push(tokenVinTmp);

          vOutAmount -= listUnspentCustomToken[i].Value;
          if (vOutAmount <= 0) {
            break;
          }
        }

        return {
          listCustomToken: listCustomToken,
          tokenVins: tokenVins,
          vinsAmount: vinAmount,
        }
      }
    }
  };
  prepareInputForTxCustomTokenPrivacy = async (spendingKeyStr, tokenParams) => {
    console.log("Token param when preparing: ", tokenParams);
    // paymentInfo for tx normal for fee
    // tokenParams for tx custom token privacy data, but haven't tokenParam's tokenInputs
    switch (tokenParams.tokenTxType) {
      case constantsTx.CustomTokenInit: {
        let listUnspentToken = await this.listPrivacyCustomTokens();
        return {
          tokenInputs: null,
          listCustomToken: listUnspentToken.listCustomToken,
        }
      }
      case constantsTx.CustomTokenTransfer: {

        // deserialize spending key string to key wallet
        let myKeyWallet = keyWallet.base58CheckDeserialize(spendingKeyStr);

        // import key set
        myKeyWallet.KeySet.importFromPrivateKey(myKeyWallet.KeySet.PrivateKey);

        // console.log("Private key: ", myKeyWallet.KeySet.PrivateKey.join(', '));

        // serialize payment address, readonlyKey
        let paymentAddrSerialize = myKeyWallet.base58CheckSerialize(constantsWallet.PaymentAddressType);
        let readOnlyKeySerialize = myKeyWallet.base58CheckSerialize(constantsWallet.ReadonlyKeyType);

        // prepare tokenParams' tokenInputs for tx custom token privacy
        let amountTokenPrivacyOutput = new BN(0);
        for (let i = 0; i < tokenParams.receivers.length; i++) {
          amountTokenPrivacyOutput = amountTokenPrivacyOutput.add(tokenParams.receivers[i].Amount);
        }

        let res = await this.getOutputCoin(paymentAddrSerialize, readOnlyKeySerialize, tokenParams.propertyID.toLowerCase());
        let allOutputCoinStrs;

        if (res.err === null) {
          allOutputCoinStrs = res.outCoins
        } else {
          console.log('ERR when call API get output: ', res.err);
        }

        // parse input coin from encoded object
        let inputCoins = this.parseInputCoinFromEncodedObject(allOutputCoinStrs, myKeyWallet);

        // get list unspent coins from all of output coins
        let unspentOutputCoins = await this.getUnspentPrivacyCustomToken(inputCoins, paymentAddrSerialize, allOutputCoinStrs, tokenParams.propertyID);

        // get coin to spent using Knapsack
        let tokenInputs = this.chooseBestCoinToSpent(unspentOutputCoins.unspentCoin, amountTokenPrivacyOutput).resultOutputCoins;

        let listUnspentToken = await this.listPrivacyCustomTokens();

        return {
          tokenInputs: tokenInputs,
          listCustomToken: listUnspentToken.listCustomToken,
        };
      }
    }

  };
  // paymentAddrSerialize, inputCoins, payments, hasPrivacy, metadata, customTokenParams, privacyCustomTokenParams
  estimateFee = async (paymentAddrSerialize, inputCoins, payments, hasPrivacy, metadata, customTokenParams, privacyCustomTokenParams) => {
    const data = {
      "jsonrpc": "1.0",
      "method": "estimatefeewithestimator",
      "params": [-1, paymentAddrSerialize, 8],
      "id": 1
    };
    let unitFee = null;
    // call API to send tx
    const response = await this.rpcHttpService.postRequest(data);
    if (response.status !== 200) {
      return {
        err: new Error("Can't request API")
      }
    } else {
      unitFee = parseInt(response.data.Result.EstimateFeeCoinPerKb);
    }
    let txSize = this.estimateTxSize(inputCoins, payments, hasPrivacy, metadata, customTokenParams, privacyCustomTokenParams);
    return txSize * unitFee;
  };
  getEstimateFee = async (from, to, amount, privatekeyStr, customTokenParams = null, privacyCustomTokenParams = null) => {
    let receiverKeyWallet = keyWallet.base58CheckDeserialize(to);
    // receiverKeyWallet.KeySet.importFromPrivateKey(receiverKeyWallet.KeySet.PrivateKey);
    let paymentInfos = new Array(1);
    paymentInfos[0] = new key.PaymentInfo(receiverKeyWallet.KeySet.PaymentAddress, new bn(amount));
    let inputForTx = await Wallet.RpcClient.prepareInputForTx(privatekeyStr, paymentInfos);
    let fee = await this.estimateFee(from, inputForTx.inputCoins, paymentInfos, true, null, customTokenParams, privacyCustomTokenParams);
    return fee;
  };
  /**
   * tokenObject {
      Privacy: true,
      TokenID: "",
      TokenName: "",
      TokenSymbol: "",
      TokenTxType: 0,
      TokenAmount: 0,
      TokenReceivers: {
        [toAddress]: amount
      }
   */
  getEstimateFeeForSendingToken = async (from, to, amount, tokenObject, privatekeyStr) => {
    console.log("BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB");
    console.log(tokenObject.TokenReceivers.PaymentAddress);

    let receivers = new TxTokenVout();
    receivers.set(keyWallet.base58CheckDeserialize(tokenObject.TokenReceivers.PaymentAddress).KeySet.PaymentAddress,tokenObject.TokenReceivers.Amount);

    let id = "";
    let name = "";
    let symbol = "";
    if (tokenObject.TokenID!==null){
      id = tokenObject.TokenID;
    }
    if (tokenObject.TokenName!==null){
      name = tokenObject.TokenName;
    }
    if (tokenObject.TokenSymbol!==null){
      symbol = tokenObject.TokenSymbol;
    }
    let customTokenParams = new CustomTokenParamTx();
    let privacyCustomTokenParams = new CustomTokenPrivacyParamTx();

    if (tokenObject.Privacy === false) {

      customTokenParams.set(id, name,symbol,
        amount, tokenObject.TokenTxType, [receivers],
        [], tokenObject.TokenAmount);
      let inputForCustomTx = await Wallet.RpcClient.prepareInputForCustomTokenTx(privatekeyStr, customTokenParams);
      customTokenParams.vins = inputForCustomTx.tokenVins;

      let fee = await this.getEstimateFee(from, to, amount, privatekeyStr, customTokenParams,privacyCustomTokenParams);
      return fee
    // } else {
    //   privacyCustomTokenParams.set(id, name,symbol, amount, tokenObject.TokenTxType, receivers,
    //     vins, tokenObject.TokenAmount);
    //   return await this.getEstimateFee(from, to, amount, privatekeyStr, customTokenParams, privacyCustomTokenParams)
    }
  }
  estimateTxSize = (inputCoins, payments, hasPrivacy, metadata, customTokenParams, privacyCustomTokenParams) => {
    let sizeVersion = 1; // int8
    let sizeType = 5;    // string, max : 5
    let sizeLockTime = 8; // int64
    let sizeFee = 8;      // uint64

    let sizeInfo = 0;
    if (hasPrivacy) {
      sizeInfo = 64;
    }
    let sizeSigPubKey = constants.SIG_PUB_KEY_SIZE;
    let sizeSig = constants.SIG_NO_PRIVACY_SIZE;
    if (hasPrivacy) {
      sizeSig = constants.SIG_PRIVACY_SIZE;
    }

    let sizeProof = zkp.estimateProofSize(inputCoins.length, payments.length, hasPrivacy);

    let sizePubKeyLastByte = 1;


    let sizeMetadata = 0;
    // if (metadata != null || typeof metadata !== "undefined"){
    //   sizeMetadata += metadata.CalculateSize()
    // }
    let sizeTx = sizeVersion + sizeType + sizeLockTime + sizeFee + sizeInfo + sizeSigPubKey + sizeSig + sizeProof + sizePubKeyLastByte + sizeMetadata;
    if (customTokenParams !== null && typeof customTokenParams !== "undefined") {
      let customTokenDataSize = 0;
      customTokenDataSize += customTokenParams.propertyID.length;
      customTokenDataSize += customTokenParams.propertySymbol.length;
      customTokenDataSize += customTokenParams.propertyName.length;
      customTokenDataSize += 8;
      customTokenDataSize += 4;
      for (let i = 0; i < customTokenParams.receivers.length; i++) {
        customTokenDataSize += customTokenParams.receivers[i].paymentAddress.toBytes().length;
        customTokenDataSize += 8;
      }
      for (let i = 0; i < customTokenParams.vins.length; i++) {
        customTokenDataSize += customTokenParams.vins[i].paymentAddress.toBytes().length;
        customTokenDataSize += customTokenParams.vins[i].txCustomTokenID.slice(0,).length;
        customTokenDataSize += customTokenParams.vins[i].signature.length;
        customTokenDataSize += 4;
      }
      sizeTx += customTokenDataSize;
    }
    if (privacyCustomTokenParams !== null && typeof privacyCustomTokenParams !== "undefined") {
      let customTokenDataSize = 0;

      customTokenDataSize += privacyCustomTokenParams.propertyID.length;
      customTokenDataSize += privacyCustomTokenParams.propertySymbol.length;
      customTokenDataSize += privacyCustomTokenParams.propertyName.length;

      customTokenDataSize += 8; // for amount
      customTokenDataSize += 4; // for TokenTxType
      customTokenDataSize += 1; // int8 version
      customTokenDataSize += 5; // string, max : 5 type
      customTokenDataSize += 8; // int64 locktime
      customTokenDataSize += 8; // uint64 fee

      customTokenDataSize += 64; // info

      customTokenDataSize += constants.SIG_PUB_KEY_SIZE; // sig pubkey
      customTokenDataSize += constants.SIG_PRIVACY_SIZE; // sig

      // Proof
      customTokenDataSize += zkp.estimateProofSize(privacyCustomTokenParams.tokenInputs.length, privacyCustomTokenParams.receivers.length, true);
      customTokenDataSize += 1; //PubKeyLastByte
      sizeTx += customTokenDataSize
    }
    return Math.ceil(sizeTx / 1024.0);
  };
}

export {RpcClient};
