const PriKeyType = 0x0; // Serialize wallet account key into string with only PRIVATE KEY of account KeySet
const PaymentAddressType = 0x1; // Serialize wallet account key into string with only PAYMENT ADDRESS of account KeySet
const ReadonlyKeyType = 0x2; // Serialize wallet account key into string with only READONLY KEY of account KeySet
const PublicKeyType = 0x3; // Serialize wallet account key into string with only READONLY KEY of account KeySet

const PriKeySerializeSize = 71;
const PaymentAddrSerializeSize = 67;
const ReadonlyKeySerializeSize = 67;
const PublicKeySerializeSize = 34;

const FailedTx = 0;
const SuccessTx = 1;
const ConfirmedTx = 2;

// for staking tx
// amount in mili constant
const AmountStakingBeacon = 2;
const MetaStakingBeacon = 64;
const AmountStakingShard = 1;
const MetaStakingShard = 63;

const ShardStakingType = 0;
const BeaconStakingType = 1;

const MaxTxSize = 100;    // in kb

const ChildNumberSize = 4;
const ChainCodeSize = 32;
const PrivacyUnit = 1e9;
const NanoUnit = 1e-9;

const PercentFeeToCancelTx = 0.1;

const BurnAddress =
  "15pABFiJVeh9D5uiQEhQX4SVibGGbdAVipQxBdxkmDqAJaoG1EdFKHBrNfs";

const BurningRequestMeta = 27;
const WithDrawRewardRequestMeta    = 44;

const PRVID = [4];

const NoStakeStatus = -1;
const CandidatorStatus = 0;
const ValidatorStatus = 1;


export {
  PriKeyType,
  PaymentAddressType,
  ReadonlyKeyType,
  PublicKeyType,
  PriKeySerializeSize,
  PaymentAddrSerializeSize,
  ReadonlyKeySerializeSize,
  PublicKeySerializeSize,
  FailedTx,
  SuccessTx,
  ConfirmedTx,
  AmountStakingBeacon,
  MetaStakingBeacon,
  AmountStakingShard,
  MetaStakingShard,
  ShardStakingType,
  BeaconStakingType,
  MaxTxSize,
  ChildNumberSize,
  ChainCodeSize,
  PercentFeeToCancelTx,
  PrivacyUnit,
  NanoUnit,
  BurnAddress,
  BurningRequestMeta,
  WithDrawRewardRequestMeta,
  PRVID,
  NoStakeStatus,
  CandidatorStatus,
  ValidatorStatus,
};
