import { KeyWallet as keyWallet } from "../../lib/wallet/hdwallet";
import * as key from "../../lib/key";
import bn from 'bn.js';
import { RpcClient } from "../../lib/rpcclient/rpcclient";
import { Tx } from "../../lib/tx/txprivacy";
import { prepareInputForTx } from "../../lib/tx/utils";
import { AccountWallet } from "../../lib/wallet/wallet";
import { PaymentAddressType } from "../../lib/wallet/constants";

const rpcClient = new RpcClient("https://test-node.incognito.org");

async function TestInitTx() {
  // prepare payment infos for tx
  let n = 1;
  let paymentInfos = new Array(n);

  let receiverPaymentAddrStr = "1Uv3c4hAXqNcxyFhKGwBzGXQ6qdR89nrawqSz7WmcQEX4yurCEVEZMDm1x7g9vJnHHy4Lno73aJhaJAf8fhGgPexmCpu5HuiXU94reXAC";
  let receiverKeyWallet = keyWallet.base58CheckDeserialize(receiverPaymentAddrStr);
  let receiverPaymentAddr = receiverKeyWallet.KeySet.PaymentAddress;
  paymentInfos[0] = new key.PaymentInfo(receiverPaymentAddr, new bn(2 * 1e9));

  // sender key
  let senderSpendingKeyStr = "112t8rnXgFuVb4pfnqh9wkwrAZZRp7WHQVtnHnxBNkaHimBoL42DvsFVLisDqXiTZpnKFAZahQsCaoWdEQ9s77FFPzRey6H9CS7JeC6ipgoB";
  let senderKeyWallet = keyWallet.base58CheckDeserialize(senderSpendingKeyStr);
  senderKeyWallet.KeySet.importFromPrivateKey(senderKeyWallet.KeySet.PrivateKey);
  let senderAccount = new AccountWallet();
  senderAccount.key = senderKeyWallet;
  let senderPaymentAddress = senderKeyWallet.base58CheckSerialize(PaymentAddressType);
  console.log("senderPaymentAddress: ", senderPaymentAddress);

  let fee = new bn(0.5 * 1e9);
  let isPrivacy = true;

  try {
    // prepare input coins
    console.time("rpcClient.prepareInputForTx");
    let res = await prepareInputForTx(senderSpendingKeyStr, paymentInfos, fee, senderAccount, rpcClient);
    console.timeEnd("rpcClient.prepareInputForTx");

    console.time("tx.init");
    // init tx
    let tx = new Tx(rpcClient);
    try {
      await tx.init(senderKeyWallet.KeySet.PrivateKey, senderPaymentAddress, paymentInfos, res.inputCoins, res.inputCoinStrs,
        fee, isPrivacy, null, null);
    } catch (e) {
      console.log("ERR when creating tx: ", e);
      return;
    }

    console.timeEnd("tx.init");
    console.log("***************Tx: ", tx);

    // send tx
    let resp;
    try {
      resp = await rpcClient.sendRawTx(tx);
    } catch (e) {
      console.log("ERR when initing tx: ", err);
      throw e;
    }
    console.log("TxId: ", resp.txId);

  } catch (e) {
    console.log(e);
  }
}

TestInitTx();