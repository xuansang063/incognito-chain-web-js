import { RpcClient } from "../../lib/rpcclient/rpcclient";

// const rpcClient = new RpcClient("https://mainnet.incognito.org/fullnode");
const rpcClient = new RpcClient("https://test-node.incognito.org");
// const rpcClient = new RpcClient("http://54.39.158.106:20032");
// const rpcClient = new RpcClient("http://172.105.115.134:20004");

async function sleep(sleepTime) {
  return new Promise(resolve => setTimeout(resolve, sleepTime));
}

async function TestGetExchangeRatePToken() {
    let tokenIDStr = "058316c13988ff532f205c86dc972b6fa1d30bd8262043ad6925503348b0deee";
    let res = await rpcClient.isExchangeRatePToken(tokenIDStr);
    console.log("Res: ", res);
}

TestGetExchangeRatePToken()