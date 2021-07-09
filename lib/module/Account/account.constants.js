import {
  STATUS_CODE_SHIELD_DECENTRALIZED,
  STATUS_CODE_SHIELD_CENTRALIZED,
  STATUS_CODE_UNSHIELD_DECENTRALIZED,
  STATUS_CODE_UNSHIELD_CENTRALIZED,
  ADDRESS_TYPE,
} from "@lib/module/Account/features/History/history.constant";

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
  BURN: 7,
  RECEIVE: 8,
  CONVERT: 9,
  ADD_LIQUIDITY: 10,
  WITHDRAW_LIQUIDITY: 11,
  WITHDRAW_LIQUIDITY_FEE: 12,
  CONSOLIDATE: 13,
  SHIELD: 99,
  UNSHIELD: 100,
  UNSHIELDPORTAL: 101,
};

export const TX_TYPE_STR = {
  [TX_TYPE.SEND]: "Send",
  [TX_TYPE.TRADE]: "Send",
  [TX_TYPE.PROVIDE]: "Send",
  [TX_TYPE.STAKE_VNODE]: "Send",
  [TX_TYPE.UNSTAKE_VNODE]: "Send",
  [TX_TYPE.WITHDRAW_REWARD_TX]: "Send",
  [TX_TYPE.INIT_TOKEN]: "Send",
  [TX_TYPE.BURN]: "Send",
  [TX_TYPE.RECEIVE]: "Receive",
  [TX_TYPE.CONVERT]: "Convert",
  [TX_TYPE.SHIELD]: "Shield",
  [TX_TYPE.UNSHIELD]: "Unshield",
  [TX_TYPE.UNSHIELDPORTAL]: "Unshield",
  [TX_TYPE.CONSOLIDATE]: "Consolidate",
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
  [TX_STATUS.PROCESSING]: "Proccessing",
  [TX_STATUS.TXSTATUS_UNKNOWN]: "Unknown",
  [TX_STATUS.TXSTATUS_FAILED]: "Failed",
  [TX_STATUS.TXSTATUS_PENDING]: "Pending",
  [TX_STATUS.TXSTATUS_SUCCESS]: "Success",
};

export const AIRDROP_STATUS = {
  FAIL: 0,
  SUCCESS: 1,
};

export const TIME_COUNT_BALANCE = 20;
export const MAX_COUNT_BALANCE = 8;

export const META_TYPE = {
  63: "Staking",
  127: "Stop Staking",
  210: "Unstaking",
  41: "Return Staking",
  44: "Withdraw Reward Request",
  45: "Withdraw Reward Response",
  244: "Init Token Request",
  245: "Init Token Response",
  90: "Add Liquidity Request",
  95: "Add Liquidity Response",
  91: "Trade Request",
  92: "Trade Response",
  93: "Remove Liquidity Request",
  94: "Remove Liquidity Response",
  205: "Cross Trade Request",
  206: "Cross Trade Response",
  207: "Withdraw Fee Request",
  208: "Withdraw Fee Response",
  209: "Trading Fee Distribution",
  204: "Add Liquidity Request",
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
  AIRDROP_STATUS,
  TIME_COUNT_BALANCE,
  MAX_COUNT_BALANCE,
  STATUS_CODE_SHIELD_DECENTRALIZED,
  STATUS_CODE_SHIELD_CENTRALIZED,
  STATUS_CODE_UNSHIELD_DECENTRALIZED,
  STATUS_CODE_UNSHIELD_CENTRALIZED,
  ADDRESS_TYPE,
};
