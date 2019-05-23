import json from 'circular-json';
import { RPCHttpService } from './rpchttpservice';
import { checkDecode, checkEncode } from "../base58";
import { P256 } from "privacy-js-lib/lib/ec";
import { stringToBytes } from 'privacy-js-lib/lib/privacy_utils';
import { ENCODE_VERSION } from "../constants";

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
          "PaymentAddress": paymentAdrr,
          "ReadonlyKey": viewingKey,
        }],
      ],
      "id": 1
    };

    if (tokenID != null) {
      data["params"][3] = tokenID;
    }

    let response;
    try {
      response = await this.rpcHttpService.postRequest(data);
    } catch(e){
      throw e;
    }

    if (response.status !== 200) {
      throw new Error("Can't request API get all output coins");
    } else if (response.data.Error) {
      throw response.data.Error;
    }

    return {
      outCoins: response.data.Result.Outputs[viewingKey]
    }
  };

  // hasSerialNumber return true if serial number existed in database
  hasSerialNumber = async (paymentAddr, serialNumberStrs, tokenID = null) => {
    const data = {
      "jsonrpc": "1.0",
      "method": "hasserialnumbers",
      "params": [
        paymentAddr,
        serialNumberStrs,
      ],
      "id": 1
    };

    if (tokenID != null) {
      data["params"][2] = tokenID;
    }

    let response;
    try{
      response = await this.rpcHttpService.postRequest(data);
    } catch(e){
      throw e;
    }
    
    if (response.status !== 200) {
      throw new Error("Can't request API check has serial number");
    } else if (response.data.Error) {
      throw response.data.Error;
    } 

    return {
      existed: response.data.Result
    }
  };

  // hasSNDerivator return true if snd existed in database
  hasSNDerivator = async (paymentAddr, snds, tokenID = null) => {
    const data = {
      "jsonrpc": "1.0",
      "method": "hassnderivators",
      "params": [
        paymentAddr,
        snds,
      ],
      "id": 1
    };
    if (tokenID != null) {
      data["params"][2] = tokenID;
    }

    const response = await this.rpcHttpService.postRequest(data);

    if (response.status !== 200) {
      return {
        existed: [],
        err: new Error("Can't request API check has serial number derivator")
      }
    } else if (response.data.Error) {
      return {
        existed: [],
        err: response.data.Error
      }
    }  

    return {
      existed: response.data.Result,
      err: null
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

    if (response.status !== 200) {
      return {
        commitmentIndices: [],
        commitments: [],
        myCommitmentIndices: [],
        err: new Error("Can't request API random commitments")
      }
    } else if (response.data.Error) {
      return {
        commitmentIndices: [],
        commitments: [],
        myCommitmentIndices: [],
        err: response.data.Error
      }
    }   

    let commitmentStrs = response.data.Result.Commitments;

    // deserialize commitments
    let commitments = new Array(commitmentStrs.length);
    for (let i = 0; i < commitments.length; i++) {
      let res = checkDecode(commitmentStrs[i]);

      if (res.version !== ENCODE_VERSION) {
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
  };

  

  sendRawTx = async (tx) => {
    console.log("SENDING TX ........");
    // hide private key for signing
    delete tx.sigPrivKey;

    // convert tx to json
    let txJson = json.stringify(tx.convertTxToByte());
    // console.log("txJson: ", txJson);

    // base58 check encode tx json
    console.log("base58 check encode tx json .....");
    let serializedTxJson = checkEncode(stringToBytes(txJson), ENCODE_VERSION);
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
    console.log("response send tx: ", response);

    if (response.status !== 200 || response.data.Result === null) {
      return {
        txId: null,
        err: response.data.Error,
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

    let txBytes = stringToBytes(txJson);
    console.log('TxBytes: ', txBytes.join(', '));
    console.log('TxBytes len : ', txBytes.length);

    // base58 check encode tx json
    let serializedTxJson = checkEncode(txBytes, ENCODE_VERSION);
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
        err: response.data.Error,
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

    let txBytes = stringToBytes(txJson);
    console.log('TxBytes: ', txBytes.join(', '));
    console.log('TxBytes len : ', txBytes.length);

    // base58 check encode tx json
    let serializedTxJson = checkEncode(txBytes, ENCODE_VERSION);
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
        err: new Error("Can't send tx"),
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

  listCustomTokens = async () => {
    const data = {
      "jsonrpc": "1.0",
      "method": "listcustomtoken",
      "params": [],
      "id": 1
    };

    // call API 
    const response = await this.rpcHttpService.postRequest(data);
    // console.log("response send tx: ", response);

    if (response.status !== 200) {
      return {
        err: new Error("Can't get list of custom tokens")
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

    // call API
    const response = await this.rpcHttpService.postRequest(data);
    if (response.status !== 200) {
      return {
        err: new Error("Can't get list of privacy custom tokens")
      }
    } else {
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

    // call API 
    const response = await this.rpcHttpService.postRequest(data);

    if (response.status !== 200 || response.data.Result === null) {
      return {
        listUnspentCustomToken: null,
        err: new Error("Can't get list of unspent custom tokens")
      }
    } else {
      return {
        listUnspentCustomToken: response.data.Result,
        err: response.data.Error
      }
    }
  };

  getEstimateFeePerKB = async (paymentAddrSerialize) => {
    const data = {
      "jsonrpc": "1.0",
      "method": "estimatefeewithestimator",
      "params": [-1, paymentAddrSerialize, 8],
      "id": 1
    };

    // call API to send tx
    const response = await this.rpcHttpService.postRequest(data);

    if (response.status !== 200) {
      return {
        unitFee: 0,
        err: new Error("Can't get estimate fee per kilibyte")
      }
    } else if (response.data.Error) {
      return {
        unitFee: 0,
        err: response.data.Error
      }
    }
    return {
      unitFee: parseInt(response.data.Result.EstimateFeeCoinPerKb),
      err: null
    }
  }

  
  

  getTransactionByHash = async (txHashStr) => {
    const data = {
      "jsonrpc": "1.0",
      "method": "gettransactionbyhash",
      "params": [
        txHashStr,
      ],
      "id": 1
    };

    // call API 
    const response = await this.rpcHttpService.postRequest(data).then(_ => { console.log('AAAAA', _); return _;});
    console.log("Response getTransactionByHash: ", JSON.parse(JSON.stringify(response)));
    console.log("txHashStr: ", txHashStr);

    if (response.data.Result === null && response.data.Error === null){
      console.log("Response getTransactionByHash is empty");
      return {
        err: new Error("Response getTransactionByHash is empty")
      }
    }

    if (response.status !== 200 || (response.data.Result === null && response.data.Error !== null)) {
      return {
        isInBlock: false,
        isInMempool: false,
        err: new Error(response.data.Error.Message),
      }
    } else {
      console.log("**** GET TX BY HASH DONE****");
      return {
        isInBlock: response.data.Result.IsInBlock,
        isInMempool: response.data.Result.IsInMempool,
        err: null,
      }
    }
  }

  getStakingAmount = async (type) => {
    const data = {
      "jsonrpc": "1.0",
      "method": "getstackingamount",
      "params": [type],
      "id": 1
    };

    // call API to send tx
    const response = await this.rpcHttpService.postRequest(data);
    console.log("response getStakingAmount: ", response);

    if (response.status !== 200 || response.data.Result === null || response.data.Error !== null) {
      return {
        res: false,
        err: new Error("Can't request API get tx by hash, " + response.data.Error),
      }
    } else {
      console.log("**** GET TX BY HASH DONE****");
      return {
        res: Number(response.data.Result),
        err: null,
      }
    }
  }

  

  getActiveShard = async () => {
    const data = {
      "jsonrpc": "1.0",
      "method": "getactiveshards",
      "params": [],
      "id": 1
    };
    // call API 
    const response = await this.rpcHttpService.postRequest(data);
    if (response.status !== 200) {
      return {
        err: new Error("Can't get active shard nunber")
      }
    } else {
      return {
        shardNumber: parseInt(response.data.Result),
        err: null
      }
    }
  }

  getMaxShardNumber = async () => {
    const data = {
      "jsonrpc": "1.0",
      "method": "getmaxshardsnumber",
      "params": [],
      "id": 1
    };
    // call API 
    const response = await this.rpcHttpService.postRequest(data);
    if (response.status !== 200) {
      return {
        err: new Error("Can't get max shard nunberr")
      }
    } else {
      return {
        shardNumber: parseInt(response.data.Result),
        err: null
      }
    }
  }

  hashToIdenticon = async (hashStrs) => {
    const data = {
      "jsonrpc": "1.0",
      "method": "hashtoidenticon",
      "params": hashStrs,
      "id": 1
    };
    // call API 
    const response = await this.rpcHttpService.postRequest(data);

    if (response.status !== 200 || response.data.Result === null) {
      return {
        err: new Error("Can't get image from hash string")
      }
    } else {
      return {
        images: response.data.Result,
        err: null
      }
    }
  }
}

export { RpcClient };
