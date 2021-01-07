import {RpcClient} from "../../lib/rpcclient/rpcclient";
// import {getBurningAddress} from "../../lib/wallet/utils";

const rpcClient = new RpcClient("http://localhost:9334");
async function sleep(sleepTime) {
  return new Promise(resolve => setTimeout(resolve, sleepTime));
}


// const rpcClient = new RpcClient("https://mainnet.incognito.org/fullnode");
// const rpcClient = new RpcClient("https://test-node.incognito.org");
// const rpcClient = new RpcClient("http://54.39.158.106:20032");
// const rpcClient = new RpcClient("http://172.105.115.134:20004");


// async function TestGetExchangeRatePToken() {
//   let tokenIDStr = "058316c13988ff532f205c86dc972b6fa1d30bd8262043ad6925503348b0deee";
//   let res = await rpcClient.isExchangeRatePToken(tokenIDStr);
//   console.log("Res: ", res);
// }

// async function GetTransactionByReceiver() {
//   var paymentAddressStr = "12Rq9cwXpX11jxEwPZQs9ddtM8A1sSZmgjRTVUayVcqNFz1naurRfVWsCVpYmMTkvgd6SCbuXJePQYEjUzsqmWpjQyRMmXV1p3o6A1A";
//   var readonlyKey = "13hSjnKSaK5QkfuR1dbDzKcpGrCD5TZHnwdGkTFZaZxcBMxBm51Ma4aMcQ45RAKkpJXkhwAXEvxXv4HHfxSSTPSmgLFrYEiFZgzCbSt";
//   var txs = await rpcClient.getTransactionByReceiver(paymentAddressStr, readonlyKey);
//   console.log(JSON.stringify(txs));
// }

// // GetTransactionByReceiver();

// async function TestGetListPrivacyToken(){
//   var ptokens = await rpcClient.listPrivacyCustomTokens();
//   console.log("ptokens: ", ptokens);
// }

// // TestGetListPrivacyToken()

// async function TestGetBurningAddress(){
//   let burningAddress = await getBurningAddress(rpcClient);
//   console.log("burningAddress: ", burningAddress);
// }

// // TestGetBurningAddress()


async function TestMultiSend(){
  let privateKeyStr = "112t8roafGgHL1rhAP9632Yef3sx5k8xgp8cwK4MCJsCL1UWcxXvpzg97N4dwvcD735iKf31Q2ZgrAvKfVjeSUEvnzKJyyJD3GqqSZdxN4or";
  let paymentInfos = {
    "12shR6fDe7ZcprYn6rjLwiLcL7oJRiek66ozzYu3B3rBxYXkqJeZYj6ZWeYy4qR4UHgaztdGYQ9TgHEueRXN7VExNRGB5t4auo3jTgXVBiLJmnTL5LzqmTXezhwmQvyrRjCbED5xVWf4ETHbRCSP": 10000000000,
    "12sm28usKxzw8HuwGiEojZZLWgvDinAkmZ3NvBNRQLuPrf5LXNLXVXiu4VBCMVDrDm97qjLrgFck3P36UTSWfqNX1PBP9PBD78Cpa95em8vcnjQrnwDNi8EdkdkSA6CWcs4oFatQYze7ETHAUBKH": 10000000000 
  }
  let numTx = 0;
  for (let i = 0; i< 50; i++)
  {
    try {
      let res = await rpcClient.createAndSendRPC(privateKeyStr, paymentInfos);
      console.log("Res: ", res);
      numTx++;
    } catch(e){
      console.log(e);
    }
    await sleep(10000);
  }  
  console.log(numTx);
  
}

TestMultiSend();
