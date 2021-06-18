import Validator from "@lib/utils/validator";

async function checkKeyImageV1({ listOutputsCoins }) {
  new Validator("checkKeyImageV1-listOutputsCoins", listOutputsCoins)
    .required()
    .array();
  const shardId = this.getShardID();
  const coinsDecrypted = await this.measureAsyncFn(
    this.decryptCoins,
    "timeCheckKeyImages.timeGetDecryptCoinsV1",
    { coins: listOutputsCoins }
  );
  const keyImages = this.getKeyImagesBase64Encode({ coinsDecrypted });
  let unspentCoins = [];
  let spentCoins = [];
  if (keyImages.length !== 0) {
    const keyImagesStatus = await this.measureAsyncFn(
      this.rpcCoinService.apiCheckKeyImages,
      "timeCheckKeyImages.timeCheckKeyImagesV1",
      {
        keyImages,
        shardId,
      }
    );
    unspentCoins = coinsDecrypted?.filter(
      (coin, index) => !keyImagesStatus[index]
    );
    spentCoins = coinsDecrypted?.filter(
      (coin, index) => keyImagesStatus[index]
    );
    this.coinsV1Storage.totalKeyImagesSize = keyImagesStatus.length;
  }
  this.coinsV1Storage.totalCoinsUnspentSize = unspentCoins.length;
  this.coinsV1Storage.totalCoinsSpentSize = spentCoins.length;
  return unspentCoins;
}

export default {
  checkKeyImageV1,
};
