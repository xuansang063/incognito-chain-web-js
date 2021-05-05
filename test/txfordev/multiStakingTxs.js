const { Wallet, KeyWallet: keyWallet, AccountWallet, types, init, DefaultStorage } = require('../..');
const bn = require('bn.js');
const { RpcClient } = types;
const { ENCODE_VERSION, PaymentAddressType } = constants;
const { base58CheckEncode: checkEncode } = utils;
const fs = require('fs');

// Wallet.RpcClient = new RpcClient("https://mainnet.incognito.org/fullnode");
// Wallet.RpcClient = new RpcClient("https://test-node.incognito.org");
Wallet.RpcClient = new RpcClient('http://139.162.55.124:8334');


async function MultiStaking() {
  // load file paymentAddr.json to set payment infos
  let jsonString = fs.readFileSync('./test/txfordev/privateKeyList.json');

  let data = JSON.parse(jsonString);
  console.log("Data multi staking: ", data);

  await init();
  let wrongCount = 0;

  for (let i = 0; i < data.privateKeys.length; i++) {
    // set private for funder
    let funderPrivateKeyStr = data.privateKeys[i];
    // let funderKeyWallet = keyWallet.base58CheckDeserialize(funderPrivateKeyStr);
    // funderKeyWallet.KeySet.importFromPrivateKey(funderKeyWallet.KeySet.PrivateKey);
    

    let accountFunder = new AccountWallet(Wallet);
    await accountFunder.setKey(funderPrivateKeyStr);
    let funderPaymentAddressStr = accountFunder.key.base58CheckSerialize(PaymentAddressType);

    let fee = 0.5 * 1e9; // nano PRV
    let param = {
      type: 0
    };
    
    let candidatePaymentAddress = funderPaymentAddressStr;
    let rewardReceiverPaymentAddress = funderPaymentAddressStr;
    let candidateMiningSeedKey = checkEncode(funderKeyWallet.getMiningSeedKey(), ENCODE_VERSION);
    let autoReStaking = true;

    try {
      let response = await accountFunder.createAndSendStakingTx({ transfer: { fee }, extra: { candidatePaymentAddress,  candidateMiningSeedKey, rewardReceiverPaymentAddress, autoReStaking, stakingType = param.type }});
      console.log("congratulations to you! Stake successfully! ^.^")
      console.log("Response: ", response);
    } catch (e) {
      wrongCount++;
      console.log(e);
      console.log("Sorry. You can not send this transaction. Please try again. Fighting ^.^");
    }
    await sleep(1000);
  }
  console.log("Running staking test with wrong count: ", wrongCount);
}

MultiStaking();

