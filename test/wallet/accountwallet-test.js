import { KeyWallet as keyWallet } from '../../lib/wallet/hdwallet';
import { AccountWallet, Wallet } from '../../lib/wallet/wallet';
import { RpcClient } from '../../lib/rpcclient/rpcclient';
import {
  CustomTokenInit,
  CustomTokenTransfer,
  MaxInfoSize,
} from '../../lib/tx/constants';
import { PaymentAddressType, PRVIDSTR } from '../../lib/wallet/constants';
import { ENCODE_VERSION } from '../../lib/constants';
import { checkEncode } from '../../lib/base58';
import { setCoinsServicesURL } from '../../lib/http/coinsServices';

// const rpcClient = new RpcClient("https://mainnet.incognito.org/fullnode");
const rpcClient = new RpcClient('https://testnet.incognito.org/fullnode');
// const rpcClient = new RpcClient("http://localhost:9354");
// const rpcClient = new RpcClient("https://dev-test-node.incognito.org");
// const rpcClient = new RpcClient("http://54.39.158.106:9334");
// const rpcClient = new RpcClient('http://139.162.55.124:8334');

Wallet.RpcClient = rpcClient;
setCoinsServicesURL({ url: 'http://51.161.119.66:9001' });

async function sleep(sleepTime) {
  return new Promise((resolve) => setTimeout(resolve, sleepTime));
}

// TestGetRewardAmount();
async function TestGetRewardAmount() {
  await sleep(5000);
  // HN1 change money
  const senderSpendingKeyStr =
    '112t8rnX7qWSJFCnGBq4YPHYN2D29NmGowC5RSbuDUC8Kg8ywg6GsPda5xRJMAmzmVKwLevdJNi5XfrqHRWDzSGEg37kbsrcWrAEQatR1UQQ';
  const senderKeyWallet = keyWallet.base58CheckDeserialize(
    senderSpendingKeyStr
  );
  await senderKeyWallet.KeySet.importFromPrivateKey(
    senderKeyWallet.KeySet.PrivateKey
  );

  const accountSender = new AccountWallet();
  accountSender.key = senderKeyWallet;

  // get reward amount
  let response0;
  try {
    response0 = await accountSender.getRewardAmount(false, '');
  } catch (e) {
    console.log(e);
  }
  console.log('REsponse getRewardAmount: ', response0);
}

// TestCreateAndSendRewardAmountTx();
async function TestCreateAndSendRewardAmountTx() {
  Wallet.RpcClient = rpcClient;
  await sleep(5000);
  // sender key
  const senderSpendingKeyStr =
    '112t8rnX7qWSJFCnGBq4YPHYN2D29NmGowC5RSbuDUC8Kg8ywg6GsPda5xRJMAmzmVKwLevdJNi5XfrqHRWDzSGEg37kbsrcWrAEQatR1UQQ';
  const senderKeyWallet = keyWallet.base58CheckDeserialize(
    senderSpendingKeyStr
  );
  await senderKeyWallet.KeySet.importFromPrivateKey(
    senderKeyWallet.KeySet.PrivateKey
  );

  const accountSender = new AccountWallet();
  accountSender.key = senderKeyWallet;

  // create and send constant tx
  let response;
  try {
    response = await accountSender.createAndSendWithdrawRewardTx('');
  } catch (e) {
    console.log(e);
  }

  console.log('Response createAndSendWithdrawRewardTx: ', response);
}

// TestBurningRequestTx();
async function TestBurningRequestTx() {
  Wallet.RpcClient = rpcClient;
  await sleep(5000);
  // sender key
  const senderSpendingKeyStr =
    '112t8rnX7qWSJFCnGBq4YPHYN2D29NmGowC5RSbuDUC8Kg8ywg6GsPda5xRJMAmzmVKwLevdJNi5XfrqHRWDzSGEg37kbsrcWrAEQatR1UQQ';
  const senderKeyWallet = keyWallet.base58CheckDeserialize(
    senderSpendingKeyStr
  );
  await senderKeyWallet.KeySet.importFromPrivateKey(
    senderKeyWallet.KeySet.PrivateKey
  );

  const accountSender = new AccountWallet();
  accountSender.key = senderKeyWallet;

  // create and send burning request tx
  let response0;
  try {
    response0 = await accountSender.createAndSendBurningRequestTx(
      [],
      {
        Privacy: true,
        TokenID:
          '51753277b5066ecbacb9bbb822812b88a3c8272c3d6b563a6a52a7d9e192f436',
        TokenName: 'Rose',
        TokenSymbol: 'Rose',
        TokenTxType: 1,
        TokenAmount: 100,
        TokenReceivers: { PaymentAddress: '', Amount: 100 },
      },
      0,
      0,
      'd5808Ba261c91d640a2D4149E8cdb3fD4512efe4'
    );
  } catch (e) {
    console.log(e);
  }

  console.log('Response createAndSendBurningRequestTx: ', response0);
}

// TestStakerStatus();
async function TestStakerStatus() {
  Wallet.RpcClient = rpcClient;
  // sender key
  const senderSpendingKeyStr =
    '112t8rnYZr2s7yMuD8V2VtXxEAWPbRjE4ycQbpuQktKADoJYiKxbCxgefjGQG64YbufDPdbTHxhczS8ucQWcXnp84X74PxSW7Kb2VsaSPZ48';
  const senderKeyWallet = keyWallet.base58CheckDeserialize(
    senderSpendingKeyStr
  );
  await senderKeyWallet.KeySet.importFromPrivateKey(
    senderKeyWallet.KeySet.PrivateKey
  );

  const accountSender = new AccountWallet();
  accountSender.key = senderKeyWallet;

  await sleep(5000);

  // get staker status
  let response0;
  try {
    response0 = await accountSender.stakerStatus();
  } catch (e) {
    console.log(e);
  }

  console.log('REsponse status staker: ', response0);
}

// TestCreateAndSendNativeToken();
async function TestCreateAndSendNativeToken() {
  Wallet.RpcClient = rpcClient;
  await sleep(5000);
  // sender key (private key)
  const senderPrivateKeyStr =
    '112t8rnXKfvZc5iAqrGtKT7kfMnbnrMLRfTTu5xfjgGYssEMdaSBC6NuPDqq8Z4QZAWhnBu1mccsJ2dU7S9f45zGyX1qw4DCRBe6Hjkhhvx7';
  const senderKeyWallet = keyWallet.base58CheckDeserialize(senderPrivateKeyStr);
  await senderKeyWallet.KeySet.importFromPrivateKey(
    senderKeyWallet.KeySet.PrivateKey
  );
  const accountSender = new AccountWallet();
  accountSender.key = senderKeyWallet;
  // receiver key (payment address)
  const receiverPaymentAddrStr =
    '12S5gFMbfrPqF76K6WAbq89reUj2PipxqGnS9Zpja1vXZnVT3eNDmMaJd9Rn1ppJT13wgQG8J59Spb3tpVfD1i7sW3mfYSaqtGhp3RS';
  // let receiverKeyWallet = keyWallet.base58CheckDeserialize(receiverPaymentAddrStr);
  // let receiverPaymentAddr = receiverKeyWallet.KeySet.PaymentAddress;

  // get balance

  let balance = await accountSender.getBalance();
  console.log('AAA balance: ', balance);

  const fee = 100;
  const isPrivacy = false;
  const info = '';
  const amountTransfer = 100; // in nano PRV

  const paymentInfosParam = [];
  paymentInfosParam[0] = {
    paymentAddressStr: receiverPaymentAddrStr,
    amount: amountTransfer,
    // "message": "A mouse is so cute A mouse is so cute A mouse is so cute A mouse is so cute A mouse is so cute A mouse is so cute A mouse is so cute"
  };

  // create and send PRV
  try {
    const res = await accountSender.createAndSendNativeToken(
      paymentInfosParam,
      fee,
      isPrivacy,
      info,
      false
    );
    console.log('Send tx succesfully with TxID: ', res.txId);
    console.log('Send tx 1 done');
    await sleep(3 * 60 * 1000);
    balance = await accountSender.getBalance();
    console.log('AFTER SEND balance: ', balance);
    await sleep(2 * 60 * 1000);
    console.log('AFTER SEND 2S balance: ', balance);
  } catch (e) {
    console.log('Error when send PRV: ', e);
  }
}

// TestCreateAndSendPrivacyTokenInit();
async function TestCreateAndSendPrivacyTokenInit() {
  Wallet.RpcClient = rpcClient;
  await sleep(5000);
  // sender key (private key)
  const senderSpendingKeyStr =
    '112t8rnjeorQyyy36Vz5cqtfQNoXuM7M2H92eEvLWimiAtnQCSZiP2HXpMW7mECSRXeRrP8yPwxKGuziBvGVfmxhQJSt2KqHAPZvYmM1ZKwR';
  const senderKeyWallet = keyWallet.base58CheckDeserialize(
    senderSpendingKeyStr
  );
  await senderKeyWallet.KeySet.importFromPrivateKey(
    senderKeyWallet.KeySet.PrivateKey
  );
  const senderPaymentAddressStr = senderKeyWallet.base58CheckSerialize(
    PaymentAddressType
  );

  const accountSender = new AccountWallet();
  accountSender.key = senderKeyWallet;

  // payment info for PRV
  const paymentInfos = [];

  // prepare token param for tx privacy token init
  const amountInit = 100000;
  const tokenParams = {
    Privacy: true,
    TokenID: '',
    TokenName: 'Rose',
    TokenSymbol: 'Rose',
    TokenTxType: CustomTokenInit,
    TokenAmount: amountInit,
    TokenReceivers: [
      {
        PaymentAddress: senderPaymentAddressStr,
        Amount: amountInit,
      },
    ],
  };

  const feePRV = 10;
  const feePToken = 0;
  const hasPrivacyForToken = false;
  const hasPrivacyForNativeToken = false;

  try {
    const res = await accountSender.createAndSendPrivacyToken(
      paymentInfos,
      tokenParams,
      feePRV,
      feePToken,
      hasPrivacyForNativeToken,
      hasPrivacyForToken,
      ''
    );
    console.log('Send tx succesfully with TxID: ', res.txId);
  } catch (e) {
    console.log('Error when initing ptoken: ', e);
  }
}

// TestCreateAndSendPrivacyTokenTransfer();
async function TestCreateAndSendPrivacyTokenTransfer() {
  Wallet.RpcClient = rpcClient;
  await sleep(5000);
  // sender key (private key)
  const senderSpendingKeyStr =
    '112t8rnjeorQyyy36Vz5cqtfQNoXuM7M2H92eEvLWimiAtnQCSZiP2HXpMW7mECSRXeRrP8yPwxKGuziBvGVfmxhQJSt2KqHAPZvYmM1ZKwR';
  const senderKeyWallet = keyWallet.base58CheckDeserialize(
    senderSpendingKeyStr
  );
  await senderKeyWallet.KeySet.importFromPrivateKey(
    senderKeyWallet.KeySet.PrivateKey
  );

  const accountSender = new AccountWallet();
  accountSender.key = senderKeyWallet;

  // receivers (payment address)
  const receiverPaymentAddressStr =
    '12Rwz4HXkVABgRnSb5Gfu1FaJ7auo3fLNXVGFhxx1dSytxHpWhbkimT1Mv5Z2oCMsssSXTVsapY8QGBZd2J4mPiCTzJAtMyCzb4dDcy';
  // let receiverKeyWallet = keyWallet.base58CheckDeserialize(receiverPaymentAddressStr);

  // payment info for PRV
  // let paymentInfos = [{
  //   paymentAddressStr: receiverPaymentAddressStr,
  //   amount: 5,
  //   message: "ABC"
  // }];
  const paymentInfos = [];
  const amountTransfer = 1000;

  // prepare token param for tx custom token init
  const tokenParams = {
    Privacy: true,
    TokenID: 'a7668c4648ffdbf3f5e0ec6e324edbaa892da52096af10da6414190712b90d44',
    TokenName: '',
    TokenSymbol: '',
    TokenTxType: CustomTokenTransfer,
    TokenAmount: amountTransfer,
    TokenReceivers: [
      {
        PaymentAddress: receiverPaymentAddressStr,
        Amount: amountTransfer,
        Message: 'ABC',
      },
    ],
  };

  const feePRV = 10;
  const feePToken = 0;
  const hasPrivacyForToken = true;
  const hasPrivacyForPRV = true;

  // try {
  const res = await accountSender.createAndSendPrivacyToken(
    paymentInfos,
    tokenParams,
    feePRV,
    feePToken,
    hasPrivacyForPRV,
    hasPrivacyForToken,
    '',
    true,
    true
  );
  console.log('Send tx succesfully with TxID: ', res.txId);
  // } catch (e) {
  //   console.log("Error when transfering ptoken: ", e);
  //   throw e;
  // }
}

// TestCreateAndSendStakingTx();
async function TestCreateAndSendStakingTx() {
  Wallet.RpcClient = rpcClient;
  await sleep(5000);
  // staker
  const senderSpendingKeyStr =
    '112t8rnjeorQyyy36Vz5cqtfQNoXuM7M2H92eEvLWimiAtnQCSZiP2HXpMW7mECSRXeRrP8yPwxKGuziBvGVfmxhQJSt2KqHAPZvYmM1ZKwR';
  const senderKeyWallet = keyWallet.base58CheckDeserialize(
    senderSpendingKeyStr
  );
  await senderKeyWallet.KeySet.importFromPrivateKey(
    senderKeyWallet.KeySet.PrivateKey
  );
  const senderPaymentAddressStr = senderKeyWallet.base58CheckSerialize(
    PaymentAddressType
  );

  const accountSender = new AccountWallet();
  accountSender.key = senderKeyWallet;

  const param = { type: 0 };
  const fee = 30;
  const candidatePaymentAddress = senderPaymentAddressStr;
  // let candidateMiningSeedKey = "12VH5z8JCn9B8SyHvB3aYP4ZGr1Wf9Rywx2ZSBe3eQneADzJ3bL";
  const rewardReceiverPaymentAddress = senderPaymentAddressStr;
  const autoReStaking = true;

  const candidateMiningSeedKey = checkEncode(
    accountSender.key.getMiningSeedKey(),
    ENCODE_VERSION
  );

  // create and send staking tx
  try {
    await accountSender.createAndSendStakingTx(
      param,
      fee,
      candidatePaymentAddress,
      candidateMiningSeedKey,
      rewardReceiverPaymentAddress,
      autoReStaking
    );
  } catch (e) {
    console.log('Error when staking: ', e);
  }
}

// TestCreateAndSendStopAutoStakingTx();
async function TestCreateAndSendStopAutoStakingTx() {
  Wallet.RpcClient = rpcClient;
  await sleep(5000);
  // staker
  const senderSpendingKeyStr = '';
  const senderKeyWallet = keyWallet.base58CheckDeserialize(
    senderSpendingKeyStr
  );
  await senderKeyWallet.KeySet.importFromPrivateKey(
    senderKeyWallet.KeySet.PrivateKey
  );
  const senderPaymentAddressStr = senderKeyWallet.base58CheckSerialize(
    PaymentAddressType
  );

  const accountSender = new AccountWallet();
  accountSender.key = senderKeyWallet;

  const fee = 5;
  const candidatePaymentAddress = senderPaymentAddressStr;
  const candidateMiningSeedKey = checkEncode(
    accountSender.key.getMiningSeedKey(),
    ENCODE_VERSION
  );

  // create and send staking tx
  try {
    await accountSender.createAndSendStopAutoStakingTx(
      fee,
      candidatePaymentAddress,
      candidateMiningSeedKey
    );
  } catch (e) {
    console.log('Error when staking: ', e);
  }
}

// TestDefragment();
async function TestDefragment() {
  await sleep(8000);
  Wallet.RpcClient = rpcClient;
  // sender
  const senderSpendingKeyStr =
    '113X9KCeDKyF3GCSwmjLnE6ufeVZUUobymQYsEfquV3rqoKiNgi53o5NMnJwWMVtqLeu75ksAGkhrqzz59d9egf1HyapW2txpYUMpfNx3bb1';
  const senderKeyWallet = keyWallet.base58CheckDeserialize(
    senderSpendingKeyStr
  );
  await senderKeyWallet.KeySet.importFromPrivateKey(
    senderKeyWallet.KeySet.PrivateKey
  );

  const accountSender = new AccountWallet();
  accountSender.key = senderKeyWallet;

  // create and send defragment tx
  try {
    for (let i = 0; i < 10; i++) {
      const response = await accountSender.defragmentNativeCoin(
        100,
        true,
        10,
        30
      );
      console.log(
        'Response defragment: ',
        accountSender.spendingCoins,
        response
      );
    }
  } catch (e) {
    console.log('ERROR', e);
  }
}

// TestFragment();
async function TestFragment() {
  await sleep(10000);
  const senders = [
    '113Hg4ewhksLe3SN5UfMS6AprNVjxjLX1AKNDRkp1vxfZkLbLRfT1iG2Cj8txpJ7PvP6jqwnUHTw1qNyDQTjR9Tx6g1WQK9PQeVJPvGh1TAp',
    '113KHgyWDDSVjP5mp2Sd4Nc4cjopm3WjBHnFgnfYhGzvz8fAMeEj5CWcudzxpr84A6kL923SB9Qh5pxfd7K25mFtYdaiYZnPTR8WiYBszFAo',
    '113G5oSiKADearq753S38NMqQA1jKPGxpqJaHkaZk7s6rZHXx3cxQ6RN2gnVTBNDbV32adPuN1aFr5oa5rM9XhWUNjR7LKrKjeLejPxm7uXD',
    '113DgVBM9RXdmHxmKS6FobrH1UTcVvVknMHjrAZnSCJZpmEkRT9z2KKEV7GaVCmujUomx6tQZfYLiUy1JJRzfoZPwhnijFWEUg1qqUZVPMvu',
    '113MhKk6mnvuheMDXrgZmCmeuvTDaN92YrDVNMgY5L5XDYPm6m2ohNNx5dHsuCdwje1c8WhCvfdU9QskXPFMLJ1etxcEuwAKsyRwjfybQgU1',
    '113iK2Y4DXfFv2D4bjWTpA9VL7QdY89WkzSfzg9jzwANHUAFozVCoj2zpmmucUkY2goN2xnaiNyLe7FnER7jXmYYxjN9Jn6uJNFUjc3GpcwS',
    '113dK4sfCN7qrcfrBMytergECXMyWoJj1QcTJUTd1kin4tfP87xBKr99NkBnHokf9U4vgn1C8zDYYjQpHjpDZ8vbY17K977b53rRQSGwiupT',
    '1137kFVc6NrAzCM4osTpYiyZ7Yup4AKEF7AzT8sLQBKz69PWL18XtUNfqspSWfsTdqVLxATrpAZhRZipbbVryQLpKQwHkFDnuC9vnbNwykYF',
    '112zsr73UXUCNqEUa3tHjUr3CQxCvfDcsYNCC7pdez7CRyvPkynXoH2wgQTYMDoEokSBve1S4Zc9EaTEvdZwzyFbdgiJbpWLvXhqf5GogTHs',
    '113Qr9vH4USFNpNyWoZqQ869sBYzofeBuA7PyQSBxtmrARPCqiGFKPzm2nxpM1UMvSC9EJaKhn6X8bHNxGW6Phm6mDnr75vtaZMnYE65FBfL',
  ];
  Wallet.RpcClient = rpcClient;

  let utxos = 0;

  const receivers = [
    '12RsABJk9vAu4qAJqPEMbJsVsTXUBMJWNsPoFr4fWZjQbiETxtWrdjZkZyjgk7vrD4iZaJJVEXJYmZapLKE2gvFKrd2pPnAYjoNDJH7',
  ];

  const amountTransfer = 1e3;
  const paymentInfos = receivers.map((item) => ({
    paymentAddressStr: item,
    amount: amountTransfer,
  }));

  while (utxos <= 40) {
    for (const sender of senders) {
      const senderKeyWallet = keyWallet.base58CheckDeserialize(sender);
      await senderKeyWallet.KeySet.importFromPrivateKey(
        senderKeyWallet.KeySet.PrivateKey
      );
      const accountSender = new AccountWallet();
      accountSender.key = senderKeyWallet;

      // create and send PRV
      const res = await accountSender.createAndSendNativeToken(
        paymentInfos,
        100,
        false,
        'Fragment',
        false
      );
      console.log('Send tx succesfully with TxID: ', res.txId);
    }

    await sleep(180000);
    utxos += 10;
    console.log('NEW UTXOs', utxos);
  }
}

// TestSendMultiple();
async function TestSendMultiple() {
  await sleep(20000);
  const masterKey =
    '112t8roafGgHL1rhAP9632Yef3sx5k8xgp8cwK4MCJsCL1UWcxXvpzg97N4dwvcD735iKf31Q2ZgrAvKfVjeSUEvnzKJyyJD3GqqSZdxN4or';
  Wallet.RpcClient = rpcClient;

  const receivers = [
    '12RqtTDruw2nbxz2rtqHvam2hGmBwPsMUCes6WZGMaUYfXz23E2gRTwA6MAKGzeVZXeRvc7bEk7bvT6BmQ4Ao6c1JwkY5fAxrTqWhzS',
    '12RwX8oHx8uWaUKA7QR24mRRYjZJN9utAD9wyZj72fgawSRoiymHVeH3YZFV1rcxuBrmqGB5dm8VM23UH5MuXq2FHg7WsX2gZNtyAJS',
    '12S5gFMbfrPqF76K6WAbq89reUj2PipxqGnS9Zpja1vXZnVT3eNDmMaJd9Rn1ppJT13wgQG8J59Spb3tpVfD1i7sW3mfYSaqtGhp3RS',
    '12S1Gj97eNmXDx3E35A1rULXmqQPN3oNkgtNLpNYMysERbHBdjJNJ4jUZ7Mab1NExEje8Crztcs8CBP3gCcAQsUAHhHXs21THTRXx1W',
    '12RyDsu2p2y5Rp6fP4GMAdYVDcTycX2f3QVRYjrNSwVKyL6s8QMojT5xVm1mEuo3j6S1Nbk7C6U1rzouxhV63cqGv5v5FQFgtQZFre1',
    '12S25ZFRh7fusQtSWpdUVz9qvbpCKUoZLtZKhKcXCdXfrxAQRUwdU6o3EJ1runKJHEHLFt4se4GQiHFjiy7Ea884wu8z6jn4B3DGBbq',
    '12S2ixNYzczL8b6fMaWY5XTCa19hqzLX7oQJHH8TN9rb7qioVJjPNxA7DXJFYhKMEhpKfcPAsQsRAG1jnS5kgkqJzU3ZXpAEF94FVnW',
    '12S3A1qWz6kng9YRfBmDn9HTNq9sGMhotZEHX2uuK2Qj6ijVALgzKtNr3GotF3BKrDPQYusaxTTXyEuEbDBmee1et7aLKCqQ6mt8rrV',
    '12S49TkrtJPHrPqwXwiKSiv8VeWYVmwVGQCujPV8Veu1jEkyW8YdS2JUM3i3krcFMkaPoEqfcVf8QJPJ8mFtwv1VVSqNPK74ZEM56Dv',
    '12RsLeV5TH4R71qJPWPX6uHht9cKbHY5o5huEeRtA7wB512XddyK2viXQFdMmMpVtKEyp1dd1yWgppdLe8oxFhB3gDQq5Mqyc26abiC',
  ];
  const amount = 100e9;
  const paymentInfos = receivers.map((item) => ({
    paymentAddressStr: item,
    amount: amount,
  }));

  const senderKeyWallet = keyWallet.base58CheckDeserialize(masterKey);
  await senderKeyWallet.KeySet.importFromPrivateKey(
    senderKeyWallet.KeySet.PrivateKey
  );
  const accountSender = new AccountWallet();
  accountSender.key = senderKeyWallet;
  const res = await accountSender.createAndSendNativeToken(
    paymentInfos,
    100,
    true,
    'Fragment',
    false
  );
  console.log('Send tx succesfully with TxID: ', res.txId);
}

// TestGetBalance();
async function TestGetBalance() {
  try {
    // sender key (private key)
    const senderPrivateKeyStr =
      '112t8rnXKfvZc5iAqrGtKT7kfMnbnrMLRfTTu5xfjgGYssEMdaSBC6NuPDqq8Z4QZAWhnBu1mccsJ2dU7S9f45zGyX1qw4DCRBe6Hjkhhvx7';
    const senderKeyWallet = keyWallet.base58CheckDeserialize(
      senderPrivateKeyStr
    );
    await senderKeyWallet.KeySet.importFromPrivateKey(
      senderKeyWallet.KeySet.PrivateKey
    );
    const accountSender = new AccountWallet();
    accountSender.setIsRevealViewKeyToGetCoins(true);
    accountSender.key = senderKeyWallet;
    const balance = await accountSender.getBalance(null);
    console.log('balance: ', balance);
  } catch (e) {
    console.log('Error when get balance: ', e);
  }
}

// TestGetBalance();

async function TestgetBalance() {
  try {
    await sleep(5000);
    // sender key (private key)
    const senderPrivateKeyStr =
      // '112t8roafGgHL1rhAP9632Yef3sx5k8xgp8cwK4MCJsCL1UWcxXvpzg97N4dwvcD735iKf31Q2ZgrAvKfVjeSUEvnzKJyyJD3GqqSZdxN4or'; //ico
      '113hagqt552h92LXY6dWPdBGS8pPdLQX5eFBLgsnzbEoU1nUTLGJkkyrTnWCz7XuURtSKzkUKFfKrMPmoNVPAbmryRbMxvNTst9cY5xqiPNN';
    const senderKeyWallet = keyWallet.base58CheckDeserialize(
      senderPrivateKeyStr
    );
    await senderKeyWallet.KeySet.importFromPrivateKey(
      senderKeyWallet.KeySet.PrivateKey
    );
    const accountSender = new AccountWallet();
    accountSender.setStorageServices();
    accountSender.key = senderKeyWallet;
    return await accountSender.getBalance();
  } catch (e) {
    console.log('Error when get balance: ', e);
  }
}

// TestGetAllPrivacyTokenBalance();
async function TestGetAllPrivacyTokenBalance() {
  Wallet.RpcClient = rpcClient;
  await sleep(5000);

  // sender key (private key)
  const senderPrivateKeyStr =
    '112t8rnX7qWSJFCnGBq4YPHYN2D29NmGowC5RSbuDUC8Kg8ywg6GsPda5xRJMAmzmVKwLevdJNi5XfrqHRWDzSGEg37kbsrcWrAEQatR1UQQ';
  const senderKeyWallet = keyWallet.base58CheckDeserialize(senderPrivateKeyStr);
  await senderKeyWallet.KeySet.importFromPrivateKey(
    senderKeyWallet.KeySet.PrivateKey
  );

  const accountSender = new AccountWallet();
  accountSender.key = senderKeyWallet;

  // create and send PRV
  try {
    const result = await accountSender.getAllPrivacyTokenBalance();
    console.log('result: ', result);
  } catch (e) {
    console.log('Error when get balance: ', e);
  }
}

/** *********************** DEX **************************/
async function TestCreateAndSendPRVContributionTx() {
  Wallet.RpcClient = rpcClient;
  await sleep(5000);
  // staker
  const senderSpendingKeyStr =
    '112t8rnX7qWSJFCnGBq4YPHYN2D29NmGowC5RSbuDUC8Kg8ywg6GsPda5xRJMAmzmVKwLevdJNi5XfrqHRWDzSGEg37kbsrcWrAEQatR1UQQ';
  const senderKeyWallet = keyWallet.base58CheckDeserialize(
    senderSpendingKeyStr
  );
  await senderKeyWallet.KeySet.importFromPrivateKey(
    senderKeyWallet.KeySet.PrivateKey
  );
  // let senderPaymentAddressStr = senderKeyWallet.base58CheckSerialize(PaymentAddressType);

  const accountSender = new AccountWallet();
  accountSender.key = senderKeyWallet;

  const fee = 1500000;
  const pdeContributionPairID = '123';
  // let contributorAddressStr = senderPaymentAddressStr;
  const contributedAmount = 100;

  // create and send staking tx
  try {
    await accountSender.createAndSendTxWithNativeTokenContribution(
      fee,
      pdeContributionPairID,
      contributedAmount
    );
  } catch (e) {
    console.log('Error when staking: ', e);
  }
}

// TestCreateAndSendPRVContributionTx();

// async function TestCreateAndSendPRVContributionTx() {
//   Wallet.RpcClient = rpcClient;
//   await sleep(5000);
//   // staker
//   let senderSpendingKeyStr = "112t8rnX7qWSJFCnGBq4YPHYN2D29NmGowC5RSbuDUC8Kg8ywg6GsPda5xRJMAmzmVKwLevdJNi5XfrqHRWDzSGEg37kbsrcWrAEQatR1UQQ";
//   let senderKeyWallet = keyWallet.base58CheckDeserialize(senderSpendingKeyStr);
//   await senderKeyWallet.KeySet.importFromPrivateKey(senderKeyWallet.KeySet.PrivateKey);
//   // let senderPaymentAddressStr = senderKeyWallet.base58CheckSerialize(PaymentAddressType);

//   let accountSender = new AccountWallet();
//   accountSender.key = senderKeyWallet;

//   let feeNativeToken = 1500000;
//   let pdeContributionPairID = "123";
//   let contributedAmount = 100;

//   let tokenParam = {
//     TokenID: "51753277b5066ecbacb9bbb822812b88a3c8272c3d6b563a6a52a7d9e192f436",
//     TokenName: "Rose",
//     TokenSymbol: "Rose"
//   }

//   // create and send staking tx
//   try {
//     await accountSender.createAndSendPTokenContributionTx(
//       tokenParam, feeNativeToken, pdeContributionPairID, contributedAmount
//     );
//   } catch (e) {
//     console.log("Error when staking: ", e);
//   }
// }

// TestCreateAndSendNativeTokenTradeRequestTx();
async function TestCreateAndSendNativeTokenTradeRequestTx() {
  Wallet.RpcClient = rpcClient;
  await sleep(5000);
  // staker
  const senderSpendingKeyStr =
    '112t8rnewVmmbP8poZSRmUvmohTYo2GG5qfmfHhWHZja3tvCLYLWXFwb1LZgFRMN6BA4hXioDqvBUMpajJBiNi7PAmryfAz2eNXiQ1xxvTV7';
  const senderKeyWallet = keyWallet.base58CheckDeserialize(
    senderSpendingKeyStr
  );
  await senderKeyWallet.KeySet.importFromPrivateKey(
    senderKeyWallet.KeySet.PrivateKey
  );
  // let senderPaymentAddressStr = senderKeyWallet.base58CheckSerialize(PaymentAddressType);

  const accountSender = new AccountWallet();
  accountSender.key = senderKeyWallet;

  const fee = 5;
  const sellAmount = 1000000000;
  const tokenIDToBuyStr =
    'b2655152784e8639fa19521a7035f331eea1f1e911b2f3200a507ebb4554387b';
  const minAcceptableAmount = 4943987;
  const tradingFee = 2500000;

  // create and send staking tx
  try {
    const res = await accountSender.createAndSendNativeTokenTradeRequestTx(
      fee,
      tokenIDToBuyStr,
      sellAmount,
      minAcceptableAmount,
      tradingFee
    );

    console.log('RES: ', res);

    // replace
    // let newFee = fee *2;
    // let newFeePToken = 0 * 2;

    // let response2 =  await accountSender.replaceTx(res.txId, newFee, newFeePToken);
    // console.log("Send tx 2 done : ", response2);
  } catch (e) {
    console.log('Error when trading native token: ', e);
  }
}

// TestCreateAndSendPTokenTradeRequestTx();
async function TestCreateAndSendPTokenTradeRequestTx() {
  Wallet.RpcClient = rpcClient;
  await sleep(5000);
  // staker
  const senderSpendingKeyStr = '';
  const senderKeyWallet = keyWallet.base58CheckDeserialize(
    senderSpendingKeyStr
  );
  await senderKeyWallet.KeySet.importFromPrivateKey(
    senderKeyWallet.KeySet.PrivateKey
  );
  // let senderPaymentAddressStr = senderKeyWallet.base58CheckSerialize(PaymentAddressType);

  const accountSender = new AccountWallet();
  accountSender.key = senderKeyWallet;

  const feePRV = 10;
  const feePToken = 0;
  const sellAmount = 300000000;
  const tokenIDToBuyStr =
    '0000000000000000000000000000000000000000000000000000000000000004';
  const minAcceptableAmount = 680000000000;
  const tradingFee = 0;

  const tokenParams = {
    Privacy: true,
    TokenID: '716fd1009e2a1669caacc36891e707bfdf02590f96ebd897548e8963c95ebac0',
    TokenName: '',
    TokenSymbol: '',
  };

  // create and send staking tx
  try {
    const res = await accountSender.createAndSendPTokenTradeRequestTx(
      tokenParams,
      feePRV,
      feePToken,
      tokenIDToBuyStr,
      sellAmount,
      minAcceptableAmount,
      tradingFee
    );
    console.log('REs: ', res);

    // replace tx
    //   let newFee = feePRV *2;
    // let newFeePToken = feePToken * 2;
    // let newInfo = "abc";
    // let newMessageForNativeToken = "Incognito-chain";
    // let newMessageForPToken = "Incognito-chain";
    // let isEncryptMessageForPToken = false;
    // let isEncryptMessageForNativeToken = false;

    //   let response2 =  await accountSender.replaceTx(res.txId, newFee, newFeePToken,
    //     newInfo, newMessageForNativeToken, isEncryptMessageForNativeToken, newMessageForPToken, isEncryptMessageForPToken);
    //   console.log("Send tx 2 done : ", response2);
  } catch (e) {
    console.log('Error when trading native token: ', e);
  }
}

// GetListReceivedTx();
async function GetListReceivedTx() {
  Wallet.RpcClient = rpcClient;
  await sleep(5000);

  const senderSpendingKeyStr = '';
  const senderKeyWallet = keyWallet.base58CheckDeserialize(
    senderSpendingKeyStr
  );
  await senderKeyWallet.KeySet.importFromPrivateKey(
    senderKeyWallet.KeySet.PrivateKey
  );

  const accountSender = new AccountWallet();
  accountSender.key = senderKeyWallet;

  const receivedTxs = await accountSender.getReceivedTransaction();
  console.log(JSON.stringify(receivedTxs, null, 2));
}

/** ****************************** REPLACE TRANSACTION *********************************/
// TestReplaceNormalTx();
async function TestReplaceNormalTx() {
  Wallet.RpcClient = rpcClient;
  await sleep(5000);

  // sender key (private key)
  const senderPrivateKeyStr =
    '112t8rnX7qWSJFCnGBq4YPHYN2D29NmGowC5RSbuDUC8Kg8ywg6GsPda5xRJMAmzmVKwLevdJNi5XfrqHRWDzSGEg37kbsrcWrAEQatR1UQQ';
  const senderKeyWallet = keyWallet.base58CheckDeserialize(senderPrivateKeyStr);
  await senderKeyWallet.KeySet.importFromPrivateKey(
    senderKeyWallet.KeySet.PrivateKey
  );

  const accountSender = new AccountWallet();
  accountSender.key = senderKeyWallet;

  // receiver key (payment address)
  const receiverPaymentAddrStr =
    '12S4NL3DZ1KoprFRy1k5DdYSXUq81NtxFKdvUTP3PLqQypWzceL5fBBwXooAsX5s23j7cpb1Za37ddmfSaMpEJDPsnJGZuyWTXJSZZ5';
  // let receiverKeyWallet = keyWallet.base58CheckDeserialize(receiverPaymentAddrStr);
  // let receiverPaymentAddr = receiverKeyWallet.KeySet.PaymentAddress;

  const fee = 5;
  const isPrivacy = true;
  const info = 'abc';
  const amountTransfer = 100 * 1e9; // in nano PRV

  const paymentInfosParam = [];
  paymentInfosParam[0] = {
    paymentAddressStr: receiverPaymentAddrStr,
    amount: amountTransfer,
  };

  // create and send PRV
  let response;
  try {
    response = await accountSender.createAndSendNativeToken(
      paymentInfosParam,
      fee,
      isPrivacy,
      info
    );
  } catch (e) {
    console.log('Error when send PRV: ', e);
  }
  console.log('Send tx 1 done: ', response);

  // await sleep(40000);

  // let newFee = fee*2;
  // let newInfo = "test replace tx";
  // let newMessage = "Rose";

  // // replace tx
  // let respone2;
  // try {
  //   respone2 = await accountSender.replaceTx(response.txId, newFee, 0, newInfo, newMessage);
  // } catch (e) {
  //   console.log("Error when replace tx: ", e);
  // }
  // console.log("Send tx 2 done, ", respone2);
}

// TestCreateAndSendReplacePrivacyTokenTransfer();
async function TestCreateAndSendReplacePrivacyTokenTransfer() {
  Wallet.RpcClient = rpcClient;
  await sleep(5000);
  // sender key (private key)
  const senderSpendingKeyStr =
    '112t8rnX7qWSJFCnGBq4YPHYN2D29NmGowC5RSbuDUC8Kg8ywg6GsPda5xRJMAmzmVKwLevdJNi5XfrqHRWDzSGEg37kbsrcWrAEQatR1UQQ';
  const senderKeyWallet = keyWallet.base58CheckDeserialize(
    senderSpendingKeyStr
  );
  await senderKeyWallet.KeySet.importFromPrivateKey(
    senderKeyWallet.KeySet.PrivateKey
  );
  const senderPaymentAddressStr = senderKeyWallet.base58CheckSerialize(
    PaymentAddressType
  );

  const accountSender = new AccountWallet();
  accountSender.key = senderKeyWallet;

  // receivers (payment address)
  const receiverPaymentAddressStr =
    '12Ryp47jXJfkz5Cketp4D9U7uTH4hFgFUVUEzq6k5ikvAZ94JucsYbi235siCMud5GdtRi1DoSecsTD2nkiic9TH7YNkLEoEhrvxvwt';
  // let receiverKeyWallet = keyWallet.base58CheckDeserialize(receiverPaymentAddressStr);

  // payment info for PRV
  const paymentInfos = [
    {
      paymentAddressStr: receiverPaymentAddressStr,
      amount: 5,
      message: 'ABC',
    },
  ];
  // let paymentInfos = [];
  const amountTransfer = 5;
  // prepare token param for tx custom token init
  const tokenParams = {
    Privacy: true,
    TokenID: '6856a8f22c3660d87ee7c5da914e4452ab245c07ecc4c3bae08ab3e0c67f81bd',
    TokenName: 'D',
    TokenSymbol: 'D',
    TokenTxType: CustomTokenTransfer,
    TokenAmount: amountTransfer,
    TokenReceivers: [
      {
        PaymentAddress: receiverPaymentAddressStr,
        Amount: amountTransfer,
        Message: 'ABC',
      },
    ],
  };

  const feePRV = 5;
  const feePToken = 0;
  const hasPrivacyForToken = true;
  const hasPrivacyForPRV = true;

  // try {
  const response1 = await accountSender.createAndSendPrivacyToken(
    paymentInfos,
    tokenParams,
    feePRV,
    feePToken,
    hasPrivacyForPRV,
    hasPrivacyForToken,
    '',
    true,
    true
  );
  console.log('Send tx 1 done : ', response1);
  // } catch (e) {
  //   console.log("Error when transfering ptoken: ", e);
  //   throw e;
  // }

  const newFee = feePRV * 2;
  const newFeePToken = feePToken * 2;
  const newInfo = 'abc';
  const newMessageForNativeToken = 'Incognito-chain';
  const newMessageForPToken = 'Incognito-chain';
  const isEncryptMessageForPToken = false;
  const isEncryptMessageForNativeToken = false;

  const response2 = await accountSender.replaceTx(
    response1.txId,
    newFee,
    newFeePToken,
    newInfo,
    newMessageForNativeToken,
    isEncryptMessageForNativeToken,
    newMessageForPToken,
    isEncryptMessageForPToken
  );
  console.log('Send tx 2 done : ', response2);
}

// TestGetOutputCoins()
async function TestGetOutputCoins() {
  Wallet.RpcClient = rpcClient;
  await sleep(5000);
  // sender key (private key)
  const senderSpendingKeyStr = '';
  const senderKeyWallet = keyWallet.base58CheckDeserialize(
    senderSpendingKeyStr
  );
  await senderKeyWallet.KeySet.importFromPrivateKey(
    senderKeyWallet.KeySet.PrivateKey
  );
  // let senderPaymentAddressStr = senderKeyWallet.base58CheckSerialize(PaymentAddressType);

  const accountSender = new AccountWallet();
  accountSender.key = senderKeyWallet;

  const allCoins = await accountSender.getAllOutputCoins(
    null,
    Wallet.RpcClient
  );
  console.log('allCoins: ', allCoins);
}

const main = async () => {
  try {
    await sleep(5000);
    await TestCreateAndSendNativeToken();
    // await sleep(2 * 60 * 1 * 1000);
    // const balance = await TestGetBalance();
    // let balance = await TestgetBalance();
    // console.debug('balance V2', balance);
    // await sleep(60 * 1000);
    // balance = await TestgetBalance();
    // console.debug('balance V2 after', balance);
    // await sleep(60 * 10000);
    // balance = await TestgetBalance();
    // console.debug('balance V2 final', balance);
    // await TestCreateAndSendNativeToken();
  } catch (error) {
    console.log(error);
  }
};

main();
