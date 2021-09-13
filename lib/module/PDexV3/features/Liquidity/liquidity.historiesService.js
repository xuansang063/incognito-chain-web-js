import Validator from '@lib/utils/validator';
import { LIMIT_DEFAULT } from '@lib/module/PDexV3/features/Liquidity/liquidity.constant';


async function getContributeHistoriesApi({ offset = 0, limit = LIMIT_DEFAULT } = {}) {
  const address = this.getPaymentKey()
  new Validator("getContributeHistoriesApi-offset", offset).required().number();
  new Validator("getContributeHistoriesApi-limit", limit).number();
  new Validator("getContributeHistoriesApi-address", address).required().string();
  return this.rpcCoinService.apiGetContributeHistories({
    offset,
    limit,
    paymentAddress: address
  });
}

async function getLiquidityRemoveHistoriesApi({ offset = 0, limit = LIMIT_DEFAULT } = {}) {
  const address = this.getPaymentKey()
  new Validator("getLiquidityRemoveHistoriesApi-offset", offset).required().number();
  new Validator("getLiquidityRemoveHistoriesApi-limit", limit).number();
  new Validator("getLiquidityRemoveHistoriesApi-address", address).required().string();
  return this.rpcCoinService.apiGetLiquidityRemoveHistories({
    offset,
    limit,
    paymentAddress: address,
  });
}

async function getLiquidityWithdrawFeeHistoriesApi({ offset = 0, limit = LIMIT_DEFAULT } = {}) {
  const address = this.getPaymentKey()
  new Validator("getLiquidityWithdrawFeeHistoriesApi-offset", offset).required().number();
  new Validator("getLiquidityWithdrawFeeHistoriesApi-limit", limit).number();
  new Validator("getLiquidityWithdrawFeeHistoriesApi-address", address).required().string();
  return this.rpcCoinService.apiGetLiquidityWithdrawFeeHistories({
    offset,
    limit,
    paymentAddress: address
  });
}

export default {
  getContributeHistoriesApi,
  getLiquidityRemoveHistoriesApi,
  getLiquidityWithdrawFeeHistoriesApi,
};

