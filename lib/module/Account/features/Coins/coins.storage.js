import Validator from "@lib/utils/validator";

function getKeyStorageByTokenId(params) {
  try {
    const { tokenID, version } = params;
    new Validator("getKeyStorageByTokenId-tokenID", tokenID)
      .required()
      .string();
    new Validator("getKeyStorageByTokenId-version", version)
      .required()
      .number();
    const otaKey = this.getOTAKey();
    const prefix = this.getPrefixKeyStorage({ version });
    return `${tokenID}-${prefix}-${otaKey}-${this.name}`;
  } catch (error) {
    throw error;
  }
}

function getPrefixKeyStorage({ version }) {
  new Validator("getPrefixKeyStorage-version", version).required().number();
  return `PRIVACY-${version}`;
}

async function clearCacheStorage(params) {
  try {
    const { tokenID, version } = params;
    new Validator("clearCacheStorage-tokenID", tokenID).required().string();
    new Validator("clearCacheStorage-version", version).required().number();
    const totalCoinsKey = this.getKeyTotalCoinsStorageByTokenId(params);
    const unspentCoinsKey = this.getKeyListUnspentCoinsByTokenId(params);
    const spendingCoinsKey = this.getKeySpendingCoinsStorageByTokenId(params);
    const storageCoins = this.getKeyCoinsStorageByTokenId(params);
    const spentCoinsKey = this.getKeyListSpentCoinsByTokenId(params);
    const otaKey = this.getOTAKey();
    await Promise.all([
      this.clearAccountStorage(totalCoinsKey),
      this.clearAccountStorage(unspentCoinsKey),
      this.clearAccountStorage(spendingCoinsKey),
      this.clearAccountStorage(storageCoins),
      this.clearAccountStorage(spentCoinsKey),
      this.clearAccountStorage(otaKey),
      this.clearTxsHistory(params),
    ]);
  } catch (error) {
    throw error;
  }
}

export default {
  getPrefixKeyStorage,
  getKeyStorageByTokenId,
  clearCacheStorage,
};
