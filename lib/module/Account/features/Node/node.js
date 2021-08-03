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
  UnStakingMeta,
  WithDrawRewardRequestMeta,
} from "@lib/core";
import { checkDecode } from "@lib/common/base58";
import { generateCommitteeKeyFromHashPrivateKey } from "@lib/common/committeekey";
import Validator from "@lib/utils/validator";
import { addressAsObject } from "@lib/common/keySet";

// staking tx always send PRV to burning address with no privacy
// type: 0 for shard
// type: 1 for beacon
/** createAndSendStakingTx
 * @param {number} stakingType
 * @param {number} fee
 * @param {string} candidatePaymentAddress
 * @param {string} candidateMiningSeedKey
 * @param {string} rewardReceiverPaymentAddress
 * @param {bool} autoReStaking
 */
async function createAndSendStakingTx({
  transfer: { fee },
  extra: { autoReStaking = true, stakingType = ShardStakingType, version } = {},
}) {
  try {
    new Validator("createAndSendStakingTx-fee", fee).required().amount();
    new Validator(
      "createAndSendStakingTx-autoReStaking",
      autoReStaking
    ).boolean();
    new Validator("createAndSendStakingTx-stakingType", stakingType).number();
    const info = await this.getDeserializeInformation();
    const { PaymentAddress, ValidatorKey } = info;
    const candidatePaymentAddress = PaymentAddress;
    const rewardReceiverPaymentAddress = PaymentAddress;
    const candidateMiningSeedKey = ValidatorKey;
    new Validator(
      "createAndSendStakingTx-candidatePaymentAddress",
      candidatePaymentAddress
    )
      .required()
      .string();
    new Validator(
      "createAndSendStakingTx-rewardReceiverPaymentAddress",
      rewardReceiverPaymentAddress
    )
      .required()
      .string();
    new Validator(
      "createAndSendStakingTx-candidateMiningSeedKey",
      candidateMiningSeedKey
    )
      .required()
      .string();
    new Validator("createAndSendStakingTx-version", version)
      .required()
      .number();
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
    const tx = await this.transact({
      transfer: { prvPayments, fee },
      extra: { metadata: meta, txType: TX_TYPE.STAKE_VNODE, version },
    });
    await this.updateProgressTx(100, "Completed");
    return tx;
  } catch (error) {
    throw error;
  }
}

/** createAndSendStopAutoStakingTx
 * @param {number} fee
 */
async function createAndSendStopAutoStakingTx({
  transfer: { fee },
  extra: { version } = {},
}) {
  new Validator("createAndSendStopAutoStakingTx-fee", fee).required().amount();
  new Validator("createAndSendStopAutoStakingTx-version", version)
    .required()
    .number();
  const info = await this.getDeserializeInformation();
  const { PaymentAddress, ValidatorKey } = info;
  const candidatePaymentAddress = PaymentAddress;
  const candidateMiningSeedKey = ValidatorKey;
  new Validator(
    "createAndSendStopAutoStakingTx-candidatePaymentAddress",
    candidatePaymentAddress
  )
    .required()
    .string();
  new Validator(
    "createAndSendStopAutoStakingTx-candidateMiningSeedKey",
    candidateMiningSeedKey
  )
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
    Type: UnStakingMeta,
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
    const tx = await this.transact({
      transfer: { prvPayments, fee },
      extra: { metadata: meta, txType: TX_TYPE.UNSTAKE_VNODE, version },
    });
    await this.updateProgressTx(100, "Completed");
    return tx;
  } catch (e) {
    throw e;
  }
}

/** createAndSendWithdrawRewardTx
 * @param {string} tokenID
 * @param {number} fee
 * @param {number} version
 */
async function createAndSendWithdrawRewardTx({
  transfer: { fee, tokenID = PRVIDSTR } = {},
  extra: { version } = {},
}) {
  new Validator("createAndSendWithdrawRewardTx-fee", fee).required().amount();
  new Validator("createAndSendWithdrawRewardTx-tokenID", tokenID)
    .required()
    .string();
  new Validator("createAndSendWithdrawRewardTx-version", version)
    .required()
    .number();
  await this.updateProgressTx(10, "Generating Metadata");
  let metadata = {
    Type: WithDrawRewardRequestMeta,
    PaymentAddress: addressAsObject(this.key.KeySet.PaymentAddress),
    TokenID: tokenID,
    Version: 1,
  };
  try {
    const tx = await this.transact({
      transfer: { fee, tokenID, prvPayments: [] },
      extra: { metadata, txType: TX_TYPE.WITHDRAW_REWARD_TX, version },
    });
    await this.updateProgressTx(100, "Completed");
    return tx;
  } catch (e) {
    throw e;
  }
}

// unstake TODO: //

export default {
  createAndSendStakingTx,
  createAndSendStopAutoStakingTx,
  createAndSendWithdrawRewardTx,
};
