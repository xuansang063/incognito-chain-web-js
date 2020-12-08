import { Wallet, DefaultStorage, getShardIDFromLastByte } from '../../lib/wallet/wallet'
import { RpcClient } from "../../lib/rpcclient/rpcclient";
import { PaymentAddressType, PriKeyType } from '../../lib/wallet/constants';

const rpcClient = new RpcClient("https://test-node.incognito.org");
async function sleep(sleepTime) {
  return new Promise(resolve => setTimeout(resolve, sleepTime));
}

async function TestImportWallet() {
  Wallet.RpcClient = rpcClient;

  await sleep(5000);

  let wallet = new Wallet();

  let words = [
    "ability",
    "able",
    "about",
    "above",
    "absent",
    "absorb",
    "abstract",
    "absurd",
    "abuse",
    "access",
    "accident",
    "account"
  ];
  console.log("typeof words: ", typeof words);

  words = words.join(" ");

  await wallet.import(words, "$as90_jasLsS", 1, "Wallet", new DefaultStorage());

  const paymentAddress = '';

  for (let i = 1; i <= 2e9; i++) {
    const account = await wallet.createAccount('test', i);
    const newPaymentAddress = account.key.base58CheckSerialize(PaymentAddressType);
    console.debug('ACCOUNT', i, newPaymentAddress);

    if (newPaymentAddress === paymentAddress) {
      console.debug('PRIVATE KEY', account.key.base58CheckSerialize(PriKeyType));
      break;
    }
  }
}

TestImportWallet();
