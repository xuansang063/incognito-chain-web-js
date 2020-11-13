import * as bip39 from 'bip39';
import * as hdkey from 'hdkey';
import bn from 'bn.js';
import { KeyWallet } from "../lib/wallet/hdwallet";
import { KeySet } from '../lib/keySet';
import { ChainCodeSize, ChildNumberSize, PriKeyType } from '../lib/wallet/constants';

async function sleep(sleepTime) {
  return new Promise(resolve => setTimeout(resolve, sleepTime));
}

async function TestKey() {
  await sleep(5000);
  const seed = bip39.mnemonicToSeedSync('cat dog cat dog cat dog cat dog cat dog cat dog');

  console.debug('SEED', seed.toString('hex'));

  const masterKey = hdkey.fromMasterSeed(seed);

  // console.debug('HD KEY', masterKey);
  console.debug('PUB KEY', masterKey.publicKey.toString('hex'));
  console.debug('PRIVATE KEY', masterKey.privateKey.toString('hex'));
  console.debug('PRIVATE EXTENDED KEY', masterKey.privateExtendedKey);

  const testImportKey = hdkey.fromExtendedKey(masterKey.publicExtendedKey);

  // console.debug('IMPORT', testImportKey);
  // console.debug('IMPORT PRIVATE KEY', testImportKey.privateKey.toString('hex'));
  // console.debug('IMPORT PUB KEY', testImportKey.publicKey.toString('hex'));
  // console.debug('IMPORT PRIVATE EXTENDED KEY', testImportKey.privateExtendedKey);

  const path = '587';
  const index = 0;
  const childHdKey = masterKey.derive(`m/44'/${path}'/0'/0/${index}`);
  const hdWalletPrivateKey = childHdKey.privateKey.toString('hex');

  // console.debug('CHILD KEY', childKey);
  console.debug('PRIVATE KEY', hdWalletPrivateKey, hdWalletPrivateKey);

  let incognitoSeed = hdWalletPrivateKey.slice(0, 32);

  const incognitoKeySet = new KeySet();
  await incognitoKeySet.generateKey(incognitoSeed);

  const incognitoChildKey = new KeyWallet();
  incognitoChildKey.ChildNumber = (new bn(index)).toArray("be", ChildNumberSize);
  incognitoChildKey.ChainCode = hdWalletPrivateKey.slice(ChainCodeSize);
  incognitoChildKey.Depth = incognitoChildKey.Depth + 1;
  incognitoChildKey.KeySet = incognitoKeySet;

  const incognitoPrivateKey = incognitoChildKey.base58CheckSerialize(PriKeyType);

  console.debug('NEW PRIVATE KEY', incognitoPrivateKey);
}

TestKey();
