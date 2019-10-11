import bn from 'bn.js';
import { KeyWallet as keyWallet } from "../wallet/hdwallet";
import { estimateProofSize } from '../payment';
import { CustomTokenParamTx } from "../tx/txcustomtokendata";
import { PrivacyTokenParamTx } from "../tx/txprivacytokendata";
import { PaymentInfo } from "../key";
import {
  ENCODE_VERSION,
  SIG_PUB_KEY_SIZE,
  SIG_NO_PRIVACY_SIZE,
  SIG_PRIVACY_SIZE,
  ED25519_KEY_SIZE,
} from "../constants";
import { PaymentAddressType, ReadonlyKeyType, MaxTxSize } from '../wallet/constants';
import { CustomTokenInit, CustomTokenTransfer } from '../tx/constants';
import { CustomError, ErrorObject } from '../errorhandler';
import { CM_RING_SIZE } from "privacy-js-lib/lib/zkps/constants";

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

const prepareInputForTx = async (amountTransfer, fee, hasPrivacy, tokenID, account, rpcClient) => {
  let paymentAddrSerialize = account.key.base58CheckSerialize(PaymentAddressType);
  // get unspent output coin with tokenID
  let unspentCoinStrs = await account.getUnspentToken(tokenID, rpcClient);

  // remove spending coins from list of unspent coins
  let unspentCoinExceptSpendingCoin = getUnspentCoinExceptSpendingCoin(unspentCoinStrs, account);
  console.log("unspentCoinExceptSpeningCoin: ", unspentCoinExceptSpendingCoin);

  // total amount transfer and fee
  amountTransfer = amountTransfer.add(fee);
  console.log("amountTransfer: ", amountTransfer);

  let respChooseBestCoin;
  try {
    respChooseBestCoin = chooseBestCoinToSpent(unspentCoinExceptSpendingCoin, amountTransfer);
  } catch (e) {
    console.log("Error when chooseBestCoinToSpent", e)
    throw e;
  }

  let inputCoinsToSpent = respChooseBestCoin.resultInputCoins;
  console.log("inputCoinsToSpent: ", inputCoinsToSpent);

  if (inputCoinsToSpent.length == 0 && amountTransfer.cmp(new bn(0)) != 0) {
    throw new CustomError(ErrorObject.NotEnoughCoinError, "Not enough coin to spend");
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
      console.log("response random commitments: ", response);
    } catch (e) {
      throw e;
    }

    commitmentIndices = response.commitmentIndices; // array index random of commitments in db
    myCommitmentIndices = response.myCommitmentIndices; // index in array index random of commitment in db
    commitmentStrs = response.commitmentStrs;

    console.log("Random commitment ok!!!!!");

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

// const prepareInputForCustomTokenTx = async (spendingKeyStr, tokenParams, rpcClient) => {
//   let senderKeyWallet = keyWallet.base58CheckDeserialize(spendingKeyStr);
//   senderKeyWallet.KeySet.importFromPrivateKey(senderKeyWallet.KeySet.PrivateKey);

//   let response;
//   try {
//     response = await rpcClient.listCustomTokens();
//   } catch (e) {
//     throw e;
//   }

//   let listCustomToken = response.listCustomToken;

//   switch (tokenParams.tokenTxType) {
//     case CustomTokenInit: {
//       return {
//         listCustomToken: listCustomToken,
//         tokenVins: null,
//       }
//     }
//     case CustomTokenTransfer: {
//       // sum of custom tokens' value in tokenParams.receivers
//       let vOutAmount = 0;
//       for (let i = 0; i < tokenParams.receivers.length; i++) {
//         vOutAmount += tokenParams.receivers[i].value;
//       }

//       // get unspent custom token with propertyID
//       try {
//         response = await rpcClient.getUnspentCustomToken(
//           senderKeyWallet.base58CheckSerialize(PaymentAddressType),
//           tokenParams.propertyID
//         );
//       } catch (e) {
//         throw new CustomError(ErrorObject.GetUnspentCustomTokenErr, e.message || e.Message);
//       }

//       let listUnspentCustomToken = response.listUnspentCustomToken;

//       if (listUnspentCustomToken.length === 0) {
//         throw new CustomError(ErrorObject.NotEnoughTokenError, "Balance of token is zero");
//       }

//       // get enough cutsom token for spending
//       let tokenVins = new Array(0);
//       let vinAmount = 0;

//       for (let i = 0; i < listUnspentCustomToken.length; i++) {
//         vinAmount += listUnspentCustomToken[i].Value;

//         let tokenVoutsTmp = new TxTokenVout();
//         tokenVoutsTmp.set(senderKeyWallet.KeySet.PaymentAddress, listUnspentCustomToken[i].Value);

//         let tokenVinTmp = new TxTokenVin();
//         tokenVinTmp.txCustomTokenID = newHashFromStr(listUnspentCustomToken[i].TxCustomTokenID);
//         tokenVinTmp.voutIndex = listUnspentCustomToken[i].Index;
//         tokenVinTmp.paymentAddress = senderKeyWallet.KeySet.PaymentAddress;
//         // console.log(":senderKeyWallet1.KeySet.PaymentAddress: ", senderKeyWallet.KeySet.PaymentAddress);

//         let signature = senderKeyWallet.KeySet.sign(tokenVoutsTmp.hash());
//         tokenVinTmp.signature = checkEncode(signature, ENCODE_VERSION);

//         tokenVins.push(tokenVinTmp);

//         vOutAmount -= listUnspentCustomToken[i].Value;
//         if (vOutAmount <= 0) {
//           break;
//         }
//       }

//       // check whether enough token amount or not
//       if (vOutAmount > 0) {
//         throw new CustomError(ErrorObject.NotEnoughTokenError, "Balance of token is insuffient");
//       }

//       return {
//         listCustomToken: listCustomToken,
//         tokenVins: tokenVins,
//         vinsAmount: vinAmount,
//       }
//     }
//   }
// };

/**
 * 
 * @param {PrivacyTokenParamTx} tokenParams 
 * @param {AccountWallet} account 
 * @param {RpcClient} rpcClient 
 * @param {bigint} feeToken 
 * @param {bool} hasPrivacyForPToken
 */
const prepareInputForTxPrivacyToken = async (tokenParams, account, rpcClient, feeToken, hasPrivacyForPToken) => {
  console.log("account prepareInputForTxPrivacyToken: ", account);
  let paymentAddressStr = account.key.base58CheckSerialize(PaymentAddressType);
  console.log("Token param when preparing: ", tokenParams);
  let response;
  try {
    response = await rpcClient.listPrivacyCustomTokens();
  } catch (e) {
    throw e;
  }
  let listPrivacyToken = response.listPrivacyToken;
  console.log("listPrivacyToken: ", listPrivacyToken);

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
      for (let i = 0; i < tokenParams.receivers.length; i++) {
        amountTokenPrivacyOutput = amountTokenPrivacyOutput.add(tokenParams.receivers[i].Amount);
        console.log("BBBB tokenParams.receivers[", i, "].Amount: ", tokenParams.receivers[i].Amount);
      }
      if (feeToken) {
        amountTokenPrivacyOutput = amountTokenPrivacyOutput.add(feeToken);
      }

      console.log("BBBB amountTokenPrivacyOutput: ", amountTokenPrivacyOutput);
      console.log("BBBB feeToken: ", feeToken.toNumber());

      // get unspent pToken 
      let unspentCoinStrs;
      try {
        // let resp = await getUnspentPrivacyTokenWithPrivKey(spendingKeyStr, tokenParams.propertyID.toLowerCase(), account, rpcClient);
        unspentCoinStrs = await account.getUnspentToken(tokenParams.propertyID.toLowerCase(), rpcClient);
      } catch (e) {
        throw new CustomError(ErrorObject.GetUnspentPrivacyTokenErr, e.message || e.Message || "Can not get unspent privacy token");
      }
      console.log("pToken unspentCoinStrs: ", unspentCoinStrs);

      // remove spending coins from list of unspent coins
      let unspentCoinExceptSpendingCoin = getUnspentCoinExceptSpendingCoin(unspentCoinStrs, account);
      console.log("pToken unspentCoinExceptSpeningCoin: ", unspentCoinExceptSpendingCoin);

      // get coin to spent using Knapsack
      let tokenInputs;
      try {
        tokenInputs = chooseBestCoinToSpent(unspentCoinExceptSpendingCoin, amountTokenPrivacyOutput).resultInputCoins;
      } catch (e) {
        throw e;
      }
      console.log("pToken tokenInputs: ", tokenInputs);

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
          console.log("pToken response random commitments: ", response);
        } catch (e) {
          throw e;
        }

        commitmentIndices = response.commitmentIndices; // array index random of commitments in db
        myCommitmentIndices = response.myCommitmentIndices; // index in array index random of commitment in db
        commitmentStrs = response.commitmentStrs;

        console.log("pToken Random commitment ok!!!!!");

        // Check number of list of random commitments, list of random commitment indices
        if (commitmentIndices.length !== tokenInputs.length * CM_RING_SIZE) {
          throw new Error("pToken  Invalid random commitments");
        }
        if (myCommitmentIndices.length !== tokenInputs.length) {
          throw new Error("pToken Number of list my commitment indices must be equal to number of input coins");
        }
      }

      let totalValueInput = new bn(0);
      for (let i = 0; i < tokenInputs.length; i++) {
        totalValueInput = totalValueInput.add(new bn(tokenInputs[i].Value));
      }

      console.log("pToken totalValueInput: ", totalValueInput);

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

// chooseBestCoinToSpent return list of coins to spent using Knapsack and Greedy algorithm
const chooseBestCoinToSpent = (inputCoins, amount) => {
  console.log("HHHHHH amount: ", amount);
  console.log("HHHHHH inputCoins: ", inputCoins);
  console.log("Amount: ", amount.toNumber());
  console.log("input coins value: ", new bn(inputCoins[0].Value).toNumber());

  // let cloneInputCoins = cloneInputCoinArray(inputCoins)

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
    console.log("compare AAAAA", new bn(inputCoins[i].Value).cmp(amount));


    if (new bn(inputCoins[i].Value).cmp(amount) === -1) {
      inCoinsUnderAmount.push(inputCoins[i]);
    } else if (inCoinOverAmount === null) {
      console.log("AAAAA");
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

  console.log("inCoinOverAmount: ", inCoinOverAmount);

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
    let object = new Object();
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
  console.log("TX size when estimate fee: ", txSize);

  // check tx size
  if (txSize > MaxTxSize) {
    throw new CustomError(ErrorObject.TxSizeExceedErr, "tx size is exceed error");
  }

  console.log("++++++++++++++++++++++ Estimate Fee +++++++++++++++++++++")
  console.log("--------- numInputCoins:", numInputCoins)
  console.log("--------- numOutputs:", numOutputs)
  console.log("--------- hasPrivacy:", hasPrivacyForNativeToken)
  console.log("--------- customTokenParams:", customTokenParams)
  console.log("--------- privacyCustomTokenParams:", privacyTokenParams)
  console.log("--------- txSize in Kb:", txSize)
  console.log("--------- unitFee:", unitFee.unitFee)
  console.log("++++++++++++++++++++++ End Estimate Fee +++++++++++++++++++++")

  return txSize * unitFee.unitFee;
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

  // console.log("Amount when getEstimateFee: ", amount);
  // console.log("Amount BigInt when getEstimateFee: ", new bn(amount));
  // console.log("Payment info when getEstimateFee: ", paymentInfos);

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
  let receivers = new PaymentInfo(
    keyWallet.base58CheckDeserialize(tokenObject.TokenReceivers.PaymentAddress).KeySet.PaymentAddress,
    new bn(tokenObject.TokenReceivers.Amount)
  );

  let privacyCustomTokenParams = new PrivacyTokenParamTx();
  privacyCustomTokenParams.set(id, name, symbol, amount, tokenObject.TokenTxType, [receivers], []);

  console.log("Amount before estimate fee: ", amount);


  let inputForPrivacyToken;
  try {
    inputForPrivacyToken = await prepareInputForTxPrivacyToken(privacyCustomTokenParams, account, rpcClient, new bn(feeToken), isPrivacyForPrivateToken);
    privacyCustomTokenParams.tokenInputs = inputForPrivacyToken.tokenInputs;
  } catch (e) {
    throw e;
  }


  let fee;
  try {
    fee = await getEstimateFee(from, to, amount, account, isPrivacyForNativeToken, isPrivacyForPrivateToken, rpcClient, null, privacyCustomTokenParams, isGetTokenFee);
  } catch (e) {
    throw e;
  }
  return fee;
  // }
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

  let receivers = new PaymentInfo(
    keyWallet.base58CheckDeserialize(tokenObject.TokenReceivers.PaymentAddress).KeySet.PaymentAddress,
    new bn(tokenObject.TokenReceivers.Amount)
  );

  let privacyCustomTokenParams = new PrivacyTokenParamTx();
  privacyCustomTokenParams.set(id, name, symbol, 0, tokenObject.TokenTxType, [receivers], []);

  let totalpTokenAmount = new bn(0);

  try {
    let unspentToken = await account.getUnspentToken(privacyCustomTokenParams.propertyID.toLowerCase(), rpcClient);
    privacyCustomTokenParams.tokenInputs = unspentToken;

    for (let i = 0; i < unspentToken.length; i++) {
      totalpTokenAmount = totalpTokenAmount.add(new bn(unspentToken[i].Value));
    }
  } catch (e) {
    throw e;
  }

  let fee;
  try {
    fee = await getEstimateFee(from, to, 0, account, false, isPrivacyForPrivateToken, rpcClient, null, privacyCustomTokenParams, true);
  } catch (e) {
    throw e;
  }

  let maxWithdrawAmount = totalpTokenAmount.sub(new bn(fee));
  return {
    maxWithdrawAmount: maxWithdrawAmount.toNumber(),
    feeCreateTx: fee,
    feeForBurn: fee,
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
//     console.log("getUTXOsToDefragment Done");
//     defragmentUTXO = result.defragmentUTXO;
//     totalAmount = result.totalAmount;
//   } catch (e) {
//     console.log(e);
//     throw e;
//   }

//   console.timeEnd("getUTXOsToDefragment")
//   console.log("defragmentUTXO len: ", defragmentUTXO.length);

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
 * @param {PrivacyTokenParamTx} privacyCustomTokenParams 
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
    console.log("************* customTokenParams.receivers: ", customTokenParams.receivers);
    console.log("************* customTokenParams.vins: ", customTokenParams.vins);

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
      privacyTokenDataSize += estimateProofSize(privacyCustomTokenParams.tokenInputs.length, privacyCustomTokenParams.receivers.length, hasPrivacyForPToken);
    }
    privacyTokenDataSize += 1; //PubKeyLastByte
    sizeTx += privacyTokenDataSize

  }
  return Math.ceil(sizeTx / 1024.0) + 2; // buffer more 2 kb on tx size
};

// @@@NOTE: for defragment feature
// const getUTXOsToDefragment = async (spendingKeyStr, fee, account, amount, rpcClient) => {
//   // deserialize spending key string to key wallet
//   let myKeyWallet = keyWallet.base58CheckDeserialize(spendingKeyStr);

//   // import key set
//   myKeyWallet.KeySet.importFromPrivateKey(myKeyWallet.KeySet.PrivateKey);

//   // serialize payment address, readonlyKey
//   let paymentAddrSerialize = myKeyWallet.base58CheckSerialize(PaymentAddressType);
//   let readOnlyKeySerialize = myKeyWallet.base58CheckSerialize(ReadonlyKeyType);

//   // get all output coins of spendingKey
//   let response;
//   try {
//     response = await rpcClient.getOutputCoin(paymentAddrSerialize, readOnlyKeySerialize);
//   } catch (e) {
//     throw e;
//   }

//   let allOutputCoinStrs = response.outCoins;

//   if (allOutputCoinStrs.length == 0) {
//     throw new Error('Have no item in list output coins');
//   }

//   // parse input coin from string
//   // leftOutputCoinStrs: is not cached
//   const { uncachedOutputCoinStrs, cachedOutputCoinStrs, cachedInputCoins } = account.analyzeOutputCoinFromCached(allOutputCoinStrs);
//   let inputCoins = cachedInputCoins

//   // console.log("Input coin cached: analyzeOutputCoinFromCached : ", inputCoins);

//   // cache leftOutputCoinStrs
//   if (uncachedOutputCoinStrs.length > 0) {
//     let uncachedInputCoins = parseInputCoinFromEncodedObject(uncachedOutputCoinStrs, account.key, account.derivatorPointCached);
//     account.mergeDerivatorCached();
//     account.mergeInputCoinJsonCached(uncachedOutputCoinStrs, uncachedInputCoins);
//     inputCoins = inputCoins.concat(uncachedInputCoins);
//     allOutputCoinStrs = cachedOutputCoinStrs.concat(uncachedOutputCoinStrs);
//   }

//   // get unspent coin from cache
//   let { unspentInputCoinsFromCached, unspentInputCoinsFromCachedStrs } = account.analyzeSpentCoinFromCached(inputCoins, allOutputCoinStrs);

//   let unspentCoins, unspentCoinStrs;
//   try {
//     let resp = await getUnspentCoin(unspentInputCoinsFromCached, paymentAddrSerialize, unspentInputCoinsFromCachedStrs, null, rpcClient);
//     unspentCoins = resp.unspentCoins;
//     unspentCoinStrs = resp.unspentCoinStrs;
//   } catch (e) {
//     throw new CustomError(ErrorObject.GetUnspentCoinErr, "Can not get unspent coin to defragment");
//   }


//   // get list of spending coins, which in tx in membool
//   let { UTXOExceptSpeningCoin, UTXOExceptSpeningCoinStrs } = getUTXOsExceptSpendingCoin(unspentCoins, unspentCoinStrs, account);
//   // console.log("UTXOExceptSpeningCoin: ", UTXOExceptSpeningCoin);

//   // get UTXO less than amount
//   let defragmentUTXO = [];
//   let defragmentUTXOStr = [];
//   let totalAmount = new bn(0);
//   let numUTXO = 0;

//   for (let i = 0; i < UTXOExceptSpeningCoin.length; i++) {
//     if (UTXOExceptSpeningCoin[i].coinDetails.value.cmp(amount) != 1) {
//       defragmentUTXO.push(UTXOExceptSpeningCoin[i]);
//       defragmentUTXOStr.push(UTXOExceptSpeningCoinStrs[i]);
//       totalAmount = totalAmount.add(UTXOExceptSpeningCoin[i].coinDetails.value);
//       numUTXO++;
//       if (numUTXO >= MaxInputNumberForDefragment) {
//         break;
//       }
//     }
//   }
//   console.log("defragmentUTXO: ", defragmentUTXO.length)
//   console.log("Get unspent input coin less than amount done!");

//   totalAmount = totalAmount.sub(fee);

//   if (totalAmount.cmp(new bn(0)) == -1) {
//     console.log("You shouldn't defragment wallet now beacause the number of UTXO need to be defragmented is so small!!! ")
//     throw new CustomError(ErrorObject.InvalidNumberUTXOToDefragment, "No UTXO has value less than amount defragment");
//   }

//   console.log("Get UTXO done!");

//   return {
//     defragmentUTXO: defragmentUTXO,
//     defragmentUTXOStr: defragmentUTXOStr,
//     totalAmount: totalAmount,
//   };
// };

// const getUTXOsExceptSpendingCoin = (unspentCoins, unspentCoinStrs, account) => {
//   if (account.spendingCoins) {
//     if (account.spendingCoins.length) {
//       let UTXOExceptSpeningCoin = cloneInputCoinArray(unspentCoins);
//       let UTXOExceptSpeningCoinStrs = unspentCoinStrs;

//       for (let i = 0; i < account.spendingCoins.length; i++) {
//         for (let j = 0; j < account.spendingCoins[i].spendingSNs.length; j++) {
//           // console.log("Spending coin : ", account.spendingCoins)
//           for (let k = 0; k < UTXOExceptSpeningCoin.length; k++) {
//             if (account.spendingCoins[i].spendingSNs[j].toString() === UTXOExceptSpeningCoin[k].coinDetails.serialNumber.compress().toString()) {
//               UTXOExceptSpeningCoin.splice(k, 1);
//               UTXOExceptSpeningCoinStrs.splice(k, 1);
//             }
//           }
//         }
//       }
//       // console.log("UTXOExceptSpeningCoin getUnspentCoinExceptSpendingCoin after : ", UTXOExceptSpeningCoin);
//       return {
//         UTXOExceptSpeningCoin: UTXOExceptSpeningCoin,
//         UTXOExceptSpeningCoinStrs: UTXOExceptSpeningCoinStrs
//       }
//     }
//   }

//   return {
//     UTXOExceptSpeningCoin: unspentCoins,
//     UTXOExceptSpeningCoinStrs: unspentCoinStrs
//   }
// };

const getUnspentCoinExceptSpendingCoin = (unspentCoinStrs, account) => {
  // console.log("unspentCoinExceptSpeningCoin getUnspentCoinExceptSpendingCoin before: ", unspentCoinExceptSpeningCoin);
  // console.log(" AAAA account.spendingCoins: ", account.spendingCoins);

  if (account.spendingCoins) {
    if (account.spendingCoins.length) {
      let unspentCoinExceptSpendingCoin = cloneInputCoinJsonArray(unspentCoinStrs);
      for (let i = 0; i < account.spendingCoins.length; i++) {
        for (let j = 0; j < account.spendingCoins[i].spendingSNs.length; j++) {
          for (let k = 0; k < unspentCoinExceptSpendingCoin.length; k++) {
            // console.log("FFF account.spendingCoins[i].spendingCoins[j].toString(): ", account.spendingCoins[i].spendingSNs[j].toString());
            // console.log("FFF unspentCoinExceptSpeningCoin[k].coinDetails.serialNumber.compress().toString(): ", unspentCoinExceptSpeningCoin[k].coinDetails.serialNumber.compress().toString());
            if (account.spendingCoins[i].spendingSNs[j] === unspentCoinExceptSpendingCoin[k].SerialNumber) {
              unspentCoinExceptSpendingCoin.splice(k, 1);
            }
          }
        }
      }
      console.log("unspentCoinExceptSpeningCoin getUnspentCoinExceptSpendingCoin after : ", unspentCoinExceptSpendingCoin);
      return unspentCoinExceptSpendingCoin;
    }
  }

  return unspentCoinStrs;
}

// getUnspentCoin returns unspent coins
const getUnspentCoin = async (spendingKeyStr, paymentAddrSerialize, inCoinStrs, tokenID, rpcClient) => {
  let unspentCoinStrs = new Array();

  let serialNumberStrs = new Array();
  console.log("AA inCoinStrs: ", inCoinStrs);
  for (let i = 0; i < inCoinStrs.length; i++) {
    serialNumberStrs.push(inCoinStrs[i].SerialNumber);
  }

  console.log("AA serialNumberStrs when call api: ", serialNumberStrs);

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
  console.log("unspent input coin: ", unspentCoinStrs);
  // console.log("unspent input coin len : ", unspentCoin.length);
  console.timeEnd("Getunspent coin:")
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
};