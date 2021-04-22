import bn from 'bn.js';
// import _ from 'lodash';
import {
    KeyWallet
} from "../core";
import {
    CustomTokenParamTx
} from "../tx/txcustomtokendata";
import {
    PrivacyTokenParamTx
} from "../tx/txprivacytokendata";
import {
    PaymentInfo
} from "../common/key";
import {
    SIG_PUB_KEY_SIZE,
    SIG_NO_PRIVACY_SIZE,
    SIG_PRIVACY_SIZE
} from "../common/constants";
import {
    PaymentAddressType,
    ReadonlyKeyType,
    MaxTxSize,
    PriKeyType
} from '../core';
import {
    CustomTokenInit,
    CustomTokenTransfer,
    MaxInputNumberForDefragment,
    MAX_INPUT_PER_TX
} from '../tx/constants';
import {
    CustomError,
    ErrorObject
} from '../common/errorhandler';
import {
    CM_RING_SIZE
} from "../privacy/constants";
import {
    base64Decode,
    base64Encode
} from '../privacy/utils';
import {
    getShardIDFromLastByte
} from '../common/common';
import {
    defaultCoinChooser as coinChooser
} from '../services/coinChooser';

const prepareInputForTxV2 = async(amountTransfer, fee, tokenID, account, inputVersion = 2, numOfOtherPks = 20, maxInputs = MAX_INPUT_PER_TX) => {
    const unspentCoinStrs = await account.getListUnspentCoins(tokenID, inputVersion);
    // remove spending coins from list of unspent coins
    let unspentCoinExceptSpendingCoin;
    try {
        unspentCoinExceptSpendingCoin = getUnspentCoinExceptSpendingCoin(unspentCoinStrs, account);
    } catch (e) {
        console.error("Coin storage error", e);
        throw e;
    };
    // console.log("coins are", unspentCoinExceptSpendingCoin, "from", unspentCoinStrs);
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
	    const respChooseBestCoin = coinChooser.coinsToSpend(unspentCoinExceptSpendingCoin, amountTransfer);
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
    // console.log('will use', inputCoinsToSpent);
    // const paymentAddrSerialize = account.key.base58CheckSerialize(PaymentAddressType);
    const shardID = getShardIDFromLastByte(account.key.KeySet.PaymentAddress.Pk[(account.key.KeySet.PaymentAddress.Pk.length - 1)]);
    let cc = null;
    try{
	    if (numOfOtherPks>0){
			cc = await coinChooser.coinsForRing(account.rpc, shardID, numOfOtherPks, tokenID);
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

// cloneInputCoinArray clone array of input coins to new array
const cloneInputCoinJsonArray = (_coins) =>
    _coins.map(c => JSON.parse(JSON.stringify(c)))

const estimateFee = async(paymentAddrSerialize, numInputCoins, numOutputs, metadata, rpcClient, tokenParams = null) => {
    let tokenIDStr = null;
    if (tokenParams != null) {
        tokenIDStr = privacyTokenParams.PropertyID;
    }

    let unitFee;
    try {
        unitFee = await rpcClient.getEstimateFeePerKB(paymentAddrSerialize, tokenIDStr);
    } catch (e) {
        throw new CustomError(ErrorObject.GetUnitFeeErr, "Can not get unit fee when estimate");
    }

    let txSize = await estimateTxSize(numInputCoins, numOutputs, metadata, tokenParams);
    // check tx size
    if (txSize > MaxTxSize) {
        throw new CustomError(ErrorObject.TxSizeExceedErr, "tx size is exceed error");
    }
    return (txSize + 1) * unitFee.unitFee;
};

const getEstimateFee = async(to, amount, account, tokenParams = null) => {
    let receiverKeyWallet = KeyWallet.base58CheckDeserialize(to);
    let paymentInfos = [];
    let amountBN = new bn(0);
    if (tokenParams == null) {
        paymentInfos = new Array(1);
        paymentInfos[0] = new PaymentInfo(to, new bn(amount).toString());
        amountBN = new bn(amount);
    }

    let tokenID = null;
    if (tokenParams != null) {
        tokenID = tokenParams.PropertyID;
    }
    // prepare input for native token tx
    let inputForTx;
    try {
        inputForTx = await prepareInputForTxV2(amountBN, new bn(0), tokenID, account);
    } catch (e) {
        throw e;
    }

    // estimate fee
    let fee;
    try {
        fee = await estimateFee(inputForTx.inputCoinStrs.length, paymentInfos.length, null, rpcClient, tokenParams);
    } catch (e) {
        throw e;
    }

    return fee;
};

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
        let unspentToken = await account.getListUnspentCoins(tokenParamJson.propertyID.toLowerCase());
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
const estimateTxSize = async (numInputCoins, numOutputCoins, metadata, tokenParams) => {
    const params = {
        NumInputs: numInputCoins,
        NumPayments: numOutputCoins,
        Metadata: metadata,
        TokenParams: tokenParams
    }
    const sz = await wasm.estimateTxSize(JSON.stringify(params));
    return result;
};

const getUnspentCoinExceptSpendingCoin = (unspentCoinStrs, account) => {
    if (account.spendingCoins) {
        if (account.spendingCoins.length) {
            let unspentCoinExceptSpendingCoin = cloneInputCoinJsonArray(unspentCoinStrs);
            for (let i = 0; i < account.spendingCoins.length; i++) {
                for (let j = 0; j < account.spendingCoins[i].spendingSNs.length; j++) {
                    for (let k = 0; k < unspentCoinExceptSpendingCoin.length; k++) {
                        //
                        //
                        if (account.spendingCoins[i].spendingSNs[j] === unspentCoinExceptSpendingCoin[k].KeyImage) {
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

    // console.log("SNs are", serialNumberStrs, "from", inCoinStrs);

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

function newParamTxV2(senderKeyWalletObj, paymentInfos, inputCoins, fee, tokenID, metadata, info, otherCoinsForRing) {
    let sk = base64Encode(senderKeyWalletObj.KeySet.PrivateKey);
    let param = {
        "SenderSK": sk,
        "PaymentInfo": paymentInfos,
        "InputCoins": inputCoins,
        "Fee": fee,
        "HasPrivacy": true,
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
    prepareInputForTxV2,
    cloneInputCoinJsonArray,
    estimateFee,
    getEstimateFee,
    estimateTxSize,
    getUnspentCoinExceptSpendingCoin,
    getUnspentCoin,
    getMaxWithdrawAmount,
    newParamTxV2,
    newTokenParamV2,
    // prepareInputForReplaceTxNormal,
    // prepareInputForReplaceTxPrivacyToken,
    // prepareInputForDefragments,
};