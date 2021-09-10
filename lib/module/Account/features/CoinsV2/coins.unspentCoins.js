import Validator from "@lib/utils/validator";

// ====================================

async function checkStatusListUnspentCoinsStorage(params) {
  try {
    const { tokenID, version } = params;
    new Validator("checkStatusListUnspentCoinsStorage-tokenID", tokenID)
      .required()
      .string();
    new Validator("checkStatusListUnspentCoinsStorage-version", version)
      .required()
      .number();
    const total = await this.getTotalCoinsStorage(params); //
    this.coinsStorage.checkStatusListUnspentCoinsFromStorage.oldTotalFromKeyInfo =
      total;
    if (total === 0) {
      return;
    }
    const coins = await this.getListUnspentCoinsStorage(params); //
    this.coinsStorage.checkStatusListUnspentCoinsFromStorage.oldTotalListUnspentCoinsSize =
      coins.length;
    const keyImages = this.getKeyImagesBase64Encode({
      coinsDecrypted: coins,
    }); //
    if (keyImages.length !== 0) {
      const shardId = this.getShardID();
      const keyImagesStatus = await this.measureAsyncFn(
        this.rpcCoinService.apiCheckKeyImages,
        "timeCheckStatusListUnspentCoinsFromLocal.timeCheckKeyImages",
        {
          keyImages,
          shardId,
          ...params,
        },
        this.rpcCoinService
      ); //
      const unspentCoins = coins?.filter(
        (coin, index) => !keyImagesStatus[index]
      );
      const spentCoins = coins?.filter((coin, index) => keyImagesStatus[index]);
      this.coinsStorage.checkStatusListUnspentCoinsFromStorage.sizeListSNStatus =
        keyImagesStatus.length;
      this.coinsStorage.checkStatusListUnspentCoinsFromStorage.spentSize =
        spentCoins.length;
      this.coinsStorage.checkStatusListUnspentCoinsFromStorage.unspentSize =
        unspentCoins.length;
      await Promise.all([
        this.measureAsyncFn(
          this.updateListUnspentCoinsStorage, //
          "timeCheckStatusListUnspentCoinsFromLocal.timeUpdateListUnspentCoinsFromLocal",
          {
            listUnspentCoins: unspentCoins,
            ...params,
          }
        ),
        this.measureAsyncFn(
          this.storeListSpentCoins, //
          "timeCheckStatusListUnspentCoinsFromLocal.timeStoreListSpentCoins",
          { spentCoins, ...params }
        ),
      ]);
    }
  } catch (error) {
    console.log("checkStatusListUnspentCoinsStorage FAILED", error);
    throw error;
  }
}

async function getUnspentCoinsV2(params) {
  try {
    const { version, tokenID, isNFT = false } = params;
    new Validator(`getUnspentCoinsV2-tokenID`, tokenID).required().string();
    new Validator(`getUnspentCoinsV2-version`, version).required().number();
    new Validator(`getUnspentCoinsV2-isNFT`, isNFT).boolean();
    this.initTrackingGetOutCoins(); //
    this.coinsStorage.tokenID = tokenID;
    const keyInfo = await this.measureAsyncFn(
      this.getKeyInfo,
      "timeGetKeyInfo",
      params
    ); //
    let listOutputsCoins = [];
    let total = 0;
    try {
      if (keyInfo) {
        if (isNFT) {
          total = keyInfo?.nftindex[tokenID]?.Total || 0;
        } else {
          total = keyInfo?.coinindex[tokenID]?.Total || 0;
        }
      }
    } catch {
      //
    }
    this.coinsStorage.newTotalCoinsFromKeyInfo = total;
    const oldTotal = await this.getTotalCoinsStorage(params); //
    this.coinsStorage.oldTotalCoinsFromKeyInfo = oldTotal;
    await this.checkStatusListUnspentCoinsStorage(params); //
    let calcTotal = 0;
    if (total !== oldTotal) {
      calcTotal = total - oldTotal;
    }
    if (calcTotal > 0) {
      this.coinsStorage.calcTotalCoinsDiff = calcTotal;
      listOutputsCoins = await this.measureAsyncFn(
        this.getListOutputsCoins, //
        "timeGetListOutputsCoins",
        {
          total: calcTotal,
          ...params,
        }
      );
      const shardId = this.getShardID(); //
      const listUnspentCoinsFiltered = await this.checkKeyImages({
        listOutputsCoins,
        shardId,
        ...params,
      }); //
      await Promise.all([
        this.measureAsyncFn(
          this.setListUnspentCoinsStorage,
          "timeSetListUnspentCoinsStorage",
          {
            value: listUnspentCoinsFiltered,
            ...params,
          }
        ),
        this.measureAsyncFn(
          this.setTotalCoinsStorage,
          "timeSetTotalCoinsStorage",
          {
            value: listOutputsCoins.length !== calcTotal ? oldTotal : total,
            ...params,
          }
        ),
      ]);
    }
    const listUnspentCoinsMerged = await this.getListUnspentCoinsStorage(
      params
    );
    if (!this.coinUTXOs) {
      this.coinUTXOs = {};
    }
    this.coinUTXOs[tokenID] = listUnspentCoinsMerged.length;
    await this.setCoinsStorage({ value: this.coinsStorage, ...params });
    return listUnspentCoinsMerged;
  } catch (error) {
    console.log("GET UNSPENT COINS V2 FAILED", error);
    throw error;
  }
}

export default {
  getUnspentCoinsV2,
  checkStatusListUnspentCoinsStorage,
};
