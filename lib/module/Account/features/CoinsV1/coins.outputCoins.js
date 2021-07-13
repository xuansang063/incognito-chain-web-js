import Validator from '@lib/utils/validator';
import { PrivacyVersion } from '@lib/core/constants';
import { LIMIT } from '@lib/module/Account/account.constants';
import { pagination } from '@lib/module/Account/account.utils';
import { uniqBy } from 'lodash';
import { CustomError, ErrorObject } from '@lib/common/errorhandler';

async function getListOutputCoinsV1({ tokenID, total, version }) {
  new Validator('getListOutputCoinsV1-tokenID', tokenID).required().string()
  new Validator('getListOutputCoinsV1-total', total).required().number()
  new Validator('getListOutputCoinsV1-version', version).required().number()

  let listOutputsCoins = [];
  const oldTotal = await this.getTotalCoinsStorage({ tokenID, total, version });
  try {
    const viewKey = this.getReadonlyKey();
    const version = PrivacyVersion.ver1;
    const key = this.getKeyParamOfCoins({
      key: viewKey,
      version
    });
    console.debug("Get output coins key: ", key);
    if (total > LIMIT) {
      const { times, remainder } = pagination(total);
      const task = [...Array(times)].map((item, index) => {
        const limit = LIMIT;
        const offset = index * LIMIT + oldTotal;
        return this.rpcCoinService.apiGetListOutputCoins({
          key,
          tokenID,
          limit,
          offset,
          version,
        });
      });
      if (remainder > 0) {
        task.push(
          this.rpcCoinService.apiGetListOutputCoins({
            key,
            tokenID,
            limit: LIMIT,
            offset: times * LIMIT,
            version,
          })
        );
      }
      const result = await Promise.all(task);
      listOutputsCoins = result.reduce((prev, curr, index) => {
        return [...prev, ...[...curr]];
      }, []);
    } else {
      listOutputsCoins = await this.rpcCoinService.apiGetListOutputCoins({
        key,
        limit: total,
        offset: oldTotal,
        tokenID,
        version,
      });
    }
    listOutputsCoins = uniqBy(listOutputsCoins, "SNDerivator");
  } catch (e) {
    throw new CustomError(
      ErrorObject.GetOutputCoinsErr,
      e.message ||
      `Can not get output coins v1 when get unspent token ${tokenID}`,
      e
    );
  }
  return listOutputsCoins;
}

async function removeStorageCoinsV1ByTokenID(params) {
  const { tokenID, version } = params
  new Validator('tokenID', tokenID).required().string();
  new Validator('version', version).required().number();
  /** unspent coins */
  const keyUnspentCoins = this.getKeyListUnspentCoinsByTokenId(params);
  const keyTotalKeyInfo = this.getKeyTotalCoinsStorageByTokenId(params);
  const keySpendCoins = this.getKeyListSpentCoinsByTokenId(params);
  const keyAirdropCoinVer2 = this.getKeyFlagRequestAirdrop();
  const keySpendingCoins = this.getKeySpendingCoinsStorageByTokenId(params);

  const tasks = [
    await this.clearAccountStorage(keyUnspentCoins),
    await this.clearAccountStorage(keyTotalKeyInfo),
    await this.clearAccountStorage(keySpendCoins),
    await this.clearAccountStorage(keyAirdropCoinVer2),
    await this.clearAccountStorage(keySpendingCoins),
  ];
  await Promise.all(tasks)
}

async function removeStorageCoinsV1() {
  const version = PrivacyVersion.ver1;
  const keyInfo = (await this.getKeyInfoV1()) || [];
  const tasks = keyInfo.map(({ tokenID }) => {
    return this.removeStorageCoinsV1ByTokenID({ tokenID, version })
  })
  await Promise.all(tasks)
}

export default {
  getListOutputCoinsV1,
  removeStorageCoinsV1ByTokenID,
  removeStorageCoinsV1,
}
