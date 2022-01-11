export const TX_STAKING_TYPE = {
  STAKING: 0,
  WITHDRAW_STAKING: 1,
  WITHDRAW_REWARD: 2,
}

export const TX_STAKING_TYPE_STR = {
  [TX_STAKING_TYPE.STAKING]: "Staking",
  [TX_STAKING_TYPE.WITHDRAW_STAKING]: "Un-stake",
  [TX_STAKING_TYPE.WITHDRAW_REWARD]: "Withdraw",
}

export const TX_STAKING_STATUS = {
  TXSTATUS_PENDING: 0,
  TXSTATUS_SUCCESS: 1,
  TXSTATUS_FAILED: 2,
};

export const TX_STAKING_STATUS_STR = {
  [TX_STAKING_STATUS.TXSTATUS_PENDING]: "Pending",
  [TX_STAKING_STATUS.TXSTATUS_SUCCESS]: "Completed",
  [TX_STAKING_STATUS.TXSTATUS_FAILED]: "Failed",
};

export const STORAGE_KEYS = {
  STAKING: '[staking] stake',
  UN_STAKE: '[staking] un stake',
  WITHDRAW_REWARD: '[staking] withdraw reward'
};
