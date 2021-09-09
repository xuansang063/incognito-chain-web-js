import Validator from '@lib/utils/validator';
import { PRVIDSTR } from '@lib/core';
import { PrivacyVersion } from '@lib/core/constants';
import { TX_TYPE } from '@lib/module/Account/account.constants';
import { flatten, uniqBy } from 'lodash';
import { LIMIT_DEFAULT } from '@lib/module/PDexV3/features/Liquidity/liquidity.constant';

async function getWithdrawRewardHistories({ offset = 0, limit = LIMIT_DEFAULT } = {}) {
  new Validator("getWithdrawRewardHistories-offset", offset).required().number();
  new Validator("getWithdrawRewardHistories-limit", limit).required().number();
  const account = this.getAccount()

  const tasks = [
    await this.getLiquidityWithdrawFeeHistoriesApi({ offset, limit }),
    await account.getTransactorHistoriesByTokenID({ tokenID: PRVIDSTR, version: PrivacyVersion.ver2 })
  ];
  const [apiHistories, storageHistories] = await Promise.all(tasks)

  let spendingStorage = (storageHistories || []).filter(history => {
    const isExist = apiHistories.some(apiHistory => apiHistory?.requestTx === history?.txId);
    const isWithdraw = history?.txType === TX_TYPE.WITHDRAW_LIQUIDITY_FEE;
    return !isExist && isWithdraw;
  });


  const tasksStorage = spendingStorage.map(async (history) => {
    const { metadata, txId, lockTime } = history;
    const status = await account.rpcTxService.apiGetTxStatus({ txId });
    const { WithdrawalFeeAmt: amount, WithdrawalToken1IDStr: tokenId1, WithdrawalToken2IDStr: tokenId2 } = metadata;
    return {
      id: txId,
      requestTx: txId,
      amount,
      tokenId1,
      tokenId2,
      status,
      lockTime,
    }
  })
  spendingStorage = flatten(await Promise.all(tasksStorage))
  return this.mapperStatus({
    histories: uniqBy(apiHistories.concat(spendingStorage), 'id')
  })
}

export default ({
  getWithdrawRewardHistories
})
