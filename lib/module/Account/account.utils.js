import bn from "bn.js";
import cloneDeep from "lodash/cloneDeep";
import { PRVIDSTR } from "@lib/core";
import { CustomTokenParamTx } from "@lib/tx/txcustomtokendata";
import { PaymentInfo } from "@lib/common/key";
import { MaxTxSize } from "@lib/core";
import { MAX_INPUT_PER_TX, DEFAULT_INPUT_PER_TX } from "@lib/tx/constants";
import { CustomError, ErrorObject } from "@lib/common/errorhandler";
import { base64Encode } from "@lib/privacy/utils";
import { getShardIDFromLastByte } from "@lib/common/common";
import { defaultCoinChooser as coinChooser } from "@lib/services/coinChooser";
import { wasm } from "@lib/wasm";

const getEstimateFee = async (from, to, amount, tokenObject, account) => {
  let amountBN = new bn(amount);
  let paymentInfos = [new PaymentInfo(to, amountBN.toString())];

  let tokenID = null,
    tokenParams = null;
  if (tokenObject) {
    tokenID = tokenObject.TokenID;
  }
  // prepare input for native token tx
  let inputForTx;
  try {
    inputForTx = await prepareInputForTxV2({
      amountTransfer: amountBN,
      fee: 0,
      tokenID,
      account,
    });
  } catch (e) {
    throw e;
  }
  try {
    let fee;
    if (!tokenID) {
      fee = await estimateFee(
        "",
        inputForTx.inputCoinStrs.length,
        paymentInfos.length,
        null,
        account.rpc,
        null
      );
    } else {
      tokenParams = {
        PaymentInfo: paymentInfos,
        InputCoins: inputForTx.inputCoinStrs,
        TokenID: tokenID,
        TokenName: tokenObject.TokenName,
        TokenSymbol: tokenObject.TokenSymbol,
      };
      fee = await estimateFee("", 1, 1, null, account.rpc, tokenParams);
    }
    return fee;
  } catch (e) {
    throw e;
  }
};

const prepareInputForTxV2 = async ({
  amountTransfer,
  fee,
  tokenID = PRVIDSTR,
  account,
  numOfOtherPks = 20,
} = {}) => {
  const unspentCoinExceptSpendingCoin = await account.getSpendingCoins(tokenID);
  console.log(
    "unspentCoinExceptSpendingCoin",
    unspentCoinExceptSpendingCoin.length
  );
  // total amount transfer and fee
  let feeBN = new bn(fee);
  let inputCoinsToSpent;
  if (amountTransfer < 0) {
    // negative means use all inputs
    let arrayEnd = MAX_INPUT_PER_TX;
    if (unspentCoinExceptSpendingCoin.length < arrayEnd) {
      arrayEnd = unspentCoinExceptSpendingCoin.length;
    }
    inputCoinsToSpent = unspentCoinExceptSpendingCoin.slice(0, arrayEnd);
    amountTransfer = feeBN;
  } else {
    amountTransfer = amountTransfer.add(feeBN);
    const respChooseBestCoin = coinChooser.coinsToSpend(
      unspentCoinExceptSpendingCoin,
      amountTransfer
    );
    inputCoinsToSpent = respChooseBestCoin.resultInputCoins;
    if (inputCoinsToSpent.length === 0 && amountTransfer.cmp(new bn(0)) !== 0) {
      throw new CustomError(
        ErrorObject.NotEnoughCoinError,
        "Not enough coin to spend"
      );
    }
  }

  let totalValueInput = new bn(0);
  for (let i = 0; i < inputCoinsToSpent.length; i++) {
    totalValueInput = totalValueInput.add(new bn(inputCoinsToSpent[i].Value));
    inputCoinsToSpent[i].Info = "";
  }
  const shardID = getShardIDFromLastByte(
    account.key.KeySet.PaymentAddress.Pk[
      account.key.KeySet.PaymentAddress.Pk.length - 1
    ]
  );
  let cc = null;
  try {
    if (numOfOtherPks > 0) {
      cc = await coinChooser.coinsForRing(
        account.rpc,
        shardID,
        numOfOtherPks,
        tokenID
      );
    }
  } catch (e) {
    console.error("Error while preparing input parameters", e);
    throw e;
  }
  let res = {
    // PaymentAddress: paymentAddrSerialize,
    inputCoinStrs: inputCoinsToSpent,
    totalValueInput: totalValueInput,
    coinsForRing: cc,
  };
  return res;
};

// cloneInputCoinArray clone array of input coins to new array
const cloneInputCoinJsonArray = (_coins) =>
  _coins.map((c) => JSON.parse(JSON.stringify(c)));

const estimateFee = async (
  paymentAddrSerialize,
  numInputCoins,
  numOutputs,
  metadata,
  rpcClient,
  tokenParams = null
) => {
  let tokenIDStr = null;
  if (tokenParams != null) {
    tokenIDStr = tokenParams.TokenID;
  }

  let resp;
  try {
    resp = await rpcClient.getEstimateFeePerKB(
      paymentAddrSerialize,
      tokenIDStr
    );
  } catch (e) {
    throw new CustomError(
      ErrorObject.GetUnitFeeErr,
      "Can not get unit fee when estimate"
    );
  }

  let txSize = await estimateTxSize(
    numInputCoins,
    numOutputs,
    metadata,
    tokenParams
  );
  // check tx size
  if (txSize > MaxTxSize) {
    throw new CustomError(
      ErrorObject.TxSizeExceedErr,
      "tx size is exceed error"
    );
  }
  return (txSize + 1) * resp.unitFee;
};

/**
 *
 * @param {number} numInputCoins
 * @param {number} numOutputCoins
 * @param {bool} hasPrivacyForNativeToken
 * @param {bool} hasPrivacyForPToken
 * @param {*} metadata
 * @param {CustomTokenParamTx} customTokenParams
 * @param {PrivacyTokenParamTxObject} privacyCustomTokenParams
//  */
const estimateTxSize = async (
  numInputCoins,
  numOutputCoins,
  metadata,
  tokenParams
) => {
  const params = {
    NumInputs: numInputCoins,
    NumPayments: numOutputCoins,
    Metadata: metadata,
    TokenParams: tokenParams,
  };
  const sz = await wasm.estimateTxSize(JSON.stringify(params));
  return sz;
};

// getUnspentCoin returns unspent coins
const getUnspentCoin = async (
  paymentAddrSerialize,
  inCoinStrs,
  tokenID,
  rpcClient
) => {
  let unspentCoinStrs = new Array();
  let serialNumberStrs = new Array();

  for (let i = 0; i < inCoinStrs.length; i++) {
    serialNumberStrs.push(inCoinStrs[i].KeyImage);
  }

  // console.log("SNs are", serialNumberStrs, "from", inCoinStrs);

  // check whether each input coin is spent or not
  let response;
  try {
    response = await rpcClient.hasSerialNumber(
      paymentAddrSerialize,
      serialNumberStrs,
      tokenID
    );
  } catch (e) {
    throw e;
  }

  let existed = response.existed;
  if (existed.length != inCoinStrs.length) {
    throw new Error("Wrong response when check has serial number");
  }

  for (let i = 0; i < existed.length; i++) {
    if (!existed[i]) {
      unspentCoinStrs.push(inCoinStrs[i]);
    }
  }

  return {
    unspentCoinStrs: unspentCoinStrs,
  };
};

function newParamTxV2(
  senderKeyWalletObj,
  paymentInfos,
  inputCoins,
  fee,
  tokenID,
  metadata,
  info,
  otherCoinsForRing
) {
  let sk = base64Encode(senderKeyWalletObj.KeySet.PrivateKey);
  let param = {
    SenderSK: sk,
    PaymentInfo: paymentInfos,
    InputCoins: inputCoins,
    Fee: fee,
    HasPrivacy: true,
    TokenID: tokenID,
    Metadata: metadata,
    Info: info,
    CoinCache: otherCoinsForRing,
  };

  return param;
}

function newTokenParamV2(
  paymentInfos,
  inputCoins,
  tokenID,
  otherCoinsForRing,
  obj = {}
) {
  obj.PaymentInfo = paymentInfos;
  obj.InputCoins = inputCoins;
  obj.TokenID = tokenID;
  obj.CoinCache = otherCoinsForRing;
  return obj;
}

const getUnspentCoinExceptSpendingCoinV1 = async ({
  account,
  tokenId,
  unspentCoins,
}) => {
  unspentCoins = cloneDeep(unspentCoins);
  try {
    const spendingCoinsStorage = await account.getSpendingCoinsV1ByTokenId({
      tokenId,
    });
    unspentCoins = unspentCoins.filter(
      (item) =>
        !spendingCoinsStorage?.find(
          (coin) => coin?.SNDerivator === item?.SNDerivator
        )
    );
    const spendingCoins =
      (await account.rpcCoinService.apiGetSpendingCoinInMemPool()) || [];
    if (Array.isArray(spendingCoins) && spendingCoins.length > 0) {
      let unspentCoinExceptSpendingCoin = cloneInputCoinJsonArray(unspentCoins);
      unspentCoinExceptSpendingCoin = unspentCoinExceptSpendingCoin.filter(
        (coin) => !spendingCoins.includes(coin.SNDerivator)
      );
      return unspentCoinExceptSpendingCoin;
    }
  } catch (error) {
    throw error;
  }
  return unspentCoins || [];
};

const prepareInputForConvertTxV2 = async (
  amountTransfer,
  fee,
  tokenID,
  account,
  maxInputs = DEFAULT_INPUT_PER_TX
) => {
  tokenID = tokenID || PRVIDSTR;
  const allUnspentCoins = (await account.getAllUnspentCoinsV1()) || [];
  console.log("allUnspentCoins", allUnspentCoins);
  let unspentCoins = allUnspentCoins.reduce((prev, curr) => {
    let result = prev;
    if (curr.tokenId === tokenID) {
      result = result.concat(curr.unspentCoins);
    }
    return result;
  }, []);

  let unspentCoinExceptSpendingCoin = await getUnspentCoinExceptSpendingCoinV1({
    account,
    tokenId: tokenID,
    unspentCoins,
  });

  // Remove after release
  // unspentCoinExceptSpendingCoin = [{
  //   Version: '1',
  //   Info: '',
  //   Index: '12vBEyqeC7',
  //   PublicKey: '129VHk369h1ZDyQaRrsS58SB1K9vVr74HuXN1px4iscMrrs3NDs',
  //   Commitment: '12nXVyFUbut3qmFKtxCbEroW6GiAmV1RtXGtj2Z3M4RKRKy7Bgb',
  //   KeyImage: '121i4NyZX6jcShLkvJVu2pod8tvmrDqJybqmztxgJLh3fyU6ixd',
  //   SharedRandom: '',
  //   SharedConcealRandom: '',
  //   TxRandom: '',
  //   Randomness: '1zUykwqRrVQxaRe2wLGPwCWnMKZHLbEbDtfuQw8Xazj6vqSKU7',
  //   Value: '553525433',
  //   CoinDetailsEncrypted: '',
  //   SNDerivator: '12KGxPrCjzfKeCy8PoJ1LzUSEP1Jv6EH9noUfWzK2AgbX9bkgoG',
  //   AssetTag: '',
  //   CoinCommitment: '12nXVyFUbut3qmFKtxCbEroW6GiAmV1RtXGtj2Z3M4RKRKy7Bgb',
  //   KeyImageBase64: 'hU2wR+IKBhHxpRUT5uWbNfX9KXEMqwI9pbISauC53Dg='
  // }]
  let inputCoinsToSpent = unspentCoinExceptSpendingCoin.slice(0, maxInputs);
  let totalValueInput = new bn(0);
  for (let i = 0; i < inputCoinsToSpent.length; i++) {
    totalValueInput = totalValueInput.add(new bn(inputCoinsToSpent[i].Value));
    inputCoinsToSpent[i].Info = "";
  }
  return {
    inputCoinStrs: inputCoinsToSpent,
    totalValueInput: totalValueInput,
  };
};

const getEstimateFeeForPToken = getEstimateFee;
export {
  prepareInputForConvertTxV2,
  prepareInputForTxV2,
  cloneInputCoinJsonArray,
  estimateFee,
  getEstimateFee,
  getEstimateFeeForPToken,
  estimateTxSize,
  getUnspentCoin,
  newParamTxV2,
  newTokenParamV2,
  // prepareInputForReplaceTxNormal,
  // prepareInputForReplaceTxPrivacyToken,
  // prepareInputForDefragments,
};
