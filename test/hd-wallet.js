import * as bip39 from 'bip39';
import { NewKey } from "../lib/wallet/hdwallet";
import { AccountWallet } from '../lib/wallet/accountWallet';

async function sleep(sleepTime) {
  return new Promise(resolve => setTimeout(resolve, sleepTime));
}

async function TestKey() {
  await sleep(10000);
  const seed = bip39.mnemonicToSeedSync('artefact just insect then little marble cereal near tomato speak during menu');

  const masterAccountKey = await NewKey(seed, 0, 0);
  const account = new AccountWallet();
  account.key = masterAccountKey;
  account.child = [];
  account.name = "master";

  const info = await account.getDeserializeInformation();

  console.debug('NEW PRIVATE KEY', info.PrivateKey);
}

TestKey();
