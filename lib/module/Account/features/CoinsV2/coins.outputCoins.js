import Validator from "@lib/utils/validator";
import { pagination } from "@lib/module/Account/account.utils";
import { CustomError, ErrorObject } from "@lib/common/errorhandler";
import { LIMIT } from "@lib/module/Account/account.constants";
import uniqBy from "lodash/uniqBy";

async function getListOutputCoinsV2(params) {
  try {
    const { tokenID, total, version } = params;
    new Validator("getListOutputCoinsV2-tokenID", tokenID).required().string();
    new Validator("getListOutputCoinsV2-total", total).required().number();
    new Validator(`getListOutputCoinsV2-version`, version).required().number();
    const otaKey = this.getOTAKey();
    let listOutputsCoins = [];
    const oldTotal = await this.getTotalCoinsStorage(params); //
    const key = this.getKeyParamOfCoins({ key: otaKey, version });
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
            offset: times * LIMIT + oldTotal,
            version,
          })
        );
      }
      const result = await Promise.all(task);
      listOutputsCoins = result.reduce((prev, curr, index) => {
        const result = [...prev, ...[...curr]];
        return result;
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
    this.coinsStorage.totalCoinsSize = listOutputsCoins.length;
    listOutputsCoins = uniqBy(listOutputsCoins, "PublicKey");
    return listOutputsCoins;
  } catch (e) {
    throw new CustomError(
      ErrorObject.GetOutputCoinsErr,
      e.message || `Can not get output coins when get unspent token ${tokenID}`,
      e
    );
  }
}

export default {
  getListOutputCoinsV2,
};
