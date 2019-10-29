import { RPCHttpService } from './rpchttpservice';
import { checkDecode, checkEncode } from "../base58";
import { stringToBytes } from '../privacy/utils';
import { ENCODE_VERSION } from "../constants";
import { CustomError, ErrorObject } from '../errorhandler';

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

    let response;
    try{
      response = await this.rpcHttpService.postRequest(data);
    } catch(e){
      throw e;
    }

    if (response.status !== 200) {
      throw new Error("Can't request API check has serial number derivator");
    } else if (response.data.Error) {
      throw response.data.Error;
    }  

    return {
      existed: response.data.Result,
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

    let response;
    try{
      response = await this.rpcHttpService.postRequest(data);
      // console.log("response random commitment: ", response);
    } catch(e){
      throw e;
    }

    if (response.status !== 200) {
      throw new Error("Can't request API random commitments");
    } else if (response.data.Error) {
      throw response.data.Error;
    }  

    let commitmentStrs = response.data.Result.Commitments;

    // // deserialize commitments
    // let commitments = new Array(commitmentStrs.length);
    // for (let i = 0; i < commitments.length; i++) {
    //   let res = checkDecode(commitmentStrs[i]);

    //   if (res.version !== ENCODE_VERSION) {
    //     throw new Error("Base58 check decode wrong version");
    //   }

    //   commitments[i] = P256.decompress(res.bytesDecoded);
    // }

    return {
      commitmentIndices: response.data.Result.CommitmentIndices,
      commitmentStrs: commitmentStrs,
      myCommitmentIndices: response.data.Result.MyCommitmentIndexs,
    }
  };

  sendRawTx = async (serializedTxJson) => {
    const data = {
      "jsonrpc": "1.0",
      "method": "sendtransaction",
      "params": [
        serializedTxJson,
      ],
      "id": 1
    };

    let response;
    try{
      response = await this.rpcHttpService.postRequest(data);
    } catch(e){
      throw e;
    }

    if (response.status !== 200) {
      throw new Error("Can't request API send transaction");
    } else if (response.data.Error) {
      throw response.data.Error;
    } 

    console.log("**** SENDING TX SUCCESS, TxID: ", response.data.Result.TxID);
    return {
      txId: response.data.Result.TxID
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

    let response;
    try {
      response = await this.rpcHttpService.postRequest(data);
      console.log("response sendRawTxCustomToken", response);
    } catch(e){
      throw e;
    }

    if (response.status !== 200) {
      throw new Error("Can't request API send custom token transaction");
    } else if (response.data.Error) {
      throw response.data.Error;
    } 

    console.log("**** SENDING TX SUCCESS****");
    return {
      txId: response.data.Result.TxID
    }
  };

  // for tx custom token
  sendRawTxCustomTokenPrivacy = async (serializedTxJson) => {
    const data = {
      "jsonrpc": "1.0",
      "method": "sendrawprivacycustomtokentransaction",
      "params": [
        serializedTxJson,
      ],
      "id": 1
    };

    let response;
    try {
      response = await this.rpcHttpService.postRequest(data);
    } catch(e){
      throw e;
    }

    if (response.status !== 200) {
      throw new Error("Can't request API send privacy custom token transaction");
    } else if (response.data.Error) {
      throw response.data.Error;
    } 

    console.log("**** SENDING TX SUCCESS, TxID: ", response.data.Result.TxID);
    return {
      txId: response.data.Result.TxID
    }
  };

  listCustomTokens = async () => {
    const data = {
      "jsonrpc": "1.0",
      "method": "listcustomtoken",
      "params": [],
      "id": 1
    };

    let response;
    try {
      response = await this.rpcHttpService.postRequest(data);
    } catch(e){
      throw new CustomError(ErrorObject.GetListCustomTokenErr, "Can't request API get custom token list");
    }

    if (response.status !== 200) {
      throw new CustomError(ErrorObject.GetListCustomTokenErr, "Can't request API get custom token list");
    } else if (response.data.Error) {
      throw new CustomError(ErrorObject.GetListCustomTokenErr, response.data.Error.Message);
    }
    
    return {
      listCustomToken: response.data.Result.ListCustomToken,
    }
  };

  listPrivacyCustomTokens = async () => {
    const data = {
      "jsonrpc": "1.0",
      "method": "listprivacycustomtoken",
      "params": [],
      "id": 1
    };

    let response;
    try {
      response = await this.rpcHttpService.postRequest(data);
    } catch(e){
      throw new CustomError(ErrorObject.GetListPrivacyTokenErr, "Can't request API get privacy token list");
    }

    if (response.status !== 200) {
      throw new CustomError(ErrorObject.GetListPrivacyTokenErr, "Can't request API get privacy token list");
    } else if (response.data.Error) {
      throw new CustomError(ErrorObject.GetListPrivacyTokenErr, response.data.Error.Message);
    }
    
    return {
      listPrivacyToken: response.data.Result.ListCustomToken,
    }
  };

  getUnspentCustomToken = async (paymentAddrSerialize, tokenIDStr) => {
    const data = {
      "jsonrpc": "1.0",
      "method": "listunspentcustomtoken",
      "params": [paymentAddrSerialize, tokenIDStr],
      "id": 1
    };

    let response;
    try {
      response = await this.rpcHttpService.postRequest(data);
    } catch(e){
      throw e;
    }

    //todo: 
    // if (response.status !== 200) {
    //   throw new Error("Can't request API get list of unspent custom tokens");
    // } else if (response.data.Error) {
    //   throw response.data.Error;
    // }

    if (response.data.Result){
      return {
        listUnspentCustomToken: response.data.Result,
      }
    }
    
    // return {
    //   listUnspentCustomToken: response.data.Result,
    // }
  };

  getEstimateFeePerKB = async (paymentAddrSerialize, tokenIDStr = null) => {
    const data = {
      "jsonrpc": "1.0",
      "method": "estimatefeewithestimator",
      "params": [-1, paymentAddrSerialize, 8, tokenIDStr],
      "id": 1
    };

    let response;
    try {
      response = await this.rpcHttpService.postRequest(data);
    } catch(e){
      throw e;
    }

    if (response.status !== 200) {
      throw new Error("Can't request API get estimate fee per kilibyte");
    } else if (response.data.Error) {
      throw response.data.Error;
    }
    
    return {
      unitFee: parseInt(response.data.Result.EstimateFeeCoinPerKb)
    }
  }

  getTransactionByHash = async (txHashStr) => {
    const data = {

      "method": "gettransactionbyhash",
      "params": [
        txHashStr,
      ],
      "id": 1
    };

    let response;
    try {
      response = await this.rpcHttpService.postRequest(data);
    } catch(e){
      throw e;
    }

    if (response.status !== 200) {
      throw new Error("Can't request API get transaction by hash");
    } else if (response.data.Result === null && response.data.Error) {
      return {
        isInBlock: false,
        isInMempool: false,
        err: response.data.Error
      }
    }
    
    return {
      isInBlock: response.data.Result.IsInBlock,
      isInMempool: response.data.Result.IsInMempool,
      err: null
    }
  }

  getStakingAmount = async (type) => {
    const data = {
      "jsonrpc": "1.0",
      "method": "getstackingamount",
      "params": [type],
      "id": 1
    };

    let response;
    try {
      response = await this.rpcHttpService.postRequest(data);
    } catch(e){
      throw new CustomError(ErrorObject.GetStakingAmountErr, "Can't request API get staking amount");
    }

    if (response.status !== 200) {
      throw new CustomError(ErrorObject.GetStakingAmountErr, "Can't request API get staking amount");
    } else if (response.data.Error) {
      throw new CustomError(ErrorObject.GetStakingAmountErr, response.data.Error.Message || "Can't request API get staking amount");
    }
    
    return {
      res: Number(response.data.Result)
    }
  }

  getActiveShard = async () => {
    const data = {
      "jsonrpc": "1.0",
      "method": "getactiveshards",
      "params": [],
      "id": 1
    };

    let response;
    try {
      response = await this.rpcHttpService.postRequest(data);
    } catch(e){
      throw new CustomError(ErrorObject.GetActiveShardErr, "Can't request API get active shard nunber");
    }

    if (response.status !== 200) {
      throw new CustomError(ErrorObject.GetActiveShardErr, "Can't request API get active shard nunber");
    } else if (response.data.Error) {
      throw new CustomError(ErrorObject.GetActiveShardErr, response.data.Error.Message || "Can't request API get active shard nunber");
    }
    
    return {
      shardNumber: parseInt(response.data.Result)
    }
  }

  getMaxShardNumber = async () => {
    const data = {
      "jsonrpc": "1.0",
      "method": "getmaxshardsnumber",
      "params": [],
      "id": 1
    };

    let response;
    try {
      response = await this.rpcHttpService.postRequest(data);
    } catch(e){
      throw new CustomError(ErrorObject.GetMaxShardNumberErr, "Can't request API get max shard number");
    }

    if (response.status !== 200) {
      throw new CustomError(ErrorObject.GetMaxShardNumberErr, "Can't request API get max shard number");
    } else if (response.data.Error) {
      throw new CustomError(ErrorObject.GetMaxShardNumberErr, response.data.Error.Message);
    }
    
    return {
      shardNumber: parseInt(response.data.Result)
    }
  }

  hashToIdenticon = async (hashStrs) => {
    const data = {
      "jsonrpc": "1.0",
      "method": "hashtoidenticon",
      "params": hashStrs,
      "id": 1
    };

    let response;
    try {
      response = await this.rpcHttpService.postRequest(data);
    } catch(e){
      throw new CustomError(ErrorObject.HashToIdenticonErr, "Can't request API get image from hash string");
    }

    if (response.status !== 200) {
      throw new CustomError(ErrorObject.HashToIdenticonErr, "Can't request API get image from hash string");
    } else if (response.data.Error) {
      throw new CustomError(ErrorObject.HashToIdenticonErr, response.data.Error.Message);
    }
    
    return {
      images: response.data.Result
    }
  }

  getRewardAmount = async (paymentAddrStr) => {
    const data = {
      "jsonrpc": "1.0",
      "method": "getrewardamount",
      "params": [paymentAddrStr],
      "id": 1
    };

    let response;
    try {
      response = await this.rpcHttpService.postRequest(data);
    } catch(e){
      throw e;
    }

    if (response.status !== 200) {
      throw new Error("Can't request API get image from hash string");
    } else if (response.data.Error) {
      throw response.data.Error;
    }
    
    return {
      rewards: response.data.Result
    }
  }

  getBeaconBestState = async () => {
    const data = {
      "jsonrpc": "1.0",
      "method": "getbeaconbeststate",
      "params": [],
      "id": 1
    };

    let response;
    try {
      response = await this.rpcHttpService.postRequest(data);
    } catch(e){
      throw e;
    }

    if (response.status !== 200) {
      throw new Error("Can't request API get beacon best state");
    } else if (response.data.Error) {
      throw response.data.Error;
    }
    
    return {
      bestState: response.data.Result
    }
  }

  getPublicKeyRole = async (publicKey) => {
    const data = {
      "jsonrpc": "1.0",
      "method": "getpublickeyrole",
      "params": [publicKey],
      "id": 1
    };

    let response;
    try {
      response = await this.rpcHttpService.postRequest(data);
    } catch(e){
      throw e;
    }

    if (response.status !== 200) {
      throw new Error("Can't request API get public key role");
    } else if (response.data.Error) {
      throw response.data.Error;
    }
    
    return {
      status: response.data.Result
    }
  }

  getPDEState = async (beaconHeight) => {
    const data = {
      "jsonrpc": "1.0",
      "method": "getpdestate",
      "params": [{
        "BeaconHeight": beaconHeight
      }],
      "id": 1
    };

    let response;
    try {
      response = await this.rpcHttpService.postRequest(data);
    } catch(e){
      throw e;
    }

    if (response.status !== 200) {
      throw new Error("Can't request API get PDE state");
    } else if (response.data.Error) {
      throw response.data.Error;
    }
    
    return {
      status: response.data.Result
    }
  }
  
}

export { RpcClient };
