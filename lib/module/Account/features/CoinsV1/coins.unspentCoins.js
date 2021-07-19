import Validator from '@lib/utils/validator';
import { PrivacyVersion, PRVIDSTR } from '@lib/core/constants';
import { getUnspentCoinExceptSpendingCoinV1 } from '@lib/module/Account/features/CoinsV1/coins.utils';
import bn from 'bn.js';
import { pagination } from '@lib/module/Account/account.utils';
import { MAX_FEE_PER_TX } from '@lib/module/Account/account.constants';
import isEmpty from 'lodash/isEmpty';
import { MIN_AMOUNT_COIN_CONVERT } from '@lib/tx/constants';

const KEY_STORAGE = {
  TOTAL_UNSPENT_COINS_V1: 'TOTAL_UNSPENT_COINS_V1'
}

function getKeyListUnspentCoinsV1() {
  try {
    const viewkey = this.getReadonlyKey();
    const prefix = this.getPrefixKeyStorage({ version: PrivacyVersion.ver1 })
    return `${prefix}-${KEY_STORAGE.TOTAL_UNSPENT_COINS_V1}-${viewkey}`;
  } catch (error) {
    throw error;
  }
}

async function getUnspentCoinsStorageV1() {
  let unspentCoins = [];
  try {
    const key = this.getKeyListUnspentCoinsV1();
    unspentCoins = (await this.getAccountStorage(key)) || [];
  } catch (error) {
    throw error;
  }
  return unspentCoins;
}

async function setUnspentCoinsStorageV1({ allUnspentCoins }) {
  new Validator("setUnspentCoinsStorageV1-allUnspentCoins", allUnspentCoins).required().array();
  if (isEmpty(allUnspentCoins) || !this.storage) return;
  try {
    const key = await this.getKeyListUnspentCoinsV1();
    await this.setAccountStorage(key, allUnspentCoins);
  } catch (error) {
    throw error;
  }
}

async function updateStatusStorageUnspentCoinsV1(params) {
  try {
    const { tokenID, version } = params;
    new Validator("updateStatusStorageUnspentCoinsV1-tokenID", tokenID)
      .required()
      .string();
    new Validator("updateStatusStorageUnspentCoinsV1-version", version)
      .required()
      .number();
    const total = await this.getTotalCoinsStorage(params);
    if (total === 0) return;
    const coins = await this.getListUnspentCoinsStorage(params);
    const keyImages = this.getKeyImagesBase64Encode({coinsDecrypted: coins});
    if (keyImages.length !== 0) {
      const shardId = this.getShardID();
      const keyImagesStatus = await this.measureAsyncFn(
        this.rpcCoinService.apiCheckKeyImages,
        "timeCheckStatusListUnspentCoinsFromLocal.timeCheckKeyImages",
        {
          keyImages,
          shardId,
          version
        },
      );
      const unspentCoins = coins?.filter((coin, index) => !keyImagesStatus[index]);
      const spentCoins = coins?.filter((coin, index) => keyImagesStatus[index]);
      await Promise.all([
        this.measureAsyncFn(
          this.updateListUnspentCoinsStorage,
          "timeCheckStatusListUnspentCoinsFromLocal.timeUpdateListUnspentCoinsFromLocal",
          {
            listUnspentCoins: unspentCoins,
            ...params,
          }
        ),
        this.measureAsyncFn(
          this.storeListSpentCoins,
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

async function getUnspentCoinsByTokenIdV1({ tokenID, total, version } = {}) {
  new Validator('getUnspentCoinsByTokenIdV1-tokenId', tokenID).required().string();
  new Validator('getUnspentCoinsByTokenIdV1-total', total).number();
  new Validator('getUnspentCoinsByTokenIdV1-version', version).required().number();
  try {
    if (!total) {
     total = (await this.getKeyInfoByTokenIdV1({ tokenID })) || 0;
    }
    await this.updateStatusStorageUnspentCoinsV1({ tokenID, version });
    const oldTotal = await this.getTotalCoinsStorage({ tokenID, version });
    let calcTotal = 0;
    let listOutputsCoins = [];
    if (total !== oldTotal) {
      calcTotal = total - oldTotal;
    }
    if (calcTotal > 0) {
      listOutputsCoins = (await this.measureAsyncFn(
        this.getListOutputsCoins,
        "`timeGetUnspentCoinsV1ByTokenId-${tokenID}`",
        {
          tokenID,
          total: calcTotal,
          version,
        }
      )) || [];
      const shardId = this.getShardID();
      const { unspentCoins } = await this.checkKeyImages({
        listOutputsCoins,
        shardId,
        version,
        tokenID,
      });
      await Promise.all([
        this.measureAsyncFn(
          this.setListUnspentCoinsStorage,
          "timeSetListUnspentCoinsStorage",
          {
            value: unspentCoins,
            version,
            tokenID
          }
        ),
        this.measureAsyncFn(
          this.setTotalCoinsStorage,
          "timeSetTotalCoinsStorage",
          {
            value: listOutputsCoins.length !== calcTotal ? oldTotal : total,
            version,
            tokenID,
          }
        ),
      ]);
    }

    /** get unspent coins from storage */
    const listUnspentCoinsMerged = await this.getListUnspentCoinsStorage({ version, tokenID });
    const unspentCoinExceptSpendingCoin = await getUnspentCoinExceptSpendingCoinV1({
      account: this,
      tokenID,
      unspentCoins: listUnspentCoinsMerged,
      version
    });
    let { balance, unspentCoinsFiltered } = unspentCoinExceptSpendingCoin?.reduce(
      (prev, coin) => {
        let { balance, unspentCoinsFiltered } = prev;
        const amount = new bn(coin.Value);
        if (tokenID === PRVIDSTR && amount.lte(new bn(MIN_AMOUNT_COIN_CONVERT))) {
          return prev;
        }
        return {
          balance: balance.add(amount),
          unspentCoinsFiltered: unspentCoinsFiltered.concat([coin]),
        };
      },
      { balance: new bn(0), unspentCoinsFiltered: [] }
    );
    // case PRV balance <= MAX_FEE_PER_TX
    if (balance.lte(new bn(MAX_FEE_PER_TX)) && tokenID === PRVIDSTR) {
      balance = new bn(0);
      unspentCoinsFiltered = [];
    }
    return {
      tokenID,
      balance: balance.toString(),
      unspentCoins: unspentCoinsFiltered,
    };
  } catch (e) {
    await this.removeStorageCoinsV1ByTokenID({ tokenID, version })
    throw e;
  }
}

/** Get all unspent coins v1 */
async function getUnspentCoinsV1({
  limitPage = 25,
  version = PrivacyVersion.ver1
} = {}) {
  new Validator('getUnspentCoinsV1-limitPage', limitPage);
  new Validator('getUnspentCoinsV1-version', version);

  /** request airdrop for convert coin v1 */
  await this.requestAirdrop();

  /** get coins in mempool*/
  await this.getCoinsInMempoolCached();

  this.coinsV1Storage = {
    unspentCoinV1: [],
    timeGetUnspentCoinsV1: 0
  };

  /** Get Key Info */
  let keysInfo = (await this.getKeyInfoV1()) || [];

  console.debug("KeysInfoV1: ", keysInfo);

  /** Get Unspent Coins By Token Id */
  const start = new Date().getTime();
  const LIMIT_PAGES = limitPage;
  const noCoins = keysInfo.length;
  let unspentCoins = [];
  if (noCoins > LIMIT_PAGES) {
    const { times, remainder } = pagination(noCoins, LIMIT_PAGES);
    for (let index = 0; index < times; index++) {
      const sliceData = keysInfo.slice(
        index * LIMIT_PAGES,
        index * LIMIT_PAGES + LIMIT_PAGES
      );
      const tasks = sliceData.map(({ tokenID, total }) =>
        this.getUnspentCoinsByTokenIdV1({ tokenID, total, version })
      );
      const result = await Promise.all(tasks);
      unspentCoins = unspentCoins.concat(result);
    }
    if (remainder > 0) {
      let sliceData = keysInfo.slice(
        times * LIMIT_PAGES,
        times * LIMIT_PAGES + remainder
      );
      const tasks = sliceData.map(({ tokenID, total }) =>
        this.getUnspentCoinsByTokenIdV1({ tokenID, total, version })
      );
      const result = await Promise.all(tasks);
      unspentCoins = unspentCoins.concat(result);
    }
  } else {
    const tasks = keysInfo.map(({ tokenID, total }) =>
      this.getUnspentCoinsByTokenIdV1({ tokenID, total, version })
    );
    unspentCoins = await Promise.all(tasks);
  }
  const end = new Date().getTime();

  /** set list unspent coins V1 */
  await this.measureAsyncFn(
    this.setUnspentCoinsStorageV1,
    "timeSetStorageUnspentCoinsV1",
    {
      allUnspentCoins: unspentCoins,
      version,
    }
  );
  console.debug("===============================");
  console.debug("Convert: unspentCoins", unspentCoins);
  console.debug("Convert: time get unspentCoins", end - start);
  console.debug("===============================");
  return unspentCoins;
}

export default {
  getKeyListUnspentCoinsV1,
  getUnspentCoinsStorageV1,
  setUnspentCoinsStorageV1,
  updateStatusStorageUnspentCoinsV1,

  getUnspentCoinsByTokenIdV1,
  getUnspentCoinsV1,
};
