const PriKeyType = 0x0; // Serialize wallet account key into string with only PRIVATE KEY of account KeySet
const PaymentAddressType = 0x1; // Serialize wallet account key into string with only PAYMENT ADDRESS of account KeySet
const ReadonlyKeyType = 0x2; // Serialize wallet account key into string with only READONLY KEY of account KeySet

const PriKeySerializeSize = 71;
const PaymentAddrSerializeSize = 69;
const ReadonlyKeySerializeSize = 68;

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

const BurnAddress = "1NHp16Y29xjc1PoXb1qwr65BfVVoHZuCbtTkVyucRzbeydgQHs2wPu5PC1hD";

export  {
  PriKeyType,
  PaymentAddressType,
  ReadonlyKeyType,
  PriKeySerializeSize,
  PaymentAddrSerializeSize,
  ReadonlyKeySerializeSize,
  FailedTx,
  SuccessTx,
  ConfirmedTx,
  AmountStakingBeacon,
  MetaStakingBeacon,
  AmountStakingShard,
  MetaStakingShard,
  ShardStakingType,
  BeaconStakingType,
  BurnAddress,

};