import {RpcClient} from "../../lib/rpcclient/rpcclient";
import {getBurningAddress} from "../../lib/wallet/utils";

// const rpcClient = new RpcClient("https://mainnet.incognito.org/fullnode");
// const rpcClient = new RpcClient("https://testnet.incognito.org/fullnode");
// const rpcClient = new RpcClient("http://54.39.158.106:20032");
// const rpcClient = new RpcClient("http://172.105.115.134:20004");

// const rpcClient = new RpcClient("http://localhost:9998");
const rpcClient = new RpcClient("http://51.161.119.68:8080");

async function sleep(sleepTime) {
  return new Promise(resolve => setTimeout(resolve, sleepTime));
}

async function TestGetExchangeRatePToken() {
  let tokenIDStr = "058316c13988ff532f205c86dc972b6fa1d30bd8262043ad6925503348b0deee";
  let res = await rpcClient.isExchangeRatePToken(tokenIDStr);
  console.log("Res: ", res);
}

async function TestGetBurningAddress(){
  let burningAddress = await getBurningAddress(rpcClient);
  console.log("burningAddress: ", burningAddress);
}

// TestGetBurningAddress()

// ----- Start Here -------

async function TestGetOutputCoin(){
  const paymentAddressStr = "12Rz88sw6FfFKuKdioLe74kiANT4UXTbC5YZ4Ycm17tkvB2W7hAS8YjWuHJnsTB9RPZFsZpE9E5N469fSa2tA79skT8RJBhVMzQHsWK";
  const readonlyKey = "13hbiJFqr3jeLcz7LsWzwkje66VFgYT7JHkNKXHM651zqYxuHFa7wDH6eE97eLTdH6QeLWG5tneSrLtMY1FrXA6Yvzq8Ymsegq91mbB";
  const tokenID = "0000000000000000000000000000000000000000000000000000000000000004";
  let outputs = await rpcClient.getOutputCoin(paymentAddressStr, readonlyKey, tokenID);
  console.log("outputs coin: ", outputs);
}

TestGetOutputCoin()

async function TestHasSerialNumber(){
  const paymentAddressStr = "12S3MWLsVS2XWyDqKDrjX7RjP9RqeNyKtgdnZvYBxE7ioC8g8AMXATH8XJoJtfvXbdmxCRrKQxH8S9eoZP2MdZhnLTjxSX6RYaBUAfm";
  const serialNumber = ["13hbiJFqr3jeLcz7LsWzwkje66VFgYT7JHkNKXHM651zqYxuHFa7wDH6eE97eLTdH6QeLWG5tneSrLtMY1FrXA6Yvzq8Ymsegq91mbB"];
  const tokenID = "0000000000000000000000000000000000000000000000000000000000000004";
  let output = await rpcClient.hasSerialNumber(paymentAddressStr, serialNumber, tokenID);
  console.log("output: ", output);
}

// TestHasSerialNumber();

async function TestGetListPrivacyToken(){
  var ptokens = await rpcClient.listPrivacyCustomTokens();
  console.log("ptokens: ", ptokens);
}

// TestGetListPrivacyToken()

async function TestGetTransactionByHash(){
  const txHashStr = "859aa7eb9522041c39d0e7f4e3fbcdd953cff1546ee1e9a5adf6c7c5acc4ee8e";
  var ptokens = await rpcClient.getTransactionByHash(txHashStr);
  console.log("ptokens: ", ptokens);
}

// TestGetTransactionByHash()

async function TestGetBeaconBestState(){
  var result = await rpcClient.getBeaconBestState();
  console.log("result: ", result);
}

// TestGetBeaconBestState()

async function TestListRewardAmount(){
  var result = await rpcClient.listRewardAmount();
  console.log("result: ", result);
}

// TestListRewardAmount()

async function TestGetBeaconBestStateDetail(){
  var result = await rpcClient.getBeaconBestStateDetail();
  console.log("result: ", result);
}

// TestGetBeaconBestStateDetail()

async function GetTransactionByReceiver() {
  var paymentAddressStr = "12Rq9cwXpX11jxEwPZQs9ddtM8A1sSZmgjRTVUayVcqNFz1naurRfVWsCVpYmMTkvgd6SCbuXJePQYEjUzsqmWpjQyRMmXV1p3o6A1A";
  var readonlyKey = "13hSjnKSaK5QkfuR1dbDzKcpGrCD5TZHnwdGkTFZaZxcBMxBm51Ma4aMcQ45RAKkpJXkhwAXEvxXv4HHfxSSTPSmgLFrYEiFZgzCbSt";
  var txs = await rpcClient.getTransactionByReceiver(paymentAddressStr, readonlyKey);
  console.log(JSON.stringify(txs));
}

// GetTransactionByReceiver();

async function TestGetListPrivacyCustomTokenBalance(){
  const privateKey = "112t8rnXWLEWW6dPuBRuBWhdL7G6Q333h9iygUvbEFy5k5zVe7rDj6gD86guzqYBTFvGZBX54iYfY54uLNFbBbeMnDtjmshvFPEWokadFkPD";
  var result = await rpcClient.getListPrivacyCustomTokenBalance(privateKey);
  console.log("result: ", result);
}

// TestGetListPrivacyCustomTokenBalance()