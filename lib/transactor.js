// import bn from "bn.js";
// import {
//   CustomTokenInit,
//   TxNormalType,
//   TxCustomTokenPrivacyType,
//   CustomTokenTransfer,
//   MaxInputNumberForDefragment,
//   MAX_INPUT_PER_TX,
// } from "./tx/constants";
// import {
//   FailedTx,
//   SuccessTx,
//   MetaStakingBeacon,
//   MetaStakingShard,
//   PaymentAddressType,
//   ReadonlyKeyType,
//   PriKeyType,
//   OTAKeyType,
//   PDETradeRequestMeta,
//   PDECrossPoolTradeRequestMeta,
//   PDEWithdrawalRequestMeta,
//   StopAutoStakingMeta,
//   ShardStakingType,
//   BurningRequestMeta,
//   IssuingETHRequestMeta,
//   InitTokenRequestMeta,
//   WithDrawRewardRequestMeta,
//   PRVID,
//   PRVIDSTR,
//   PercentFeeToReplaceTx,
//   encryptMessageOutCoin,
//   decryptMessageOutCoin,
//   getBurningAddress,
//   TxHistoryInfo,
//   KeyWallet,
//   PDEPRVRequiredContributionRequestMeta,
// } from "./core";
// import { checkEncode, checkDecode } from "./common/base58";
// import {
//   prepareInputForTxV2,
//   getUnspentCoin,
//   newParamTxV2,
//   newTokenParamV2,
// } from "./tx/utils";
// import { ENCODE_VERSION, ED25519_KEY_SIZE } from "./common/constants";
// import {
//   convertHashToStr,
//   getShardIDFromLastByte,
//   getChildIdFromChildNumberArray,
// } from "./common/common";
// import {
//   generateCommitteeKeyFromHashPrivateKey,
//   generateBLSPubKeyB58CheckEncodeFromSeed,
// } from "./common/committeekey";
// import {
//   hashSha3BytesToBytes,
//   base64Decode,
//   base64Encode,
//   stringToBytes,
//   bytesToString,
//   toHexString,
//   setRandBytesFunc,
// } from "./privacy/utils";
// import { CustomError, ErrorObject } from "./common/errorhandler";
// import { KeySet, addressAsObject } from "./common/keySet";
// import { RpcClient } from "./rpcclient/rpcclient";
// import { wasm } from "./wasm";
// import { isJsonString } from "./utils/json";
// import { Account } from "@lib/module/Account";
// import { isEmpty } from "lodash";
// import { PrivacyVersion } from "./core/constants";
// import Validator from '@lib/utils/validator';
// import { VALIDATOR } from '@lib/module/Account/account';

// const LIMIT_COINS = 100;

// class Transactor extends Account {
//   constructor(w, rpcUrl = null) {
//     super();
//     this.updateProgressTx = async (prog, msg = "") => {
//       if (w.updateProgressTx) {
//         await w.updateProgressTx(prog);
//         w.Debug = msg;
//       }
//     };
//     this.rpc = rpcUrl ? new RpcClient(rpcUrl) : w.RpcClient;
//     this.rpcCoinService = w.RpcCoinService;
//     this.useCoinsService = true;
//     this.isSubmitOtaKey = false;
//     this.offlineMode = false;
//     // function aliases
//     this.make = this._transact;
//     this.prv = this.createAndSendNativeToken;
//     this.token = this.createAndSendPrivacyToken;
//     this.newToken = this.createAndSendInitTokenTx;
//     this.stake = this.createAndSendStakingTx;
//     this.unstake = this.createAndSendStopAutoStakingTx;
//     this.withdraw = this.createAndSendWithdrawRewardTx;
//     this.convert = this.createAndSendConvertTx;
//     this.convertToken = this.createAndSendTokenConvertTx;
//     this.contribute = this.createAndSendTxWithContribution;
//     this.trade = this.createAndSendNativeTokenTradeRequestTx;
//     this.withdrawDex = this.createAndSendWithdrawDexTx;
//     this.burn = this.createAndSendBurningRequestTx;
//     this.shield = this.createAndSendIssuingEthRequestTx;
//     this.defrag = this.defragmentNativeCoin;
//     this.coin = this.getUnspentCoins;
//     this.balance = this.getBalance;
//     this.waitBalanceChange = this.waitUntilBalanceChange;
//     this.wasm = wasm;
//     this.version = w.PrivacyVersion;
//   }

//   async setKey(privateKey) {
//     // transactor needs private key to sign TXs. Read key in encoded or raw form
//     if (typeof privateKey == "string") {
//       this.key = KeyWallet.base58CheckDeserialize(privateKey);
//     } else if (privateKey.length && privateKey.length == 32) {
//       this.key = KeyWallet.deserialize(privateKey);
//     } else {
//       this.key = new KeyWallet();
//       return this.key;
//     }
//     let result = await this.key.KeySet.importFromPrivateKey(
//       this.key.KeySet.PrivateKey
//     );
//     return result;
//   }

//   // fetchOutputCoins returns all output coins with tokenID
//   // for native token: tokenID is null
//   /**
//    *
//    * @param {string} tokenID
//    * @param {RpcClient} rpcClient
//    */
//   async fetchOutputCoins(tokenID, version = 2) {
//     let paymentAddrSerialize = this.key.base58CheckSerialize(
//       PaymentAddressType
//     );
//     let readOnlyKeySerialize = "";
//     let otaKeySerialize = this.key.base58CheckSerialize(OTAKeyType);
//     let privKeySerialize = this.key.base58CheckSerialize(PriKeyType);
//     const handler = async (response, _privateKey, _version, _prevH, result) => {
//       // when key was submitted, only send 1 rpc request
//       let coins = response.outCoins;
//       for (let i = 0; i < coins.length; i++) {
//         // match the desired version. Version -1 means any
//         if (_version == -1 || coins[i].Version == _version) {
//           let params = {
//             Coin: coins[i],
//             KeySet: _privateKey,
//           };
//           try {
//             let coinStr = await wasm.decryptCoin(JSON.stringify(params));
//             let coin = JSON.parse(coinStr);
//             // console.log("decrypt coin", coin);
//             // console.log("from", params.Coin);
//             if (coins[i].Version == 2 || _prevH == 0) result.push(coin);
//           } catch (e) {
//             console.error(e);
//             console.log("skip coin", params.Coin.PublicKey);
//           }
//         }
//       }
//       return response.next;
//     };

//     const req = async (paymentAddr, roKey, otaKey, tid, toHeight = 0) => {
//       try {
//         let res = await this.rpc.getOutputCoin(
//           paymentAddr,
//           roKey,
//           otaKey,
//           tid,
//           toHeight,
//           this.isSubmitOtaKey
//         );
//         return res;
//       } catch (e) {
//         throw new CustomError(
//           ErrorObject.GetOutputCoinsErr,
//           e.message || "Can not get output coins when get unspent token"
//         );
//       }
//     };

//     let result = [];
//     let h = 0;
//     // this client config searches up to 9yrs
//     for (let i = 0; i < 3000; i++) {
//       try {
//         let response = await req(
//           paymentAddrSerialize,
//           readOnlyKeySerialize,
//           otaKeySerialize,
//           tokenID,
//           h
//         );
//         const nextHeight = await handler(
//           response,
//           privKeySerialize,
//           version,
//           h,
//           result
//         );
//         if (h == nextHeight || nextHeight == 0) break;
//         h = nextHeight;
//       } catch (e) {
//         console.error(e);
//         return [];
//       }
//     }
//     return result;
//   }

//   async waitUntilBalanceChange(tokenID) {
//     console.debug(
//       this.key.base58CheckSerialize(PaymentAddressType),
//       " => wait for balance change with token",
//       tokenID
//     );
//     let maxWaitTime = this.timeout;
//     const startBalance = new bn(await this.getBalance(tokenID));
//     let balance = startBalance;
//     while (balance.eq(startBalance)) {
//       try {
//         maxWaitTime = await this.sleepCapped(1000, maxWaitTime);
//         balance = new bn(await this.getBalance(tokenID));
//         // console.debug('balance is', balance);
//       } catch (e) {
//         throw new CustomError(ErrorObject.GetTxByHashErr, e.message);
//       }
//     }
//     return {
//       oldBalance: startBalance.toString(),
//       balance: balance.toString(),
//     };
//   }

//   // getAllPrivacyTokenBalance returns list of privacy token's balance
//   /**
//    *
//    * @returns [{TokenID: string, Balance: number}]
//    */
//   async getAllPrivacyTokenBalance() {
//     try {
//       // get list privacy token
//       let privacyTokens = await this.rpc.listTokens();
//       let pTokenList = privacyTokens.listPrivacyToken;

//       // get balance for each privacy token
//       let tasks = [];
//       for (let i = 0; i < pTokenList.length; i++) {
//         let tokenID = pTokenList[i].ID;

//         const tokenBalanceItemPromise = new Promise((resolve) => {
//           this.getBalance(tokenID, -1)
//             .then((balance) => {
//               resolve({
//                 TokenID: tokenID,
//                 Balance: balance,
//               });
//             })
//             .catch(() => null);
//         });
//         tasks.push(tokenBalanceItemPromise);
//       }

//       const allResult = await Promise.all(tasks);
//       const hasBalanceResult =
//         allResult && allResult.filter((r) => r && r.Balance > 0);

//       return hasBalanceResult;
//     } catch (e) {
//       throw e;
//     }
//   }

//   /**
//    *
//    * @param {{paymentAddressStr: string (B58checkencode), amount: number, message: "" }} prvPayments
//    * @param {number} fee
//    * @param {bool} isPrivacy
//    * @param {string} info
//    */
//   async createAndSendNativeToken({
//     transfer: { prvPayments = [], fee, info = "" },
//     extra: { metadata = null, isEncryptMessage = false } = {},
//   } = {}) {
//     //(prvPayments, fee, info = "", isEncryptMessage = false, metadata = null) {
//     // check fee
//     if (fee < 0) {
//       fee = 0;
//     }
//     let messageForNativeToken = "";
//     if (prvPayments.length > 0) {
//       messageForNativeToken = prvPayments[0].Message;
//     }
//     await this.updateProgressTx(10, "Encrypting Message");
//     const isEncodeOnly = !isEncryptMessage;
//     prvPayments = await encryptMessageOutCoin(prvPayments, isEncodeOnly);
//     try {
//       let result = await this._transact({
//         transfer: { prvPayments, fee, info },
//         extra: { metadata },
//       });
//       this.saveTxHistory(result, false, "", messageForNativeToken);
//       await this.updateProgressTx(100, "Completed");
//       return result;
//     } catch (e) {
//       throw e;
//     }
//   }

//   async _transact({
//     transfer: {
//       prvPayments = [],
//       fee = 10,
//       info = "",
//       tokenID = null,
//       tokenPayments = null,
//       tokenParams = null,
//     } = {},
//     extra: { metadata = null } = {},
//   }) {
//     await this.updateProgressTx(20, "Preparing Your Payments");
//     info = base64Encode(stringToBytes(info));

//     let receiverPaymentAddrStr = new Array(prvPayments.length);
//     let totalAmountTransfer = new bn(0);
//     for (let i = 0; i < prvPayments.length; i++) {
//       receiverPaymentAddrStr[i] = prvPayments[i].paymentAddressStr;
//       totalAmountTransfer = totalAmountTransfer.add(
//         new bn(prvPayments[i].Amount)
//       );
//       prvPayments[i].Amount = new bn(prvPayments[i].Amount).toString();
//     }

//     await this.updateProgressTx(30, "Selecting Coins");
//     let inputForTx;
//     try {
//       inputForTx = await prepareInputForTxV2(
//         totalAmountTransfer,
//         fee,
//         null,
//         this
//       );
//     } catch (e) {
//       console.error(e);
//       throw new CustomError(
//         ErrorObject.InitNormalTxErr,
//         "Error while preparing inputs",
//         e
//       );
//     }

//     if (inputForTx.inputCoinStrs.length > MAX_INPUT_PER_TX) {
//       throw new CustomError(ErrorObject.TxSizeExceedErr);
//     }
//     await this.updateProgressTx(40, "Packing Parameters");

//     let txParams = newParamTxV2(
//       this.key,
//       prvPayments,
//       inputForTx.inputCoinStrs,
//       fee,
//       null,
//       metadata,
//       info,
//       inputForTx.coinsForRing
//     );
//     // handle token transfer
//     let tokenReceiverPaymentAddrStr = [];
//     let totalAmountTokenTransfer = new bn(0);
//     let inputForToken = {
//       inputCoinStrs: [],
//       coinsForRing: {},
//     };

//     await this.updateProgressTx(50, "Adding Token Info");
//     // tokenID is non-null when transferring token; tokenParams is non-null when creating new token
//     if (tokenPayments) {
//       let isInit = Boolean(tokenParams);
//       let isTransfer = Boolean(tokenID);
//       if (!(isInit || isTransfer)) {
//         throw new CustomError(
//           ErrorObject.InitNormalTxErr,
//           "Invalid Token parameters"
//         );
//       }
//       tokenReceiverPaymentAddrStr = new Array(tokenPayments.length);
//       for (let i = 0; i < tokenPayments.length; i++) {
//         receiverPaymentAddrStr[i] = tokenPayments[i].paymentAddressStr;
//         totalAmountTokenTransfer = totalAmountTokenTransfer.add(
//           new bn(tokenPayments[i].Amount)
//         );
//         tokenPayments[i].Amount = new bn(tokenPayments[i].Amount).toString();
//       }
//       await this.updateProgressTx(60, "Selecting Token Coins");
//       if (isTransfer) {
//         try {
//           inputForToken = await prepareInputForTxV2(
//             totalAmountTokenTransfer,
//             0,
//             tokenID,
//             this
//           );
//         } catch (e) {
//           console.error(e);
//           throw new CustomError(
//             ErrorObject.InitNormalTxErr,
//             `Error while preparing inputs ${e}`
//           );
//         }
//       }
//       await this.updateProgressTx(70, "Decorating Parameters");
//       tokenParams = newTokenParamV2(
//         tokenPayments,
//         inputForToken.inputCoinStrs,
//         tokenID,
//         inputForToken.coinsForRing,
//         tokenParams || {}
//       );
//       txParams.TokenParams = tokenParams;
//     }

//     let txParamsJson = JSON.stringify(txParams);
//     await this.updateProgressTx(80, "Signing Transaction");
//     let theirTime = await this.rpc.getNodeTime();
//     let wasmResult = await wasm.createTransaction(txParamsJson, theirTime);
//     let { b58EncodedTx, hash, outputs } = JSON.parse(wasmResult);
//     // console.log(`Encoded TX : ${b58EncodedTx}, Hash : ${hash}`);
//     if (b58EncodedTx === null || b58EncodedTx === "") {
//       throw new CustomError(
//         ErrorObject.InitNormalTxErr,
//         "Can not init transaction tranfering PRV"
//       );
//     }
//     let tempBuf = checkDecode(b58EncodedTx).bytesDecoded;
//     let theString = new TextDecoder("utf-8").decode(tempBuf);
//     let txObj = JSON.parse(theString);
//     txObj.Encoded = b58EncodedTx;
//     // console.log("TX: ", txObj);
//     // console.log("Encoded: ", b58EncodedTx)

//     await this.updateProgressTx(90, "Submitting Transaction");
//     let response;
//     try {
//       response = await this.send(b58EncodedTx, Boolean(tokenPayments));
//     } catch (e) {
//       console.error(e);
//       throw new CustomError(
//         ErrorObject.SendTxErr,
//         "Can not send PRV transaction",
//         e
//       );
//     }

//     if (response.TokenID && response.TokenID.length > 0) {
//       tokenID = response.TokenID;
//     }
//     await this.updateProgressTx(95, "Saving Records");
//     return {
//       Response: response,
//       Tx: txObj,
//       Hash: hash,
//       Outputs: outputs,
//       Amount: totalAmountTransfer.toString(),
//       Inputs: inputForTx.inputCoinStrs,
//       Receivers: receiverPaymentAddrStr,
//       TokenID: tokenID,
//       TokenAmount: totalAmountTokenTransfer.toString(),
//       TokenInputs: inputForToken.inputCoinStrs,
//       TokenReceivers: tokenReceiverPaymentAddrStr,
//       IsPrivacy: true,
//       Metadata: metadata,
//     };
//   }

//   // async createAndSendTokenConvertTx({
//   //   transfer: {
//   //     prvPayments = [],
//   //     fee,
//   //     info = "",
//   //     tokenID = null,
//   //     tokenPayments = [],
//   //   },
//   //   extra: { isEncryptMessage = false, isEncryptMessageToken = false } = {},
//   // }) {
//   //   // (tokenID, prvPayments, tokenPayments, fee, info = "", isEncryptMessage = false, isEncryptMessageToken = false) {
//   //   // check fee
//   //   if (fee < 0) {
//   //     fee = 0;
//   //   }
//   //   let messageForNativeToken = "";
//   //   if (prvPayments.length > 0) {
//   //     messageForNativeToken = prvPayments[0].Message;
//   //   }
//   //   await this.updateProgressTx(10, "Encrypting Message");
//   //   let isEncodeOnly = !isEncryptMessage;
//   //   prvPayments = await encryptMessageOutCoin(prvPayments, isEncodeOnly);
//   //   isEncodeOnly = !isEncryptMessageToken;
//   //   tokenPayments = await encryptMessageOutCoin(tokenPayments, isEncodeOnly);
//   //
//   //   try {
//   //     let result = await this._transactConvert({
//   //       transfer: { prvPayments, fee, info, tokenID, tokenPayments },
//   //     });
//   //     // prvPayments, fee, info, tokenID, tokenPayments);
//   //     this.saveTxHistory(result, false, "", messageForNativeToken);
//   //     await this.updateProgressTx(100, "Completed");
//   //     return result;
//   //   } catch (e) {
//   //     throw e;
//   //   }
//   // }

//   // async createAndSendConvertTx({
//   //   transfer: { prvPayments = [], fee = 10, info = "" } = {},
//   //   extra: { isEncryptMessage = false } = {},
//   // } = {}) {
//   //   //(prvPayments, fee, info = "", isEncryptMessage = false) {
//   //   // check fee
//   //   if (fee < 0) {
//   //     fee = 0;
//   //   }
//   //   let messageForNativeToken = "";
//   //   if (prvPayments.length > 0) {
//   //     messageForNativeToken = prvPayments[0].Message;
//   //   }
//   //   await this.updateProgressTx(10, "Encrypting Message");
//   //   const isEncodeOnly = !isEncryptMessage;
//   //   prvPayments = await encryptMessageOutCoin(prvPayments, isEncodeOnly);
//   //
//   //   try {
//   //     let result = await this._transactConvert({
//   //       transfer: { prvPayments, fee, info },
//   //     });
//   //     // prvPayments, fee, info);
//   //     this.saveTxHistory(result, false, "", messageForNativeToken);
//   //     await this.updateProgressTx(100, "Completed");
//   //     return result;
//   //   } catch (e) {
//   //     throw e;
//   //   }
//   // }

//   // async _transactConvert({
//   //   transfer: {
//   //     prvPayments = [],
//   //     fee,
//   //     info = "",
//   //     tokenID = null,
//   //     tokenPayments,
//   //   } = {},
//   //   extra: { numOfDefragInputs = 0 } = {},
//   // }) {
//   //   // (prvPayments, fee, info, tokenID = null, tokenPayments = null, numOfDefragInputs = 0) {
//   //   await this.updateProgressTx(20, "Preparing Your Payments");
//   //   info = base64Encode(stringToBytes(info));
//   //
//   //   let metadata = null;
//   //   let receiverPaymentAddrStr = new Array(prvPayments.length);
//   //   let totalAmountTransfer = new bn(0);
//   //   for (let i = 0; i < prvPayments.length; i++) {
//   //     receiverPaymentAddrStr[i] = prvPayments[i].paymentAddressStr;
//   //     totalAmountTransfer = totalAmountTransfer.add(
//   //       new bn(prvPayments[i].Amount)
//   //     );
//   //     prvPayments[i].Amount = new bn(prvPayments[i].Amount).toString();
//   //   }
//   //   let isTokenConvert = tokenID && tokenPayments;
//   //   let isDefrag = numOfDefragInputs > 0;
//   //   if (isDefrag && isTokenConvert) {
//   //     throw new CustomError(
//   //       ErrorObject.SendTxErr,
//   //       "Error: token defragment is not supported"
//   //     );
//   //   }
//   //   await this.updateProgressTx(35, "Selecting Coins");
//   //   let inputForTx;
//   //   try {
//   //     if (isTokenConvert) {
//   //       // converting token. We need v2 PRV coins
//   //       inputForTx = await prepareInputForTxV2(
//   //         totalAmountTransfer,
//   //         fee,
//   //         null,
//   //         this
//   //       );
//   //     } else {
//   //       // 0 means convert, otherwise we defrag
//   //       if (isDefrag) {
//   //         inputForTx = await prepareInputForTxV2(
//   //           -1,
//   //           fee,
//   //           null,
//   //           this,
//   //           2,
//   //           20,
//   //           numOfDefragInputs
//   //         );
//   //       } else {
//   //         inputForTx = await prepareInputForTxV2(-1, fee, null, this, 1, 0);
//   //       }
//   //     }
//   //   } catch (e) {
//   //     throw new CustomError(ErrorObject.SendTxErr, "Can not prepare inputs", e);
//   //   }
//   //   if (inputForTx.inputCoinStrs.length > MAX_INPUT_PER_TX) {
//   //     throw new CustomError(ErrorObject.TxSizeExceedErr);
//   //   }
//   //
//   //   await this.updateProgressTx(50, "Packing Parameters");
//   //   let txParams = newParamTxV2(
//   //     this.key,
//   //     prvPayments,
//   //     inputForTx.inputCoinStrs,
//   //     fee,
//   //     null,
//   //     null,
//   //     info,
//   //     inputForTx.coinsForRing
//   //   );
//   //   // handle token transfer
//   //   let tokenReceiverPaymentAddrStr = [];
//   //   let totalAmountTokenTransfer = new bn(0);
//   //   let inputForToken = {};
//   //   if (isTokenConvert) {
//   //     tokenReceiverPaymentAddrStr = new Array(tokenPayments.length);
//   //     for (let i = 0; i < tokenPayments.length; i++) {
//   //       receiverPaymentAddrStr[i] = tokenPayments[i].paymentAddressStr;
//   //       totalAmountTokenTransfer = totalAmountTokenTransfer.add(
//   //         new bn(tokenPayments[i].Amount)
//   //       );
//   //       tokenPayments[i].Amount = new bn(tokenPayments[i].Amount).toString();
//   //     }
//   //     inputForToken = await prepareInputForTxV2(-1, 0, tokenID, this, 1, 0);
//   //     let tokenParams = newTokenParamV2(
//   //       tokenPayments,
//   //       inputForToken.inputCoinStrs,
//   //       tokenID,
//   //       inputForToken.coinsForRing
//   //     );
//   //     txParams.TokenParams = tokenParams;
//   //   }
//   //   let txParamsJson = JSON.stringify(txParams);
//   //   let wasmResult;
//   //   await this.updateProgressTx(80, "Signing Transaction");
//   //   let theirTime = await this.rpc.getNodeTime();
//   //   if (isDefrag) {
//   //     wasmResult = await wasm.createTransaction(txParamsJson, theirTime);
//   //   } else {
//   //     wasmResult = await wasm.createConvertTx(txParamsJson, theirTime);
//   //   }
//   //   let { b58EncodedTx, hash } = JSON.parse(wasmResult);
//   //   if (b58EncodedTx === null || b58EncodedTx === "") {
//   //     throw new CustomError(
//   //       ErrorObject.InitNormalTxErr,
//   //       "Can not init transaction tranfering PRV"
//   //     );
//   //   }
//   //   let tempBuf = checkDecode(b58EncodedTx).bytesDecoded;
//   //   let theString = new TextDecoder("utf-8").decode(tempBuf);
//   //   let txObj = JSON.parse(theString);
//   //   txObj.Encoded = b58EncodedTx;
//   //
//   //   await this.updateProgressTx(90, "Submitting Transaction");
//   //   let response;
//   //   try {
//   //     response = await this.send(b58EncodedTx, tokenID && tokenPayments);
//   //   } catch (e) {
//   //     throw new CustomError(
//   //       ErrorObject.SendTxErr,
//   //       "Can not send PRV transaction",
//   //       e
//   //     );
//   //   }
//   //   await this.updateProgressTx(95, "Saving Records");
//   //   return {
//   //     Response: response,
//   //     Tx: txObj,
//   //     Hash: hash,
//   //     Amount: totalAmountTransfer.toNumber(),
//   //     Inputs: inputForTx.inputCoinStrs,
//   //     Receivers: receiverPaymentAddrStr,
//   //     TokenAmount: totalAmountTokenTransfer.toNumber(),
//   //     TokenInputs: inputForToken.inputCoinStrs,
//   //     TokenReceivers: tokenReceiverPaymentAddrStr,
//   //     IsPrivacy: true,
//   //     Metadata: metadata,
//   //   };
//   // }

//   async _transactConvert({ transfer: {
//     fee,
//     info = "",
//     tokenID = null,
//     prvPayments = [],
//     tokenPayments,
//   } = {}, extra: {
//     numOfDefragInputs = 0
//   } = {}}) {
//     await this.updateProgressTx(20, 'Preparing Your Payments');

//     info = base64Encode(stringToBytes(info));
//     const metadata = null;
//     const receiverPaymentAddrStr = new Array(prvPayments.length);
//     let totalAmountTransfer = new bn(0);

//     for (let i = 0; i < prvPayments.length; i++) {
//       receiverPaymentAddrStr[i] = prvPayments[i].paymentAddressStr;
//       totalAmountTransfer = totalAmountTransfer.add(new bn(prvPayments[i].Amount));
//       prvPayments[i].Amount = new bn(prvPayments[i].Amount).toString();
//     }

//     let isTokenConvert = (tokenID && tokenPayments);
//     let isDefrag = numOfDefragInputs > 0;

//     if (isDefrag && isTokenConvert){
//       throw new CustomError(ErrorObject.SendTxErr, "Error: token defragment is not supported");
//     }
//     await this.updateProgressTx(35, 'Selecting Coins');

//     /** Prepare Input For Tx */
//     let inputForTx;
//     try{
//       if (isTokenConvert){
//         // converting token. We need v2 PRV coins
//         // inputForTx = await prepareInputForTxV2(totalAmountTransfer, fee, null, this);
//       }else{
//         // 0 means convert, otherwise we defrag
//         if (isDefrag){
//           // inputForTx = await prepareInputForTxV2(-1, fee, null, this, 2, 20, numOfDefragInputs);
//         }else{
//           inputForTx = await prepareInputForTxV2(-1, fee, null, this, 1, 0);
//         }
//       }
//     }catch(e){
//       throw new CustomError(ErrorObject.SendTxErr, "Can not prepare inputs", e);
//     }

//   }

//   async createAndSendConvertTx({
//     transfer: { prvPayments = [], fee = 10, info = '' } = {},
//     extra: { isEncryptMessage = false } = {},
//   } = {}) {
//     let messageForNativeToken = "";
//     if (prvPayments.length > 0) {
//       messageForNativeToken = prvPayments[0].Message;
//     }
//     await this.updateProgressTx(10, "Encrypting Message");
//     const isEncodeOnly = !isEncryptMessage;
//     prvPayments = await encryptMessageOutCoin(prvPayments, isEncodeOnly);

//     try {
//       let result = await this._transactConvert({
//         transfer: { prvPayments, fee, info },
//       });
//       // // prvPayments, fee, info);
//       // this.saveTxHistory(result, false, "", messageForNativeToken);
//       // await this.updateProgressTx(100, "Completed");
//       // return result;
//     } catch (e) {
//       throw e;
//     }

//     try {

//     } catch (e) {
//       throw e;
//     }
//   }

//   // staking tx always send PRV to burning address with no privacy
//   // type: 0 for shard
//   // type: 1 for beacon
//   /**
//    *
//    * @param {{type: number}} param
//    * @param {number} fee
//    * @param {string} candidatePaymentAddress
//    * @param {string} candidateMiningSeedKey
//    * @param {string} rewardReceiverPaymentAddress
//    * @param {bool} autoReStaking
//    */
//   async createAndSendStakingTx({
//     transfer: { fee },
//     extra: {
//       candidatePaymentAddress,
//       candidateMiningSeedKey,
//       rewardReceiverPaymentAddress,
//       autoReStaking = true,
//       stakingType = ShardStakingType,
//     } = {},
//   }) {
//     // (param, fee, candidatePaymentAddress, candidateMiningSeedKey, rewardReceiverPaymentAddress, autoReStaking = true) {
//     await this.updateProgressTx(10, "Generating Metadata");
//     // check fee
//     if (fee < 0) {
//       fee = 0;
//     }
//     // get amount staking
//     let amountBN = new bn("1750000000000", 10);
//     let feeBN = new bn(fee);

//     // generate committee key
//     let candidateKeyWallet = KeyWallet.base58CheckDeserialize(
//       candidatePaymentAddress
//     );
//     let publicKeyBytes = candidateKeyWallet.KeySet.PaymentAddress.Pk;
//     let candidateHashPrivateKeyBytes = checkDecode(candidateMiningSeedKey)
//       .bytesDecoded;
//     let committeeKey;
//     try {
//       committeeKey = await generateCommitteeKeyFromHashPrivateKey(
//         candidateHashPrivateKeyBytes,
//         publicKeyBytes
//       );
//     } catch (e) {
//       throw e;
//     }
//     let paymentAddressStr = this.key.base58CheckSerialize(PaymentAddressType);
//     let type =
//       stakingType === ShardStakingType ? MetaStakingShard : MetaStakingBeacon;
//     let meta = {
//       Type: type,
//       FunderPaymentAddress: paymentAddressStr,
//       RewardReceiverPaymentAddress: rewardReceiverPaymentAddress,
//       StakingAmountShard: amountBN.toNumber(),
//       CommitteePublicKey: committeeKey,
//       AutoReStaking: autoReStaking,
//     };
//     let burningAddress = await getBurningAddress(this.rpc);
//     let prvPayments = [
//       {
//         PaymentAddress: burningAddress,
//         Amount: amountBN.toString(),
//         Message: "",
//       },
//     ];

//     let messageForNativeToken = prvPayments[0].Message;
//     try {
//       let result = await this._transact({
//         transfer: { prvPayments, fee },
//         extra: { metadata: meta },
//       });
//       // prvPayments, fee, meta, "");
//       this.saveTxHistory(result, false, "", messageForNativeToken);
//       await this.updateProgressTx(100, "Completed");
//       return result;
//     } catch (e) {
//       throw e;
//     }
//   }

//   // staking tx always send PRV to burning address with no privacy
//   // type: 0 for shard
//   // type: 1 for beacon
//   /**
//    *
//    * @param {{type: number}} param
//    * @param {number} fee
//    * @param {string} candidatePaymentAddress
//    * @param {string} candidateMiningSeedKey
//    * @param {string} rewardReceiverPaymentAddress
//    * @param {bool} autoReStaking
//    */
//   async createAndSendStopAutoStakingTx({
//     transfer: { fee },
//     extra: { candidatePaymentAddress, candidateMiningSeedKey } = {},
//   }) {
//     // (fee, candidatePaymentAddress, candidateMiningSeedKey) {
//     // check fee
//     if (fee < 0) {
//       fee = 0;
//     }
//     let amountBN = new bn(0);
//     let feeBN = new bn(fee);
//     await this.updateProgressTx(10, "Generating Metadata");

//     // generate committee key
//     let candidateKeyWallet = KeyWallet.base58CheckDeserialize(
//       candidatePaymentAddress
//     );
//     let publicKeyBytes = candidateKeyWallet.KeySet.PaymentAddress.Pk;

//     let candidateHashPrivateKeyBytes = checkDecode(candidateMiningSeedKey)
//       .bytesDecoded;

//     const committeeKey = await generateCommitteeKeyFromHashPrivateKey(
//       candidateHashPrivateKeyBytes,
//       publicKeyBytes
//     );

//     let meta = {
//       Type: StopAutoStakingMeta,
//       CommitteePublicKey: committeeKey,
//     };

//     let burningAddress = await getBurningAddress(this.rpc);
//     let prvPayments = [
//       {
//         PaymentAddress: burningAddress,
//         Amount: "0",
//         Message: "",
//       },
//     ];
//     let messageForNativeToken = prvPayments[0].Message;

//     try {
//       let result = await this._transact({
//         transfer: { prvPayments, fee },
//         extra: { metadata: meta },
//       });
//       // prvPayments, fee, meta, "");
//       this.saveTxHistory(result, false, "", messageForNativeToken);
//       await this.updateProgressTx(100, "Completed");
//       return result;
//     } catch (e) {
//       throw e;
//     }
//   }

//   /**
//    *
//    * @param {{paymentAddressStr: string, amount: number, message: string}} prvPaymentsForNativeToken
//    * @param {{Privacy: bool, TokenID: string, TokenName: string, TokenSymbol: string, TokenTxType: bool, TokenAmount: number, TokenReceivers : [{PaymentAddress: string, Amount: number, Message: string}]}} submitParam
//    * @param {number} fee
//    * @param {number} feePToken
//    * @param {bool} hasPrivacyForNativeToken
//    * @param {bool} hasPrivacyForPToken
//    * @param {string} info
//    */
//   async createAndSendPrivacyToken({
//     transfer: {
//       prvPayments = [],
//       fee,
//       info = "",
//       tokenID,
//       tokenPayments = [],
//       tokenParams = {},
//     },
//     extra: {
//       metadata = null,
//       isEncryptMessage = false,
//       isEncryptMessageToken = false,
//     } = {},
//   }) {
//     if (fee < 0) {
//       fee = 0;
//     }
//     await this.updateProgressTx(10, "Encrypting Message");
//     let messageForNativeToken = "";
//     if (prvPayments.length > 0) {
//       messageForNativeToken = prvPayments[0].Message;
//     }
//     let messageForPToken = tokenPayments[0].Message;
//     let isEncodeOnly = !isEncryptMessage;
//     prvPayments = await encryptMessageOutCoin(prvPayments, isEncodeOnly);
//     isEncodeOnly = !isEncryptMessageToken;
//     tokenPayments = await encryptMessageOutCoin(tokenPayments, isEncodeOnly);
//     try {
//       let result = await this._transact({
//         transfer: {
//           prvPayments,
//           fee,
//           info,
//           tokenID,
//           tokenPayments,
//           tokenParams,
//         },
//         extra: { metadata },
//       });
//       // prvPayments, fee, metadata, info, tokenID, tokenPayments, tokenParams);
//       this.saveTxHistory(result, false, "", messageForNativeToken);
//       await this.updateProgressTx(100, "Completed");
//       return result;
//     } catch (e) {
//       throw e;
//     }
//   }

//   async createAndSendInitTokenTx({
//     transfer: { fee, info = "", tokenPayments },
//     extra: { tokenName = "", tokenSymbol = "" } = {},
//   }) {
//     // (tokenPayments, fee, tokenName = "", tokenSymbol = "", info = "") {
//     // only the 1st payment info is relevant
//     if (tokenPayments.length) tokenPayments = tokenPayments[0];
//     const prvPaymentInfos = [];
//     if (fee < 0) {
//       fee = 0;
//     }
//     await this.updateProgressTx(10, "Generating Metadata");
//     let messageForNativeToken = null;
//     let newCoin;
//     try {
//       // since we only use the PublicKey and TxRandom fields, the tokenID is irrelevant
//       let temp = await wasm.createCoin(
//         JSON.stringify({ PaymentInfo: tokenPayments, TokenID: null })
//       );
//       newCoin = JSON.parse(temp);
//     } catch (e) {
//       throw e;
//     }
//     // prepare meta data for tx. It is normal trade request at first
//     let metadata = {
//       Type: InitTokenRequestMeta,
//       Amount: new bn(tokenPayments.Amount).toString(),
//       OTAStr: newCoin.PublicKey,
//       TxRandomStr: newCoin.TxRandom,
//       TokenName: tokenName,
//       TokenSymbol: tokenSymbol,
//     };

//     try {
//       let result = await this._transact({
//         transfer: { prvPaymentInfos, fee, info },
//         extra: { metadata },
//       });
//       // prvPaymentInfos, fee, metadata, info);
//       // re-compute token ID
//       console.log("TX Hash is", result.Hash);
//       const shardID = getShardIDFromLastByte(
//         this.key.KeySet.PaymentAddress.Pk[
//           this.key.KeySet.PaymentAddress.Pk.length - 1
//         ]
//       );
//       console.log("Shard ID is", shardID);
//       // concatenate, then hash the raw bytes
//       const content = stringToBytes(result.Hash + shardID);
//       console.log("Data to hash :", content);
//       // swap the endian to match Go code
//       let hashed = hashSha3BytesToBytes(content);
//       hashed.reverse();
//       result.TokenID = toHexString(hashed);
//       this.saveTxHistory(result, false, "", messageForNativeToken);
//       await this.updateProgressTx(100, "Completed");
//       return result;
//     } catch (e) {
//       throw e;
//     }
//   }

//   // recursively sweep up everything into one UTXO
//   async defragmentNativeCoin({
//     transfer: { fee } = {},
//     extra: { noOfInputPerTx = MaxInputNumberForDefragment } = {},
//   }) {
//     const info = "defragment";

//     // loop up to 30 times
//     const MAX_ITERATIONS = 100;
//     for (let i = 0; i < MAX_ITERATIONS; i++) {
//       await this.updateProgressTx(i + 1, `Combining UTXOs - TX #${i}`);
//       try {
//         let inputForTx;
//         try {
//           inputForTx = await prepareInputForTxV2(
//             -1,
//             fee,
//             null,
//             this,
//             2,
//             0,
//             noOfInputPerTx
//           );
//         } catch (e) {
//           throw new CustomError(
//             ErrorObject.InitNormalTxErr,
//             "Error while preparing inputs",
//             e
//           );
//         }
//         if (inputForTx.inputCoinStrs.length == 1) {
//           break;
//         }
//         console.log(
//           "Now combining",
//           inputForTx.inputCoinStrs.length,
//           "coins in 1 send"
//         );
//         try {
//           let result = await this._transactConvert({
//             transfer: { fee, info, tokenID: null, tokenPayments: null },
//             extra: { noOfInputPerTx },
//           });
//           //[], fee, info, null, null, noOfInputPerTx);
//           console.log("Sent Defrag TX: ", result.Response.TxID);
//           const confs = 2;
//           console.log(`Waiting for ${confs} block confirmation`);
//           await this.waitTx(result.Response.TxID, confs);
//         } catch (e) {
//           throw e;
//         }
//       } catch (e) {
//         throw e;
//       }
//     }
//   }

//   // createAndSendBurningRequestTx create and send tx burning ptoken when withdraw
//   // remoteAddress (string) is an ETH/BTC address which users want to receive ETH/BTC (without 0x)
//   /**
//    *
//    * @param {...{paymentAddressStr: string, amount: number, message: string}} prvPaymentsForNativeToken
//    * @param {{Privacy: bool, TokenID: string, TokenName: string, TokenSymbol: string, TokenTxType: bool, TokenAmount: number, TokenReceivers : {PaymentAddress: string, Amount: number, Message: string}}} submitParam
//    * @param {number} fee
//    * @param {number} feePToken
//    * @param {string} remoteAddress
//    */
//   async createAndSendBurningRequestTx({
//     transfer: { prvPayments = [], fee, info = "", tokenID = null },
//     extra: {
//       burningType = BurningRequestMeta,
//       isEncryptMessage = false,
//       isEncryptMessageToken = false,
//       burnAmount,
//       remoteAddress,
//     } = {},
//   }) {
//     const burningTokenID = tokenID;

//     if (remoteAddress.startsWith("0x")) {
//       remoteAddress = remoteAddress.slice(2);
//     }
//     if (fee < 0) {
//       fee = 0;
//     }
//     await this.updateProgressTx(10, "Encrypting Message");
//     let burningAddress = await getBurningAddress(this.rpc);
//     let tokenPayments = [
//       {
//         PaymentAddress: burningAddress,
//         Amount: new bn(burnAmount).toString(),
//         Message: "",
//       },
//     ];
//     let messageForNativeToken = "";
//     if (prvPayments.length > 0) {
//       messageForNativeToken = prvPayments[0].Message;
//     }
//     let isEncodeOnly = !isEncryptMessage;
//     prvPayments = await encryptMessageOutCoin(prvPayments, isEncodeOnly);
//     isEncodeOnly = !isEncryptMessageToken;
//     tokenPayments = await encryptMessageOutCoin(tokenPayments, isEncodeOnly);
//     // use an empty payment address
//     let emptyKeySet = new KeySet();
//     await emptyKeySet.importFromPrivateKey(new Uint8Array(32));
//     let addrForMd = addressAsObject(emptyKeySet.PaymentAddress);
//     const paymentAddressStr = this.key.base58CheckSerialize(PaymentAddressType);
//     await this.updateProgressTx(15, "Generating Metadata");
//     // prepare meta data for tx
//     let burningReqMetadata = {
//       BurnerAddress: addrForMd,
//       BurningAmount: burnAmount,
//       TokenID: burningTokenID,
//       RemoteAddress: remoteAddress,
//       Type: burningType,
//     };
//     try {
//       let result = await this._transact({
//         transfer: {
//           prvPayments,
//           fee,
//           info,
//           tokenID: burningTokenID,
//           tokenPayments,
//         },
//         extra: { metadata: burningReqMetadata },
//       });
//       // prvPayments, fee, burningReqMetadata, info, burningTokenID, tokenPayments);
//       this.saveTxHistory(result, false, "", messageForNativeToken);
//       await this.updateProgressTx(100, "Completed");
//       return result;
//     } catch (e) {
//       throw e;
//     }
//   }

//   // createAndSendIssuingEthRequestTx makes an issuing request based on a Deposit event from ETH bridge
//   /**
//    *
//    * @param {...{paymentAddressStr: string, amount: number, message: string}} prvPaymentsForNativeToken
//    * @param {{Privacy: bool, TokenID: string, TokenName: string, TokenSymbol: string, TokenTxType: bool, TokenAmount: number, TokenReceivers : {PaymentAddress: string, Amount: number, Message: string}}} submitParam
//    * @param {number} fee
//    * @param {number} feePToken
//    * @param {string} remoteAddress
//    */
//   async createAndSendIssuingEthRequestTx({
//     transfer: { prvPayments = [], fee, info = "", tokenID = null },
//     extra: {
//       isEncryptMessage = false,
//       isEncryptMessageToken = false,
//       ethBlockHash,
//       ethDepositProof,
//       txIndex,
//     } = {},
//   }) {
//     // (prvPayments = [], fee, tokenID, ethBlockHash, ethDepositProof, txIndex, info = "", isEncryptMessage = false,     isEncryptMessageToken = false) {
//     if (!ethBlockHash.startsWith("0x")) {
//       ethBlockHash = "0x" + ethBlockHash;
//     }
//     if (fee < 0) {
//       fee = 0;
//     }
//     await this.updateProgressTx(10, "Encrypting Message");
//     let messageForNativeToken = "";
//     if (prvPayments.length > 0) {
//       messageForNativeToken = prvPayments[0].Message;
//     }
//     let isEncodeOnly = !isEncryptMessage;
//     prvPayments = await encryptMessageOutCoin(prvPayments, isEncodeOnly);
//     isEncodeOnly = !isEncryptMessageToken;
//     await this.updateProgressTx(15, "Generating Metadata");
//     // prepare meta data for tx
//     let metadata = {
//       BlockHash: ethBlockHash,
//       TxIndex: txIndex,
//       ProofStrs: ethDepositProof,
//       IncTokenID: tokenID,
//       Type: IssuingETHRequestMeta,
//     };
//     try {
//       let result = await this._transact({
//         transfer: { prvPayments, fee, info },
//         extra: { metadata },
//       });
//       // prvPayments, fee, metadata, info);
//       this.saveTxHistory(result, false, "", messageForNativeToken);
//       await this.updateProgressTx(100, "Completed");
//       return result;
//     } catch (e) {
//       throw e;
//     }
//   }

//   // getRewardAmount returns amount rewards
//   // if isGetAll is true: return all of reward types (such as PRV, pToken,..)
//   /**
//    *
//    * @param {string} paymentAddrStr
//    * @param {bool} isGetAll
//    * @param {string} tokenID
//    * @returns {number} (if isGetAll = false)
//    * @returns {map[TokenID] : number} (if isGetAll = true)
//    */
//   async getRewardAmount(paymentAddrStr, isGetAll = true, tokenID = "") {
//     let resp;
//     try {
//       resp = await this.rpc.getRewardAmount(paymentAddrStr);
//     } catch (e) {
//       throw new CustomError(
//         ErrorObject.GetRewardAmountErr,
//         "Can not get reward amount"
//       );
//     }

//     if (isGetAll) {
//       return resp.rewards;
//     } else {
//       if (tokenID === "") {
//         tokenID = "PRV";
//       }

//       return resp.rewards[tokenID];
//     }
//   }

//   // createAndSendWithdrawRewardTx create and send tx withdraw reward amount
//   /**
//    *
//    * @param {string} tokenID
//    */
//   async createAndSendWithdrawRewardTx({ transfer: { fee, tokenID = null } }) {
//     await this.updateProgressTx(10, "Generating Metadata");
//     if (!tokenID || tokenID === "") {
//       tokenID = convertHashToStr(PRVID);
//     }
//     let addrForMd = addressAsObject(this.key.KeySet.PaymentAddress);
//     let md = {
//       Type: WithDrawRewardRequestMeta,
//       PaymentAddress: addrForMd,
//       TokenID: tokenID,
//       Version: 1,
//     };

//     try {
//       let result = await this._transact({
//         transfer: { fee, info: "" },
//         extra: { metadata: md },
//       });
//       // [], fee, md, "");
//       this.saveTxHistory(result, false, "", "");
//       await this.updateProgressTx(100, "Completed");
//       return result;
//     } catch (e) {
//       throw e;
//     }
//   }

//   /*
//    * @param {number} fee
//    * @param {string} pairID
//    * @param {number} sellAmount
//    * @param {string} info
//    */
//   async createAndSendWithdrawDexTx({
//     transfer: { fee, info = "" },
//     extra: { tokenIDs = [], withdrawalShareAmt } = {},
//   }) {
//     // (fee, withdrawalToken1IDStr, withdrawalToken2IDStr, withdrawalShareAmt, info = "") {
//     let [withdrawalToken1IDStr, withdrawalToken2IDStr] = tokenIDs;
//     await this.updateProgressTx(10, "Generating Metadata");
//     if (!withdrawalToken1IDStr || withdrawalToken1IDStr === "") {
//       withdrawalToken1IDStr = convertHashToStr(PRVID);
//     }
//     if (!withdrawalToken2IDStr || withdrawalToken2IDStr === "") {
//       withdrawalToken2IDStr = convertHashToStr(PRVID);
//     }
//     // let addrForMd = addressAsObject(this.key.KeySet.PaymentAddress);
//     let md = {
//       WithdrawerAddressStr: this.key.base58CheckSerialize(PaymentAddressType),
//       WithdrawalToken1IDStr: withdrawalToken1IDStr,
//       WithdrawalToken2IDStr: withdrawalToken2IDStr,
//       WithdrawalShareAmt: new bn(withdrawalShareAmt).toString(),
//       Type: PDEWithdrawalRequestMeta,
//     };
//     try {
//       let result = await this._transact({
//         transfer: { fee, info: "" },
//         extra: { metadata: md },
//       });
//       // [], fee, md, "");
//       this.saveTxHistory(result, false, "", "");
//       await this.updateProgressTx(100, "Completed");
//       return result;
//     } catch (e) {
//       throw e;
//     }
//   }

//   /**
//    *
//    */
//   // stakerStatus return status of staker
//   // return object {{Role: int, ShardID: int}}
//   // Role: -1: is not staked, 0: candidate, 1: validator
//   // ShardID: beacon: -1, shardID: 0->MaxShardNumber
//   async stakerStatus() {
//     let blsPubKeyB58CheckEncode = await this.key.getBLSPublicKeyB58CheckEncode();
//     let reps;
//     try {
//       reps = await this.rpc.getPublicKeyRole("bls:" + blsPubKeyB58CheckEncode);
//     } catch (e) {
//       throw e;
//     }

//     return reps.status;
//   }

//   /********************** DEX **********************/
//   /**
//    *
//    * @param {number} fee
//    * @param {string} pairID
//    * @param {number} contributedAmount
//    * @param {string} info
//    */
//   async createAndSendTxWithContribution({
//     transfer: { fee, info = "", tokenID = null },
//     extra: { pairID, contributedAmount } = {},
//   }) {
//     // (fee, pairID, contributedAmount, info = "", tokenIDStr = null) {
//     if (fee < 0) {
//       fee = 0;
//     }
//     await this.updateProgressTx(10, "Generating Metadata");
//     let burningAddress = await getBurningAddress(this.rpc);
//     let burningPayments = [
//       {
//         PaymentAddress: burningAddress,
//         Amount: new bn(contributedAmount).toString(),
//         Message: "",
//       },
//     ];
//     let messageForNativeToken = burningPayments[0].Message;
//     let contributorAddressStr = this.key.base58CheckSerialize(
//       PaymentAddressType
//     );
//     let isToken = true;
//     let tokenIDStr = tokenID;
//     if (!tokenIDStr) {
//       isToken = false;
//       tokenIDStr = convertHashToStr(PRVID);
//     }
//     // prepare meta data for tx
//     let metadata = {
//       PDEContributionPairID: pairID,
//       ContributorAddressStr: contributorAddressStr,
//       ContributedAmount: contributedAmount,
//       TokenIDStr: tokenIDStr,
//       Type: PDEPRVRequiredContributionRequestMeta,
//     };

//     try {
//       let result;
//       if (isToken) {
//         result = await this._transact({
//           transfer: {
//             fee,
//             info,
//             tokenID: tokenIDStr,
//             tokenPayments: burningPayments,
//           },
//           extra: { metadata },
//         });
//         // [], fee, metadata, info, tokenIDStr, burningPayments);
//       } else {
//         result = await this._transact({
//           transfer: { prvPayments: burningPayments, fee, info },
//           extra: { metadata },
//         });
//         // burningPayments, fee, metadata, info);
//       }
//       this.saveTxHistory(result, false, "", messageForNativeToken);
//       await this.updateProgressTx(100, "Completed");
//       return result;
//     } catch (e) {
//       throw e;
//     }
//   }

//   /**
//    *
//    * @param {number} fee
//    * @param {string} pairID
//    * @param {number} sellAmount
//    * @param {number} minAcceptableAmount
//    * @param {number} tradingFee
//    * @param {string} info
//    */
//   async createAndSendNativeTokenTradeRequestTx({
//     transfer: { fee, info = "", tokenID = null },
//     extra: {
//       tokenIDToBuy = null,
//       sellAmount,
//       minAcceptableAmount,
//       tradingFee,
//       tokenIDToSell = null,
//     } = {},
//   }) {
//     // (fee, tokenIDToBuy, sellAmount, minAcceptableAmount, tradingFee, info = "", tokenIDToSell = null) {
//     if (fee < 0) {
//       fee = 0;
//     }
//     await this.updateProgressTx(10, "Generating Metadata");
//     let prv = convertHashToStr(PRVID);
//     let sellPRV = false;
//     if (!tokenIDToSell || tokenIDToSell == prv) {
//       sellPRV = true;
//       tokenIDToSell = prv;
//     }
//     let buyPRV = false;
//     if (!tokenIDToBuy || tokenIDToBuy == prv) {
//       buyPRV = true;
//       tokenIDToBuy = prv;
//     }

//     const burningAddress = await getBurningAddress(this.rpc);
//     let amount = tradingFee;
//     let tokenPaymentInfos = [];
//     if (sellPRV) {
//       amount += sellAmount;
//     } else {
//       tokenPaymentInfos = [
//         {
//           PaymentAddress: burningAddress,
//           Amount: sellAmount,
//           Message: "",
//         },
//       ];
//     }

//     const prvPaymentInfos = [
//       {
//         PaymentAddress: burningAddress,
//         Amount: amount,
//         Message: "",
//       },
//     ];
//     let messageForNativeToken = prvPaymentInfos[0].Message;
//     let myAddressStr = this.key.base58CheckSerialize(PaymentAddressType);
//     let pInf = {
//       PaymentAddress: myAddressStr,
//       Amount: "0",
//     };
//     let newCoin;
//     try {
//       // since we only use the PublicKey and TxRandom fields, the tokenID is irrelevant
//       let temp = await wasm.createCoin(
//         JSON.stringify({ PaymentInfo: pInf, TokenID: null })
//       );
//       newCoin = JSON.parse(temp);
//     } catch (e) {
//       throw e;
//     }
//     let newCoinForSub;
//     try {
//       let temp = await wasm.createCoin(
//         JSON.stringify({ PaymentInfo: pInf, TokenID: null })
//       );
//       newCoinForSub = JSON.parse(temp);
//     } catch (e) {
//       throw e;
//     }
//     // prepare meta data for tx. It is normal trade request at first
//     let metadata = {
//       TokenIDToBuyStr: tokenIDToBuy,
//       TokenIDToSellStr: tokenIDToSell,
//       SellAmount: sellAmount,
//       Type: PDECrossPoolTradeRequestMeta,
//       MinAcceptableAmount: minAcceptableAmount,
//       TradingFee: tradingFee,
//       TraderAddressStr: newCoin.PublicKey,
//       TxRandomStr: newCoin.TxRandom,
//       SubTraderAddressStr: newCoinForSub.PublicKey,
//       SubTxRandomStr: newCoinForSub.TxRandom,
//     };

//     try {
//       let result;
//       if (sellPRV) {
//         result = await this._transact({
//           transfer: { prvPayments: prvPaymentInfos, fee, info },
//           extra: { metadata },
//         });
//         // prvPaymentInfos, fee, metadata, info);
//       } else {
//         result = await this._transact({
//           transfer: {
//             prvPayments: prvPaymentInfos,
//             fee,
//             info,
//             tokenID: tokenIDToSell,
//             tokenPayments: tokenPaymentInfos,
//           },
//           extra: { metadata },
//         });
//         // prvPaymentInfos, fee, metadata, info, tokenIDToSell, tokenPaymentInfos);
//       }
//       this.saveTxHistory(result, false, "", messageForNativeToken);
//       await this.updateProgressTx(100, "Completed");
//       return result;
//     } catch (e) {
//       throw e;
//     }
//   }

//   async getReceivedTransaction() {
//     let rpcClient = this.rpc;
//     // call api to get info from node
//     const paymentAddress = this.key.base58CheckSerialize(PaymentAddressType);
//     const viewingKey = this.key.base58CheckSerialize(ReadonlyKeyType);

//     // cal rpc to get data
//     let txs = await this.rpc.getTransactionByReceiver(
//       paymentAddress,
//       viewingKey
//     );
//     txs = txs.receivedTransactions;
//     if (txs.length > 0) {
//       this.txReceivedHistory.NormalTx = [];
//       this.txReceivedHistory.PrivacyTokenTx = [];
//       this.txReceivedHistory.CustomTokenTx = [];
//     }
//     for (let i = 0; i < txs.length; i++) {
//       // loop and parse into history tx object
//       const tx = txs[i].TransactionDetail;

//       let messageForNativeToken = "";
//       let messageForPToken = "";
//       if (txs[i].ReceivedAmounts[PRVIDSTR]) {
//         try {
//           messageForNativeToken = await decryptMessageOutCoin(
//             this,
//             txs[i].TransactionDetail.ProofDetail.OutputCoins[0].Info
//           );
//         } catch (e) {
//           messageForNativeToken =
//             txs[i].TransactionDetail.ProofDetail.OutputCoins[0].Info;
//           console.log("Skipping message because", e); // skip
//         }
//       }
//       if (txs[i].ReceivedAmounts[tx.PrivacyCustomTokenID]) {
//         console.log(txs[i].TransactionDetail.PrivacyCustomTokenProofDetail);
//         try {
//           messageForPToken = await decryptMessageOutCoin(
//             this,
//             this,
//             txs[i].TransactionDetail.PrivacyCustomTokenProofDetail
//               .OutputCoins[0].Info
//           );
//         } catch (e) {
//           messageForPToken =
//             txs[i].TransactionDetail.PrivacyCustomTokenProofDetail
//               .OutputCoins[0].Info;
//           console.log("Skipping message because", e); // skip
//         }
//       }

//       let infoDecode = tx.Info;
//       if (infoDecode) {
//         infoDecode = checkDecode(tx.Info).bytesDecoded;
//         infoDecode = bytesToString(infoDecode);
//       }
//       // console.log("TX", tx);

//       try {
//         const historyObj = {
//           txID: tx.Hash,
//           amountNativeToken: txs[i].ReceivedAmounts[PRVIDSTR], // in nano PRV
//           amountPToken: txs[i].ReceivedAmounts[tx.PrivacyCustomTokenID],
//           feeNativeToken: tx.Fee, // in nano PRV
//           feePToken: tx.PrivacyCustomTokenFee,
//           typeTx: tx.Type,
//           receivers: null,
//           tokenName: tx.PrivacyCustomTokenName,
//           tokenID: tx.PrivacyCustomTokenID,
//           tokenSymbol: tx.PrivacyCustomTokenIDSymbol,
//           isIn: true,
//           time: new Date(tx.LockTime).getTime(), // in mili-second
//           status: null,
//           isPrivacyNativeToken: true,
//           isPrivacyForPToken: true,
//           listUTXOForPRV: [],
//           listUTXOForPToken: [],
//           hashOriginalTx: "",
//           metaData: tx.Metadata,
//           info: infoDecode,
//           messageForNativeToken: messageForNativeToken,
//           messageForPToken: messageForPToken,
//         };

//         let txHistoryInfo = new TxHistoryInfo();
//         txHistoryInfo.setHistoryInfo(historyObj);
//         switch (tx.Type) {
//           case TxNormalType: {
//             this.txReceivedHistory.NormalTx.push(txHistoryInfo);
//             break;
//           }
//           case TxCustomTokenPrivacyType: {
//             this.txReceivedHistory.PrivacyTokenTx.push(txHistoryInfo);
//             break;
//           }
//         }
//       } catch (e) {
//         throw e;
//       }
//     }
//     return this.txReceivedHistory;
//   }

//   sleep(ms) {
//     return new Promise((resolve) => setTimeout(resolve, ms));
//   }

//   sleepCapped(ms, maxSeconds) {
//     // console.debug("Wait up to", maxSeconds);
//     if (maxSeconds <= 0) {
//       throw new CustomError(ErrorObject.UnexpectedErr, "wait time depleted");
//     }
//     maxSeconds -= ms / 1000;
//     return this.sleep(ms).then((_) => maxSeconds);
//   }

//   async waitTx(txId, confirmations = 5) {
//     console.debug(txId, " => wait for", confirmations, "confirmations");
//     let maxWaitTime = this.timeout;
//     let blockHash = null;
//     let response;
//     while (!blockHash) {
//       try {
//         response = await this.rpc.getTransactionByHash(txId);
//         if (response.blockHash && response.blockHash.length == 64) {
//           blockHash = response.blockHash;
//         } else {
//           maxWaitTime = await this.sleepCapped(1000, maxWaitTime);
//         }
//       } catch (e) {
//         throw new CustomError(ErrorObject.GetTxByHashErr, e.message);
//       }
//     }

//     maxWaitTime = 200;
//     let currentConfs = 0;
//     while (currentConfs < confirmations) {
//       try {
//         response = await this.rpc.getBlockByHash(blockHash);
//         let c = response.Confirmations;
//         // console.debug(c, "confirmations");
//         if (c) {
//           currentConfs = c;
//         }
//         maxWaitTime = await this.sleepCapped(1000, maxWaitTime);
//       } catch (e) {
//         throw new CustomError(ErrorObject.GetTxByHashErr, e.message);
//       }
//     }
//     console.debug("Confirmed !");
//   }

//   async waitHeight(height = 10) {
//     console.debug("Waiting for beacon height to reach", height);
//     let maxWaitTime = this.timeout;
//     let done = false;
//     let response;
//     while (!done) {
//       try {
//         response = await this.rpc.getBeaconBestState();
//         if (response.bestState.BeaconHeight >= height) {
//           done = true;
//         } else {
//           maxWaitTime = await this.sleepCapped(1000, maxWaitTime);
//         }
//       } catch (e) {
//         throw new CustomError(ErrorObject.GetTxByHashErr, e.message);
//       }
//     }
//     console.debug("Completed !");
//   }

//   async submitKeyAndSync(tokenIDs = [PRVIDSTR]) {
//     const otaKey = this.key.base58CheckSerialize(OTAKeyType);
//     await this.rpc.submitKey(otaKey);
//     await Promise.all(tokenIDs.map((t) => this.fetchOutputCoins(t)));
//     this.isSubmitOtaKey = true;
//   }

//   getPrivateKey() {
//     return this.key.base58CheckSerialize(PriKeyType);
//   }
// }

// export { Transactor };
