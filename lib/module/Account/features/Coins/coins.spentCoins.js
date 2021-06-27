import Validator from "@lib/utils/validator";
import uniqBy from "lodash/uniqBy";

export const SPENT_COINS_STORAGE = "SPENT_COINS_STORAGE";

async function storeListSpentCoins(params) {
  const { tokenID, spentCoins, version } = params;
  new Validator("storeListSpentCoins-tokenID", tokenID).required().string();
  new Validator("storeListSpentCoins-spentCoins", spentCoins)
    .array()
    .required();
  new Validator("storeListSpentCoins-version", version).required().number();
  await this.setListSpentCoinsStorage(params);
}

async function setListSpentCoinsStorage(params) {
  try {
    const { spentCoins, tokenID, version } = params;
    new Validator("setListSpentCoinsStorage-spentCoins", spentCoins)
      .required()
      .array();
    new Validator("setListSpentCoinsStorage-tokenID", tokenID)
      .required()
      .string();
    new Validator("setListSpentCoinsStorage-version", version)
      .required()
      .number();
    if (this.storage) {
      const key = this.getKeyListSpentCoinsByTokenId(params);
      const oldSpentCoins = await this.getListSpentCoinsStorage(params);
      const value =
        oldSpentCoins?.length === 0
          ? [...spentCoins]
          : uniqBy([...oldSpentCoins, ...spentCoins], (item) => item?.KeyImage);
      await this.setAccountStorage(key, value);
    }
  } catch (error) {
    throw error;
  }
}

function getKeyListSpentCoinsByTokenId(params) {
  try {
    const { tokenID, version } = params;
    new Validator("getKeyListSpentCoinsByTokenId-tokenID", tokenID)
      .required()
      .string();
    new Validator("getKeyListSpentCoinsByTokenId-version", version)
      .required()
      .number();
    const keyByTokenId = this.getKeyStorageByTokenId(params);
    const key = `${keyByTokenId}-${SPENT_COINS_STORAGE}`;
    return key;
  } catch (error) {
    throw error;
  }
}

async function getListSpentCoinsStorage(params) {
  try {
    const { tokenID, version } = params;
    new Validator("getListSpentCoinsStorage-tokenID", tokenID)
      .required()
      .string();
    new Validator("getListSpentCoinsStorage-version", version)
      .required()
      .number();
    if (this.storage) {
      const key = this.getKeyListSpentCoinsByTokenId(params);
      return (await this.getAccountStorage(key)) || [];
    }
  } catch (error) {
    throw error;
  }
}

export default {
  storeListSpentCoins,
  getListSpentCoinsStorage,
  getKeyListSpentCoinsByTokenId,
  setListSpentCoinsStorage,
};
