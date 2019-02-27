import {RPCHttpService} from './rpchttpservice';
import * as base58 from "../base58";
import * as constants from 'privacy-js-lib/lib/constants';
import json from 'circular-json';
import {KeyWallet as keyWallet} from "../wallet/hdwallet";
import * as constantsWallet from '../wallet/constants';
import {knapsack, greedy} from '../knapsack';
import bn from "bn.js"
import * as coin from '../coin';
import * as ec from "privacy-js-lib/lib/ec";
import * as privacyUtils from 'privacy-js-lib/lib/privacy_utils';

const P256 = ec.P256;

class RpcClient {
  constructor(url, user, password) {
    this.rpcHttpService = new RPCHttpService(this.url, this.user, this.password)
  }

  getOutputCoin = async (paymentAdrr, viewingKey) => {
    const data = {
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
        }]
      ],
      "id": 1
    };
    let that = this
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
  hasSerialNumber = async (paymentAddr, serialNumberStrs) => {
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

  // hasSNDerivator return true if snd existed in database
  hasSNDerivator = async (paymentAddr, snds) => {
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
  randomCommitmentsProcess = async (paymentAddr, inputCoinStrs) => {
    const data = {
      "jsonrpc": "1.0",
      "method": "randomcommitments",
      "params": [
        paymentAddr,
        inputCoinStrs,
        // [
        //     {
        //         "Pk": "177KNe6pRhi97hD9LqjUvGxLoNeKh9F5oSeh99V6Td2sQcm7qEu",
        //         "CoinCommitment": "15iYzoFTsoE2xkRe8cb2HbWeEBUoejZCBedV8e14xXiJjBPCHtX",
        //         "SNDerivator": "1gkrfYsYoria5TQMqYTzqnXutgdgqPvXwhMHk7q2UaZmjvkDnA",
        //         "SerialNumber": "",
        //         "Randomness": "1M59rHeaXwDNfWoDTRh6QNPPUSLizfcrK14ic9cJTo2pjzxtLR",
        //         "Value": 1000000,
        //         "Info": "1Wh4bh"
        //     }
        // ]
      ],
      "id": 1
    };

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
    } else {
      console.log('ERR when call API get output: ', res.err);
    }

    // parse input coin from string
    let inputCoins = this.parseInputCoinFromStr(allOutputCoinStrs, myKeyWallet);

    // get unspent coin
    let resGetUnspentCoin = await this.getUnspentCoin(inputCoins, paymentAddrSerialize, allOutputCoinStrs);
    let unspentCoins = resGetUnspentCoin.unspentCoin;
    let unspentCoinStrs = resGetUnspentCoin.unspentCoinStrs;


    // console.log("Unspent coin: ", unspentCoins);

    // calculate amount which need to be spent
    let amount = new bn.BN(0);
    for (let i = 0; i < paymentInfos.length; i++) {
      amount = amount.add(paymentInfos[i].Amount);
    }

    // get coin to spent using Knapsack
    return {
      senderKeySet: myKeyWallet.KeySet,
      paymentAddrSerialize: paymentAddrSerialize,
      inputCoins: this.chooseBestCoinToSpent(unspentCoins, amount).resultOutputCoins,
      inputCoinStrs: unspentCoinStrs,
    };
  };

  // chooseBestCoinToSpent return list of coin to spent using Knapsack and Greedy algorithm
  chooseBestCoinToSpent = (inputCoins, amount) => {
    if (amount.cmp(new bn(0)) === 0) {
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
    let sumvalueKnapsack = new bn(0);

    for (let i = 0; i < inputCoins.length; i++) {
      if (inputCoins[i].CoinDetails.Value.cmp(amount) > 0) {
        incoinUnknapsack.push(inputCoins[i]);
      } else {
        sumvalueKnapsack = sumvalueKnapsack.add(inputCoins[i].CoinDetails.Value);
        valueKnapsack.push(inputCoins[i].CoinDetails.Value.toNumber());
        incoinKnapsack.push(inputCoins[i]);
      }
    }

    let target = sumvalueKnapsack.clone().sub(amount);
    let totalResultOutputCoinAmount = new bn(0);

    if (target.cmpn(1000) > 0) {
      inputCoins.sort(function (a, b) {
        return a.CoinDetails.Value.cmp(b.CoinDetails.Value)
      });

      let choices = greedy(inputCoins, amount);
      for (let i = 0; i < inputCoins.length; i++) {
        if (choices[i]) {
          totalResultOutputCoinAmount = totalResultOutputCoinAmount.add(inputCoins[i].CoinDetails.Value);
          resultOutputCoins.push(inputCoins[i]);
        } else {
          remainOutputCoins.push(inputCoins[i]);
        }
      }
    } else if (target.cmpn(0) > 0) {
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
      totalResultOutputCoinAmount = sumvalueKnapsack;
      resultOutputCoins = incoinKnapsack;
      remainOutputCoins = incoinUnknapsack;
    } else {
      if (incoinUnknapsack.length === 0) {
        throw new Error("Not enough coin");
      } else {
        let iMin = 0;
        for (let i = 1; i < incoinUnknapsack.length; i++) {
          iMin = (incoinUnknapsack[i].CoinDetails.Value.cmp(incoinUnknapsack[iMin].CoinDetails.Value) < 0) ? (i) : (iMin);
        }
        resultOutputCoins.push(incoinUnknapsack[iMin]);
        totalResultOutputCoinAmount = incoinUnknapsack[iMin].CoinDetails.Value.clone();
        for (let i = 0; i < incoinUnknapsack.length; i++) {
          if (i !== iMin) {
            remainOutputCoins.push(incoinUnknapsack[i]);
          }
        }
      }
    }
    return {
      resultOutputCoins: resultOutputCoins,
      remainOutputCoins: remainOutputCoins,
      totalResultOutputCoinAmount: totalResultOutputCoinAmount
    };
  };

  // ParseCoinFromStr convert input coin string to struct
  parseInputCoinFromStr = (coinStrs, keyWallet) => {
    let inputCoins = new Array(coinStrs.length);

    let spendingKeyBN = new bn.BN(keyWallet.KeySet.PrivateKey);

    for (let i = 0; i < coinStrs.length; i++) {

      let publicKeyDecode = base58.checkDecode(coinStrs[i].PublicKey).bytesDecoded;
      let commitmentDecode = base58.checkDecode(coinStrs[i].CoinCommitment).bytesDecoded;
      let sndDecode = base58.checkDecode(coinStrs[i].SNDerivator).bytesDecoded;
      let randDecode = base58.checkDecode(coinStrs[i].Randomness).bytesDecoded;

      inputCoins[i] = new coin.InputCoin();

      inputCoins[i].CoinDetails.set(P256.decompress(publicKeyDecode),
        P256.decompress(commitmentDecode),
        new bn.BN(sndDecode),
        null,
        new bn.BN(randDecode),
        new bn.BN(coinStrs[i].Value),
        base58.checkDecode(coinStrs[i].Info).bytesDecoded);

      // calculate serial number for all of output coins

      inputCoins[i].CoinDetails.SerialNumber = P256.g.derive(spendingKeyBN, new bn.BN(inputCoins[i].CoinDetails.SNDerivator));
    }

    return inputCoins;
  };

  // getUnspentCoin returns unspent coins
  getUnspentCoin = async (inputCoins, paymentAddrSerialize, inCoinStrs) => {
    let unspentCoin = new Array();
    let unspentCoinStrs = new Array();

    let serialNumberStrs = new Array(inputCoins.length);

    for (let i = 0; i < inputCoins.length; i++) {
      serialNumberStrs[i] = base58.checkEncode(inputCoins[i].CoinDetails.SerialNumber.compress(), 0x00);
    }

    // check whether each input coin is spent or not
    let res = await this.hasSerialNumber(paymentAddrSerialize, serialNumberStrs);
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
    // hide private key for signing
    delete tx.sigPrivKey;

    // convert tx to json
    let txJson = json.stringify(tx.convertTxToByte());
    // console.log("txJson: ", txJson);

    // base58 check encode tx json
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
    const response = await this.rpcHttpService.postRequest(data);
    // console.log("response send tx: ", response);

    if (response.status !== 200) {
      return {
        err: new Error("Can't request API")
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
    let txJson = json.stringify(tx.convertTxToByte());
    // console.log("txJson: ", txJson);

    let txBytes = privacyUtils.stringToBytes(txJson);
    // console.log('TxBytes: ', txBytes.join(', '));
    // console.log('TxBytes len : ', txBytes.length);

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
    console.log("response send tx: ", response);

    if (response.status !== 200) {
      return {
        err: new Error("Can't request API")
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

  getListCustomTokens = async () => {

    const data = {
      "jsonrpc": "1.0",
      "method": "listcustomtoken",
      "params": [],
      "id": 1
    };

    // call API to send tx
    const response = await this.rpcHttpService.postRequest(data);
    // console.log("response send tx: ", response);

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

  getUnspentToken = async(paymentAddrSerialize, tokenIDStr) => {
    const data = {
      "jsonrpc": "1.0",
      "method": "listunspentcustomtoken",
      "params": [paymentAddrSerialize, tokenIDStr],
      "id": 1
    };

    // call API to send tx
    const response = await this.rpcHttpService.postRequest(data);
    // console.log("response send tx: ", response);

    if (response.status !== 200) {
      return {
        err: new Error("Can't request API")
      }
    } else {
      console.log("Response: ", response.data.Result);
      // console.log("**** SENDING TX CUSTOM TOKEN SUCCESS****");
      return {
        listUnspentCustomToken: response.data.Result,
        err: response.data.Error,
        id: response.data.Id,
      }
    }
  };

}

module.exports = {RpcClient};