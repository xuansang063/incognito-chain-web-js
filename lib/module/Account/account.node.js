import bn from "bn.js";
import {
  ShardStakingType,
  StakingAmount,
  TX_TYPE,
} from "@lib/module/Account/account.constants";
import {
  getBurningAddress,
  KeyWallet,
  MetaStakingBeacon,
  MetaStakingShard,
  PRVIDSTR,
  StopAutoStakingMeta,
  WithDrawRewardRequestMeta,
} from "@lib/core";
import { checkDecode } from "@lib/common/base58";
import { generateCommitteeKeyFromHashPrivateKey } from "@lib/common/committeekey";
import Validator from "@lib/utils/validator";
import { addressAsObject } from "@lib/common/keySet";

// staking tx always send PRV to burning address with no privacy
// type: 0 for shard
// type: 1 for beacon
/**
 * @param {number} stakingType
 * @param {number} fee
 * @param {string} candidatePaymentAddress
 * @param {string} candidateMiningSeedKey
 * @param {string} rewardReceiverPaymentAddress
 * @param {bool} autoReStaking
 */
async function createAndSendStakingTx({
  transfer: { fee },
  extra: { autoReStaking = true, stakingType = ShardStakingType } = {},
}) {
  try {
    new Validator("fee", fee).required().amount();
    new Validator("autoReStaking", autoReStaking).boolean();
    new Validator("stakingType", stakingType).number();
    const info = await this.getDeserializeInformation();
    const { PaymentAddress, ValidatorKey } = info;
    const candidatePaymentAddress = PaymentAddress;
    const rewardReceiverPaymentAddress = PaymentAddress;
    const candidateMiningSeedKey = ValidatorKey;
    new Validator("candidatePaymentAddress", candidatePaymentAddress)
      .required()
      .string();
    new Validator("rewardReceiverPaymentAddress", rewardReceiverPaymentAddress)
      .required()
      .string();
    new Validator("candidateMiningSeedKey", candidateMiningSeedKey)
      .required()
      .string();
    await this.updateProgressTx(10, "Generating Metadata");
    // check fee
    if (fee < 0) {
      fee = 0;
    }
    // get amount staking
    let amountBN = new bn(StakingAmount);
    // generate committee key
    let candidateKeyWallet = KeyWallet.base58CheckDeserialize(
      candidatePaymentAddress
    );
    let publicKeyBytes = candidateKeyWallet.KeySet.PaymentAddress.Pk;
    let candidateHashPrivateKeyBytes = checkDecode(
      candidateMiningSeedKey
    ).bytesDecoded;
    let committeeKey;
    committeeKey = await generateCommitteeKeyFromHashPrivateKey(
      candidateHashPrivateKeyBytes,
      publicKeyBytes
    );
    let type =
      stakingType === ShardStakingType ? MetaStakingShard : MetaStakingBeacon;
    let meta = {
      Type: type,
      FunderPaymentAddress: PaymentAddress,
      RewardReceiverPaymentAddress: rewardReceiverPaymentAddress,
      StakingAmountShard: amountBN.toNumber(),
      CommitteePublicKey: committeeKey,
      AutoReStaking: autoReStaking,
    };
    let burningAddress = await getBurningAddress(this.rpc);
    let prvPayments = [
      {
        PaymentAddress: burningAddress,
        Amount: amountBN.toString(),
        Message: "",
      },
    ];
    let tx = await this.transact({
      transfer: { prvPayments, fee },
      extra: { metadata: meta, txType: TX_TYPE.STAKE_VNODE },
    });
    await this.saveTxHistory({
      tx,
    });
    await this.updateProgressTx(100, "Completed");
    return tx;
  } catch (error) {
    throw error;
  }
}

/**
 * @param {number} fee
 */
async function createAndSendStopAutoStakingTx({
  transfer: { fee },
  extra: {} = {},
}) {
  new Validator("fee", fee).required().amount();
  const info = await this.getDeserializeInformation();
  const { PaymentAddress, ValidatorKey } = info;
  const candidatePaymentAddress = PaymentAddress;
  const candidateMiningSeedKey = ValidatorKey;
  new Validator("candidatePaymentAddress", candidatePaymentAddress)
    .required()
    .string();
  new Validator("candidateMiningSeedKey", candidateMiningSeedKey)
    .required()
    .string();
  // check fee
  if (fee < 0) {
    fee = 0;
  }
  await this.updateProgressTx(10, "Generating Metadata");
  // generate committee key
  let candidateKeyWallet = KeyWallet.base58CheckDeserialize(
    candidatePaymentAddress
  );
  let publicKeyBytes = candidateKeyWallet.KeySet.PaymentAddress.Pk;
  let candidateHashPrivateKeyBytes = checkDecode(
    candidateMiningSeedKey
  ).bytesDecoded;
  const committeeKey = await generateCommitteeKeyFromHashPrivateKey(
    candidateHashPrivateKeyBytes,
    publicKeyBytes
  );
  let meta = {
    Type: StopAutoStakingMeta,
    CommitteePublicKey: committeeKey,
  };
  let burningAddress = await getBurningAddress(this.rpc);
  let prvPayments = [
    {
      PaymentAddress: burningAddress,
      Amount: "0",
      Message: "",
    },
  ];
  try {
    let tx = await this.transact({
      transfer: { prvPayments, fee },
      extra: { metadata: meta, txType: TX_TYPE.UNSTAKE_VNODE },
    });
    await this.saveTxHistory({
      tx,
    });
    await this.updateProgressTx(100, "Completed");
    return tx;
  } catch (e) {
    throw e;
  }
}

/**
 * @param {string} tokenID
 * @param {number} fee
 */
async function createAndSendWithdrawRewardTx({
  transfer: { fee, tokenID = PRVIDSTR } = {},
}) {
  new Validator("fee", fee).required().amount();
  new Validator("tokenID", tokenID).required().string();
  await this.updateProgressTx(10, "Generating Metadata");
  let metadata = {
    Type: WithDrawRewardRequestMeta,
    PaymentAddress: addressAsObject(this.key.KeySet.PaymentAddress),
    TokenID: tokenID,
    Version: 1,
  };
  console.log(metadata);
  try {
    let tx = await this.transact({
      transfer: { fee, tokenID, prvPayments: [] },
      extra: { metadata, txType: TX_TYPE.WITHDRAW_REWARD_TX },
    });
    await this.saveTxHistory({
      tx,
    });
    await this.updateProgressTx(100, "Completed");
    return tx;
  } catch (e) {
    throw e;
  }
}

export default {
  createAndSendStakingTx,
  createAndSendStopAutoStakingTx,
  createAndSendWithdrawRewardTx,
};
