const { Wallet, Transactor : AccountWallet, types, constants, utils } = require('../../');
const { KeyWallet, RpcClient } = types;
const { PaymentAddressType, PRVIDSTR, ENCODE_VERSION } = constants;
const { base58CheckEncode : checkEncode } = utils;


async function TestGetExchangeRatePToken() {
  let tokenIDStr = "c575c9a7f0706db902fb83dcad85be2f5488e1ac3bc382cb1f3cbffebf814fef";
  let res = await Wallet.RpcClient.isExchangeRatePToken(tokenIDStr);
  console.log("Res: ", res);
}

async function GetTransactionByReceiver() {
  var paymentAddressStr = "12Rq9cwXpX11jxEwPZQs9ddtM8A1sSZmgjRTVUayVcqNFz1naurRfVWsCVpYmMTkvgd6SCbuXJePQYEjUzsqmWpjQyRMmXV1p3o6A1A";
  var readonlyKey = "13hSjnKSaK5QkfuR1dbDzKcpGrCD5TZHnwdGkTFZaZxcBMxBm51Ma4aMcQ45RAKkpJXkhwAXEvxXv4HHfxSSTPSmgLFrYEiFZgzCbSt";
  var txs = await Wallet.RpcClient.getTransactionByReceiver(paymentAddressStr, readonlyKey);
  console.log(JSON.stringify(txs));
}

// GetTransactionByReceiver();

async function TestGetListPrivacyToken(){
  var ptokens = await Wallet.RpcClient.listPrivacyCustomTokens();
  console.log("ptokens: ", ptokens);
}

// TestGetListPrivacyToken()

async function TestGetBurningAddress(){
  let burningAddress = await Wallet.RpcClient.getBurningAddress(3000);
  console.log("burningAddress: ", burningAddress);
}

// TestGetBurningAddress()

module.exports = {
    TestGetBurningAddress,
    TestGetListPrivacyToken,
    TestGetExchangeRatePToken,
    GetTransactionByReceiver
}
