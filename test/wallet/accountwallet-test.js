
import {KeyWallet as keyWallet} from "../../lib/wallet/hdwallet";
import { AccountWallet, Wallet } from "../../lib/wallet/wallet";
import {RpcClient} from "../../lib/rpcclient/rpcclient";
import {PRVID, ShardStakingType} from "../../lib/wallet/constants"
import {convertHashToStr} from "../../lib/common";
import { bn } from "privacy-js-lib/lib/sjcl/sjcl";

async function TestGetRewardAmount() {
    Wallet.RpcClient = new RpcClient("https://dev-test-node.incognito.org")
    // HN1 change money
    let senderSpendingKeyStr = "112t8rnZ8iwXxHCW1ERzvVWxzhXDFNePExNWWfqSoBnhaemft7KYfpW7M79Jk8SbhDnSWP5ZeQnwKB2Usg1vvLosZoLJeBt36He1iDv5iFYg";
    let senderKeyWallet = keyWallet.base58CheckDeserialize(senderSpendingKeyStr);
    senderKeyWallet.KeySet.importFromPrivateKey(senderKeyWallet.KeySet.PrivateKey);
    
    let accountSender = new AccountWallet();
    accountSender.key = senderKeyWallet;
    
    // // create and send constant tx
    let response0;
    try{
        response0 = await accountSender.getRewardAmount();
    } catch(e){
      console.log(e);
    }
   
    console.log("REsponse getRewardAmount: ", response0);

    // let response;
    // try{
    //   response = await accountSender.createAndSendWithdrawRewardTx("");
    // } catch(e){
    //   console.log(e);
    // }
   
    // console.log("REsponse createAndSendWithdrawRewardTx: ", response);
  }
  
  // TestGetRewardAmount();

  async function TestBurningRequestTx() {
    Wallet.RpcClient = new RpcClient("http://localhost:9334")
    // HN1 change money
    let senderSpendingKeyStr = "112t8rqJHgJp2TPpNpLNx34aWHB5VH5Pys3hVjjhhf9tctVeCNmX2zQLBqzHau6LpUbSV52kXtG2hRZsuYWkXWF5kw2v24RJq791fWmQxVqy";
    let senderKeyWallet = keyWallet.base58CheckDeserialize(senderSpendingKeyStr);
    senderKeyWallet.KeySet.importFromPrivateKey(senderKeyWallet.KeySet.PrivateKey);
    
    let accountSender = new AccountWallet();
    accountSender.key = senderKeyWallet;
    
    // // create and send constant tx
    let response0;
    try{
        response0 = await accountSender.createAndSendBurningRequestTx(
          [],
          {"Privacy":true,"TokenID":"96c63625c29d146fedca606dd64ab86e561c5ca0e691d21bd66448e5a80b03d9","TokenName":"Phuong","TokenSymbol":"pHPV","TokenTxType":1,"TokenAmount":100000000,"TokenReceivers":{"PaymentAddress":"","Amount":100000000}},
          0, 
          0,
          "d5808Ba261c91d640a2D4149E8cdb3fD4512efe4",
        );
    } catch(e){
      console.log(e);
    }
   
    console.log("REsponse createAndSendBurningRequestTx: ", response0);
  }
  
  // TestBurningRequestTx();

  async function TestIsStaked() {
    Wallet.RpcClient = new RpcClient("https://test-node.incognito.org")
    // HN1 change money
    let senderSpendingKeyStr = "112t8rnXgFuVb4pfnqh9wkwrAZZRp7WHQVtnHnxBNkaHimBoL42DvsFVLisDqXiTZpnKFAZahQsCaoWdEQ9s77FFPzRey6H9CS7JeC6ipgoB";
    let senderKeyWallet = keyWallet.base58CheckDeserialize(senderSpendingKeyStr);
    senderKeyWallet.KeySet.importFromPrivateKey(senderKeyWallet.KeySet.PrivateKey);
    
    let accountSender = new AccountWallet();
    accountSender.key = senderKeyWallet;
    
    // // create and send constant tx
    let response0;
    try{
        response0 = await accountSender.stakerStatus();
    } catch(e){
      console.log(e);
    }
   
    console.log("REsponse is staked: ", response0);
  }
  
  // TestIsStaked();

  async function sleep(sleepTime) {
    return new Promise(resolve => setTimeout(resolve, sleepTime));
  }

  async function TestStaking() {
    Wallet.RpcClient = new RpcClient("https://dev-test-node.incognito.org")
    // HN1 change money
    let senderSpendingKeyStr = "112t8rnXgFuVb4pfnqh9wkwrAZZRp7WHQVtnHnxBNkaHimBoL42DvsFVLisDqXiTZpnKFAZahQsCaoWdEQ9s77FFPzRey6H9CS7JeC6ipgoB";
    let senderKeyWallet = keyWallet.base58CheckDeserialize(senderSpendingKeyStr);
    senderKeyWallet.KeySet.importFromPrivateKey(senderKeyWallet.KeySet.PrivateKey);
    
    let accountSender = new AccountWallet();
    accountSender.key = senderKeyWallet;

    let fee = 0.5*1e9;
    let candidatePaymentAddress = "1Uv3c4hAXqNcxyFhKGwBzGXQ6qdR89nrawqSz7WmcQEX4yurCEVEZMDm1x7g9vJnHHy4Lno73aJhaJAf8fhGgPexmCpu5HuiXU94reXAC";
    let miningSeedKey = "1Y1uxmXqqB4kL3zYu6Qee3N4T8cn4konVBrwVAyZS9Mx88onpH";
    let rewardReceiverPaymentAddress = "1Uv3c4hAXqNcxyFhKGwBzGXQ6qdR89nrawqSz7WmcQEX4yurCEVEZMDm1x7g9vJnHHy4Lno73aJhaJAf8fhGgPexmCpu5HuiXU94reXAC";
    
    await sleep(5000);
    // // create and send constant tx
    let response0;
    try{
        response0 = await accountSender.createAndSendStakingTx({type: ShardStakingType}, fee, candidatePaymentAddress, miningSeedKey, rewardReceiverPaymentAddress);
    } catch(e){
      console.log(e);
    }
   
    console.log("REsponse staking: ", response0.txId);
  }
  
  TestStaking();