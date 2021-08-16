import { cachePromise } from "@lib/module/Account/features/Cache/cache";
import { camelCaseKeys } from "@lib/utils/camelCaseKeys";
import Validator from "@lib/utils/validator";
import orderLimitPrototype from "./orderLimit";
import swapPrototype from "./swap";

async function getListState() {
  let list = [];
  try {
    let res = await cachePromise("LIST_STATE", () =>
      this.rpcTradeService.apiGetListState()
    );
    res = res[0];
    list = Object.keys(res).map((key) => ({
      ...camelCaseKeys(res[key]),
      poolid: key,
    }));
  } catch (error) {
    throw error;
  }
  return list;
}

async function getEstimateTrade(params) {
  try {
    const { selltoken, buytoken, amount, feetoken, poolid } = params;
    new Validator("getEstimateTrade-selltoken", selltoken).required().string();
    new Validator("getEstimateTrade-buytoken", buytoken).required().string();
    new Validator("getEstimateTrade-amount", amount).required().number();
    new Validator("getEstimateTrade-feetoken", feetoken).required().string();
    new Validator("getEstimateTrade-poolid", poolid).string();
    new Validator(
      "getEstimateTrade-slippagetolerance",
      slippagetolerance
    ).number();
    new Validator("getEstimateTrade-rate", rate).number();
    const res = await this.rpcTradeService.apiEstimateTrade(params);
    return camelCaseKeys(res);
  } catch (error) {
    throw error;
  }
}

export default {
  getListState,
  getEstimateTrade,
  ...swapPrototype,
  ...orderLimitPrototype,
};
