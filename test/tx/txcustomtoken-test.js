import {KeyWallet as keyWallet} from "../../lib/wallet/hdwallet";
import * as key from "../../lib/key";
import bn from 'bn.js';
import {RpcClient} from "../../lib/rpcclient/rpcclient";
import {Tx} from "../../lib/tx/txprivacy";
import {TxCustomToken} from "../../lib/tx/txcustomtoken";
import {TxTokenData, TxTokenVout, TxTokenVin, CustomTokenParamTx} from "../../lib/tx/txcustomtokendata";
import {CustomTokenInit, CustomTokenTransfer} from '../../lib/tx/constants';
import * as common from '../../lib/common';
import * as privacyUtils from 'privacy-js-lib/lib/privacy_utils';
import * as constantWallet from '../../lib/wallet/constants';
import * as base58 from '../../lib/base58';
import * as privacyConstants from 'privacy-js-lib/lib/constants';


const rpcClient = new RpcClient("http://localhost:9334");

async function TestTxCustomTokenInit() {
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
        let res = await rpcClient.prepareInputForTx(receiverSpendingKeyStr1, paymentInfos);
        console.timeEnd("Time for preparing input for fee");

        let tx = new TxCustomToken("http://localhost:9334");

        console.time("Time for creating tx custom token");

        let vouts = new Array(1);
        vouts[0] = new TxTokenVout();
        vouts[0].set(receiverKeyWallet1.KeySet.PaymentAddress, 100);

        let tokenParams = new CustomTokenParamTx();
        tokenParams.propertyName = "abc";
        tokenParams.propertySymbol = "abc";
        tokenParams.amount = 100;
        tokenParams.tokenTxType = CustomTokenInit;
        tokenParams.receivers = vouts;

        let res2 = await rpcClient.getListCustomTokens();
        let listCustomToken = res2.listCustomToken;

        await tx.init(res, paymentInfos, new bn.BN(0), tokenParams, listCustomToken, null, null, false);
        console.timeEnd("Time for creating tx custom token");

        console.log("Token ID after initing: ", common.convertHashToStr(tx.txTokenData.propertyID));
         console.log("Token ID after initing bytes : ", tx.txTokenData.propertyID.join(', '));

         // 221, 227, 69, 211, 137, 230, 150, 80, 201, 106, 219, 64, 98, 179, 126, 136, 6, 99, 41, 17, 241, 110, 54, 45, 178, 115, 235, 172, 232, 97, 190, 13


        // console.log("***************Tx: ", tx);
        await rpcClient.sendRawTxCustomToken(tx);

        // console.log("res: ", res);
    } catch (e) {
        console.log(e);
    }
}

// TestTxCustomTokenInit();

async function TestTxCustomTokenTransfer() {
    let n = 0;
    let paymentInfos = new Array(n);
    // paymentInfos[0] = new key.PaymentInfo(receiverKeyWallet1.KeySet.PaymentAddress, new bn.BN(2300));

    let senderSpendingKeyStr1 = "112t8rqGc71CqjrDCuReGkphJ4uWHJmiaV7rVczqNhc33pzChmJRvikZNc3Dt5V7quhdzjWW9Z4BrB2BxdK5VtHzsG9JZdZ5M7yYYGidKKZV";
    let senderKeyWallet1 = keyWallet.base58CheckDeserialize(senderSpendingKeyStr1);
    // import key set
    senderKeyWallet1.KeySet.importFromPrivateKey(senderKeyWallet1.KeySet.PrivateKey);

    let receiverSpendingKeyStr1 = "112t8rqnMrtPkJ4YWzXfG82pd9vCe2jvWGxqwniPM5y4hnimki6LcVNfXxN911ViJS8arTozjH4rTpfaGo5i1KKcG1ayjiMsa4E3nABGAqQh";
    let receiverKeyWallet1 = keyWallet.base58CheckDeserialize(receiverSpendingKeyStr1);
    // import key set
    receiverKeyWallet1.KeySet.importFromPrivateKey(receiverKeyWallet1.KeySet.PrivateKey);

    try {
        console.time("Time for preparing input for fee");
        let res = await rpcClient.prepareInputForTx(senderSpendingKeyStr1, paymentInfos);
        console.timeEnd("Time for preparing input for fee");

        let tx = new TxCustomToken("http://localhost:9334");

        console.time("Time for creating tx custom token");

        let vouts = new Array(1);
        vouts[0] = new TxTokenVout();
        vouts[0].set(receiverKeyWallet1.KeySet.PaymentAddress, 10);

        let voutsAmount = 10;

        console.log("token id bytes", common.newHashFromStr("DDE345D389E69650C96ADB4062B37E8806632911F16E362DB273EBACE861BE0D"));


        // let vins = ;
        let res0 = await rpcClient.getUnspentToken(senderKeyWallet1.base58CheckSerialize(constantWallet.PaymentAddressType),
            "DDE345D389E69650C96ADB4062B37E8806632911F16E362DB273EBACE861BE0D");

        let vins = res0.listUnspentCustomToken;

        if (vins.length ===0){
            console.log("Balance of token is zero");
            return;
        }

        let tokenVins = new Array(vins.length);
        let vinAmount = 0;

        for (let i=0; i< vins.length; i++){
            vinAmount+= vins[i].value;

            tokenVins[i] =  new TxTokenVin();
            tokenVins[i].txCustomTokenID = vins[i].propertyID;
            tokenVins[i].voutIndex = vins[i].index;
            tokenVins[i].paymentAddress = vins[i].paymentAddress;

            let signature = senderKeyWallet1.KeySet.sign(vins[i].hash());
            tokenVins[i].signature = base58.checkEncode(signature, privacyConstants.PRIVACY_VERSION);

            voutsAmount -= vins[i].value;
            if (voutsAmount <=0){
                break;
            }

        }

        let tokenParams = new CustomTokenParamTx();
        tokenParams.propertyName = "abc";
        tokenParams.propertySymbol = "abc";
        tokenParams.amount = 100;
        tokenParams.tokenTxType = CustomTokenTransfer;
        tokenParams.receivers = vouts;
        tokenParams.vins = tokenVins;
        tokenParams.propertyID = "DDE345D389E69650C96ADB4062B37E8806632911F16E362DB273EBACE861BE0D";
        tokenParams.vinsAmount = vinAmount;

        

        let res2 = await rpcClient.getListCustomTokens();
        let listCustomToken = res2.listCustomToken;

        await tx.init(res, paymentInfos, new bn.BN(0), tokenParams, listCustomToken, null, null, false);
        console.timeEnd("Time for creating tx custom token");

        // console.log("Token ID after initing: ", tx.txTokenData.propertyID.join(', '));


        // console.log("***************Tx: ", tx);
        await rpcClient.sendRawTxCustomToken(tx);

        // console.log("res: ", res);
    } catch (e) {
        console.log(e);
    }
}

TestTxCustomTokenTransfer();
//
//
// let a = [12];
// let hash = privacyUtils.hashBytesToBytes(a);
//
// console.log(hash.join(', '));
//
// let str = common.convertHashToStr(hash);
// console.log(str);
// console.log(common.newHashFromStr(str).join(', '));
