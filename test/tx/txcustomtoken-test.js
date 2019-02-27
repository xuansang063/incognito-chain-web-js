import {KeyWallet as keyWallet} from "../../lib/wallet/hdwallet";
import * as key from "../../lib/key";
import bn from 'bn.js';
import {RpcClient} from "../../lib/rpcclient/rpcclient";
import {Tx} from "../../lib/tx/txprivacy";
import {TxCustomToken} from "../../lib/tx/txcustomtoken";
import {TxTokenData, TxTokenVout, CustomTokenParamTx} from "../../lib/tx/txcustomtokendata";
import {CustomTokenInit, CustomTokenTransfer} from '../../lib/tx/constants';
import * as common from '../../lib/common';
import * as privacyUtils from 'privacy-js-lib/lib/privacy_utils';

const rpcClient = new RpcClient("http://localhost:9334");

async function TestTxCustomToken() {
    let n = 0;
    let paymentInfos = new Array(n);

    let receiverSpendingKeyStr1 = "112t8rqGc71CqjrDCuReGkphJ4uWHJmiaV7rVczqNhc33pzChmJRvikZNc3Dt5V7quhdzjWW9Z4BrB2BxdK5VtHzsG9JZdZ5M7yYYGidKKZV";
    let receiverKeyWallet1 = keyWallet.base58CheckDeserialize(receiverSpendingKeyStr1);


    // import key set
    receiverKeyWallet1.KeySet.importFromPrivateKey(receiverKeyWallet1.KeySet.PrivateKey);
    //
    // paymentInfos[0] = new key.PaymentInfo(receiverKeyWallet1.KeySet.PaymentAddress, new bn.BN(2300));

    let spendingKeyStr = "112t8rqnMrtPkJ4YWzXfG82pd9vCe2jvWGxqwniPM5y4hnimki6LcVNfXxN911ViJS8arTozjH4rTpfaGo5i1KKcG1ayjiMsa4E3nABGAqQh";

    try {
        console.time("Time for preparing input for fee");
        let res = await rpcClient.prepareInputForTx(spendingKeyStr, paymentInfos);
        console.timeEnd("Time for preparing input for fee");

        let tx = new TxCustomToken("http://localhost:9334");

        console.time("Time for creating tx custom token");

        let vouts = new Array(1);
        vouts[0] = new TxTokenVout();
        vouts[0].set(receiverKeyWallet1.KeySet.PaymentAddress, 100);

        let tokenParams = new CustomTokenParamTx();
        tokenParams.propertyName = "abc";
        tokenParams.propertySymbol = "abc";
        tokenParams.amount = 1000;
        tokenParams.tokenTxType = CustomTokenInit;
        tokenParams.receivers = vouts;

        let res2 = await rpcClient.getListCustomTokens();
        let listCustomToken = res2.listCustomToken;

        await tx.init(res, paymentInfos, new bn.BN(0), tokenParams, listCustomToken, null, null, false);
        console.timeEnd("Time for creating tx custom token");

        // console.log("***************Tx: ", tx);
        await rpcClient.sendRawTxCustomToken(tx);

        // console.log("res: ", res);
    } catch (e) {
        console.log(e);
    }
}

TestTxCustomToken();

// let arr = new Uint8Array(10);
// for (let i=0; i<10; i++){
//   arr[i] = 10;
// }
//
// console.log("ARR: ", arr);
// console.log("Arr to string: ", arr.toString());


let a = [1,2,3];
let hashA = privacyUtils.hashBytesToBytes(a);
console.log("HAsh A: ", hashA);
let str = common.convertHashToStr(a);
console.log("Str: ", str);