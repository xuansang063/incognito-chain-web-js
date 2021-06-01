import Validator from '@lib/utils/validator';
import { encryptMessageOutCoin, PaymentAddressType, PRVIDSTR } from '@lib/core';
import { isEmpty, uniqBy, uniq } from 'lodash';
import { base64Encode, stringToBytes } from '@lib/privacy/utils';
import bn from 'bn.js';
import { CustomError, ErrorObject } from '@lib/common/errorhandler';
import {
  getUnspentCoinExceptSpendingCoinV1,
  newParamTxV2,
  newTokenParamV2,
  pagination,
  prepareInputForConvertTxV2,
  sleep,
} from '@lib/module/Account/account.utils';
import { wasm } from '@lib/wasm';
import { checkDecode } from '@lib/common/base58';
import { PrivacyVersion } from '@lib/core/constants';
import {
  AIRDROP_STATUS,
  LIMIT,
  MAX_COUNT_BALANCE,
  MAX_FEE_PER_TX, TIME_COUNT_BALANCE,
  TX_STATUS,
  TX_TYPE
} from '@lib/module/Account/account.constants';
import { SPENDING_COINS_STORAGE } from '@lib/module/Account/account';

async function transactConvert({
  transfer: {
    fee = 100,
    info = "",
    tokenID = PRVIDSTR,
    prvPayments = [],
    tokenPayments,
  } = {},
  extra: { numOfDefragInputs = 0, txType = TX_TYPE.CONVERT } = {},
}) {
  tokenID = tokenID || PRVIDSTR;
  new Validator("fee", fee).required().number();

  if (!isEmpty(info)) {
    info = base64Encode(stringToBytes(info)); /** encode base64 info */
  }

  const account = this;
  const isTokenConvert = tokenID !== PRVIDSTR;
  const isDefrag = numOfDefragInputs > 0;

  const metadata = null;
  const receiverPaymentAddrStr = new Array(prvPayments.length);
  let totalAmountTransfer = new bn(0);

  prvPayments.forEach((payment, index) => {
    receiverPaymentAddrStr[index] = payment.paymentAddressStr;
    totalAmountTransfer = totalAmountTransfer.add(new bn(payment.Amount));
    payment.Amount = new bn(prvPayments[i].Amount).toString();
  });

  if (isDefrag && isTokenConvert) {
    throw new CustomError(
      ErrorObject.SendTxErr,
      "Error: token defragment is not supported"
    );
  }

  /** prepare input for tx */
  let inputForTx;
  try {
    const paramConvert = {
      amountTransfer: -1,
      fee,
      tokenID,
      account,
    };
    if (isTokenConvert) {
      /** converting token. We need v2 PRV coins */
      inputForTx = await prepareInputForConvertTxV2(paramConvert);
    } else {
      /** 0 means convert, otherwise we defrag */
      if (isDefrag) {
        // inputForTx = await prepareInputForTxV2(-1, fee, null, this, 2, 20, numOfDefragInputs);
      } else {
        /** converting prv */
        inputForTx = await prepareInputForConvertTxV2(paramConvert);
      }
    }

    const inputCoins = isTokenConvert ? inputForTx?.inputCoinsForFee : inputForTx?.inputCoinsToSpent;
    let inputTokenCoins = [];
    if (isTokenConvert) {
      inputTokenCoins = inputForTx?.inputCoinsToSpent
    }

    if (inputCoins.length === 0) {
      throw new CustomError(
        ErrorObject.EmptyUTXO,
        "Error: Dont have UTXO PRV v1"
      );
    }

    let txParams = newParamTxV2(
      this.key,
      prvPayments,
      inputCoins,
      fee,
      null,
      null,
      info,
      inputForTx.coinsForRing
    );
    let tokenReceiverPaymentAddrStr = [];
    let totalAmountTokenTransfer = new bn(0);
    if (isTokenConvert) {
      tokenReceiverPaymentAddrStr = new Array(tokenPayments.length);
      for (let i = 0; i < tokenPayments.length; i++) {
        receiverPaymentAddrStr[i] = tokenPayments[i].paymentAddressStr;
        totalAmountTokenTransfer = totalAmountTokenTransfer.add(
          new bn(tokenPayments[i].Amount)
        );
        tokenPayments[i].Amount = new bn(tokenPayments[i].Amount).toString();
      }
      if (inputTokenCoins.length === 0) {
        throw new CustomError(
          ErrorObject.EmptyUTXO,
          "Error: Dont have UTXO pToken v1"
        );
      }
      txParams.TokenParams = newTokenParamV2(
        tokenPayments,
        inputTokenCoins,
        tokenID,
        null
      );
    }
    const theirTime = await this.rpc.getNodeTime();
    let txParamsJson = JSON.stringify(txParams);
    console.debug('txParams: ', txParams)
    let wasmResult;
    if (isDefrag) {
      wasmResult = await wasm.createTransaction(txParamsJson, theirTime);
    } else {
      wasmResult = await wasm.createConvertTx(txParamsJson, theirTime);
    }
    /** create raw tx success */
    let { b58EncodedTx, hash, outputs } = JSON.parse(wasmResult);

    if (b58EncodedTx === null || b58EncodedTx === "") {
      throw new CustomError(
        ErrorObject.InitNormalTxErr,
        "Can not init transaction transferring PRV"
      );
    }
    let tempBuf = checkDecode(b58EncodedTx).bytesDecoded;
    let theString = String.fromCharCode.apply(null, tempBuf);
    let txObj = JSON.parse(theString);
    txObj.Encoded = b58EncodedTx;
    let tx = {
      txId: hash,
      tx: txObj,
      hash,
      outputs,
      amount: totalAmountTransfer.toString(),
      inputs: inputCoins,
      receivers: receiverPaymentAddrStr,
      tokenID,
      tokenAmount: totalAmountTokenTransfer.toString(),
      tokenInputs: inputTokenCoins,
      tokenReceivers: tokenReceiverPaymentAddrStr,
      isPrivacy: true,
      metadata,
      txType,
      status: TX_STATUS.PROCESSING,
      info,
    };
    await this.saveTxHistory({ tx });

    // set pending tx
    const inputV1 = isTokenConvert ? txParams?.TokenParams?.InputCoins : txParams?.InputCoins;
    await this.setStorageSpendingCoinsV1({
      tokenId: tokenID,
      value: inputV1 || [],
      txId: hash,
    });
    if (isTokenConvert) {
      const inputV2 = txParams?.InputCoins;
      await this.setSpendingCoinsStorage({
        tokenId: PRVIDSTR,
        coins: inputV2,
        txId: hash,
      });
    }
    this.setPrivacyVersion(PrivacyVersion.ver1)
    // pubsub
    try {
      const pushRawTxToPubsub = await this.rpcTxService.apiPushTx({
        rawTx: b58EncodedTx,
      });
      console.log('pushRawTxToPubsub: ', pushRawTxToPubsub)
      if (!pushRawTxToPubsub) {
        throw new CustomError(
          ErrorObject.FailPushRawTxToPubsub,
          "Can not send transaction",
        );
      }
    } catch (error) {
      throw error;
    }
    await this.saveTxHistory({
      tx: { ...tx, tokenID, txId: hash },
    });
    return tx;
  } catch (e) {
    throw e;
  }
}

async function createAndSendConvertTx({
  transfer: {
    prvPayments = [],
    fee = 10,
    info = "",
    tokenID = null,
    tokenPayments = [],
  },
  extra: { isEncryptMessage = false } = {},
}) {
  try {
    const isEncodeOnly = !isEncryptMessage;

    if (!isEmpty(prvPayments)) {
      prvPayments = await encryptMessageOutCoin(prvPayments, isEncodeOnly);
    }

    if (!isEmpty(tokenPayments)) {
      tokenPayments = await encryptMessageOutCoin(tokenPayments, isEncodeOnly);
    }
    let result = await this.transactConvert({
      transfer: { prvPayments, fee, info, tokenID, tokenPayments },
      extra: { txType: TX_TYPE.CONVERT }
    });
    console.debug('Converted Tx: ', {
      tokenID: tokenID || PRVIDSTR,
      txId: result?.txId,
      fee,
    })
    return result;
  } catch (error) {
    console.log('Convert with error: ', error.message);
    throw error;
  }
}

async function createAndSendConvertPToken({ tokenID = null, balance, fee }) {
  new Validator("tokenID", tokenID).required().string();
  new Validator("balance", balance).required().number();

  const errors = [];
  if (balance === 0) return errors;

  fee = fee || MAX_FEE_PER_TX;
  let info = "";
  let paymentInfo = [];
  let tokenPaymentInfo = [];
  /** create and send convert pToken */
  while (true) {
    try {
      const nextStep = await this.waitingBalanceNativeTokenV2()
      if (!nextStep) break;
      await this.createAndSendConvertTx({
        transfer: {
          tokenID,
          prvPayments: paymentInfo,
          tokenPayments: tokenPaymentInfo,
          fee,
          info,
        },
        extra: { isEncryptMessageToken: true },
      });
    } catch (error) {
      if (error.code !== "WEB_JS_ERROR(-3012)") {
        errors.push(error);
      }
      break;
    }
  }
  return errors;
}

async function convertAllPToken(unspentPTokens) {
  new Validator("unspentPTokens", unspentPTokens).required().array();
  let errorsList = []
  for (const unspentPToken of unspentPTokens) {
    try {
      const { tokenId: tokenID, balance } = unspentPToken;
      await this.createAndSendConvertPToken({ tokenID, balance });
    } catch (errors) {
      errorsList = errorsList.concat(errors)
    }
  }
  return { errors: errorsList };
}

async function createAndSendConvertNativeToken({ tokenID, balance, fee }) {
  new Validator("tokenID", tokenID).string();
  new Validator("balance", balance).required().number();
  const errors = []
  fee = fee || MAX_FEE_PER_TX;
  if (balance <= 100) return errors;
  /** Loop handle convert transaction */
  while (true) {
    try {
      let info = "";
      let paymentInfosParam = [];
      await this.createAndSendConvertTx({
        transfer: { prvPayments: paymentInfosParam, fee, info, tokenID },
        extra: { isEncryptMessage: true },
      });
    } catch (error) {
      if (error.code === "WEB_JS_ERROR(-3012)") break;
      errors.push(error);
      break;
    }
  }
  return { errors };
}

async function getStorageUnspentCoinsV1() {
  let unspentCoins = [];
  try {
    this.setPrivacyVersion(PrivacyVersion.ver1);
    const key = await this.getKeyListUnspentCoins();
    unspentCoins = (await this.getAccountStorage(key)) || [];
  } catch (error) {
    throw error;
  }
  return unspentCoins;
}

async function setStorageUnspentCoinsV1({ value }) {
  new Validator('value', value).required().array();
  if (isEmpty(value) || !this.storage) return;
  try {
    const key = await this.getKeyListUnspentCoins();
    await this.setAccountStorage(key, value);
  } catch (error) {
    console.debug("ERROR GET ACCOUNT STORAGE", error?.message);
  }
}

async function getKeyStorageSpendingCoinsV1({ tokenId }) {
  this.setPrivacyVersion(PrivacyVersion.ver1);
  return this.getPrefixKeyStorage() + `-${tokenId}-${SPENDING_COINS_STORAGE}`;
}

async function getStorageSpendingCoinsV1({ tokenId }) {
  this.setPrivacyVersion(PrivacyVersion.ver1)
  new Validator('tokenId', tokenId).required().string();
  const key = await this.getKeyStorageSpendingCoinsV1({ tokenId });
  const spendingCoins = (await this.getAccountStorage(key)) || [];
  const txIds = uniq(spendingCoins.map(coin => coin.txId));

  const tasks = txIds.map(txId => this.rpcTxService.apiGetTxStatus({ txId }));
  let statuses = []
  try {
    statuses = await Promise.all(tasks);
  } catch (e) {
    throw new CustomError(ErrorObject.GetStatusTransactionErr, "Message is too large", e);
  }
  statuses = txIds.map((txId, index) => ({
    txId,
    status: statuses[index],
  }))

  const spendingCoinsFilterByTime = spendingCoins.filter((item) => {
    const timeExist = new Date().getTime() - item?.createdAt;
    const timeExpired = 2 * 60 * 1000;
    const { status } = statuses.find(status => status.txId === item.txId);
    return (status === TX_STATUS.TXSTATUS_UNKNOWN && timeExist < timeExpired)
      || status === TX_STATUS.TXSTATUS_PENDING
      || status === TX_STATUS.PROCESSING;
  });
  await this.setAccountStorage(key, spendingCoinsFilterByTime);
  return spendingCoinsFilterByTime || [];
}

async function setStorageSpendingCoinsV1({ tokenId, value, txId }) {
  this.setPrivacyVersion(PrivacyVersion.ver1)
  tokenId = tokenId || PRVIDSTR;
  new Validator('tokenId', tokenId).required().string();
  new Validator('value', value).required().array();
  new Validator('txId', txId).required().string();
  try {
    const key = await this.getKeyStorageSpendingCoinsV1({ tokenId });
    let spendingCoins = await this.getStorageSpendingCoinsV1({
      tokenId,
    });
    const mapCoins = value.map((item) => ({
      keyImage: item.KeyImage,
      createdAt: new Date().getTime(),
      txId,
      tokenId,
    }));
    mapCoins.forEach((item) => {
      const isExist = spendingCoins.some(
        (coin) => coin?.keyImage === item?.keyImage
      );
      if (!isExist) {
        spendingCoins.push(item);
      }
    });
    await this.setAccountStorage(key, spendingCoins);
  } catch (error) {
    throw error;
  }
}


function getKeyFlagRequestAirdrop() {
  return this.getOTAKey() + '_REQUEST_AIRDROP';
}

async function getFlagRequestAirdrop() {
  let requested = false;
  try {
    const key = this.getKeyFlagRequestAirdrop();
    requested = await this.getAccountStorage(key);
  } catch (error) {
    console.log("error", error);
  }
  return !!requested;
}

async function setFlagRequestAirdrop() {
  let requested = false;
  try {
    const key = this.getKeyFlagRequestAirdrop();
    requested = await this.setAccountStorage(key, true);
  } catch (error) {
    console.log("error", error);
  }
  return !!requested;
}

async function getKeysInfoV1() {
  const key = this.getOTAKey();
  let keysInfo = {};
  const result = await this.rpcCoinService.apiGetKeyInfo({
    key,
    version: PrivacyVersion.ver1,
  });
  const coinsIndex = result?.coinindex || {};
  if (
    typeof coinsIndex === "object" &&
    coinsIndex &&
    Object.keys(coinsIndex).length > 0
  ) {
    Object.keys(coinsIndex).forEach((tokenId) => {
      keysInfo[tokenId] = { total: coinsIndex[tokenId].Total || 0 };
    });
  }

  keysInfo = Object.keys(keysInfo).map((tokenId) => {
    const total = keysInfo[tokenId].total;
    return {
      tokenId,
      total
    }
  });
  return keysInfo;
}

async function getOutputCoinsV1({ tokenId, total }) {
  let listOutputsCoins = [];
  try {
    this.setPrivacyVersion(PrivacyVersion.ver1);
    const viewKey = this.getReadonlyKey();
    const version = PrivacyVersion.ver1;
    const key = this.getKeyParamOfCoins(viewKey);
    console.debug('Get output coins key: ', key)
    if (total > LIMIT) {
      const { times, remainder } = pagination(total);
      const task = [...Array(times)].map((item, index) => {
        const limit = LIMIT;
        const offset = index * LIMIT;
        return this.rpcCoinService.apiGetListOutputCoins({
          key,
          tokenId,
          limit,
          offset,
          version,
        });
      });
      if (remainder > 0) {
        task.push(
          this.rpcCoinService.apiGetListOutputCoins({
            key,
            tokenId,
            limit: LIMIT,
            offset: times * LIMIT,
            version,
          })
        );
      }
      const result = await Promise.all(task);
      listOutputsCoins = result.reduce((prev, curr, index) => {
        return [...prev, ...[...curr]];
      }, []);
    } else {
      listOutputsCoins = await this.rpcCoinService.apiGetListOutputCoins({
        key,
        limit: total,
        offset: 0,
        tokenId,
        version,
      });
    }
    listOutputsCoins = uniqBy(listOutputsCoins, "SNDerivator");
  } catch (e) {
    throw new CustomError(
      ErrorObject.GetOutputCoinsErr,
      e.message ||
      `Can not get output coins v1 when get unspent token ${tokenId}`
    );
  }
  return listOutputsCoins;
}

async function getUnspentCoinsByTokenIdV1({ tokenId, total, fromApi = true } = {}) {
  new Validator('tokenId', tokenId).required().string();

  fromApi = !!fromApi;
  if (!fromApi) {
    let unspentCoins = await this.getStorageUnspentCoinsV1();
    unspentCoins = unspentCoins.filter((coin) => !!coin).find(
      coin => coin.tokenId === tokenId
    );
    return unspentCoins;
  }

  if (!total) {
    const keyInfo = await this.getKeyInfo(tokenId);
    if (keyInfo && keyInfo.coinindex && keyInfo.coinindex[tokenId]) {
      total = keyInfo.coinindex[tokenId].Total || 0;
    }
    total = keyInfo.total;
  }

  const listOutputsCoins = await this.measureAsyncFn(
    this.getOutputCoinsV1,
    `timeGetUnspentCoinsV1ByTokenId-${tokenId}`,
    { tokenId, total }
  );

  const shardId = this.getShardId();

  const listUnspentCoinsFiltered = (
    await this.checkKeyImages({
      listOutputsCoins,
      shardId,
      tokenId,
    })
  ).filter((coin) => coin.Version !== PrivacyVersion.ver2.toString());

  let unspentCoinExceptSpendingCoin = await getUnspentCoinExceptSpendingCoinV1({
    account: this,
    tokenId,
    unspentCoins: listUnspentCoinsFiltered,
  });

  let { balance, unspentCoinsFiltered } = unspentCoinExceptSpendingCoin?.reduce(
    (prev, coin) => {
      let { balance, unspentCoinsFiltered } = prev;
      const amount = new bn(coin.Value);
      if (tokenId === PRVIDSTR && amount.toNumber() <= 5) {
        return prev;
      }
      return {
        balance: balance.add(amount),
        unspentCoinsFiltered: unspentCoinsFiltered.concat([coin]),
      };
    },
    { balance: new bn(0), unspentCoinsFiltered: [] }
  );

  // case PRV balance < 100
  if (balance.toNumber() <= 100 && tokenId === PRVIDSTR) {
    balance = new bn(0);
    unspentCoinsFiltered = [];
  }

  return {
    tokenId,
    balance: balance.toNumber(),
    unspentCoins: unspentCoinsFiltered,
    numberUnspent: unspentCoinsFiltered.length,
    numberKeyInfo: total,
    numberCoins: listOutputsCoins.length
  };
}

async function requestAirdrop () {
  const paymentAddress = this.key.base58CheckSerialize(PaymentAddressType);
  const status = await this.rpcRequestService.apiRequestAirdrop({ paymentAddress })
  if (AIRDROP_STATUS.SUCCESS === status) {
    await this.setFlagRequestAirdrop()
  }
}

async function checkBalanceNativeTokenV2() {
  this.setPrivacyVersion(PrivacyVersion.ver2)
  const unspentCoins = await this.getSpendingCoins(PRVIDSTR);
  let balance = unspentCoins?.reduce(
    (prev, coin) => {
      let balance = prev;
      const amount = new bn(coin.Value);
      return balance.add(amount);
    },
    new bn(0)
  );
  this.setPrivacyVersion(PrivacyVersion.ver1)
  console.log('Balance v2: ', balance.toNumber());
  return { balance: balance.toNumber(), unspentCoins };
}


async function waitingBalanceNativeTokenV2({
  maxCounter = MAX_COUNT_BALANCE,
  timeCount = TIME_COUNT_BALANCE
} = {}) {
  let counterStep = 0;
  let nextStep = false;
  while (true) {
    if (maxCounter < counterStep) {
      nextStep = true;
      break;
    }
    const { balance } = await this.checkBalanceNativeTokenV2();
    if (balance >= MAX_FEE_PER_TX) {
      nextStep = true;
      break;
    }
    counterStep += 1
    await sleep(timeCount * 1000)
  }
  return nextStep;
}

async function getUnspentCoinsV1({ fromApi = true } = {}) {
  fromApi = !!fromApi;
  this.setPrivacyVersion(PrivacyVersion.ver1);

  const isAirdrop = await this.getFlagRequestAirdrop();
  if (!isAirdrop) {
    await this.requestAirdrop();
  }

  if (!fromApi) {
    /** get coins from storage */
    let unspentCoins = await this.getStorageUnspentCoinsV1();
    unspentCoins = unspentCoins.filter((coin) => !!coin);
    if (!isEmpty(unspentCoins)) {
      return unspentCoins;
    }
  }

  this.coinsV1Storage = {
    unspentCoinV1: [],
  };

  /** Get Key Info */
  const keysInfo = await this.measureAsyncFn(
    this.getKeysInfoV1,
    "timeGetKeysInfoV1"
  );
  console.debug("KeysInfoV1: ", keysInfo);

  /** Get Unspent Coins By Token Id */
  const tasks = keysInfo.map(({ tokenId, total }) => (
    this.getUnspentCoinsByTokenIdV1({ tokenId, total, fromApi })
  ));
  const start = new Date().getTime();
  let unspentCoins = await Promise.all(tasks);
  const end = new Date().getTime();
  this.coinsV1Storage.timeGetUnspentCoinsV1 = end - start;

  /** set list unspent coins V1 */
  await this.measureAsyncFn(
    this.setStorageUnspentCoinsV1,
    "timeSetStorageUnspentCoinsV1",
    {
      value: unspentCoins,
    }
  );

  console.debug('unspentCoinsV1: ', unspentCoins)

  return unspentCoins;
}

async function convertTokensV1() {
  this.setPrivacyVersion(PrivacyVersion.ver1);
  this.coinsV1Storage = {
    unspentCoins: [],
  };
  let errorsList = [];
  /** list unspent coins v1 */
  const unspentCoins = (await this.getUnspentCoinsV1()) || [];
  const prvUnspent = unspentCoins.find((coin) => coin.tokenId === PRVIDSTR);
  const pTokenUnspent = unspentCoins.filter(
    (coin) => coin.tokenId !== PRVIDSTR && coin.balance > 0
  );

  /** handle convert PRV */
  if (!isEmpty(prvUnspent)) {
    const { errors } = await this.createAndSendConvertNativeToken(prvUnspent);
    if (Array.isArray(errors)) {
      errorsList = errorsList.concat(errors)
    }
  }

  /** handle convert PToken */
  if (!isEmpty(pTokenUnspent)) {
    const { errors } = await this.convertAllPToken(pTokenUnspent);
    if (Array.isArray(errors)) {
      errorsList = errorsList.concat(errors)
    }
  }

  console.log('errorsList: ', errorsList)
  return { errors: errorsList };
}

async function clearCacheBalanceV1() {
  this.setPrivacyVersion(PrivacyVersion.ver1);
  const version = this.privacyVersion;
  const key = this.getOTAKey();
  const keyInfo = await this.rpcCoinService.apiGetKeyInfo({
    key,
    version,
  });

  let tokenIds = [];
  const coinsIndex = keyInfo?.coinindex;
  if (coinsIndex) {
    tokenIds = Object.keys(coinsIndex);
  }
  const tasks = tokenIds.map(async (tokenId) => {
    const key = await this.getKeyStorageSpendingCoinsV1({ tokenId });
    return this.clearAccountStorage(key)
  })
  await Promise.all(tasks)
}

export default {
  /** transactor */
  transactConvert,
  createAndSendConvertTx,
  convertAllPToken,
  createAndSendConvertNativeToken,
  createAndSendConvertPToken,

  /** storage */
  getStorageUnspentCoinsV1,
  setStorageUnspentCoinsV1,
  getKeyStorageSpendingCoinsV1,
  getStorageSpendingCoinsV1,
  setStorageSpendingCoinsV1,
  getKeyFlagRequestAirdrop,
  getFlagRequestAirdrop,
  setFlagRequestAirdrop,
  requestAirdrop,

  /** get data */
  getOutputCoinsV1,
  getUnspentCoinsByTokenIdV1,
  getKeysInfoV1,
  getUnspentCoinsV1,
  convertTokensV1,
  checkBalanceNativeTokenV2,
  waitingBalanceNativeTokenV2,
  clearCacheBalanceV1,
};
