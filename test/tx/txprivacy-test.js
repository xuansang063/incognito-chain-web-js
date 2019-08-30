import {KeyWallet as keyWallet} from "../../lib/wallet/hdwallet";
import * as key from "../../lib/key";
import bn from 'bn.js';
import {RpcClient} from "../../lib/rpcclient/rpcclient";
import {Tx} from "../../lib/tx/txprivacy";
import {prepareInputForTx} from "../../lib/tx/utils";
import { AccountWallet } from "../../lib/wallet/wallet";
import { PaymentAddressType } from "../../lib/wallet/constants";
import {PedCom } from "privacy-js-lib/lib/pedersen";
import { checkDecode} from "../../lib/base58";
import {InputCoin} from "../../lib/coin";
import {P256} from "privacy-js-lib/lib/ec";
// const rpcClient = new RpcClient("https://test-node.incognito.org");

const rpcClient = new RpcClient("http://192.168.0.247:9334");
async function TestTx() {
  // prepare payment infos for tx
  let n = 1;
  let paymentInfos = new Array(n);

  let receiverSpendingKeyStr1 = "112t8rnZ8iwXxHCW1ERzvVWxzhXDFNePExNWWfqSoBnhaemft7KYfpW7M79Jk8SbhDnSWP5ZeQnwKB2Usg1vvLosZoLJeBt36He1iDv5iFYg"; // Rose
  let receiverKeyWallet1 = keyWallet.base58CheckDeserialize(receiverSpendingKeyStr1);
  // import key set
  receiverKeyWallet1.KeySet.importFromPrivateKey(receiverKeyWallet1.KeySet.PrivateKey);

  paymentInfos[0] = new key.PaymentInfo(receiverKeyWallet1.KeySet.PaymentAddress, new bn(2*1e9));

  //Tien
  let senderSpendingKeyStr = "112t8rnaSSM8jizNrQRNuwAzQVKR2WnhTZCvsY5DKEKkRLJi1grZ1HeVbK2hGywZH7T2JRrJkCzBCVF5P8UVEnr8hJjLTprnEFUdA3XNrBZN";
  let senderKeyWallet = keyWallet.base58CheckDeserialize(senderSpendingKeyStr);
  senderKeyWallet.KeySet.importFromPrivateKey(senderKeyWallet.KeySet.PrivateKey);
  let senderAccount = new AccountWallet();
  senderAccount.key = senderKeyWallet;
  let senderPaymentAddress = senderKeyWallet.base58CheckSerialize(PaymentAddressType);
  console.log("senderPaymentAddress: ", senderPaymentAddress);

  let fee = new bn(0.5* 1e9);

  try {
    // console.time("rpcClient.prepareInputForTx");
    // let res = await prepareInputForTx(senderSpendingKeyStr, paymentInfos, fee, senderAccount, rpcClient);
    // console.timeEnd("rpcClient.prepareInputForTx");

  
    let coinObject = {
      "PublicKey": "181pftJwY4zhvsCNa89M5Kdw7qJnXV67BaNn6qqaYKS3GNCTLKA",
      "CoinCommitment": "18jq2ND9L1PnAxVjRLLpNk2Eo3ztYkUifFps1eTtDfhkhxCQy6G",
      "SNDerivator": "12bs8tNVK2Ljkx8vivD9NEufxarjkd3dqkMYoKLUtwjQFVS77yS",
      // "SerialNumber": "176yfPnVDsfXJbLMEQ3apEsh48RJ1XWqncA55QJ3HJZrFgXSz9K",
      "Randomness": "15vZR4fK8MS7P2vKnYDkwkwDm7a9TL5Z5VwCkBL1FySmpyq7nU",
      "Value": "3000000000",
      "Info": "13PMpZ4"
    };
  
    let publicKeyDecode = checkDecode(coinObject.PublicKey).bytesDecoded;
    let commitmentDecode = checkDecode(coinObject.CoinCommitment).bytesDecoded;
    let sndDecode = checkDecode(coinObject.SNDerivator).bytesDecoded;
    let randDecode = checkDecode(coinObject.Randomness).bytesDecoded;
    // let snDecode = checkDecode(coinObject.SerialNumber).bytesDecoded;
  
    console.log("commitmentDecode: ", commitmentDecode.join(", "));
    // console.log("publicKeyDecode: ", publicKeyDecode);
    // console.log("sndDecode: ", sndDecode);
    // console.log("randDecode: ", randDecode);
  
    let inputCoin = new InputCoin();
    inputCoin.coinDetails.publicKey = P256.decompress(publicKeyDecode);
    // inputCoin.coinDetails.coinCommitment = P256.decompress(commitmentDecode);
    inputCoin.coinDetails.snderivator = new bn(sndDecode);
    inputCoin.coinDetails.randomness = new bn(randDecode);
    inputCoin.coinDetails.value = new bn(coinObject.Value);
    inputCoin.coinDetails.info = checkDecode(coinObject.Info).bytesDecoded;
    inputCoin.coinDetails.serialNumber = PedCom.G[0].derive(new bn(senderKeyWallet.KeySet.PrivateKey), inputCoin.coinDetails.snderivator);


    let inputCoins = [];
    inputCoins[0] = inputCoin;

    let inputCoinStrs = [];
    inputCoinStrs[0] = coinObject;

    console.log("inputCoins: ", inputCoins);
    console.log("inputCoinStrs: ", inputCoinStrs);

    console.time("tx.init");
    let tx = new Tx(rpcClient);
    let err = await tx.init(senderKeyWallet.KeySet.PrivateKey, senderPaymentAddress, paymentInfos, inputCoins, inputCoinStrs,
        new bn(0), true, null, null);

    if (err !== null){
      console.log("ERR when creating tx: ", err);
    }
    console.timeEnd("tx.init");
    console.log("***************Tx: ", tx);

    let res2 ;
    try {
      res2 = await rpcClient.sendRawTx(tx);
    } catch(e){
      throw e;
    }

    console.log("TxId: ", res2.txId);
    
  
  } catch (e) {
    console.log(e);
  }
}

TestTx();


// function TestTx2(){

// }



// let arr = new Uint8Array(10);
// for (let i=0; i<10; i++){
//   arr[i] = 10;
// }
//
// console.log("ARR: ", arr);
// console.log("Arr to string: ", arr.toString());