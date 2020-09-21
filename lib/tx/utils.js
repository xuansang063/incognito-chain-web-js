import bn from 'bn.js';
import _ from 'lodash';
import { KeyWallet as keyWallet } from "../wallet/hdwallet";
import { estimateProofSize } from '../paymentproof';
import { CustomTokenParamTx } from "../tx/txcustomtokendata";
import { PrivacyTokenParamTx } from "../tx/txprivacytokendata";
import { PaymentInfo } from "../key";
import {
  SIG_PUB_KEY_SIZE,
  SIG_NO_PRIVACY_SIZE,
  SIG_PRIVACY_SIZE
} from "../constants";
import { PaymentAddressType, ReadonlyKeyType, MaxTxSize, PriKeyType } from '../wallet/constants';
import { CustomTokenInit, CustomTokenTransfer, MaxInputNumberForDefragment } from '../tx/constants';
import { CustomError, ErrorObject } from '../errorhandler';
import { CM_RING_SIZE } from "../privacy/constants";
import { Coin } from "../coin";
import { Wallet } from '../wallet/wallet';

// prepareInputForTx prepare inputs for privacy tx
/**
 *
 * @param {bigint} amountTransfer
 * @param {bigint} fee
 * @param {bool} hasPrivacy
 * @param {string} tokenID
 * @param {AccountWallet} account
 * @param {RpcClient} rpcClient
 */

/**
 *
 * @param {*} amountTransfer
 * @param {*} fee
 * @param {*} hasPrivacy
 * @param {*} tokenID
 * @param {*} account
 * @param {*} rpcClient
 */

const prepareInputForReplaceTxNormal = async (inCoinSerialNumbers, hasPrivacy, tokenID, account, rpcClient) => {
  // get all output coins
  let paymentAddrSerialize = account.key.base58CheckSerialize(PaymentAddressType);

  // get all output coins of spendingKey
  let allOutputCoinStrs;
  try {
    allOutputCoinStrs = await account.getAllOutputCoins(tokenID, rpcClient);
  } catch (e) {

    throw new CustomError(ErrorObject.GetOutputCoinsErr, e.message || "Can not get output coins when get unspent token");
  }

  // get coin detail of input coins to spent
  let inputCoinsToSpent = new Array(inCoinSerialNumbers.length);
  for (let i = 0; i < inputCoinsToSpent.length; i++) {
    inputCoinsToSpent[i] = allOutputCoinStrs.find(coin => {
      return coin.SNDerivator == inCoinSerialNumbers[i];
    });

    // get serial number from cache
    //todo: if not found: re-calculate
    const sndStr = `PRV_${inputCoinsToSpent[i].SNDerivator}`;
    inputCoinsToSpent[i].SerialNumber = account.derivatorToSerialNumberCache[sndStr];
  }

  // prepare random comitment list
  let commitmentIndices = []; // array index random of commitments in db
  let myCommitmentIndices = []; // index in array index random of commitment in db
  let commitmentStrs = [];

  // get commitment list from db for proving
  // call api to random commitments list
  if (hasPrivacy) {
    let response;
    try {
      response = await rpcClient.randomCommitmentsProcess(paymentAddrSerialize, inputCoinsToSpent, tokenID);
    } catch (e) {
      throw e;
    }

    commitmentIndices = response.commitmentIndices; // array index random of commitments in db
    myCommitmentIndices = response.myCommitmentIndices; // index in array index random of commitment in db
    commitmentStrs = response.commitmentStrs;


    // Check number of list of random commitments, list of random commitment indices
    if (commitmentIndices.length !== inputCoinsToSpent.length * CM_RING_SIZE) {
      throw new Error("Invalid random commitments");
    }
    if (myCommitmentIndices.length !== inputCoinsToSpent.length) {
      throw new Error("Number of list my commitment indices must be equal to number of input coins");
    }
  }

  let totalValueInput = new bn(0);
  for (let i = 0; i < inputCoinsToSpent.length; i++) {
    totalValueInput = totalValueInput.add(new bn(inputCoinsToSpent[i].Value));
  }

  return {
    paymentAddrSerialize: paymentAddrSerialize,
    inputCoinStrs: inputCoinsToSpent,
    totalValueInput: totalValueInput,
    commitmentIndices: commitmentIndices,
    myCommitmentIndices: myCommitmentIndices,
    commitmentStrs: commitmentStrs,
  };
};

const prepareInputForTx = async (amountTransfer, fee, hasPrivacy, tokenID, account, rpcClient) => {
  const unspentCoinStrs = await account.getUnspentToken(tokenID, rpcClient);

  // remove spending coins from list of unspent coins
  const unspentCoinExceptSpendingCoin = getUnspentCoinExceptSpendingCoin(unspentCoinStrs, account);

  // total amount transfer and fee
  amountTransfer = amountTransfer.add(fee);

  const respChooseBestCoin = chooseBestCoinToSpent(unspentCoinExceptSpendingCoin, amountTransfer);

  let inputCoinsToSpent = respChooseBestCoin.resultInputCoins;

  if (inputCoinsToSpent.length === 0 && amountTransfer.cmp(new bn(0)) !== 0) {
    throw new CustomError(ErrorObject.NotEnoughCoinError, "Not enough coin to spend");
  }

  return randomCommitment(amountTransfer, hasPrivacy, tokenID, account, rpcClient, inputCoinsToSpent);
};

const prepareInputForDefragments = async (coinId, account, rpcClient, noInputPerTx) => {
  const unspentCoinExceptSpendingCoin = (await getUnspentUTXOs(account, rpcClient, coinId)).defragmentUTXOStrs;
  const sortedUnspentCoins = _.orderBy(unspentCoinExceptSpendingCoin, item => item.Value);
  const parts = _.chunk(sortedUnspentCoins, noInputPerTx);
  const results = [];

  for (const part of parts) {
    const result = await randomCommitment(1, true, coinId, account, rpcClient, part);
    results.push(result);
  }

  return results;
};

const randomCommitment = async (amountTransfer, hasPrivacy, tokenID, account, rpcClient, inputCoinsToSpent) => {
  const paymentAddrSerialize = account.key.base58CheckSerialize(PaymentAddressType);

  // prepare random commitment list
  let commitmentIndices = []; // array index random of commitments in db
  let myCommitmentIndices = []; // index in array index random of commitment in db
  let commitmentStrs = [];

  // get commitment list from db for proving
  // call api to random commitments list
  if (hasPrivacy) {
    let response = {
      commitmentIndices: [],
      myCommitmentIndices: [],
      commitmentStrs: [],
    };

    if (amountTransfer.toString() !== '0') {
      response = await rpcClient.randomCommitmentsProcess(paymentAddrSerialize, inputCoinsToSpent, tokenID);
    }

    commitmentIndices = response.commitmentIndices; // array index random of commitments in db
    myCommitmentIndices = response.myCommitmentIndices; // index in array index random of commitment in db
    commitmentStrs = response.commitmentStrs;


    // Check number of list of random commitments, list of random commitment indices
    if (commitmentIndices.length !== inputCoinsToSpent.length * CM_RING_SIZE) {
      throw new Error("Invalid random commitments");
    }
    if (myCommitmentIndices.length !== inputCoinsToSpent.length) {
      throw new Error("Number of list my commitment indices must be equal to number of input coins");
    }
  }

  let totalValueInput = new bn(0);
  for (let i = 0; i < inputCoinsToSpent.length; i++) {
    totalValueInput = totalValueInput.add(new bn(inputCoinsToSpent[i].Value));
    // set info for input coin is null
    inputCoinsToSpent[i].Info = "";
  }

  return {
    paymentAddrSerialize: paymentAddrSerialize,
    inputCoinStrs: inputCoinsToSpent,
    totalValueInput: totalValueInput,
    commitmentIndices: commitmentIndices,
    myCommitmentIndices: myCommitmentIndices,
    commitmentStrs: commitmentStrs,
  };
};

/**
 *
 * @param {PrivacyTokenParamTx} tokenParams
 * @param {AccountWallet} account
 * @param {RpcClient} rpcClient
 * @param {bigint} feeToken
 * @param {bool} hasPrivacyForPToken
 */
const prepareInputForTxPrivacyToken = async (tokenParams, account, rpcClient, feeToken, hasPrivacyForPToken) => {
  let paymentAddressStr = account.key.base58CheckSerialize(PaymentAddressType);
  let response;
  try {
    response = await rpcClient.listPrivacyCustomTokens();
  } catch (e) {
    throw e;
  }
  let listPrivacyToken = response.listPrivacyToken;


  // paymentInfo for tx normal
  // tokenParams for tx custom token privacy data, but haven't tokenParam's tokenInputs
  switch (tokenParams.tokenTxType) {
    case CustomTokenInit: {
      return {
        tokenInputs: [],
        listPrivacyToken: listPrivacyToken,
        totalValueInput: new bn(0),
        commitmentIndices: [],
        myCommitmentIndices: [],
        commitmentStrs: [],

      }
    }
    case CustomTokenTransfer: {
      // prepare tokenParams' tokenInputs for tx custom token privacy
      let amountTokenPrivacyOutput = new bn(0);
      for (let i = 0; i < tokenParams.paymentInfoForPToken.length; i++) {
        amountTokenPrivacyOutput = amountTokenPrivacyOutput.add(new bn(tokenParams.paymentInfoForPToken[i].amount));

      }
      if (feeToken) {
        amountTokenPrivacyOutput = amountTokenPrivacyOutput.add(feeToken);
      }


      // get unspent pToken
      let unspentCoinStrs;
      try {
        // let resp = await getUnspentPrivacyTokenWithPrivKey(spendingKeyStr, tokenParams.propertyID.toLowerCase(), account, rpcClient);
        unspentCoinStrs = await account.getUnspentToken(tokenParams.propertyID.toLowerCase(), rpcClient);
      } catch (e) {
        throw new CustomError(ErrorObject.GetUnspentPrivacyTokenErr, e.message || e.Message || "Can not get unspent privacy token");
      }


      // remove spending coins from list of unspent coins
      let unspentCoinExceptSpendingCoin = getUnspentCoinExceptSpendingCoin(unspentCoinStrs, account);


      // get coin to spent using Knapsack
      let tokenInputs;
      try {
        tokenInputs = chooseBestCoinToSpent(unspentCoinExceptSpendingCoin, amountTokenPrivacyOutput).resultInputCoins;
      } catch (e) {
        throw e;
      }


      // prepare random comitment list
      let commitmentIndices = []; // array index random of commitments in db
      let myCommitmentIndices = []; // index in array index random of commitment in db
      let commitmentStrs = [];

      // get commitment list from db for proving
      // call api to random commitments list
      if (hasPrivacyForPToken) {
        let response;
        try {
          response = await rpcClient.randomCommitmentsProcess(paymentAddressStr, tokenInputs, tokenParams.propertyID.toLowerCase());
        } catch (e) {
          throw e;
        }

        commitmentIndices = response.commitmentIndices; // array index random of commitments in db
        myCommitmentIndices = response.myCommitmentIndices; // index in array index random of commitment in db
        commitmentStrs = response.commitmentStrs;


        // Check number of list of random commitments, list of random commitment indices
        if (commitmentIndices.length !== tokenInputs.length * CM_RING_SIZE) {
          throw new Error("pToken Invalid random commitments");
        }
        if (myCommitmentIndices.length !== tokenInputs.length) {
          throw new Error("pToken Number of list my commitment indices must be equal to number of input coins");
        }
      }

      let totalValueInput = new bn(0);
      for (let i = 0; i < tokenInputs.length; i++) {
        totalValueInput = totalValueInput.add(new bn(tokenInputs[i].Value));
        // set info for input coin is null
        tokenInputs[i].Info = "";
      }


      return {
        tokenInputs: tokenInputs,
        listPrivacyToken: listPrivacyToken,
        totalValueInput: totalValueInput,
        commitmentIndices: commitmentIndices,
        myCommitmentIndices: myCommitmentIndices,
        commitmentStrs: commitmentStrs,
      };
    }
  }
};

/**
 *
 * @param {PrivacyTokenParamTx} tokenParams
 * @param {AccountWallet} account
 * @param {RpcClient} rpcClient
 * @param {bigint} feeToken
 * @param {bool} hasPrivacyForPToken
 */
const prepareInputForReplaceTxPrivacyToken = async (inCoinSerialNumbers, account, rpcClient, hasPrivacyForPToken, tokenID) => {
  // get all output coins
  let paymentAddrSerialize = account.key.base58CheckSerialize(PaymentAddressType);
  let readOnlyKeySerialize = account.key.base58CheckSerialize(ReadonlyKeyType);

  let resGetOutputCoins;
  try {
    resGetOutputCoins = await rpcClient.listPrivacyCustomTokens();
  } catch (e) {
    throw e;
  }
  let listPrivacyToken = resGetOutputCoins.listPrivacyToken;


  // get all output coins of spendingKey
  let allOutputCoinStrs;
  try {
    allOutputCoinStrs = await account.getAllOutputCoins(tokenID, rpcClient);
  } catch (e) {

    throw new CustomError(ErrorObject.GetOutputCoinsErr, e.message || "Can not get output coins when get unspent token");
  }

  // get coin detail of input coins to spent
  let tokenInputs = new Array(inCoinSerialNumbers.length);
  for (let i = 0; i < tokenInputs.length; i++) {
    tokenInputs[i] = allOutputCoinStrs.find(coin => {
      return coin.SNDerivator == inCoinSerialNumbers[i];
    });

    // get serial number from cache
    //todo: if not found: re-calculate
    const sndStr = `${tokenID}_${tokenInputs[i].SNDerivator}`;
    tokenInputs[i].SerialNumber = account.derivatorToSerialNumberCache[sndStr];
  }


  // paymentInfo for tx normal
  // tokenParams for tx custom token privacy data, but haven't tokenParam's tokenInputs
  // only transfer token
  // switch (tokenParams.tokenTxType) {
  //   case CustomTokenInit: {
  //     return {
  //       tokenInputs: [],
  //       listPrivacyToken: listPrivacyToken,
  //       totalValueInput: new bn(0),
  //       commitmentIndices: [],
  //       myCommitmentIndices: [],
  //       commitmentStrs: [],

  //     }
  //   }
  //   case CustomTokenTransfer: {

  // prepare random comitment list
  let commitmentIndices = []; // array index random of commitments in db
  let myCommitmentIndices = []; // index in array index random of commitment in db
  let commitmentStrs = [];

  // get commitment list from db for proving
  // call api to random commitments list
  if (hasPrivacyForPToken) {
    let response;
    try {
      response = await rpcClient.randomCommitmentsProcess(paymentAddrSerialize, tokenInputs, tokenID.toLowerCase());
    } catch (e) {
      throw e;
    }

    commitmentIndices = response.commitmentIndices; // array index random of commitments in db
    myCommitmentIndices = response.myCommitmentIndices; // index in array index random of commitment in db
    commitmentStrs = response.commitmentStrs;


    // Check number of list of random commitments, list of random commitment indices
    if (commitmentIndices.length !== tokenInputs.length * CM_RING_SIZE) {
      throw new Error("pToken Invalid random commitments");
    }
    if (myCommitmentIndices.length !== tokenInputs.length) {
      throw new Error("pToken Number of list my commitment indices must be equal to number of input coins");
    }
  }

  let totalValueInput = new bn(0);
  for (let i = 0; i < tokenInputs.length; i++) {
    totalValueInput = totalValueInput.add(new bn(tokenInputs[i].Value));
    // set info for input coin is null
    tokenInputs[i].Info = "";
  }


  return {
    tokenInputs: tokenInputs,
    listPrivacyToken: listPrivacyToken,
    totalValueInput: totalValueInput,
    commitmentIndices: commitmentIndices,
    myCommitmentIndices: myCommitmentIndices,
    commitmentStrs: commitmentStrs,
  };
  // }
  // }
};

// chooseBestCoinToSpent return list of coins to spent using Greedy algorithm
const chooseBestCoinToSpent = (inputCoins, amount) => {
  console.time("chooseBestCoinToSpent")

  if (amount.cmp(new bn(0)) === 0) {
    return {
      resultInputCoins: [],
      remainInputCoins: inputCoins,
      totalResultInputCoinAmount: new bn(0)
    }
  }

  let resultInputCoins = [];
  let remainInputCoins = [];
  let totalResultInputCoinAmount = new bn(0);

  // either take the smallest coins, or a single largest one
  let inCoinOverAmount = null;
  let inCoinsUnderAmount = [];

  for (let i = 0; i < inputCoins.length; i++) {
    if (new bn(inputCoins[i].Value).cmp(amount) === -1) {
      inCoinsUnderAmount.push(inputCoins[i]);
    } else if (inCoinOverAmount === null) {
      inCoinOverAmount = inputCoins[i];
    } else if (new bn(inCoinOverAmount.Value).cmp(new bn(inputCoins[i].Value)) === 1) {
      remainInputCoins.push(inputCoins[i]);
    } else {
      remainInputCoins.push(inCoinOverAmount);
      inCoinOverAmount = inputCoins[i];
    }
  }

  inCoinsUnderAmount.sort(function (a, b) {
    return new bn(a.Value).cmp(new bn(b.Value));
  });

  for (let i = 0; i < inCoinsUnderAmount.length; i++) {
    if (totalResultInputCoinAmount.cmp(amount) === -1) {
      totalResultInputCoinAmount = totalResultInputCoinAmount.add(new bn(inCoinsUnderAmount[i].Value));
      resultInputCoins.push(inCoinsUnderAmount[i]);
    } else {
      remainInputCoins.push(inCoinsUnderAmount[i]);
    }
  }


  if (inCoinOverAmount != null && (new bn(inCoinOverAmount.Value).cmp(amount.mul(new bn(2))) === 1 || totalResultInputCoinAmount.cmp(amount) === -1)) {
    remainInputCoins.push(resultInputCoins);
    resultInputCoins = [inCoinOverAmount];
    totalResultInputCoinAmount = new bn(inCoinOverAmount.Value);
  } else if (inCoinOverAmount != null) {
    remainInputCoins.push(inCoinOverAmount);
  }

  if (totalResultInputCoinAmount.cmp(amount) === -1) {
    throw new CustomError(ErrorObject.NotEnoughCoinError, "Not enough coin");
  } else {
    console.timeEnd("chooseBestCoinToSpent")
    return {
      resultInputCoins: resultInputCoins,
      remainInputCoins: remainInputCoins,
      totalResultInputCoinAmount: totalResultInputCoinAmount
    };
  }
};

// cloneInputCoinArray clone array of input coins to new array
const cloneInputCoinJsonArray = (inputCoinsJson) => {
  let inputCoinsClone = new Array(inputCoinsJson.length);

  for (let i = 0; i < inputCoinsClone.length; i++) {
    let object = new Coin();
    object.PublicKey = inputCoinsJson[i].PublicKey;
    object.CoinCommitment = inputCoinsJson[i].CoinCommitment;
    object.SNDerivator = inputCoinsJson[i].SNDerivator;
    object.Randomness = inputCoinsJson[i].Randomness;
    object.SerialNumber = inputCoinsJson[i].SerialNumber;
    object.Value = inputCoinsJson[i].Value;
    object.Info = inputCoinsJson[i].Info;

    inputCoinsClone[i] = object;
  }
  return inputCoinsClone;
}


// estimateFee receives params and returns a fee (PRV or pToken) in number
/**
 *
 * @param {string} paymentAddrSerialize
 * @param {number} numInputCoins
 * @param {number} numOutputs
 * @param {bool} hasPrivacyForNativeToken
 * @param {bool} hasPrivacyForPToken
 * @param {*} metadata
 * @param {RpcClient} rpcClient
 * @param {CustomTokenParamTx} customTokenParams
 * @param {PrivacyTokenParamTx} privacyTokenParams
 * @param {bool} isGetTokenFee
 */
const estimateFee = async (paymentAddrSerialize, numInputCoins, numOutputs, hasPrivacyForNativeToken, hasPrivacyForPToken, metadata, rpcClient, customTokenParams = null, privacyTokenParams = null, isGetTokenFee = false) => {
  let tokenIDStr = null;
  if (isGetTokenFee == true) {
    if (customTokenParams != null) {
      tokenIDStr = customTokenParams.propertyID;
    }
    if (privacyTokenParams != null) {
      tokenIDStr = privacyTokenParams.propertyID;
    }
  }

  let unitFee;
  try {
    unitFee = await rpcClient.getEstimateFeePerKB(paymentAddrSerialize, tokenIDStr);
  } catch (e) {
    throw new CustomError(ErrorObject.GetUnitFeeErr, "Can not get unit fee when estimate");
  }

  let txSize = estimateTxSize(numInputCoins, numOutputs, hasPrivacyForNativeToken, hasPrivacyForPToken, metadata, customTokenParams, privacyTokenParams);


  // check tx size
  if (txSize > MaxTxSize) {
    throw new CustomError(ErrorObject.TxSizeExceedErr, "tx size is exceed error");
  }


  return (txSize + 1) * unitFee.unitFee;
};

/**
 *
 * @param {string} from
 * @param {string} to
 * @param {number} amount
 * @param {AccountWallet} account
 * @param {bool} isPrivacy
 * @param {RpcClient} rpcClient
 * @param {CustomTokenParamTx} customTokenParams
 * @param {PrivacyTokenParamTx} privacyTokenParams
 * @param {bool} isGetTokenFee
 */
const getEstimateFee = async (from, to, amount, account, isPrivacyForNativeToken, isPrivacyForPToken, rpcClient, customTokenParams = null, privacyTokenParams = null, isGetTokenFee = false) => {
  let receiverKeyWallet = keyWallet.base58CheckDeserialize(to);
  let paymentInfos = [];
  let amountBN = new bn(0);
  if (customTokenParams == null && privacyTokenParams == null) {
    paymentInfos = new Array(1);
    paymentInfos[0] = new PaymentInfo(receiverKeyWallet.KeySet.PaymentAddress, new bn(amount));
    amountBN = new bn(amount);
  }

  let tokenID = null;
  if (customTokenParams != null) {
    tokenID = customTokenParams.propertyID;
  } else if (privacyTokenParams != null) {
    tokenID = privacyTokenParams.propertyID;
  }

  //
  //
  //

  // prepare input for native token tx
  let inputForTx;
  try {
    inputForTx = await prepareInputForTx(amountBN, new bn(0), isPrivacyForNativeToken, tokenID, account, rpcClient);
  } catch (e) {
    throw e;
  }

  // estimate fee
  let fee;
  try {
    fee = await estimateFee(from, inputForTx.inputCoinStrs.length, paymentInfos.length, isPrivacyForNativeToken, isPrivacyForPToken, null, rpcClient, customTokenParams, privacyTokenParams, isGetTokenFee);
  } catch (e) {
    throw e;
  }

  return fee;
};

/**
 *
 * @param {string} from
 * @param {string} to
 * @param {number} amount
 * @param {{Privacy: boolean, TokenID: string, TokenName: string, TokenSymbol: string, TokenTxType: number TokenAmount: number, TokenReceivers: {[string]: number}}} tokenObject
 * @param {AccountWallet} account
 * @param {RpcClient} rpcClient
 * @param {bool} isPrivacyForNativeToken
 * @param {bool} isPrivacyForPrivateToken
 * @param {number} feeToken
 * @param {bool} isGetTokenFee
 */
// PRV fee
const getEstimateFeeForPToken = async (from, to, amount, tokenObject, account, rpcClient, isPrivacyForNativeToken, isPrivacyForPrivateToken, feeToken, isGetTokenFee = false) => {
  let id = "";
  let name = "";
  let symbol = "";
  if (tokenObject.TokenID !== null) {
    id = tokenObject.TokenID;
  }
  if (tokenObject.TokenName !== null) {
    name = tokenObject.TokenName;
  }
  if (tokenObject.TokenSymbol !== null) {
    symbol = tokenObject.TokenSymbol;
  }

  if (isGetTokenFee) {
    feeToken = 0;
  }

  // @@@NOTE: for custom token
  // if (tokenObject.Privacy === false) {
  //   let receivers = new TxTokenVout();
  //   receivers.set(
  //     keyWallet.base58CheckDeserialize(tokenObject.TokenReceivers.PaymentAddress).KeySet.PaymentAddress,
  //     tokenObject.TokenReceivers.Amount
  //   );

  //   let customTokenParams = new CustomTokenParamTx();
  //   customTokenParams.set(id, name, symbol,
  //     amount, tokenObject.TokenTxType, [receivers],
  //     [], tokenObject.TokenAmount);

  //   let inputForCustomTx;
  //   try {
  //     inputForCustomTx = await prepareInputForCustomTokenTx(privatekeyStr, customTokenParams, rpcClient);
  //     customTokenParams.vins = inputForCustomTx.tokenVins;
  //   } catch (e) {
  //     throw e;
  //   }

  //   let fee;
  //   try {
  //     fee = await getEstimateFee(from, to, amount, privatekeyStr, account, false, rpcClient, customTokenParams);
  //   } catch (e) {
  //     throw e;
  //   }

  //   return fee;
  // } else if (tokenObject.Privacy === true) {

  let privacyTokenParam = {
    propertyID: id,
    propertyName: name,
    propertySymbol: symbol,
    amount: amount,
    tokenTxType: tokenObject.TokenTxType,
    fee: feeToken,
    paymentInfoForPToken: [{
      paymentAddressStr: tokenObject.TokenReceivers.PaymentAddress,
      amount: tokenObject.TokenReceivers.Amount
    }],
    tokenInputs: [],
  }

  let inputForPrivacyToken;
  try {
    inputForPrivacyToken = await prepareInputForTxPrivacyToken(privacyTokenParam, account, rpcClient, new bn(feeToken), isPrivacyForPrivateToken);
    privacyTokenParam.tokenInputs = inputForPrivacyToken.tokenInputs;
  } catch (e) {
    throw e;
  }


  let fee;
  try {
    fee = await getEstimateFee(from, to, amount, account, isPrivacyForNativeToken, isPrivacyForPrivateToken, rpcClient, null, privacyTokenParam, isGetTokenFee);
  } catch (e) {
    throw e;
  }
  return fee;
}

/**
 *
 * @param {string} from
 * @param {string} to
 * @param {{Privacy: boolean, TokenID: string, TokenName: string, TokenSymbol: string, TokenTxType: number TokenAmount: number, TokenReceivers: {[string]: number}}} tokenObject
 * @param {AccountWallet} account
 * @param {RpcClient} rpcClient
 * @param {bool} isPrivacyForPrivateToken
 */
// getMaxWithdrawAmount return maximum amount pToken can be withdrawed
// it just be called before withdraw pToken
async function getMaxWithdrawAmount(from, to, tokenObject, account, rpcClient, isPrivacyForPrivateToken) {
  let id = "";
  let name = "";
  let symbol = "";
  if (tokenObject.TokenID !== null) {
    id = tokenObject.TokenID;
  }
  if (tokenObject.TokenName !== null) {
    name = tokenObject.TokenName;
  }
  if (tokenObject.TokenSymbol !== null) {
    symbol = tokenObject.TokenSymbol;
  }

  // token param
  // get current token to get token param
  let tokenParamJson = {
    propertyID: id,
    propertyName: name,
    propertySymbol: symbol,
    amount: 0,
    tokenTxType: tokenObject.TokenTxType,
    fee: 0,
    paymentInfoForPToken: [{
      paymentAddressStr: tokenObject.TokenReceivers.PaymentAddress,
      amount: tokenObject.TokenReceivers.Amount
    }],
    tokenInputs: [],
  };


  let totalpTokenAmount = new bn(0);

  try {
    let unspentToken = await account.getUnspentToken(tokenParamJson.propertyID.toLowerCase(), rpcClient);
    tokenParamJson.tokenInputs = unspentToken;

    for (let i = 0; i < unspentToken.length; i++) {
      totalpTokenAmount = totalpTokenAmount.add(new bn(unspentToken[i].Value));
    }
  } catch (e) {
    throw e;
  }

  let isRatePToken;
  try {
    isRatePToken = await Wallet.RpcClient.isExchangeRatePToken(tokenParamJson.propertyID);
  } catch (e) {

    isRatePToken = false;
  }

  let isGetTokenFee = false;
  if (isRatePToken) {
    isGetTokenFee = true;
  }

  let fee;
  try {
    fee = await getEstimateFee(from, to, 0, account, false, isPrivacyForPrivateToken, rpcClient, null, tokenParamJson, isGetTokenFee);
  } catch (e) {
    // get fee in native token
    if (isGetTokenFee) {
      isGetTokenFee = false;
      try {
        fee = await getEstimateFee(from, to, 0, account, false, isPrivacyForPrivateToken, rpcClient, null, tokenParamJson, isGetTokenFee);
      } catch (e) {
        throw e;
      }
    } else {
      throw e;
    }
  }

  let maxWithdrawAmount = totalpTokenAmount;
  if (isGetTokenFee) {
    maxWithdrawAmount = maxWithdrawAmount.sub(new bn(fee));
  }

  return {
    maxWithdrawAmount: maxWithdrawAmount.toNumber(),
    feeCreateTx: fee,
    feeForBurn: fee,
    isGetTokenFee: isGetTokenFee
  };
}

// @@@NOTE: for defragment feature
// const getEstimateFeeToDefragment = async (from, amount, privatekeyStr, account, isPrivacy, rpcClient) => {
//   amount = new bn(amount);

//   let senderPaymentAddress = keyWallet.base58CheckDeserialize(from);

//   // totalAmount was paid for fee
//   let defragmentUTXO, totalAmount;
//   console.time("getUTXOsToDefragment")
//   try {
//     let result = await getUTXOsToDefragment(privatekeyStr, new bn(0), account, amount, rpcClient);
//
//     defragmentUTXO = result.defragmentUTXO;
//     totalAmount = result.totalAmount;
//   } catch (e) {
//
//     throw e;
//   }

//   console.timeEnd("getUTXOsToDefragment")
//

//   // create paymentInfos
//   let paymentInfos = new Array(1);
//   paymentInfos[0] = new PaymentInfo(
//     senderPaymentAddress,
//     totalAmount
//   );

//   let fee;
//   try {
//     fee = await estimateFee(from, defragmentUTXO, paymentInfos, isPrivacy, false, null, rpcClient);
//   } catch (e) {
//     throw e;
//   }
//   return fee;
// };

/**
 *
 * @param {number} numInputCoins
 * @param {number} numOutputCoins
 * @param {bool} hasPrivacyForNativeToken
 * @param {bool} hasPrivacyForPToken
 * @param {*} metadata
 * @param {CustomTokenParamTx} customTokenParams
 * @param {PrivacyTokenParamTxObject} privacyCustomTokenParams
 */
const estimateTxSize = (numInputCoins, numOutputCoins, hasPrivacyForNativeToken, hasPrivacyForPToken, metadata, customTokenParams, privacyCustomTokenParams) => {
  let sizeVersion = 1; // int8
  let sizeType = 5;    // string, max : 5
  let sizeLockTime = 8; // int64
  let sizeFee = 8;      // uint64

  let sizeInfo = 0;
  if (hasPrivacyForNativeToken) {
    sizeInfo = 64;
  }
  let sizeSigPubKey = SIG_PUB_KEY_SIZE;
  let sizeSig = SIG_NO_PRIVACY_SIZE;
  if (hasPrivacyForNativeToken) {
    sizeSig = SIG_PRIVACY_SIZE;
  }

  let sizeProof = estimateProofSize(numInputCoins, numOutputCoins, hasPrivacyForNativeToken);

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

    if (customTokenParams.vins !== null) {
      for (let i = 0; i < customTokenParams.vins.length; i++) {
        customTokenDataSize += customTokenParams.vins[i].paymentAddress.toBytes().length;
        customTokenDataSize += customTokenParams.vins[i].txCustomTokenID.slice(0).length;
        customTokenDataSize += customTokenParams.vins[i].signature.length;
        customTokenDataSize += 4;
      }
      sizeTx += customTokenDataSize;
    }
  }
  if (privacyCustomTokenParams !== null && typeof privacyCustomTokenParams !== "undefined") {
    let privacyTokenDataSize = 0;

    privacyTokenDataSize += privacyCustomTokenParams.propertyID.length;
    privacyTokenDataSize += privacyCustomTokenParams.propertySymbol.length;
    privacyTokenDataSize += privacyCustomTokenParams.propertyName.length;

    privacyTokenDataSize += 8; // for amount
    privacyTokenDataSize += 4; // for TokenTxType
    privacyTokenDataSize += 1; // int8 version
    privacyTokenDataSize += 5; // string, max : 5 type
    privacyTokenDataSize += 8; // int64 locktime
    privacyTokenDataSize += 8; // uint64 fee

    privacyTokenDataSize += 64; // info

    privacyTokenDataSize += SIG_PUB_KEY_SIZE; // sig pubkey
    privacyTokenDataSize += SIG_PRIVACY_SIZE; // sig

    // Proof
    if (privacyCustomTokenParams.tokenInputs !== null) {
      privacyTokenDataSize += estimateProofSize(privacyCustomTokenParams.tokenInputs.length, privacyCustomTokenParams.paymentInfoForPToken.length, hasPrivacyForPToken);
    }
    privacyTokenDataSize += 1; //PubKeyLastByte
    sizeTx += privacyTokenDataSize

  }
  return Math.ceil(sizeTx / 1024.0) + 2; // buffer more 2 kb on tx size
};

// @@@NOTE: for defragment feature
const getUTXOsToDefragment = async (spendingKeyStr, fee, account, amount, rpcClient, coinId) => {
  // deserialize spending key string to key wallet
  const myKeyWallet = keyWallet.base58CheckDeserialize(spendingKeyStr);

  // import key set
  myKeyWallet.KeySet.importFromPrivateKey(myKeyWallet.KeySet.PrivateKey);

  // serialize payment address, readonlyKey
  const paymentAddrSerialize = myKeyWallet.base58CheckSerialize(PaymentAddressType);
  const readOnlyKeySerialize = myKeyWallet.base58CheckSerialize(ReadonlyKeyType);

// get all output coins of spendingKey
  let allOutputCoinStrs = await account.getAllOutputCoins(coinId, rpcClient);

  if (allOutputCoinStrs.length === 0) {
    throw new Error('Have no item in list output coins');
  }

  // parse input coin from string
  // leftOutputCoinStrs: is not cached
  const {uncachedOutputCoinStrs, cachedOutputCoinStrs, cachedInputCoins} = account.analyzeOutputCoinFromCached(allOutputCoinStrs);
  let inputCoins = cachedInputCoins;

  //

  // cache leftOutputCoinStrs
  if (uncachedOutputCoinStrs.length > 0) {
    let uncachedInputCoins = parseInputCoinFromEncodedObject(uncachedOutputCoinStrs, account.key, account.derivatorPointCached);
    account.mergeDerivatorCached();
    account.mergeInputCoinJsonCached(uncachedOutputCoinStrs, uncachedInputCoins);
    inputCoins = inputCoins.concat(uncachedInputCoins);
    allOutputCoinStrs = cachedOutputCoinStrs.concat(uncachedOutputCoinStrs);
  }

  // get unspent coin from cache
  let {unspentInputCoinsFromCached, unspentInputCoinsFromCachedStrs} = account.analyzeSpentCoinFromCached(inputCoins, allOutputCoinStrs);

  let resp = await getUnspentCoin(unspentInputCoinsFromCached, paymentAddrSerialize, unspentInputCoinsFromCachedStrs, null, rpcClient);
  const unspentCoins = resp.unspentCoins;
  const unspentCoinStrs = resp.unspentCoinStrs;


  // get list of spending coins, which in tx in mempool
  const {
    UTXOExceptSpeningCoin,
    UTXOExceptSpeningCoinStrs,
  } = getUTXOsExceptSpendingCoin(unspentCoins, unspentCoinStrs, account);
  //

  // get UTXO less than amount
  let defragmentUTXO = [];
  let defragmentUTXOStr = [];
  let totalAmount = new bn(0);
  let numUTXO = 0;

  for (let i = 0; i < UTXOExceptSpeningCoin.length; i++) {
    if (UTXOExceptSpeningCoin[i].coinDetails.value.cmp(amount) !== 1) {
      defragmentUTXO.push(UTXOExceptSpeningCoin[i]);
      defragmentUTXOStr.push(UTXOExceptSpeningCoinStrs[i]);
      totalAmount = totalAmount.add(UTXOExceptSpeningCoin[i].coinDetails.value);
      numUTXO++;
      if (numUTXO >= MaxInputNumberForDefragment) {
        break;
      }
    }
  }


  totalAmount = totalAmount.sub(fee);

  if (totalAmount.cmp(new bn(0)) == -1) {

    throw new CustomError(ErrorObject.InvalidNumberUTXOToDefragment, "No UTXO has value less than amount defragment");
  }


  return {
    defragmentUTXO: defragmentUTXO,
    defragmentUTXOStr: defragmentUTXOStr,
    totalAmount: totalAmount,
  };
};

const getUnspentUTXOs = async (account, rpcClient, coinId) => {
  const spendingKeyStr = account.key.base58CheckSerialize(PriKeyType);
  const paymentAddrSerialize = account.key.base58CheckSerialize(PaymentAddressType);

  let allOutputCoinStrs = await account.getAllOutputCoins(coinId, rpcClient);

  // divide all of output coins into uncached and cached out put coins list
  let {
    uncachedOutputCoinStrs,
    cachedOutputCoinStrs,
  } = account.analyzeOutputCoinFromCached(allOutputCoinStrs, coinId);

  // calculate serial number uncachedOutputCoinStrs and cache
  if (uncachedOutputCoinStrs.length > 0) {
    const res = await account.deriveSerialNumbers(spendingKeyStr, uncachedOutputCoinStrs, coinId);
    uncachedOutputCoinStrs = res.inCoinStrs;
    allOutputCoinStrs = cachedOutputCoinStrs.concat(uncachedOutputCoinStrs);
  }

  const { unspentInputCoinsFromCachedStrs } = account.analyzeSpentCoinFromCached(allOutputCoinStrs, coinId);

  // check whether unspent coin from cache is spent or not
  const {
    unspentCoinStrs,
  } = await getUnspentCoin(spendingKeyStr, paymentAddrSerialize, unspentInputCoinsFromCachedStrs, coinId, rpcClient);

  return getUTXOsExceptSpendingCoin(unspentCoinStrs, account);
};

const getUTXOsExceptSpendingCoin = (unspentCoinStrs, account) => {
  let result = {
    defragmentUTXOStrs: unspentCoinStrs
  };

  if (account.spendingCoins && account.spendingCoins.length) {
    const spendingSNs = [];

    account.spendingCoins.forEach(spendingCoin =>
      spendingCoin.spendingSNs.forEach(serialNumber => {
        spendingSNs.push(serialNumber);
      })
    );

    const UTXOExceptSpendingCoinStrs = unspentCoinStrs
      .filter(coin => !spendingSNs.includes(coin.SerialNumber));

    result = {
      defragmentUTXOStrs: UTXOExceptSpendingCoinStrs
    }
  }

  result.totalAmount = new bn(0);
  result.defragmentUTXOStrs.forEach(utxo => {
    result.totalAmount = result.totalAmount.add(new bn(utxo.Value));
  });

  return result;
};

const getUnspentCoinExceptSpendingCoin = (unspentCoinStrs, account) => {
  //
  //

  if (account.spendingCoins) {
    if (account.spendingCoins.length) {
      let unspentCoinExceptSpendingCoin = cloneInputCoinJsonArray(unspentCoinStrs);
      for (let i = 0; i < account.spendingCoins.length; i++) {
        for (let j = 0; j < account.spendingCoins[i].spendingSNs.length; j++) {
          for (let k = 0; k < unspentCoinExceptSpendingCoin.length; k++) {
            //
            //
            if (account.spendingCoins[i].spendingSNs[j] === unspentCoinExceptSpendingCoin[k].SerialNumber) {
              unspentCoinExceptSpendingCoin.splice(k, 1);
            }
          }
        }
      }

      return unspentCoinExceptSpendingCoin;
    }
  }

  return unspentCoinStrs;
}

// getUnspentCoin returns unspent coins
const getUnspentCoin = async (spendingKeyStr, paymentAddrSerialize, inCoinStrs, tokenID, rpcClient) => {

  let unspentCoinStrs = new Array();
  let serialNumberStrs = new Array();

  for (let i = 0; i < inCoinStrs.length; i++) {
    serialNumberStrs.push(inCoinStrs[i].SerialNumber);
  }


  // check whether each input coin is spent or not
  let response;
  try {
    response = await rpcClient.hasSerialNumber(paymentAddrSerialize, serialNumberStrs, tokenID);
  } catch (e) {
    throw e;
  }

  let existed = response.existed;
  if (existed.length != inCoinStrs.length) {
    throw new Error("Wrong response when check has serial number");
  }

  for (let i = 0; i < existed.length; i++) {
    if (!existed[i]) {
      unspentCoinStrs.push(inCoinStrs[i]);
    }
  }

  return {
    unspentCoinStrs: unspentCoinStrs
  };
};

function newParamInitTx(senderSkStr, paramPaymentInfos, inputCoinStrs, fee, isPrivacy, tokenID, metaData, info, commitmentIndices, myCommitmentIndices, commitmentStrs, sndOutputs) {
  let param = {
    "senderSK": senderSkStr,
    "paramPaymentInfos": paramPaymentInfos,
    "inputCoinStrs": inputCoinStrs,
    "fee": fee,
    "isPrivacy": isPrivacy,
    "tokenID": tokenID,
    "metaData": metaData,
    "info": info,
    "commitmentIndices": commitmentIndices,
    "myCommitmentIndices": myCommitmentIndices,
    "commitmentStrs": commitmentStrs,
    "sndOutputs": sndOutputs
  };

  return param
}

function newParamInitPrivacyTokenTx(senderSkStr, paramPaymentInfos, inputCoinStrs, fee, isPrivacy, isPrivacyForPToken, privacyTokenParam, metaData, info,
                                    commitmentIndicesForNativeToken, myCommitmentIndicesForNativeToken, commitmentStrsForNativeToken, sndOutputsForNativeToken,
                                    commitmentIndicesForPToken, myCommitmentIndicesForPToken, commitmentStrsForPToken, sndOutputsForPToken
) {
  let param = {
    "senderSK": senderSkStr,
    "paramPaymentInfos": paramPaymentInfos,
    "inputCoinStrs": inputCoinStrs,
    "fee": fee,
    "isPrivacy": isPrivacy,
    "isPrivacyForPToken": isPrivacyForPToken,
    "privacyTokenParam": privacyTokenParam,
    "metaData": metaData,
    "info": info,
    "commitmentIndicesForNativeToken": commitmentIndicesForNativeToken,
    "myCommitmentIndicesForNativeToken": myCommitmentIndicesForNativeToken,
    "commitmentStrsForNativeToken": commitmentStrsForNativeToken,
    "sndOutputsForNativeToken": sndOutputsForNativeToken,

    "commitmentIndicesForPToken": commitmentIndicesForPToken,
    "myCommitmentIndicesForPToken": myCommitmentIndicesForPToken,
    "commitmentStrsForPToken": commitmentStrsForPToken,
    "sndOutputsForPToken": sndOutputsForPToken,
  };

  return param
}

export {
  prepareInputForTx,
  prepareInputForTxPrivacyToken,
  chooseBestCoinToSpent,
  cloneInputCoinJsonArray,
  estimateFee,
  getEstimateFee,
  getEstimateFeeForPToken,
  // getEstimateFeeToDefragment,
  estimateTxSize,
  // getUTXOsToDefragment,
  // getUTXOsExceptSpendingCoin,
  getUnspentCoinExceptSpendingCoin,
  getUnspentCoin,
  getMaxWithdrawAmount,
  newParamInitTx,
  newParamInitPrivacyTokenTx,
  prepareInputForReplaceTxNormal,
  prepareInputForReplaceTxPrivacyToken,
  prepareInputForDefragments,
};
