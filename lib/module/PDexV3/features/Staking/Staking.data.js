import { camelCaseKeys } from '@lib/utils/camelCaseKeys';

function getStakingData() {
  return [
    {
      ID:98,
      TokenID: "0000000000000000000000000000000000000000000000000000000000000004",
      Balance:17375000000,
      RewardBalance:437920363,
      Status: 1
    }
  ].map(item => camelCaseKeys(item))
}

export default ({
  getStakingData
})
