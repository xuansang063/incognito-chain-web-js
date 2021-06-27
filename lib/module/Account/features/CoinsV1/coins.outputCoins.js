import Validator from '@lib/utils/validator';
import { PrivacyVersion } from '@lib/core/constants';
import { LIMIT } from '@lib/module/Account/account.constants';
import { pagination } from '@lib/module/Account/account.utils';
import { uniqBy } from 'lodash';
import { CustomError, ErrorObject } from '@lib/common/errorhandler';

async function getOutputCoinsV1({ tokenID, total, version }) {
  new Validator('getOutputCoinsV1-tokenID', tokenID).required().string()
  new Validator('getOutputCoinsV1-total', total).required().number()
  new Validator('getOutputCoinsV1-version', version).required().number()

  let listOutputsCoins = [];
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
        const offset = index * LIMIT;
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
        offset: 0,
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

export default {
  getOutputCoinsV1,
}
