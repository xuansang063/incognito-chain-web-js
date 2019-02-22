import {requestAPI} from './request';
import * as base58 from "../base58";
import json from 'circular-json';

class RpcClient {
  constructor(url) {
    this.url = url;
  }

  async getOutputCoin(paymentAdrr, viewingKey) {
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

    const response = await requestAPI(data, 'POST', this.url);

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
  }

  // hasSerialNumber return true if snd existed in database
  async hasSerialNumber(paymentAddr, serialNumberStrs) {
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

    const response = await requestAPI(data);

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
  }

  // hasSNDerivator return true if snd existed in database
  async hasSNDerivator(paymentAddr, snds) {
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

    const response = await httpRequest.requestAPI(data);

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
    // return false
  }

  // randomCommitmentsProcess randoms list commitment for proving
  async randomCommitmentsProcess(paymentAddr, inputCoinStrs) {
    const data = {
      "jsonrpc": "1.0",
      "method": "randomcommitments",
      "params": [
        paymentAddr,
        inputCoinStrs,
        // [
        //     {
        //         "PublicKey": "177KNe6pRhi97hD9LqjUvGxLoNeKh9F5oSeh99V6Td2sQcm7qEu",
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

    const response = await requestAPI(data);

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

      console.log("Len commitment: ", commitmentStrs.length);

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
  }

  async sendTx(tx) {
    // console.log("tx string : ", tx.toString());
    delete tx.sigPrivKey;
    let txJson = json.stringify(tx.convertTxToByte());
    console.log("txJson: ", txJson);


    // let tx1 = json.parse(txJson);
    // console.log("tx struct: ", tx1);

    let serializedTxJson = base58.checkEncode(privacyUtils.stringToBytes(txJson), constants.PRIVACY_VERSION);
    console.log("tx json serialize: ", serializedTxJson);


    const data = {
      "jsonrpc": "1.0",
      "method": "sendtransaction",
      "params": [
        serializedTxJson,
      ],
      "id": 1
    };

    const response = await requestAPI(data, "POST");
    console.log("response send tx: ", response);

    // if (response.status !== 200) {
    //     return {
    //         outCoins: [],
    //         err: new Error("Can't request API")
    //     }
    // } else {
    //     return {
    //         outCoins: response.data.Result.Outputs[viewingKey],
    //         err: null
    //     }
    // }
  }
}

module.exports = {RpcClient}