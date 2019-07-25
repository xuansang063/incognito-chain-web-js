
import {KeyWallet as keyWallet} from "../../lib/wallet/hdwallet";
import { AccountWallet, Wallet } from "../../lib/wallet/wallet";
import {RpcClient} from "../../lib/rpcclient/rpcclient";
import {PRVID} from "../../lib/wallet/constants"
import {convertHashToStr} from "../../lib/common";

async function TestGetRewardAmount() {
    Wallet.RpcClient = new RpcClient("https://test-node.incognito.org")
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

    let response;
    try{
      response = await accountSender.createAndSendWithdrawRewardTx("");
    } catch(e){
      console.log(e);
    }
   
    console.log("REsponse createAndSendWithdrawRewardTx: ", response);
  }
  
  TestGetRewardAmount();