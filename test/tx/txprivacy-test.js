import {KeyWallet as keyWallet} from "../../lib/wallet/hdwallet";
import * as key from "../../lib/key";
import bn from 'bn.js';
import {RpcClient} from "../../lib/rpcclient/rpcclient";
import {Tx} from "../../lib/tx/txprivacy"

const rpcClient = new RpcClient("http://localhost:9334");

async function TestTx() {
  let n = 1;
  let paymentInfos = new Array(n);

  //HN2
  let receiverSpendingKeyStr1 = "112t8rqGc71CqjrDCuReGkphJ4uWHJmiaV7rVczqNhc33pzChmJRvikZNc3Dt5V7quhdzjWW9Z4BrB2BxdK5VtHzsG9JZdZ5M7yYYGidKKZV";
  let receiverKeyWallet1 = keyWallet.base58CheckDeserialize(receiverSpendingKeyStr1);
  // import key set
  receiverKeyWallet1.KeySet.importFromPrivateKey(receiverKeyWallet1.KeySet.PrivateKey);

  paymentInfos[0] = new key.PaymentInfo(receiverKeyWallet1.KeySet.PaymentAddress, new bn(2300));

  //HN1
  let spendingKeyStr = "112t8rqnMrtPkJ4YWzXfG82pd9vCe2jvWGxqwniPM5y4hnimki6LcVNfXxN911ViJS8arTozjH4rTpfaGo5i1KKcG1ayjiMsa4E3nABGAqQh";

  try {
    console.time("rpcClient.prepareInputForTx");
    let res = await rpcClient.prepareInputForTx(spendingKeyStr, paymentInfos);
    console.timeEnd("rpcClient.prepareInputForTx");
    let tx = new Tx(new RpcClient("http://localhost:9334"));
    // console.log();
    // console.log();
    // console.log("---------- BEFORE CREATE TX res input coin strs : ", res.inputCoinStrs);

    // let inputCoinStrs = new Array(res.inputCoins.length);
    // for (let i=0; i<res.inputCoins.length; i++){
    //   inputCoinStrs[i] = res.inputCoins[i].convertInputCoinToStr();
    // }

    // let inputCoinStrs = rpcClient.parseInputCoinToStr(res.inputCoins);


    console.time("tx.init");
    let err = await tx.init(res.senderKeySet.PrivateKey, res.paymentAddrSerialize, paymentInfos, res.inputCoins, res.inputCoinStrs,
        new bn(0), true, null, null);


    if (err !== null){
      console.log("ERR when creating tx")
    }
    console.timeEnd("tx.init");
    console.log("***************Tx: ", tx);

    let res2 = await rpcClient.sendRawTx(tx);
    if (res2.err !== null){
      console.log(err);
    }
    // console.log("res: ", res);
  } catch (e) {
    console.log(e);
  }
}

TestTx();

// let arr = new Uint8Array(10);
// for (let i=0; i<10; i++){
//   arr[i] = 10;
// }
//
// console.log("ARR: ", arr);
// console.log("Arr to string: ", arr.toString());