import {KeyWallet as keyWallet} from "../../lib/wallet/hdwallet";
import * as key from "../../lib/key";
import bn from 'bn.js';
import {RpcClient} from "../../lib/rpcclient/rpcclient";
import {Tx} from "../../lib/tx/txprivacy"

const rpcClient = new RpcClient("http://localhost:9334")

async function TestTx() {
  let n = 1;
  let paymentInfos = new Array(n);

  let receiverSpendingKeyStr1 = "112t8rqGc71CqjrDCuReGkphJ4uWHJmiaV7rVczqNhc33pzChmJRvikZNc3Dt5V7quhdzjWW9Z4BrB2BxdK5VtHzsG9JZdZ5M7yYYGidKKZV";
  let receiverKeyWallet1 = keyWallet.base58CheckDeserialize(receiverSpendingKeyStr1);

  // import key set
  receiverKeyWallet1.KeySet.importFromPrivateKey(receiverKeyWallet1.KeySet.PrivateKey);

  paymentInfos[0] = new key.PaymentInfo(receiverKeyWallet1.KeySet.PaymentAddress, new bn.BN(2300));

  try {
    let res = await rpcClient.prepareInputForTx("", paymentInfos);
    let tx = new Tx("http://localhost:9334");
    // console.log();
    // console.log();
    // console.log("---------- BEFORE CREATE TX res input coin strs : ", res.inputCoinStrs);


    await tx.init(res, paymentInfos, new bn.BN(0), true, null, null, null);
    // console.log("***************Tx: ", tx);

    await rpcClient.sendTx(tx);
    // console.log("res: ", res);
  } catch (e) {
    console.log(e);
  }
}

TestTx();