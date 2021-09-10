import Validator from '@lib/utils/validator';
import { cloneDeep, isEmpty } from 'lodash';
import { cloneInputCoinJsonArray } from '@lib/module/Account/account.utils';
import { PRVIDSTR } from '@lib/core';
import { DEFAULT_INPUT_PER_TX } from '@lib/tx/constants';
import bn from 'bn.js';
import { defaultCoinChooser as coinChooser } from '@lib/services/coinChooser';
import { getShardIDFromLastByte } from '@lib/common/common';
import { checkDecode } from '@lib/common/base58';
import { base64Encode } from '@lib/privacy/utils';
import { PrivacyVersion } from '@lib/core/constants';
import { CustomError, ErrorObject } from '@lib/common/errorhandler';

export const getSpendingCoinFilteredWithStorageV1 = async ({
  account,
  tokenID,
  unspentCoins,
  version,
}) => {
  new Validator("getSpendingCoinFilteredWithStorageV1-account", account).required();
  new Validator("getSpendingCoinFilteredWithStorageV1-tokenID", tokenID).string();
  new Validator("getSpendingCoinFilteredWithStorageV1-unspentCoins", unspentCoins).required().array();
  new Validator("getSpendingCoinFilteredWithStorageV1-version", version).required().number();

  const spendingCoinsStorage = await account.getSpendingCoinsStorageByTokenId({
    tokenID,
    version
  });
  unspentCoins = unspentCoins.filter(
    (item) =>
      !spendingCoinsStorage?.find((coin) => coin?.keyImage === item?.KeyImage)
  );
  return unspentCoins;
}

export const getUnspentCoinExceptSpendingCoinV1 = async ({
  account,
  tokenID,
  unspentCoins,
  version
}) => {
  new Validator("getUnspentCoinExceptSpendingCoinV1-account", account).required();
  new Validator("getUnspentCoinExceptSpendingCoinV1-tokenID", tokenID).string();
  new Validator("getUnspentCoinExceptSpendingCoinV1-unspentCoins", unspentCoins).required().array();
  new Validator("getUnspentCoinExceptSpendingCoinV1-version", version).required().number();

  unspentCoins = cloneDeep(unspentCoins);

  try {
    unspentCoins = await getSpendingCoinFilteredWithStorageV1({
      account,
      tokenID,
      unspentCoins,
      version,
    });
    /** get pending coins in mempool */
    const spendingCoins = await account.getCoinsInMempoolCached();
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

export const prepareInputForConvertTxV2 = async ({ fee, tokenID, account, version }) => {
  tokenID = tokenID || PRVIDSTR;
  new Validator('fee', fee).required().amount();
  new Validator('tokenID', tokenID).required().string();
  new Validator('account', account).required();
  new Validator('version', version).required().number();

  const isPToken = tokenID !== PRVIDSTR;
  const { unspentCoins: unspentCoinExceptSpendingCoin } = await account.getUnspentCoinsByTokenIdV1({ version, tokenID });
  const maxInputs = DEFAULT_INPUT_PER_TX;
  const maxLength = unspentCoinExceptSpendingCoin.length;
  let totalValueInput = new bn(0);
  let inputCoinsToSpent = unspentCoinExceptSpendingCoin.slice(0, maxInputs);
  // const subUnspent = unspentCoinExceptSpendingCoin.slice(maxInputs, maxLength);
  // if (subUnspent.length <= 10) {
  //   inputCoinsToSpent = inputCoinsToSpent.concat(subUnspent);
  // }

  const remainInputCoins = maxLength - inputCoinsToSpent.length;

  for (let i = 0; i < inputCoinsToSpent.length; i++) {
    totalValueInput = totalValueInput.add(new bn(inputCoinsToSpent[i].Value));
    inputCoinsToSpent[i].Info = "";
  }

  let coinsForRing;
  let inputCoinsForFee;
  if (isPToken) {
    const unspentPRV_v2 = (await account.getUnspentCoinsExcludeSpendingCoins({
      tokenID: PRVIDSTR,
      version: PrivacyVersion.ver2
    })) || [];
    if (unspentPRV_v2.length === 0) {
      throw new CustomError(
        ErrorObject.NotEnoughCoinPRVError,
        ErrorObject.NotEnoughCoinPRVError.description
      );
    }
    inputCoinsForFee = coinChooser.coinsToSpend(
      unspentPRV_v2,
      new bn(fee)
    ).resultInputCoins;
    const shardID = getShardIDFromLastByte(
      account.key.KeySet.PaymentAddress.Pk[
      account.key.KeySet.PaymentAddress.Pk.length - 1
        ]
    );
    coinsForRing = await coinChooser.coinsForRing(
      account.rpc,
      shardID,
      inputCoinsForFee.length * 7,
      PRVIDSTR
    );
    coinsForRing.Commitments = coinsForRing.Commitments.map((item) => {
      let base58 = checkDecode(item).bytesDecoded;
      return base64Encode(base58);
    });
    coinsForRing.PublicKeys = coinsForRing.PublicKeys.map((item) => {
      let base58 = checkDecode(item).bytesDecoded;
      return base64Encode(base58);
    });
  }
  console.debug("inputCoinsToSpent: ", {
    unspentCoinExceptSpendingCoin,
    inputCoinsToSpent,
    inputCoinsForFee,
    tokenID,
  });

  return {
    inputCoinsToSpent: inputCoinsToSpent,
    totalValueInput: totalValueInput,
    coinsForRing,
    inputCoinsForFee,
    remainInputCoins,
  };
};

export default {
  getSpendingCoinFilteredWithStorageV1,
  getUnspentCoinExceptSpendingCoinV1,
  prepareInputForConvertTxV2,
};
