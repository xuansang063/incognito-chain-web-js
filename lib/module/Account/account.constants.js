const TxNormalType = "n"; // normal tx(send and receive coin)
const TxSalaryType = "s"; // salary tx(gov pay salary for block producer)
const TxCustomTokenType = "t"; // token  tx with no supporting privacy
const TxCustomTokenPrivacyType = "tp"; // token  tx with supporting privacy

const CustomTokenInit = 0;
const CustomTokenTransfer = 1;
const TxVersion = 1;

export const TX_TYPE = {
  SEND: 0,
  TRADE: 1,
  PROVIDE: 2,
  STAKE_VNODE: 3,
  UNSTAKE_VNODE: 4,
  WITHDRAW_REWARD_TX: 5,
  INIT_TOKEN: 6,
  BURN_DECENTRALIZED: 7,
  RECEIVE: 8,
};

export const TX_TYPE_STR = {
  0: "Send",
  1: "Send",
  2: "Send",
  3: "Send",
  4: "Send",
  5: "Send",
  6: "Send",
  7: "Send",
  8: "Receive",
};

// todo: 0xkraken
// NumUTXO must be 255
// because tx zise is exceed 100kb with NumUTXO = 255
export const MaxInputNumberForDefragment = 30;
const MAX_DEFRAGMENT_TXS = 30;
export const MAX_INPUT_PER_TX = 30;
const DEFAULT_INPUT_PER_TX = 20;
const MaxInfoSize = 512;

export const ShardStakingType = 0;
export const BeaconStakingType = 1;
export const StakingAmount = 1750e9;

export const MAX_FEE_PER_TX = 100;

export const LIMIT = 100;

export const TX_STATUS = {
  PROCESSING: -1,
  TXSTATUS_UNKNOWN: 0,
  TXSTATUS_FAILED: 1,
  TXSTATUS_PENDING: 2,
  TXSTATUS_SUCCESS: 3,
};

export const TX_STATUS_STR = {
  "-1": "Proccessing",
  0: "Unknown",
  1: "Failed",
  2: "Pending",
  3: "Success",
};

export default {
  TxNormalType,
  TxSalaryType,
  TxCustomTokenType,
  TxCustomTokenPrivacyType,
  CustomTokenInit,
  CustomTokenTransfer,
  TxVersion,
  MaxInputNumberForDefragment,
  MaxInfoSize,
  MAX_INPUT_PER_TX,
  MAX_DEFRAGMENT_TXS,
  DEFAULT_INPUT_PER_TX,
  ShardStakingType,
  BeaconStakingType,
  StakingAmount,
  TX_TYPE,
  TX_TYPE_STR,
  TX_STATUS_STR,
  TX_STATUS,
};
