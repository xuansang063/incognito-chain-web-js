import Validator from "@lib/utils/validator";

export const TOTAL_COINS_KEY_STORAGE = "TOTAL-COINS";

async function setTotalCoinsStorage(params) {
  try {
    const { value, tokenID, version } = params;
    new Validator(`setTotalCoinsStorage-value`, value).required().number();
    new Validator(`setTotalCoinsStorage-tokenID`, tokenID).required().string();
    new Validator(`setTotalCoinsStorage-version`, version).required().number();
    if (this.storage) {
      const key = this.getKeyTotalCoinsStorageByTokenId(params);
      await this.setAccountStorage(key, value);
    }
  } catch (error) {
    throw error;
  }
}

function getKeyTotalCoinsStorageByTokenId(params) {
  try {
    const { tokenID, version } = params;
    new Validator("getKeyTotalCoinsStorageByTokenId-tokenID", tokenID)
      .required()
      .string();
    new Validator("getKeyTotalCoinsStorageByTokenId-version", version)
      .required()
      .number();
    const keyByTokenId = this.getKeyStorageByTokenId(params);
    const key = `${keyByTokenId}-${TOTAL_COINS_KEY_STORAGE}`;
    return key;
  } catch (error) {
    throw error;
  }
}

async function getTotalCoinsStorage(params) {
  try {
    const { tokenID, version } = params;
    new Validator("getTotalCoinsStorage-tokenID", tokenID).required().string();
    new Validator("getTotalCoinsStorage-version", version).required().number();
    if (this.storage) {
      const key = this.getKeyTotalCoinsStorageByTokenId(params);
      const total = await this.getAccountStorage(key);
      return total || 0;
    }
  } catch (error) {
    throw error;
  }
}

export default {
  getTotalCoinsStorage,
  setTotalCoinsStorage,
  getKeyTotalCoinsStorageByTokenId,
};
