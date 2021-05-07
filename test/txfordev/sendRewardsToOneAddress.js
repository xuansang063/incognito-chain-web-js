const { Wallet, KeyWallet: keyWallet, AccountWallet, types, init } = require('../..');
const { RpcClient } = types;
const fs = require('fs');
const bn = require('bn.js');

// Wallet.RpcClient = new RpcClient("https://mainnet.incognito.org/fullnode");
// Wallet.RpcClient = new RpcClient("https://test-node.incognito.org");
Wallet.RpcClient = new RpcClient('http://139.162.55.124:8334');

async function SendRewardsToOneAddress() {
  // load file sendRewardsToOneAddress.json to get fromAddress and toAddress
  let jsonString = fs.readFileSync('./test/txfordev/sendRewardsToOneAddress.json');

  let data = JSON.parse(jsonString);
  console.log("Data from Json file: ", data);

  let toAddress = data.toAddress;
  let fromAddressList = data.fromAddress;

  await init();

  //  tokenID, default null for PRV
  let tokenID = null;

  let feePRV = 200;      // nano PRV
  let isPrivacyPRV = true;
  let isPrivacyPToken = true;

  let totalTransfer = new bn(0);
  let numTxSuccess  = 0;

  for (let i = 0; i < fromAddressList.length; i++) {
    // set private key of sender
    let senderPrivateKeyStr = fromAddressList[i];
    // let senderKeyWallet = keyWallet.base58CheckDeserialize(senderPrivateKeyStr);
    // await senderKeyWallet.KeySet.importFromPrivateKey(senderKeyWallet.KeySet.PrivateKey);

    let accountSender = new AccountWallet(Wallet);
    await accountSender.setKey(senderPrivateKeyStr);

    // get balance
    let balance = await accountSender.getBalance(tokenID);
    balance = new bn(balance);

    // create tx transfering reward to toAddress
    if (balance.gtn(feePRV)) {
      if (tokenID == null){
        let amountTransfer = balance.subn(feePRV);
        let paymentInfo = [{
          "PaymentAddress": toAddress,
          "Amount": amountTransfer.toString(),
        }]
        try {
          let response = await accountSender.createAndSendNativeToken({ transfer: { prvPayments: paymentInfo, fee: feePRV }});
          if (response.txId != null){
            console.log("TxID: ", response.txId);
            numTxSuccess++;
            totalTransfer = totalTransfer.add(amountTransfer);
          }
        } catch(e) {
          console.log("Error when sending PRV from ", senderPrivateKeyStr, e);
          break;
        }
      } else{
        console.log("Coming soon");
        break;
      }
    } else {
      console.log("Balance of Private key: ", senderPrivateKeyStr, " is zero");
    }
    await sleep(1000);
  }

  console.log("****** Total transfer to receiver address: ", totalTransfer);
  console.log("****** Number successful transactions: ", numTxSuccess);
}

SendRewardsToOneAddress();

