import { KeyWallet as keyWallet } from "../../lib/wallet/hdwallet";
import * as key from "../../lib/key";
import bn from 'bn.js';
import { RpcClient } from "../../lib/rpcclient/rpcclient";
import { Tx } from "../../lib/tx/txprivacy";
import { prepareInputForTx, parseInputCoinFromEncodedObject } from "../../lib/tx/utils";
import { AccountWallet } from "../../lib/wallet/wallet";
import { PaymentAddressType } from "../../lib/wallet/constants";
import { checkDecode } from "../../lib/base58";
import { PaymentProof } from "../../lib/payment";

const rpcClient = new RpcClient("https://test-node.incognito.org");

async function TestInitTx() {
  // prepare payment infos for tx
  let n = 1;
  let paymentInfos = new Array(n);

  let receiverPaymentAddrStr = "1Uv4APZadR2kbpm4Uazwng2hwfqb2AtuV6Y6QVcypzQurzwE9YvUzTA8TWVndLJxtuAytWPey57YiU97abmSJ7nnPxnDdsjGcXUAiiE6t";
  let receiverKeyWallet = keyWallet.base58CheckDeserialize(receiverPaymentAddrStr);
  let receiverPaymentAddr = receiverKeyWallet.KeySet.PaymentAddress;
  paymentInfos[0] = new key.PaymentInfo(receiverPaymentAddr, new bn(1000 * 1e9));

  // sender key
  let senderSpendingKeyStr = "112t8rnXHD9s2MXSXigMyMtKdGFtSJmhA9cCBN34Fj55ox3cJVL6Fykv8uNWkDagL56RnA4XybQKNRrNXinrDDfKZmq9Y4LR18NscSrc9inc";
  let senderKeyWallet = keyWallet.base58CheckDeserialize(senderSpendingKeyStr);
  senderKeyWallet.KeySet.importFromPrivateKey(senderKeyWallet.KeySet.PrivateKey);
  let senderAccount = new AccountWallet();
  senderAccount.key = senderKeyWallet;
  let senderPaymentAddress = senderKeyWallet.base58CheckSerialize(PaymentAddressType);
  console.log("senderPaymentAddress: ", senderPaymentAddress);

  let fee = new bn(0.0 * 1e9);
  let isPrivacy = true;

  try {
    // prepare input coins
    console.time("rpcClient.prepareInputForTx");
    let res = await prepareInputForTx(senderSpendingKeyStr, paymentInfos, fee, senderAccount, rpcClient);
    console.timeEnd("rpcClient.prepareInputForTx");

    console.time("tx.init");
    // init tx
    let tx = new Tx(rpcClient);
    try {
      await tx.init(senderKeyWallet.KeySet.PrivateKey, senderPaymentAddress, paymentInfos, res.inputCoins, res.inputCoinStrs,
        fee, isPrivacy, null, null);
    } catch (e) {
      console.log("ERR when creating tx: ", e);
      return;
    }

    console.timeEnd("tx.init");
    console.log("***************Tx: ", tx);

    // send tx
    let resp;
    try {
      resp = await rpcClient.sendRawTx(tx);
    } catch (e) {
      console.log("ERR when initing tx: ", err);
      throw e;
    }
    console.log("TxId: ", resp.txId);

  } catch (e) {
    console.log(e);
  }
}

// TestInitTx();

async function TestInitTxWithSpecificCoin() {
  // prepare payment infos for tx
  let n = 1;
  let paymentInfos = new Array(n);

  let receiverPaymentAddrStr = "1Uv4APZadR2kbpm4Uazwng2hwfqb2AtuV6Y6QVcypzQurzwE9YvUzTA8TWVndLJxtuAytWPey57YiU97abmSJ7nnPxnDdsjGcXUAiiE6t";
  let receiverKeyWallet = keyWallet.base58CheckDeserialize(receiverPaymentAddrStr);
  let receiverPaymentAddr = receiverKeyWallet.KeySet.PaymentAddress;
  paymentInfos[0] = new key.PaymentInfo(receiverPaymentAddr, new bn(14 * 1e9));

  // sender key
  let senderSpendingKeyStr = "112t8rnXHD9s2MXSXigMyMtKdGFtSJmhA9cCBN34Fj55ox3cJVL6Fykv8uNWkDagL56RnA4XybQKNRrNXinrDDfKZmq9Y4LR18NscSrc9inc";
  let senderKeyWallet = keyWallet.base58CheckDeserialize(senderSpendingKeyStr);
  senderKeyWallet.KeySet.importFromPrivateKey(senderKeyWallet.KeySet.PrivateKey);
  let senderAccount = new AccountWallet();
  senderAccount.key = senderKeyWallet;
  let senderPaymentAddress = senderKeyWallet.base58CheckSerialize(PaymentAddressType);
  console.log("senderPaymentAddress: ", senderPaymentAddress);

  let fee = new bn(0.0 * 1e9);
  let isPrivacy = true;

  try {
    // // prepare input coins
    // console.time("rpcClient.prepareInputForTx");
    // let res = await prepareInputForTx(senderSpendingKeyStr, paymentInfos, fee, senderAccount, rpcClient);
    // console.timeEnd("rpcClient.prepareInputForTx");


    // let coinStr = [{
		// 		"CoinCommitment": "18dPVo1gbWJGtFi4sZ6wDpz3yjgix6T3ZYs7Hr9fV34zS85PH86",
		// 		"Info": "13PMpZ4",
		// 		"PublicKey": "183XvUp5gn7gtTWjMBGwpBSgER6zexEMAqmvvQsd9ZavsErG89y",
		// 		"Randomness": "12fWyd534XPttUmXtbtRHNVr2azs6EtmJuXPYiq8sA3v2RbLEGL",
		// 		"SNDerivator": "1JAGxpwAwFwV7iFmjVGCR1VYSMGXYXwgywCC5uUPfWekku5kLc",
		// 		"SerialNumber": null,
		// 		"Value": "3510638297"
    // }];

  //   let coinStr = [{
  //     "PublicKey": "183XvUp5gn7gtTWjMBGwpBSgER6zexEMAqmvvQsd9ZavsErG89y",
  //     "CoinCommitment": "1634tawnjRXKYphuTdiiU3PuNq3REq8LkbCGTe9CGG3PRma37kH",
  //     "SNDerivator": "12eoz7L4TPEJ3DqeNvg9bbgdKEpxSZ9SstxMDuFd4pBnjihkMfx",
  //     "SerialNumber": "17UAHwF32gHX1GbcyqdLyve6FG662Bi7tXPn4zJiEvPaMk6EK1D",
  //     "Randomness": "12kB7Cp3KNwKEhcu2MzBsF35H2zzX14JTAqzjJkyXejzQ5mopSm",
  //     "Value": "3492063492",
  //     "Info": "13PMpZ4"
  //   },
  // ];

  let coinStr = [
    // {
    //   "PublicKey": "183XvUp5gn7gtTWjMBGwpBSgER6zexEMAqmvvQsd9ZavsErG89y",
    //   "CoinCommitment": "17t3MMSQicisfhYzXaMLD3qRMaDkiEywn8ZP8rzUwdihh5WuLct",
    //   "SNDerivator": "1J3T1W56R62RxmC3rdw8xdSXP719GbHfXNWcBBJeAxvRRRi6HX",
    //   "SerialNumber": "165H2q1uybUQBtd5BGSqSVio46YXCPC4SpTX9iaJj3ZaEB2oMax",
    //   "Randomness": "129dtV5FySoRFnntb5w9YqnD1gS52fshvvPNYgsrZJfeLRFAVhi",
    //   "Value": "13423728813",
    //   "Info": "13PMpZ4"
    // },
    // {
    //   "PublicKey": "183XvUp5gn7gtTWjMBGwpBSgER6zexEMAqmvvQsd9ZavsErG89y",
    //   "CoinCommitment": "15FVTb7JwVupWFaterPwzTKdtMyn6CcUVBwVgNC1eU5iZ21bbCg",
    //   "SNDerivator": "1dBWPwSKkEpjnQxFqwSRsiRvANbYhmc1941TtE3Z7iNa3KGJLS",
    //   "SerialNumber": "17oewS3HWheSESU7xfb6bEJm7zZQF6cFPb2Di68CkxkRWk3p9oD",
    //   "Randomness": "12uehTLynRkxxYZNjVdwB9o8mNRCoyoeNBCNtYUaL25FLNEpNpz",
    //   "Value": "32442396313",
    //   "Info": "13PMpZ4"
    // }
    {
      "CoinCommitment": "15kWDmEVPxfaCtkuKGy52GwzPsawcVXgSRcw2LT7d9fJ26tGY7W",
      "Info": "13PMpZ4",
      "PublicKey": "183XvUp5gn7gtTWjMBGwpBSgER6zexEMAqmvvQsd9ZavsErG89y",
      "Randomness": "12Ae3zhWM2Vp4EsVvuT52TqxgaFmQQ6pnw6YTe3U6uk1MyCCQD9",
      "SNDerivator": "1yHaUAt67Z5LGzFF9WjYWV2vCeBWhernHNRAjoqjYLTnJpLGgw",
      "SerialNumber": null,
      "Value": "2115384615"
    },
    {
      "CoinCommitment": "15NEu6fsnKXGh5SB75UTVrpwBKPrp6xak1RBnfZzwtZGCUUTuZj",
      "Info": "13PMpZ4",
      "PublicKey": "183XvUp5gn7gtTWjMBGwpBSgER6zexEMAqmvvQsd9ZavsErG89y",
      "Randomness": "12DBRVwqpwy6ZmqFgADj9aVicnsghKQcAvH1fso61rqypUnCRHt",
      "SNDerivator": "12RQgi4Ku5yDQzzNuigk5yZcEwwh6EzhFrJDiQRQCXLthxYBQ44",
      "SerialNumber": null,
      "Value": "2492063492"
    },
    {
      "CoinCommitment": "168c9GutromiqEFU56iPm1H1NLBgZ6sxRd5kYdbP4y51zJhXDBD",
      "Info": "13PMpZ4",
      "PublicKey": "183XvUp5gn7gtTWjMBGwpBSgER6zexEMAqmvvQsd9ZavsErG89y",
      "Randomness": "1muy5cr5MVrWbj2tr5AskN6tBp6ebcibkdwH8d6Nf7ibYUeLR9",
      "SNDerivator": "12Pqd7UQo8B4CKmh8Q7Y2EPRFsFXAWyRkFqzuZT4qwMAcgbBNct",
      "SerialNumber": null,
      "Value": "2510638297"
    },
    {
      "CoinCommitment": "15iBgsY3BZxjypRptHNqD8CfYb4FWzifLLtz6gxYQnB9bMpcjDE",
      "Info": "13PMpZ4",
      "PublicKey": "183XvUp5gn7gtTWjMBGwpBSgER6zexEMAqmvvQsd9ZavsErG89y",
      "Randomness": "1ueGRFnm8f8qtKLnwe2zs2BuXUtT4XGZykFHgh5WzJvrZ3AvRg",
      "SNDerivator": "128fsyfyLDns19rwFsdeVfGNRGMJZjFJ5ZLfhzS1pTT4thLqd9h",
      "SerialNumber": null,
      "Value": "3333333333"
    },
    {
      "CoinCommitment": "15kvBCJiaQ2ZRuiizmfMKFgfWhjFdo88mLbnakc7DDmRWpnvqNu",
      "Info": "13PMpZ4",
      "PublicKey": "183XvUp5gn7gtTWjMBGwpBSgER6zexEMAqmvvQsd9ZavsErG89y",
      "Randomness": "1apHnDAZ8sm5saZBSknL6pN5EXbr85TwFATHwiQRFFJPPBvz7",
      "SNDerivator": "1ptb5uytfAZE39muwzQLWHPzTqf8zRZtD8xxSKHGE6b5szJuqQ",
      "SerialNumber": null,
      "Value": "3510638297"
    },
    {
      "CoinCommitment": "159TcxAqgFVcc4RkBTCcpbm5q2j3goyvibnAhtBFKmuasgf6ywo",
      "Info": "13PMpZ4",
      "PublicKey": "183XvUp5gn7gtTWjMBGwpBSgER6zexEMAqmvvQsd9ZavsErG89y",
      "Randomness": "1tfDumpxu1rQXMC7fjLtVdzjP8CFhQ3bze6BgWqYGHwWvQFAY2",
      "SNDerivator": "1LxoxC1kzVafD5Xa5nZWBdqokXJvonRiQwR3renR42hqv7bUdQ",
      "SerialNumber": null,
      "Value": "4177215189"
    },
    {
      "CoinCommitment": "174v2TzgJHvMZqNqZu1u1sA4CeNrTWVPcE27TEYRpKW3PxcnKpS",
      "Info": "13PMpZ4",
      "PublicKey": "183XvUp5gn7gtTWjMBGwpBSgER6zexEMAqmvvQsd9ZavsErG89y",
      "Randomness": "12tQDu6ovFVb2oLJSTvwzZs9ty1vME4EZeiNXREKg8DgX2FhPyL",
      "SNDerivator": "1Jt6JgsR3U9U3QJJkJSqejiNVNzHPvQgLgj4mnRLvRCpzxdcN4",
      "SerialNumber": null,
      "Value": "4203821656"
    },
    {
      "CoinCommitment": "18EamtgcNdRcZMU5F3x8bgF2LoXpD353ENV6nnJHRb54T2QqZ22",
      "Info": "13PMpZ4",
      "PublicKey": "183XvUp5gn7gtTWjMBGwpBSgER6zexEMAqmvvQsd9ZavsErG89y",
      "Randomness": "1GFVEkbcYTKLhn27Mhzo2G5miLobJBff9nCNZHJxirFGKuLnR9",
      "SNDerivator": "1Ko4LEZvBJCUNwytr5CTYL2e3HckYsbWhQEuAhQYAYhwTNFF9N",
      "SerialNumber": null,
      "Value": "4203821656"
    },
    {
      "CoinCommitment": "17pb83j2YcrB8WLr1jPNGsT6Qgo3dEan7U6NsJwR2QAY1PcmXWa",
      "Info": "13PMpZ4",
      "PublicKey": "183XvUp5gn7gtTWjMBGwpBSgER6zexEMAqmvvQsd9ZavsErG89y",
      "Randomness": "12cyHe5MyGLDGeKDZSknP2DEny48mNMC49Rd8CHhdiBCh35bnTs",
      "SNDerivator": "12M48gjxpPUkb69ieMLc9EhBDcCerTbhtHnAgdoaEToXUYhFiCb",
      "SerialNumber": null,
      "Value": "4230769230"
    },
    {
      "CoinCommitment": "18gHXwrvvs8NkTQk19eGSJXRaKUQqDygvASUA4hRMftsib3e8yr",
      "Info": "13PMpZ4",
      "PublicKey": "183XvUp5gn7gtTWjMBGwpBSgER6zexEMAqmvvQsd9ZavsErG89y",
      "Randomness": "12aKmjFgBr89Q7uocdfGuJCsMSRmhMH29YnZhSEkWYaXUB1NLpT",
      "SNDerivator": "1uY1pZvpTZHVCdBcAAHBitrPZBdiYemADR8GTBDTMwB3fYAYmm",
      "SerialNumber": null,
      "Value": "4230769230"
    },
    {
      "CoinCommitment": "15FTk8jAUdV4u8aW6QBZqsHPsQqCC5KXkF9CeHSzFiWhfP4eVjm",
      "Info": "13PMpZ4",
      "PublicKey": "183XvUp5gn7gtTWjMBGwpBSgER6zexEMAqmvvQsd9ZavsErG89y",
      "Randomness": "1288bNRmGC9RWzuzEwT5o4uYLwdbwkUyScnCxSPMNj5p9MrPa1E",
      "SNDerivator": "194AUfg8vpUm6TxppKVAfHwbfrQsvhwf2XLQYBaELoSSUY3EvS",
      "SerialNumber": null,
      "Value": "4230769230"
    },
    {
      "CoinCommitment": "15kEsyvcNyEBkAzaxDj64sNZPEuBvFzEddRmVe48jWevMwJTuDw",
      "Info": "13PMpZ4",
      "PublicKey": "183XvUp5gn7gtTWjMBGwpBSgER6zexEMAqmvvQsd9ZavsErG89y",
      "Randomness": "13EDcmRMRyn14jUBHJfFZW8AdxWeYuyvHd7i8VtKzHgL6uVF4F",
      "SNDerivator": "1Gq9vEPLszj43atxbspwdx8GEAbx7y8dzdJESGzoa4can4FakS",
      "SerialNumber": null,
      "Value": "4230769230"
    },
    {
      "CoinCommitment": "15pYpezPQtG4hfJXXNTKcUw1jirBxBdfA6VujmHjjF4kN275KBQ",
      "Info": "13PMpZ4",
      "PublicKey": "183XvUp5gn7gtTWjMBGwpBSgER6zexEMAqmvvQsd9ZavsErG89y",
      "Randomness": "1DjLCFnnfnuPmNU1ZXxJ5wjums7CxVE9uvFGcPBHcX6PBwqoVH",
      "SNDerivator": "14Bx5hYq5JEdXyjUXJELJgQzL2PpvGv3fgJZBKMPNTwwjEh1T8",
      "SerialNumber": null,
      "Value": "6226415094"
    },
    {
      "CoinCommitment": "16f3mLfdRUUzENcPRxgRTEcDcZuvKb2JssanHC5us8mMiZp12ss",
      "Info": "13PMpZ4",
      "PublicKey": "183XvUp5gn7gtTWjMBGwpBSgER6zexEMAqmvvQsd9ZavsErG89y",
      "Randomness": "14HrBhAk5phL2h4p4zQt63riz4NCAmVu7xpjStZEgetpRTFD91",
      "SNDerivator": "1F4wf3pmHKQUv3Dw4z7HCUT2hu15tQVAuqe1muboR7RaAuYr4A",
      "SerialNumber": null,
      "Value": "6226415094"
    },
    {
      "CoinCommitment": "18kU3FtMZFnwhEe1i4k7AAyYoZn4wRidNqPxf9cPu7DyoJxvihw",
      "Info": "13PMpZ4",
      "PublicKey": "183XvUp5gn7gtTWjMBGwpBSgER6zexEMAqmvvQsd9ZavsErG89y",
      "Randomness": "12DZhnJwr6YXDK2yuPowT6nVpkZDJ99qetei8euUK7mj9J3U3wx",
      "SNDerivator": "1G8BXPJs6umS2UWwcM8P3GVZM4VgE5vab3xFQ39aTvEJxiYtVN",
      "SerialNumber": null,
      "Value": "6226415094"
    },
    {
      "CoinCommitment": "188C79Y2jJmKNxxuGN56S5rSXDYAZqP7erMEebmui74DaS7qf4V",
      "Info": "13PMpZ4",
      "PublicKey": "183XvUp5gn7gtTWjMBGwpBSgER6zexEMAqmvvQsd9ZavsErG89y",
      "Randomness": "1WPLdUVWt6566hpjENoNkSmukPSyYBjbWwrv2nyQx49DByPR36",
      "SNDerivator": "1xD4hPppKFkwTkUK2GkR6VVEszhF94KZEFqpqvSynqUePGKnrh",
      "SerialNumber": null,
      "Value": "6285714285"
    },
    {
      "CoinCommitment": "15sk2fbeckaew3dK4uqWUU8D1Qqa1rykz6KLL3kjK83dW4bFvUK",
      "Info": "13PMpZ4",
      "PublicKey": "183XvUp5gn7gtTWjMBGwpBSgER6zexEMAqmvvQsd9ZavsErG89y",
      "Randomness": "12dewVV1wDCMWLpHtnaTUhs3HmQZbcWJ197MpfkVQ8pqtHJMRTv",
      "SNDerivator": "12H8rBNpH653oasxzwNn83y3tewoBNkvU6pjuUShzB75udywnDR",
      "SerialNumber": null,
      "Value": "6407766990"
    },
    {
      "CoinCommitment": "17vDpNeEvbkEXonoVT31enBV6TQ46WuAb49GMARkN9BQKwBAZYa",
      "Info": "13PMpZ4",
      "PublicKey": "183XvUp5gn7gtTWjMBGwpBSgER6zexEMAqmvvQsd9ZavsErG89y",
      "Randomness": "12ZpzFWkWQQbSwV7xSMjinyQH3SDH3Z2Mqabrpio3on2CKyWqt9",
      "SNDerivator": "12XUgB7HV1aFrENFXx4fCRhL8Du1U7bjGxS9FnmpEVtqWfQpqQF",
      "SerialNumber": null,
      "Value": "12983606557"
    },
    {
      "CoinCommitment": "16rDxiXDg9AhyC3o3XiBQZAtg4P2x1ER9umyspRFC4AUWGj9LnK",
      "Info": "13PMpZ4",
      "PublicKey": "183XvUp5gn7gtTWjMBGwpBSgER6zexEMAqmvvQsd9ZavsErG89y",
      "Randomness": "13CyLqj6BErihknHV7AWqHdAodLAwRwGuqkEdDqFb5chS5uhLN",
      "SNDerivator": "12bf2zoKdYw8c8BT3YMKNaVkLppoQqEkLtSCymEa6EK65FSowV7",
      "SerialNumber": null,
      "Value": "13063917525"
    },
    {
      "CoinCommitment": "17tcbagBHAjG8fr2RGLc3FjAJ5Mkbqitdv6KCtQWLiBydHoHpRP",
      "Info": "13PMpZ4",
      "PublicKey": "183XvUp5gn7gtTWjMBGwpBSgER6zexEMAqmvvQsd9ZavsErG89y",
      "Randomness": "12Br463SeHFafpPEntE1L81S6vk5HShUtgE7tiCfPzr1aWiSZMU",
      "SNDerivator": "1SXpgdZKqwENjSYgLhaam6PS3u5CciYMHuwyt1ipr5SUQQMYGn",
      "SerialNumber": null,
      "Value": "13395348837"
    },
    {
      "CoinCommitment": "15hXs8yZpHTyikvE43TDNVk89Z1rREDzt5pYyT8JPhK2GcUvPQB",
      "Info": "13PMpZ4",
      "PublicKey": "183XvUp5gn7gtTWjMBGwpBSgER6zexEMAqmvvQsd9ZavsErG89y",
      "Randomness": "12UYKRnfo2U7VFoHgTdYUiyKnhKUxPHmLJeaZ1fRRp3iXhvjnrV",
      "SNDerivator": "1fCz63BR3CLtrwqHHsVLzxHhrrK8AsQRpHNGx4TYctLqfKJj3f",
      "SerialNumber": null,
      "Value": "13395348837"
    },
    {
      "CoinCommitment": "17Pw2SmoW4zXojM8HHHMEpX5k3SjKL8UAeGXBDKjqpJBJKtHSkf",
      "Info": "13PMpZ4",
      "PublicKey": "183XvUp5gn7gtTWjMBGwpBSgER6zexEMAqmvvQsd9ZavsErG89y",
      "Randomness": "12XdvDLJ2UKASYX2wCSEKvda3xYrJKeUaP4XXmQ3f6f5hA399pg",
      "SNDerivator": "122qVAS24X5AjWdWsiX54npCN7WDrAyDk4VmGSbFNexWcofzNXa",
      "SerialNumber": null,
      "Value": "13423728813"
    },
    {
      "CoinCommitment": "185KAJWAHwmV3oPQU5vThgAUqWPwjQQi7zHPeRVx14SGQgXdFdK",
      "Info": "13PMpZ4",
      "PublicKey": "183XvUp5gn7gtTWjMBGwpBSgER6zexEMAqmvvQsd9ZavsErG89y",
      "Randomness": "12JvANGndrmGY2TeKQ5r8dYKnzpaTU1HhrtqmmK4veqAn9Gk8Vq",
      "SNDerivator": "121ZqFKC6pWTXYbnaoBy6FX8xJUabxQeWdHD2ktGMeUqk2vTRvY",
      "SerialNumber": null,
      "Value": "13714285714"
    },
    {
      "CoinCommitment": "157RHE3pyhuLxFCViVfgehgVYgQiQuTCoHP14hLbxxXirNYdTny",
      "Info": "13PMpZ4",
      "PublicKey": "183XvUp5gn7gtTWjMBGwpBSgER6zexEMAqmvvQsd9ZavsErG89y",
      "Randomness": "1iikNWS5QcNrBJv7ceGfHqE7FGyTPtKk5oJrbrzagC4CQj4ic8",
      "SNDerivator": "14G9wQANTgJs8R83zjoFfwKXAmJnjUJi3QCy6CoVpQ7RpZ6h81",
      "SerialNumber": null,
      "Value": "13714285714"
    },
    {
      "CoinCommitment": "15ZRZKtEiszzn1ft3v1o2jzZDzF64cd3myMnzeui2fJxjzrrFxu",
      "Info": "13PMpZ4",
      "PublicKey": "183XvUp5gn7gtTWjMBGwpBSgER6zexEMAqmvvQsd9ZavsErG89y",
      "Randomness": "136BugeaBg3KxD9nnwGBU8mo3Wrvzkh24UoPKxr58cNfbQAmL6",
      "SNDerivator": "1tZdZbkH3YovzztFotR5XGLvqBLFJaMgqKJeWhb1zZAs4G31jn",
      "SerialNumber": null,
      "Value": "14803738317"
    },
    {
      "CoinCommitment": "16umMvwYvs89Jrn6S1KpyPkQRUDn1L57xZtuKHm5ioNj8X67vJk",
      "Info": "13PMpZ4",
      "PublicKey": "183XvUp5gn7gtTWjMBGwpBSgER6zexEMAqmvvQsd9ZavsErG89y",
      "Randomness": "12n8CoNUUVjnAW9yJu4GQBnYK3UwpnqPh1HAmmSbYUuCyAShdf",
      "SNDerivator": "13JhsXAFoi8mzxexdg8i75zXZfpSwRhtERewzF2LvJHUS73SgR",
      "SerialNumber": null,
      "Value": "16536912751"
    },
    {
      "CoinCommitment": "17yizrKcYL6ZhxoTW8sUUAJrkwgioCA9NavL3RMRG9UTXdR5kTW",
      "Info": "13PMpZ4",
      "PublicKey": "183XvUp5gn7gtTWjMBGwpBSgER6zexEMAqmvvQsd9ZavsErG89y",
      "Randomness": "1LEWTbwHY6D3qobE8XpeFq677aBz8qaQmjCPNWf3XQy9sfJR8E",
      "SNDerivator": "12o13UUFKMKMDMkhEHigrkbyfLwDVjNoWrvnkEerKv3hzjtFiPD",
      "SerialNumber": null,
      "Value": "31866125126"
    },
    {
      "CoinCommitment": "16emCWJ2JnA7f8hctUPQ27jdNngdRVfjYTdJqtzehZNJ8bSJXrb",
      "Info": "13PMpZ4",
      "PublicKey": "183XvUp5gn7gtTWjMBGwpBSgER6zexEMAqmvvQsd9ZavsErG89y",
      "Randomness": "125SgqZF5Jz2eoRejKWPL5NvJoy6GK3DHMCYRpLtJL3TuY3HysF",
      "SNDerivator": "12CnYR365QZeJ9rawii7tixcJSP3S9ZZEVeDSC9yQDJNiGobhGR",
      "SerialNumber": null,
      "Value": "32897196261"
    },
    {
      "CoinCommitment": "18BEQa7HErZqcAiZWQQWyftqQkJhj35jQysBLa1T7kHe1nGiyvU",
      "Info": "13PMpZ4",
      "PublicKey": "183XvUp5gn7gtTWjMBGwpBSgER6zexEMAqmvvQsd9ZavsErG89y",
      "Randomness": "1Xts6Rr1XaJTsm7DcVKKLuxxQ3kTiHX8aap5hBjMwhkasmrZim",
      "SNDerivator": "17xxSmUxe6pqThhdiCdgKngqb5XVXUWnmamGLrLQbeCsJQiaf1",
      "SerialNumber": null,
      "Value": "32963210702"
    },
    {
      "CoinCommitment": "16XTnAerGKz7px5y6BEph8ygTENKEDDhWxr2emjLwZqAtiQP42u",
      "Info": "13PMpZ4",
      "PublicKey": "183XvUp5gn7gtTWjMBGwpBSgER6zexEMAqmvvQsd9ZavsErG89y",
      "Randomness": "1drZ36nLwop2FfQ11HePpvMa2d8pCqXMqXg8g6iWMDieihjsbb",
      "SNDerivator": "1VKgZ3UfeBgRzeGwR5J6YQzwD6HpmyNGSFtDYoVRiXBweE5t2R",
      "SerialNumber": null,
      "Value": "33073825503"
    },
    {
      "CoinCommitment": "17PZNhGi9RJzJNVeR9vuAvYpAmXfrtdxu9Fi1wW8mpQaXLypTRu",
      "Info": "13PMpZ4",
      "PublicKey": "183XvUp5gn7gtTWjMBGwpBSgER6zexEMAqmvvQsd9ZavsErG89y",
      "Randomness": "12TPQxp86TK33PLsjkGhVmcdWNyB6N81xcyFbVaJbJe9mrYv1UE",
      "SNDerivator": "1fF5QiQNApbN5oY65itvjsUSKgpqRGYY8j6WuSEcwc7sXAykKx",
      "SerialNumber": null,
      "Value": "33073825503"
    },
    {
      "CoinCommitment": "171xTbUnZH8EbpCgZDgb99nNWg7mHNf4V2omdNcPZoLcKxi3rAX",
      "Info": "13PMpZ4",
      "PublicKey": "183XvUp5gn7gtTWjMBGwpBSgER6zexEMAqmvvQsd9ZavsErG89y",
      "Randomness": "129q1TjZBBSfD9kCA6khtfGfhEmpPEFWcPLB85jGh7119QsLNWw",
      "SNDerivator": "1MvftproCMv1nZWiF8VPLmW6kLL6oVXuMsADcjEzpkmexUvFxq",
      "SerialNumber": null,
      "Value": "33638225255"
    },
    {
      "CoinCommitment": "15aQRptukj5hzqRuTdJMe7SBH6WfCVVE934LQ5BFdSANRdc1QBu",
      "Info": "13PMpZ4",
      "PublicKey": "183XvUp5gn7gtTWjMBGwpBSgER6zexEMAqmvvQsd9ZavsErG89y",
      "Randomness": "1i4u35rKnVtNPvoAskN8krjEhPy9Hub7GXZCL8DnpBNMb1yvuD",
      "SNDerivator": "12Zr31KF5bfqfmB1Vi2zqWPVeKgtYGSQUsUu1FF3bmDDZFTrMBP",
      "SerialNumber": null,
      "Value": "33753424657"
    },
    {
      "CoinCommitment": "15BAnWMq1HUBcLg98A4rpc5LZ2S1VzChjVUCpDZzLfSjaupNB2v",
      "Info": "13PMpZ4",
      "PublicKey": "183XvUp5gn7gtTWjMBGwpBSgER6zexEMAqmvvQsd9ZavsErG89y",
      "Randomness": "1BcCE1vKLEi4AYRwTmw2Dwt1umdZitJAPeBM9g8dfe1oui5WX8",
      "SNDerivator": "121LQ3vcYmkweMxj2k8aMs8hYLv3wxVrvPMAiE83SXiE4TgTc2a",
      "SerialNumber": null,
      "Value": "33753424657"
    },
    {
      "CoinCommitment": "16pqEAVx3NQ8THGM3dEb9tw2JqtuQxe1syC7DUkx87EwrFYheor",
      "Info": "13PMpZ4",
      "PublicKey": "183XvUp5gn7gtTWjMBGwpBSgER6zexEMAqmvvQsd9ZavsErG89y",
      "Randomness": "1SdNfyU1KJ8rwi1b7yivuPA46uYHhWZWD66tm2VRnCew2JH6gf",
      "SNDerivator": "1wEtfoAG8TRw5syjKFgXR54J4k2szkiytDyL7ua9nf4q1UUq1",
      "SerialNumber": null,
      "Value": "37215859030"
    },
    {
      "CoinCommitment": "15WH1Kag5NAG48Rud4kH8CZ2BR78YkFjiuTi1MbMiMkRC4kjv5W",
      "Info": "13PMpZ4",
      "PublicKey": "183XvUp5gn7gtTWjMBGwpBSgER6zexEMAqmvvQsd9ZavsErG89y",
      "Randomness": "1A65DdgjWkarzBYA9gE54zQchm2gvfDbwdqpDWMnhKTuvTmJqC",
      "SNDerivator": "14Vz7DS6DLucjBZKrUNBtdAVSeUjsL8yy5AoK5rYSrmJogENtJ",
      "SerialNumber": null,
      "Value": "37333333333"
    },
    {
      "CoinCommitment": "16JntsnNk2P5mTsamSizKcrcPdxFq9j4TTZGFyJ7DFeWffGYeeJ",
      "Info": "13PMpZ4",
      "PublicKey": "183XvUp5gn7gtTWjMBGwpBSgER6zexEMAqmvvQsd9ZavsErG89y",
      "Randomness": "19iavprFKR1QQXMvcvKoBhbFDjbgXaddNh2XPNbvjjR4XLvYVD",
      "SNDerivator": "1WC8kBb6jyJKLB96zuLdxTAMtSRyrVzuKmWJMpGY1cCQkdezjv",
      "SerialNumber": null,
      "Value": "37333333333"
    },
    {
      "CoinCommitment": "17dpd5NNmrxiPYe1dvAN1qJuVKviZAg1EUKhKH41WhHFGqREEpY",
      "Info": "13PMpZ4",
      "PublicKey": "183XvUp5gn7gtTWjMBGwpBSgER6zexEMAqmvvQsd9ZavsErG89y",
      "Randomness": "12VnmdAaQPDtwA9qrbK6bmRWuFgYx7gCR1RT7EJkqzcDLhgDUHk",
      "SNDerivator": "13ZMeRuwnKJwxAzRhBBDnN6KejQx3oPtkuGZyLuvKsZNk6DT5B",
      "SerialNumber": null,
      "Value": "37907692307"
    },
    {
      "CoinCommitment": "16bHqebg9v84tkvrfMsphUyKKibmiSicsH2SvnjueMBMeemSwDL",
      "Info": "13PMpZ4",
      "PublicKey": "183XvUp5gn7gtTWjMBGwpBSgER6zexEMAqmvvQsd9ZavsErG89y",
      "Randomness": "1abx1CB182iJ7uU15JK86xkf9R1w5FTLTmeG6ETfoA7bxpebgb",
      "SNDerivator": "1GKUqR3Usf4KDvfby7ET6JWV5679kn4e3bk9ucQs9NZAvZVrr1",
      "SerialNumber": null,
      "Value": "38054054054"
    },
    {
      "CoinCommitment": "18L7Puf4qDqYRUd4rjcRuk5JBia1he2syff9ofCsdfE6hVE5cHL",
      "Info": "13PMpZ4",
      "PublicKey": "183XvUp5gn7gtTWjMBGwpBSgER6zexEMAqmvvQsd9ZavsErG89y",
      "Randomness": "1y2VoSPjpCAS47FQf8WudryAtkP87hFMsMTXiS58MJqbSLbkXs",
      "SNDerivator": "1H7fHJsKwDrYrtyG7ewUeFVtkPwVLK7kuKjcm63ZRH7KvrdzVF",
      "SerialNumber": null,
      "Value": "63792880258"
    },
    {
      "CoinCommitment": "18YSew1voaRprYKBqaZK1En6daqhtvH3h6e7aTryVtA6qQ9hxYd",
      "Info": "13PMpZ4",
      "PublicKey": "183XvUp5gn7gtTWjMBGwpBSgER6zexEMAqmvvQsd9ZavsErG89y",
      "Randomness": "122iE8WpTJjjjheygXWshS6XoCDjevXma2w7597Zr4eEdsuB6bH",
      "SNDerivator": "1pHEczVca13dHanAcqLfr8XZEw9tCdxhxP8YuLR5HEyCW691mS",
      "SerialNumber": null,
      "Value": "63792880258"
    },
    {
      "CoinCommitment": "15699oxAL7wTCohJcCe9eyGbKdXbht2kweAenoUkgmEbZvwNdAi",
      "Info": "13PMpZ4",
      "PublicKey": "183XvUp5gn7gtTWjMBGwpBSgER6zexEMAqmvvQsd9ZavsErG89y",
      "Randomness": "1k5K5KRsvMcTETYqn6z9HUqZNVARrarc6XTHspiqnBCo852Sd1",
      "SNDerivator": "1TGuBhx5Z8gmjE1mJZCVSvDyzpmxGNy8cT8huitafgbmBfLrRJ",
      "SerialNumber": null,
      "Value": "134939759036"
    },
    {
      "CoinCommitment": "17xWqZ4ySGRFBvzCLVwgsKr448cgisrVAqssoXkFEWsKpLtXJhh",
      "Info": "13PMpZ4",
      "PublicKey": "183XvUp5gn7gtTWjMBGwpBSgER6zexEMAqmvvQsd9ZavsErG89y",
      "Randomness": "1b6SocXBc77r2ozR38i2rBWYYaByGA8o8YsMzLwAfiDcbMaWa7",
      "SNDerivator": "12gTcfb4yVvxb6WuhpU12q1gFQ225PQybXN5inAu4S6kYFRGJqM",
      "SerialNumber": null,
      "Value": "375420344428"
    }

  ];

  console.log("len input coin: ", coinStr.length);

    let coinObjects = parseInputCoinFromEncodedObject(coinStr, senderKeyWallet);
    console.log("coinObjects: ", coinObjects)

    console.time("tx.init");
    // init tx
    let tx = new Tx(rpcClient);
    try {
      await tx.init(senderKeyWallet.KeySet.PrivateKey, senderPaymentAddress, paymentInfos, coinObjects, coinStr,
        fee, isPrivacy, null, null);
    } catch (e) {
      console.log("ERR when creating tx: ", e);
      return;
    }

    console.timeEnd("tx.init");
    console.log("***************Tx: ", tx);

    // send tx
    let resp;
    try {
      resp = await rpcClient.sendRawTx(tx);
    } catch (e) {
      console.log("ERR when initing tx: ", e);
      throw e;
    }
    console.log("TxId: ", resp.txId);

  } catch (e) {
    console.log(e);
  }
}

TestInitTxWithSpecificCoin();
