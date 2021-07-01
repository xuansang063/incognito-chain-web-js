import Validator from "@lib/utils/validator";

async function checkKeyImageV2(params) {
  try {
    const { listOutputsCoins, shardId, tokenID, version } = params;
    new Validator(`checkKeyImageV2-shardId`, shardId).required().number();
    new Validator(`checkKeyImageV2-tokenID`, tokenID).required().string();
    new Validator(`checkKeyImageV2-version`, version).required().number();
    new Validator(`checkKeyImageV2-listOutputsCoins`, listOutputsCoins)
      .required()
      .array();
    const coinsDecrypted = await this.measureAsyncFn(
      this.decryptCoins,
      "timeCheckKeyImages.timeGetDecryptCoins",
      { coins: listOutputsCoins, ...params }
    ); //
    const keyImages = this.getKeyImagesBase64Encode({ coinsDecrypted }); //
    let unspentCoins = [];
    let spentCoins = [];
    if (keyImages.length !== 0) {
      const keyImagesStatus = await this.measureAsyncFn(
        this.rpcCoinService.apiCheckKeyImages,
        "timeCheckKeyImages.timeCheckKeyImages",
        {
          keyImages,
          shardId,
          ...params,
        }
      ); //
      unspentCoins = coinsDecrypted?.filter(
        (coin, index) => !keyImagesStatus[index]
      );
      spentCoins = coinsDecrypted?.filter(
        (coin, index) => keyImagesStatus[index]
      );
      await this.measureAsyncFn(
        this.storeListSpentCoins, //
        "timeCheckKeyImages.timeStoreListSpentCoins",
        {
          spentCoins,
          ...params,
        }
      );
      this.coinsStorage.totalKeyImagesSize = keyImagesStatus.length;
    }
    this.coinsStorage.totalCoinsUnspentSize = unspentCoins.length;
    this.coinsStorage.totalCoinsSpentSize = spentCoins.length;
    return unspentCoins;
  } catch (error) {
    throw error;
  }
}

export default {
  checkKeyImageV2,
};
