import Validator from "@lib/utils/validator";
import uniqBy from "lodash/uniqBy";

export const UNSPENT_COINS_STORAGE = "UNSPENT-COINS";
export const TOTAL_UNSPENT_COINS = "TOTAL_UNSPENT_COINS";

async function getKeyListUnspentCoins(params) {
  try {
    const { version } = params;
    new Validator("getKeyListUnspentCoins-version", version)
      .required()
      .number();
    const viewkey = this.getReadonlyKey();
    return (
      this.getPrefixKeyStorage(params) + `-${TOTAL_UNSPENT_COINS}-${viewkey}`
    );
  } catch (error) {
    throw error;
  }
}

function getKeyListUnspentCoinsByTokenId(params) {
  try {
    const { tokenID, version } = params;
    new Validator(`getKeyListUnspentCoinsByTokenId-tokenID`, tokenID)
      .required()
      .string();
    new Validator("getKeyListUnspentCoinsByTokenId-version", version)
      .required()
      .number();
    const keyByTokenId = this.getKeyStorageByTokenId(params);
    const key = `${keyByTokenId}-${UNSPENT_COINS_STORAGE}`;
    return key;
  } catch (error) {
    throw error;
  }
}

async function getListUnspentCoinsStorage(params) {
  try {
    const { tokenID, version } = params;
    new Validator(`getListUnspentCoinsStorage-tokenID`, tokenID)
      .required()
      .string();
    new Validator("getListUnspentCoinsStorage-version", version)
      .required()
      .number();
    if (this.storage) {
      const key = this.getKeyListUnspentCoinsByTokenId(params);
      const listUnspentCoins = await this.getAccountStorage(key);
      return listUnspentCoins || [];
    }
  } catch (error) {
    throw error;
  }
}

async function setListUnspentCoinsStorage(params) {
  try {
    const { value, tokenID, version } = params;
    new Validator(`setListUnspentCoinsStorage-tokenID`, tokenID)
      .required()
      .string();
    new Validator(`setListUnspentCoinsStorage-version`, version)
      .required()
      .number();
    new Validator(`setListUnspentCoinsStorage-value`, value).required().array();
    if (this.storage) {
      const key = this.getKeyListUnspentCoinsByTokenId(params);
      const oldListUnspentCoins = await this.getListUnspentCoinsStorage(params);
      const listUnspentCoins =
        !oldListUnspentCoins || oldListUnspentCoins.length === 0
          ? value
          : uniqBy([...oldListUnspentCoins, ...value], "KeyImage");
      await this.setAccountStorage(key, listUnspentCoins);
    }
  } catch (error) {
    throw error;
  }
}

async function updateListUnspentCoinsStorage(params) {
  try {
    const { listUnspentCoins, tokenID, version } = params;
    new Validator(
      "updateListUnspentCoinsStorage-listUnspentCoins",
      listUnspentCoins
    )
      .required()
      .array();
    new Validator("updateListUnspentCoinsStorage-tokenID", tokenID)
      .required()
      .string();
    new Validator("updateListUnspentCoinsStorage-version", version)
      .required()
      .number();
    const key = this.getKeyListUnspentCoinsByTokenId({ tokenID, version });
    await this.setAccountStorage(key, listUnspentCoins);
  } catch (error) {
    throw error;
  }
}

export default {
  updateListUnspentCoinsStorage,
  getKeyListUnspentCoinsByTokenId,
  getListUnspentCoinsStorage,
  getKeyListUnspentCoins,
  setListUnspentCoinsStorage,
};
