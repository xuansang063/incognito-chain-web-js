import { Wallet } from '../../lib/wallet/wallet'
import { KeyWallet as keyWallet } from "../../lib/wallet/hdwallet";
import { AccountWallet } from "../../lib/wallet/accountWallet";
import { RpcClient } from "../../lib/rpcclient/rpcclient";
const fs = require('fs');

Wallet.RpcClient = new RpcClient("https://mainnet.incognito.org/fullnode");
// Wallet.RpcClient = new RpcClient("https://test-node.incognito.org");

async function sleep(sleepTime) {
  return new Promise(resolve => setTimeout(resolve, sleepTime));
}

async function Trade() {
  await sleep(5000);

  // TODO 1. need to fill in your private key
  let privateKeyStr = "113LTtaVFRYsmFJGxRNib3xjSDdrcVji2i8mFbuiVk7P2pvYmQjMBEpFaksGfqAvNrboUPNTEjXSJA4qaFuDNDfnUoPKhLHoXFgNDiiRdXBq";
  let senderKeyWallet = keyWallet.base58CheckDeserialize(privateKeyStr);
  senderKeyWallet.KeySet.importFromPrivateKey(senderKeyWallet.KeySet.PrivateKey);

  let accountSender = new AccountWallet();
  accountSender.key = senderKeyWallet;


  // Sell PRV to other token
  let fee = 5;
  let sellAmount = 3000000000000;
  let tokenIDToBuyStr = "b832e5d3b1f01a4f0623f7fe91d6673461e1f5d37d91fe78c5c2e6183ff39696";
  let minAcceptableAmount = 342528000;
  let tradingFee = 1;

  // create and send staking tx
  try {
    let res = await accountSender.createAndSendNativeTokenTradeRequestTx(
      fee, tokenIDToBuyStr, sellAmount, minAcceptableAmount, tradingFee
    );

    console.log("RES: ", res);
  } catch (e) {
    console.log("Error when trading native token: ", e);
  }





  // Buy PRV by other token
//     let feePRV = 10;
//   let feePToken = 0;
//   let tokenIDToBuyStr = "0000000000000000000000000000000000000000000000000000000000000004";
//   let sellAmount = 300000000;
//   let minAcceptableAmount = 680000000000;
//   let tradingFee = 0;

//   let tokenParams = {
//     Privacy: true,
//     TokenID: "716fd1009e2a1669caacc36891e707bfdf02590f96ebd897548e8963c95ebac0",
//     TokenName: "",
//     TokenSymbol: ""
//   }

//   try {
//     let res = await accountSender.createAndSendPTokenTradeRequestTx(
//       tokenParams, feePRV, feePToken, tokenIDToBuyStr, sellAmount, minAcceptableAmount, tradingFee
//     );
//     console.log("REs: ", res);
//   } catch (e)  
//     console.log("Error when trading privacy token: ", e);
//   }

}

Trade();