import { CustomError, ErrorObject } from '@lib/common/errorhandler';
import { isEmpty } from 'lodash';
import Validator from '@lib/utils/validator';
import { PrivacyVersion, PRVIDSTR } from '@lib/core/constants';
import { getUnspentCoinExceptSpendingCoinV1 } from '@lib/module/Account/features/CoinsV1/coins.utils';
import bn from 'bn.js';

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

async function getUnspentCoinsByTokenIdV1({ tokenID, total, fromApi = true, version } = {}) {
  new Validator('getUnspentCoinsByTokenIdV1-tokenId', tokenID).required().string();
  new Validator('getUnspentCoinsByTokenIdV1-total', total).number();
  new Validator('getUnspentCoinsByTokenIdV1-fromApi', fromApi).required().boolean();
  new Validator('getUnspentCoinsByTokenIdV1-version', version).required().number();

  /** if fromApi = false, get unspent coins from local storage */

  if (!fromApi) {
    let unspentCoins = (await this.getUnspentCoinsStorageV1()) || [];
    unspentCoins = unspentCoins.filter((coin) => !!coin).find(
      coin => coin.tokenID === tokenID
    );
    return unspentCoins;
  }

  if (!total) {
    total = await this.getKeyInfoByTokenIdV1({ tokenID });
  }

  const listOutputsCoins = (await this.measureAsyncFn(
    this.getOutputCoinsV1,
    `timeGetUnspentCoinsV1ByTokenId-${tokenID}`,
    { tokenID, total, version }
  )) || [];

  const shardId = this.getShardID();

  const listUnspentCoinsFiltered = (
    await this.checkKeyImages({
      listOutputsCoins,
      shardId,
      version,
      tokenID,
    })
  ).unspentCoins.filter((coin) => coin.Version !== PrivacyVersion.ver2.toString());

  let unspentCoinExceptSpendingCoin = await getUnspentCoinExceptSpendingCoinV1({
    account: this,
    tokenID,
    unspentCoins: listUnspentCoinsFiltered,
    version
  });

  let { balance, unspentCoinsFiltered } = unspentCoinExceptSpendingCoin?.reduce(
    (prev, coin) => {
      let { balance, unspentCoinsFiltered } = prev;
      const amount = new bn(coin.Value);
      if (tokenID === PRVIDSTR && amount.toNumber() <= 5) {
        return prev;
      }
      return {
        balance: balance.add(amount),
        unspentCoinsFiltered: unspentCoinsFiltered.concat([coin]),
      };
    },
    { balance: new bn(0), unspentCoinsFiltered: [] }
  );

  // case PRV balance < 100
  if (balance.toNumber() <= 100 && tokenID === PRVIDSTR) {
    balance = new bn(0);
    unspentCoinsFiltered = [];
  }

  return {
    tokenID,
    balance: balance.toNumber(),
    unspentCoins: unspentCoinsFiltered,
    numberUnspent: unspentCoinsFiltered.length,
    numberKeyInfo: total,
    numberCoins: listOutputsCoins.length
  };
}

/** Get all unspent coins v1 */
async function getUnspentCoinsV1({ fromApi } = {}) {
  const version = PrivacyVersion.ver1;
  /** fromApi = false, get unspent coins from storage */
  new Validator('getUnspentCoinsV1-fromApi', fromApi).required().boolean()

  /** request airdrop for convert coin v1 */
  try {
    const isAirdrop = await this.getFlagRequestAirdrop();
    if (!isAirdrop) {
      await this.requestAirdrop();
    }
  } catch (e) {
    throw new CustomError(ErrorObject.RequestAirdropErr, e.message, e);
  }

  if (!fromApi) {
    /** get coins from storage */
    let unspentCoins = (await this.getUnspentCoinsStorageV1()) || [];
    unspentCoins = unspentCoins.filter((coin) => !!coin);
    if (!isEmpty(unspentCoins)) {
      return unspentCoins;
    }
  }

  this.coinsV1Storage = {
    unspentCoinV1: [],
    timeGetUnspentCoinsV1: 0
  };

  /** Get Key Info */
  let keysInfo = (await this.getKeyInfoV1()) || [];

  console.debug("KeysInfoV1: ", keysInfo);

  /** Get Unspent Coins By Token Id */
  const tasks = keysInfo.map(({ tokenID, total }) =>
    this.getUnspentCoinsByTokenIdV1({ tokenID, total, fromApi, version })
  );
  const start = new Date().getTime();
  let unspentCoins = await Promise.all(tasks);
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

  getUnspentCoinsByTokenIdV1,
  getUnspentCoinsV1,
};
