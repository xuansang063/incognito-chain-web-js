import { camelCaseKeys } from '@lib/utils/camelCaseKeys';

function getProvideData() {
  return [
    {
      ID:98,
      CreatedAt: '2021-04-18T17:24:45Z',
      StakerID: 74,
      TokenID: "0000000000000000000000000000000000000000000000000000000000000004",
      Balance:17375000000,
      RewardBalance:437920363,
      RewardRate:24.65,
      PendingBalance:0,
      UnstakePendingBalance:1000,
      WithdrawPendingBalance:10,
      Status: 1
    }
  ].map(item => camelCaseKeys(item))
}

export default ({
  getProvideData
})
