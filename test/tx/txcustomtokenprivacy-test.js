import {KeyWallet as keyWallet} from "../../lib/wallet/hdwallet";
import * as key from "../../lib/key";
import bn from 'bn.js';
import {RpcClient} from "../../lib/rpcclient/rpcclient";
import {Tx} from "../../lib/tx/txprivacy";
import {TxCustomToken} from "../../lib/tx/txcustomtoken";
import {TxCustomTokenPrivacy} from "../../lib/tx/txcustomtokenprivacy";
import {TxTokenData, TxTokenVout, TxTokenVin, CustomTokenParamTx} from "../../lib/tx/txcustomtokendata";
import {CustomTokenInit, CustomTokenTransfer} from '../../lib/tx/constants';
import * as common from '../../lib/common';
import * as privacyUtils from 'privacy-js-lib/lib/privacy_utils';
import * as constantWallet from '../../lib/wallet/constants';
import * as base58 from '../../lib/base58';
import * as privacyConstants from 'privacy-js-lib/lib/constants';
import * as constantsTx from "../../lib/tx/constants";

import {CustomTokenPrivacyParamTx} from "../../lib/tx/txcustomkenprivacydata";

import {PaymentInfo} from '../../lib/key';

const rpcClient = new RpcClient("http://localhost:9334");

async function TestTxCustomTokenPrivacyInit() {
    let n = 0;
    let paymentInfos = new Array(n);

    // HN2
    let receiverSpendingKeyStr1 = "112t8rqGc71CqjrDCuReGkphJ4uWHJmiaV7rVczqNhc33pzChmJRvikZNc3Dt5V7quhdzjWW9Z4BrB2BxdK5VtHzsG9JZdZ5M7yYYGidKKZV";
    let receiverKeyWallet1 = keyWallet.base58CheckDeserialize(receiverSpendingKeyStr1);


    // import key set
    receiverKeyWallet1.KeySet.importFromPrivateKey(receiverKeyWallet1.KeySet.PrivateKey);
    //
    // paymentInfos[0] = new key.PaymentInfo(receiverKeyWallet1.KeySet.PaymentAddress, new bn.BN(2300));

    // let spendingKeyStr = "112t8rqnMrtPkJ4YWzXfG82pd9vCe2jvWGxqwniPM5y4hnimki6LcVNfXxN911ViJS8arTozjH4rTpfaGo5i1KKcG1ayjiMsa4E3nABGAqQh";

    try {
        console.time("Time for preparing input for fee");
        let input = await rpcClient.prepareInputForTx(receiverSpendingKeyStr1, paymentInfos);
        console.timeEnd("Time for preparing input for fee");

        let tx = new TxCustomTokenPrivacy("http://localhost:9334");

        console.time("Time for creating tx custom token");

        let vouts = new Array(1);
        vouts[0] = new PaymentInfo(receiverKeyWallet1.KeySet.PaymentAddress, 100);

        let tokenParams = new CustomTokenPrivacyParamTx();
        tokenParams.propertyName = "token2";
        tokenParams.propertySymbol = "token2";
        tokenParams.amount = 100;
        tokenParams.tokenTxType = CustomTokenInit;
        tokenParams.receiver = vouts;

        let res2 = await rpcClient.listPrivacyCustomTokens();
        let listPrivacyCustomToken = res2.listCustomToken;

        await tx.init(input.senderKeySet.PrivateKey, input.paymentAddrSerialize, paymentInfos, input.inputCoins, input.inputCoinStrs, new bn.BN(0), tokenParams, listPrivacyCustomToken, null,  false);
        console.timeEnd("Time for creating tx custom token");

        console.log("Token ID after initing bytes before : ", tx.txTokenPrivacyData.propertyID.join(', '));
        console.log("Token ID after initing: ", common.convertHashToStr(tx.txTokenPrivacyData.propertyID));
        console.log("Token ID after initing bytes after: ", tx.txTokenPrivacyData.propertyID.join(', '));


        // 71, 199, 56, 75, 4, 15, 240, 157, 217, 211, 215, 107, 85, 225, 89, 3, 96, 25, 92, 225, 190, 34, 168, 182, 0, 223, 11, 56, 137, 109, 38, 243

        // F3266D89380BDF00B6A822BEE15C19600359E1556BD7D3D99DF00F044B38C747

        // console.log("***************Tx: ", tx);
        await rpcClient.sendRawTxCustomTokenPrivacy(tx);

        // console.log("res: ", res);
    } catch (e) {
        console.log(e);
    }
}

// TestTxCustomTokenPrivacyInit();


async function TestTxCustomTokenPrivacyTransfer() {
    let n = 0;
    let paymentInfos = new Array(n);
    // paymentInfos[0] = new key.PaymentInfo(receiverKeyWallet1.KeySet.PaymentAddress, new bn.BN(2300));

    // HN2
    let senderSpendingKeyStr1 = "112t8rqGc71CqjrDCuReGkphJ4uWHJmiaV7rVczqNhc33pzChmJRvikZNc3Dt5V7quhdzjWW9Z4BrB2BxdK5VtHzsG9JZdZ5M7yYYGidKKZV";
    let senderKeyWallet1 = keyWallet.base58CheckDeserialize(senderSpendingKeyStr1);
    // import key set
    senderKeyWallet1.KeySet.importFromPrivateKey(senderKeyWallet1.KeySet.PrivateKey);

    console.log("Payment address : ", senderKeyWallet1.KeySet.PaymentAddress);

    // HN1
    let receiverSpendingKeyStr1 = "112t8rqnMrtPkJ4YWzXfG82pd9vCe2jvWGxqwniPM5y4hnimki6LcVNfXxN911ViJS8arTozjH4rTpfaGo5i1KKcG1ayjiMsa4E3nABGAqQh";
    let receiverKeyWallet1 = keyWallet.base58CheckDeserialize(receiverSpendingKeyStr1);
    // import key set
    receiverKeyWallet1.KeySet.importFromPrivateKey(receiverKeyWallet1.KeySet.PrivateKey);

    // receiver token
    let receivers = new Array(1);
    receivers[0] = new PaymentInfo(receiverKeyWallet1.KeySet.PaymentAddress, new bn(10));


    // prepare token param
    let tokenParams = new CustomTokenPrivacyParamTx();
    tokenParams.propertyID = "56783B1532273081182E0DBA547CA564A6E71270580B75D6D06CD3A4CBE66377";
    tokenParams.propertyName = "token2";
    tokenParams.propertySymbol = "token2";
    tokenParams.amount = 10;
    tokenParams.tokenTxType = constantsTx.CustomTokenTransfer;
    tokenParams.receiver = receivers;

    let inputForNormalTx = await rpcClient.prepareInputForTx(senderSpendingKeyStr1, paymentInfos);

    let inputForTxCustomTokenPrivacy = await rpcClient.prepareInputForTxCustomTokenPrivacy(senderSpendingKeyStr1, tokenParams);

    let txCustomTokenPrivacy = new TxCustomTokenPrivacy("http://localhost:9334");
    tokenParams.tokenInput = inputForTxCustomTokenPrivacy.tokenInputs;

    await txCustomTokenPrivacy.init(senderKeyWallet1.KeySet.PrivateKey,
        inputForNormalTx.paymentAddrSerialize,
        paymentInfos,
        inputForNormalTx.inputCoins,
        inputForNormalTx.inputCoinStrs,
        new bn(0),
        tokenParams,
        inputForTxCustomTokenPrivacy.listCustomToken, null, true);

    // console.timeEnd("Time for creating tx custom token");

    console.log("Tx privacy custom token: ", txCustomTokenPrivacy);

        // console.log("***************Tx: ", tx);
    await rpcClient.sendRawTxCustomTokenPrivacy(txCustomTokenPrivacy);
}

TestTxCustomTokenPrivacyTransfer();