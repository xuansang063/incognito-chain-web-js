import bn from 'bn.js';
import _ from 'lodash';
import {
    KeyWallet as keyWallet
} from "../core/hdwallet";
import {
    estimateProofSize
} from '../paymentproof';
import {
    CustomTokenParamTx
} from "../tx/txcustomtokendata";
import {
    PrivacyTokenParamTx
} from "../tx/txprivacytokendata";
import {
    PaymentInfo
} from "../key";
import {
    SIG_PUB_KEY_SIZE,
    SIG_NO_PRIVACY_SIZE,
    SIG_PRIVACY_SIZE
} from "../constants";
import {
    PaymentAddressType,
    ReadonlyKeyType,
    MaxTxSize,
    PriKeyType
} from '../core/constants';
import {
    CustomTokenInit,
    CustomTokenTransfer,
    MaxInputNumberForDefragment,
    MAX_INPUT_PER_TX
} from '../tx/constants';
import {
    CustomError,
    ErrorObject
} from '../errorhandler';
import {
    CM_RING_SIZE
} from "../privacy/constants";
import {
    base64Decode,
    base64Encode
} from '../privacy/utils';
import {
    Coin
} from "../coin";
// import {
//     Wallet
// } from '../core/wallet';

const prepareInputForTxV2 = async(amountTransfer, fee, tokenID, account, rpcClient, inputVersion = "2", numOfOtherPks = 20, maxInputs = MAX_INPUT_PER_TX) => {
    const unspentCoinStrs = await account.getUnspentToken(tokenID, rpcClient, inputVersion);
    // remove spending coins from list of unspent coins
    const unspentCoinExceptSpendingCoin = getUnspentCoinExceptSpendingCoin(unspentCoinStrs, account);

    // total amount transfer and fee
    let feeBN = new bn(fee);
    let inputCoinsToSpent;
    if (amountTransfer < 0){
    	// negative means use all inputs
    	let arrayEnd = MAX_INPUT_PER_TX;
    	if (unspentCoinExceptSpendingCoin.length < arrayEnd){
    		arrayEnd = unspentCoinExceptSpendingCoin.length;
    	}
    	inputCoinsToSpent = unspentCoinExceptSpendingCoin.slice(0, arrayEnd);
    	amountTransfer = feeBN;
    }else{
	    amountTransfer = amountTransfer.add(feeBN);
	    const respChooseBestCoin = chooseBestCoinToSpent(unspentCoinExceptSpendingCoin, amountTransfer);
	    inputCoinsToSpent = respChooseBestCoin.resultInputCoins;
	    if (inputCoinsToSpent.length === 0 && amountTransfer.cmp(new bn(0)) !== 0) {
	        throw new CustomError(ErrorObject.NotEnoughCoinError, "Not enough coin to spend");
	    }
	}
    
    let totalValueInput = new bn(0);
    for (let i = 0; i < inputCoinsToSpent.length; i++) {
        totalValueInput = totalValueInput.add(new bn(inputCoinsToSpent[i].Value));
        inputCoinsToSpent[i].Info = "";
    }
    const paymentAddrSerialize = account.key.base58CheckSerialize(PaymentAddressType);
    let cc = null;
    try{
	    if (numOfOtherPks>0){
			cc = await rpcClient.getOtherCoinsForRing(paymentAddrSerialize, numOfOtherPks, tokenID);
	    }
	}catch(e){
		console.error("Error while preparing input parameters", e);
		throw e;
	}
    let res = {
        // PaymentAddress: paymentAddrSerialize,
        inputCoinStrs: inputCoinsToSpent,
        totalValueInput: totalValueInput,
        coinsForRing: cc
    };
    return res;
};


// chooseBestCoinToSpent return list of coins to spent using Greedy algorithm
const chooseBestCoinToSpent = (inputCoins, amount) => {

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

    inCoinsUnderAmount.sort(function(a, b) {
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
// const estimateFee = async(paymentAddrSerialize, numInputCoins, numOutputs, hasPrivacyForNativeToken, hasPrivacyForPToken, metadata, rpcClient, customTokenParams = null, privacyTokenParams = null, isGetTokenFee = false) => {
//     let tokenIDStr = null;
//     if (isGetTokenFee == true) {
//         if (customTokenParams != null) {
//             tokenIDStr = customTokenParams.propertyID;
//         }
//         if (privacyTokenParams != null) {
//             tokenIDStr = privacyTokenParams.propertyID;
//         }
//     }

//     let unitFee;
//     try {
//         unitFee = await rpcClient.getEstimateFeePerKB(paymentAddrSerialize, tokenIDStr);
//     } catch (e) {
//         throw new CustomError(ErrorObject.GetUnitFeeErr, "Can not get unit fee when estimate");
//     }

//     let txSize = estimateTxSize(numInputCoins, numOutputs, hasPrivacyForNativeToken, hasPrivacyForPToken, metadata, customTokenParams, privacyTokenParams);


//     // check tx size
//     if (txSize > MaxTxSize) {
//         throw new CustomError(ErrorObject.TxSizeExceedErr, "tx size is exceed error");
//     }


//     return (txSize + 1) * unitFee.unitFee;
// };

// /**
//  *
//  * @param {string} from
//  * @param {string} to
//  * @param {number} amount
//  * @param {AccountWallet} account
//  * @param {bool} isPrivacy
//  * @param {RpcClient} rpcClient
//  * @param {CustomTokenParamTx} customTokenParams
//  * @param {PrivacyTokenParamTx} privacyTokenParams
//  * @param {bool} isGetTokenFee
//  */
// const getEstimateFee = async(from, to, amount, account, isPrivacyForNativeToken, isPrivacyForPToken, rpcClient, customTokenParams = null, privacyTokenParams = null, isGetTokenFee = false) => {
//     let receiverKeyWallet = keyWallet.base58CheckDeserialize(to);
//     let paymentInfos = [];
//     let amountBN = new bn(0);
//     if (customTokenParams == null && privacyTokenParams == null) {
//         paymentInfos = new Array(1);
//         paymentInfos[0] = new PaymentInfo(receiverKeyWallet.KeySet.PaymentAddress, new bn(amount));
//         amountBN = new bn(amount);
//     }

//     let tokenID = null;
//     if (customTokenParams != null) {
//         tokenID = customTokenParams.propertyID;
//     } else if (privacyTokenParams != null) {
//         tokenID = privacyTokenParams.propertyID;
//     }

//     //
//     //
//     //

//     // prepare input for native token tx
//     let inputForTx;
//     try {
//         inputForTx = await prepareInputForTx(amountBN, new bn(0), isPrivacyForNativeToken, tokenID, account, rpcClient);
//     } catch (e) {
//         throw e;
//     }

//     // estimate fee
//     let fee;
//     try {
//         fee = await estimateFee(from, inputForTx.inputCoinStrs.length, paymentInfos.length, isPrivacyForNativeToken, isPrivacyForPToken, null, rpcClient, customTokenParams, privacyTokenParams, isGetTokenFee);
//     } catch (e) {
//         throw e;
//     }

//     return fee;
// };

// *
//  *
//  * @param {string} from
//  * @param {string} to
//  * @param {number} amount
//  * @param {{Privacy: boolean, TokenID: string, TokenName: string, TokenSymbol: string, TokenTxType: number TokenAmount: number, TokenReceivers: {[string]: number}}} tokenObject
//  * @param {AccountWallet} account
//  * @param {RpcClient} rpcClient
//  * @param {bool} isPrivacyForNativeToken
//  * @param {bool} isPrivacyForPrivateToken
//  * @param {number} feeToken
//  * @param {bool} isGetTokenFee
 
// // PRV fee
// const getEstimateFeeForPToken = async(from, to, amount, tokenObject, account, rpcClient, isPrivacyForNativeToken, isPrivacyForPrivateToken, feeToken, isGetTokenFee = false) => {
//     let id = "";
//     let name = "";
//     let symbol = "";
//     if (tokenObject.TokenID !== null) {
//         id = tokenObject.TokenID;
//     }
//     if (tokenObject.TokenName !== null) {
//         name = tokenObject.TokenName;
//     }
//     if (tokenObject.TokenSymbol !== null) {
//         symbol = tokenObject.TokenSymbol;
//     }

//     if (isGetTokenFee) {
//         feeToken = 0;
//     }

//     // @@@NOTE: for custom token
//     // if (tokenObject.Privacy === false) {
//     //   let receivers = new TxTokenVout();
//     //   receivers.set(
//     //     keyWallet.base58CheckDeserialize(tokenObject.TokenReceivers.PaymentAddress).KeySet.PaymentAddress,
//     //     tokenObject.TokenReceivers.Amount
//     //   );

//     //   let customTokenParams = new CustomTokenParamTx();
//     //   customTokenParams.set(id, name, symbol,
//     //     amount, tokenObject.TokenTxType, [receivers],
//     //     [], tokenObject.TokenAmount);

//     //   let inputForCustomTx;
//     //   try {
//     //     inputForCustomTx = await prepareInputForCustomTokenTx(privatekeyStr, customTokenParams, rpcClient);
//     //     customTokenParams.vins = inputForCustomTx.tokenVins;
//     //   } catch (e) {
//     //     throw e;
//     //   }

//     //   let fee;
//     //   try {
//     //     fee = await getEstimateFee(from, to, amount, privatekeyStr, account, false, rpcClient, customTokenParams);
//     //   } catch (e) {
//     //     throw e;
//     //   }

//     //   return fee;
//     // } else if (tokenObject.Privacy === true) {

//     let privacyTokenParam = {
//         propertyID: id,
//         propertyName: name,
//         propertySymbol: symbol,
//         amount: amount,
//         tokenTxType: tokenObject.TokenTxType,
//         fee: feeToken,
//         paymentInfoForPToken: [{
//             paymentAddressStr: tokenObject.TokenReceivers.PaymentAddress,
//             amount: tokenObject.TokenReceivers.Amount
//         }],
//         tokenInputs: [],
//     }

//     let inputForPrivacyToken;
//     try {
//         inputForPrivacyToken = await prepareInputForTxPrivacyToken(privacyTokenParam, account, rpcClient, new bn(feeToken), isPrivacyForPrivateToken);
//         privacyTokenParam.tokenInputs = inputForPrivacyToken.tokenInputs;
//     } catch (e) {
//         throw e;
//     }


//     let fee;
//     try {
//         fee = await getEstimateFee(from, to, amount, account, isPrivacyForNativeToken, isPrivacyForPrivateToken, rpcClient, null, privacyTokenParam, isGetTokenFee);
//     } catch (e) {
//         throw e;
//     }
//     return fee;
// }

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
        isRatePToken = await rpcClient.isExchangeRatePToken(tokenParamJson.propertyID);
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
//   try {
//     let result = await getUTXOsToDefragment(privatekeyStr, new bn(0), account, amount, rpcClient);
//
//     defragmentUTXO = result.defragmentUTXO;
//     totalAmount = result.totalAmount;
//   } catch (e) {
//
//     throw e;
//   }

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
//  */
// const estimateTxSize = (numInputCoins, numOutputCoins, hasPrivacyForNativeToken, hasPrivacyForPToken, metadata, customTokenParams, privacyCustomTokenParams) => {
//     let sizeVersion = 1; // int8
//     let sizeType = 5; // string, max : 5
//     let sizeLockTime = 8; // int64
//     let sizeFee = 8; // uint64

//     let sizeInfo = 0;
//     if (hasPrivacyForNativeToken) {
//         sizeInfo = 64;
//     }
//     let sizeSigPubKey = SIG_PUB_KEY_SIZE;
//     let sizeSig = SIG_NO_PRIVACY_SIZE;
//     if (hasPrivacyForNativeToken) {
//         sizeSig = SIG_PRIVACY_SIZE;
//     }

//     let sizeProof = estimateProofSize(numInputCoins, numOutputCoins, hasPrivacyForNativeToken);

//     let sizePubKeyLastByte = 1;

//     let sizeMetadata = 0;
//     // if (metadata != null || typeof metadata !== "undefined"){
//     //   sizeMetadata += metadata.CalculateSize()
//     // }
//     let sizeTx = sizeVersion + sizeType + sizeLockTime + sizeFee + sizeInfo + sizeSigPubKey + sizeSig + sizeProof + sizePubKeyLastByte + sizeMetadata;
//     if (customTokenParams !== null && typeof customTokenParams !== "undefined") {
//         let customTokenDataSize = 0;
//         customTokenDataSize += customTokenParams.propertyID.length;
//         customTokenDataSize += customTokenParams.propertySymbol.length;
//         customTokenDataSize += customTokenParams.propertyName.length;
//         customTokenDataSize += 8;
//         customTokenDataSize += 4;

//         for (let i = 0; i < customTokenParams.receivers.length; i++) {
//             customTokenDataSize += customTokenParams.receivers[i].paymentAddress.toBytes().length;
//             customTokenDataSize += 8;
//         }

//         if (customTokenParams.vins !== null) {
//             for (let i = 0; i < customTokenParams.vins.length; i++) {
//                 customTokenDataSize += customTokenParams.vins[i].paymentAddress.toBytes().length;
//                 customTokenDataSize += customTokenParams.vins[i].txCustomTokenID.slice(0).length;
//                 customTokenDataSize += customTokenParams.vins[i].signature.length;
//                 customTokenDataSize += 4;
//             }
//             sizeTx += customTokenDataSize;
//         }
//     }
//     if (privacyCustomTokenParams !== null && typeof privacyCustomTokenParams !== "undefined") {
//         let privacyTokenDataSize = 0;

//         privacyTokenDataSize += privacyCustomTokenParams.propertyID.length;
//         privacyTokenDataSize += privacyCustomTokenParams.propertySymbol.length;
//         privacyTokenDataSize += privacyCustomTokenParams.propertyName.length;

//         privacyTokenDataSize += 8; // for amount
//         privacyTokenDataSize += 4; // for TokenTxType
//         privacyTokenDataSize += 1; // int8 version
//         privacyTokenDataSize += 5; // string, max : 5 type
//         privacyTokenDataSize += 8; // int64 locktime
//         privacyTokenDataSize += 8; // uint64 fee

//         privacyTokenDataSize += 64; // info

//         privacyTokenDataSize += SIG_PUB_KEY_SIZE; // sig pubkey
//         privacyTokenDataSize += SIG_PRIVACY_SIZE; // sig

//         // Proof
//         if (privacyCustomTokenParams.tokenInputs !== null) {
//             privacyTokenDataSize += estimateProofSize(privacyCustomTokenParams.tokenInputs.length, privacyCustomTokenParams.paymentInfoForPToken.length, hasPrivacyForPToken);
//         }
//         privacyTokenDataSize += 1; //PubKeyLastByte
//         sizeTx += privacyTokenDataSize

//     }
//     return Math.ceil(sizeTx / 1024.0) + 2; // buffer more 2 kb on tx size
// };

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
const getUnspentCoin = async(paymentAddrSerialize, inCoinStrs, tokenID, rpcClient) => {
    let unspentCoinStrs = new Array();
    let serialNumberStrs = new Array();

    for (let i = 0; i < inCoinStrs.length; i++) {
        serialNumberStrs.push(inCoinStrs[i].KeyImage);
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

function newParamTxV2(senderKeyWalletObj, paymentInfos, inputCoins, fee, isPrivacy, tokenID, metadata, info, otherCoinsForRing) {
    let sk = base64Encode(senderKeyWalletObj.KeySet.PrivateKey);
    let param = {
        "SenderSK": sk,
        "PaymentInfo": paymentInfos,
        "InputCoins": inputCoins,
        "Fee": fee,
        "HasPrivacy": isPrivacy,
        "TokenID": tokenID,
        "Metadata": metadata,
        "Info": info,
        "CoinCache": otherCoinsForRing
    };

    return param
}

function newTokenParamV2(paymentInfos, inputCoins, tokenID, otherCoinsForRing, obj = {}){
    obj.PaymentInfo = paymentInfos
    obj.InputCoins = inputCoins
    obj.TokenID = tokenID
    obj.CoinCache = otherCoinsForRing
    return obj
}

export {
    // prepareInputForTx,
    prepareInputForTxV2,
    // prepareInputForTxPrivacyToken,
    chooseBestCoinToSpent,
    cloneInputCoinJsonArray,
    // estimateFee,
    // getEstimateFee,
    // getEstimateFeeForPToken,
    // getEstimateFeeToDefragment,
    // estimateTxSize,
    // getUTXOsToDefragment,
    getUnspentCoinExceptSpendingCoin,
    getUnspentCoin,
    getMaxWithdrawAmount,
    // newParamInitTx,
    // newParamInitPrivacyTokenTx,
    newParamTxV2,
    newTokenParamV2,
    // prepareInputForReplaceTxNormal,
    // prepareInputForReplaceTxPrivacyToken,
    // prepareInputForDefragments,
};