import { PrivacyVersion, PRVIDSTR, Validator } from '@lib/wallet';
import { getBurningAddress } from '@lib/core';
import bn from 'bn.js';
import { pdexv3 } from '@lib/core/constants';
import { TX_TYPE } from '@lib/module/Account';
import uniq from 'lodash/uniq';

async function stakeCreateRequestTx({
  fee,
  info = "",
  tokenID,
  tokenAmount,
  nftID,
  version = PrivacyVersion.ver2,
}) {
  try {
    new Validator("createAndSendStakeRequestTx-fee", fee).required().amount();
    new Validator("createAndSendStakeRequestTx-info", info).required().string();
    new Validator("createAndSendStakeRequestTx-tokenID", tokenID).required().string();
    new Validator("createAndSendStakeRequestTx-tokenAmount", tokenAmount).required().amount();
    new Validator("createAndSendStakeRequestTx-nftID", nftID).required().string();
    new Validator("createAndSendStakeRequestTx-version", version).required().number();
    await this.account.updateProgressTx(10, 'Generating Metadata');
    const burningAddress = await getBurningAddress(this.rpc);
    let burningPayments = [{
      PaymentAddress: burningAddress,
      Amount: new bn(tokenAmount).toString(),
      Message: info
    }];
    let isToken = tokenID !== PRVIDSTR;
    // prepare meta data for tx
    const otaReceiver = await this.getOTAReceive();
    let metadata = {
      TokenID: tokenID,
      TokenAmount: tokenAmount,
      NftID: nftID,
      OtaReceiver: otaReceiver,
      Type: pdexv3.StakingRequestMeta,
    };
    let result;
    if (isToken) {
      result = await this.account.transact({
        transfer: { fee, info, tokenID, tokenPayments: burningPayments, prvPayments: [] },
        extra: { metadata, version, txType: TX_TYPE.STAKING_INVEST }
      });
    } else {
      result = await this.account.transact({
        transfer: { prvPayments: burningPayments, fee, info, tokenID },
        extra: { metadata, version, txType: TX_TYPE.STAKING_INVEST }
      });
    }
    if (result) {
      const { status, txId, tx } = result;
      const params = {
        isStaking: true,
        requestTx: txId,
        status,
        tokenId: tokenID,
        nftId: nftID,
        amount: tokenAmount,
        requestTime: isToken ? tx?.Tx.LockTime : tx?.LockTime
      }
      console.log('setStorageStakingTxs: ', params)
      await this.setStorageStakingTxs(params)
    }
    await this.account.updateProgressTx(100, 'Completed');
    return result;
  } catch (e) {
    throw e;
  }
}

async function stakeWithdrawRequestTx({
  fee,
  info = "",
  unstakingAmount,
  nftID,
  stakingTokenID,
  stakingPoolID,
  version = PrivacyVersion.ver2,
}) {
  try {
    new Validator("createAndSendStakeWithdrawRequestTx-fee", fee).required().amount();
    new Validator("createAndSendStakeWithdrawRequestTx-info", info).required().string();
    new Validator("createAndSendStakeWithdrawRequestTx-unstakingAmount", unstakingAmount).required().amount();
    new Validator("createAndSendStakeWithdrawRequestTx-stakingTokenID", stakingTokenID).required().string();
    new Validator("createAndSendStakeWithdrawRequestTx-stakingPoolID", stakingPoolID).required().string();
    new Validator("createAndSendStakeWithdrawRequestTx-nftID", nftID).required().string();
    new Validator("createAndSendStakeWithdrawRequestTx-version", version).required().number();
    await this.account.updateProgressTx(10, 'Generating Metadata');
    const burningAddress = await getBurningAddress(this.rpc);
    let burningPayments = [{
      PaymentAddress: burningAddress,
      Amount: new bn(1).toString(), // burn 1 of NFTID
      Message: info
    }];
    let receivingTokens = [stakingTokenID, nftID];
    let receiver = {};
    // create new OTAs
    for (const t of receivingTokens) {
      receiver[t] = await this.getOTAReceive();
    }
    // prepare meta data for tx
    let metadata = {
      StakingPoolID: stakingPoolID,
      UnstakingAmount: unstakingAmount,
      NftID: nftID,
      OtaReceivers: receiver,
      Type: pdexv3.UnstakingRequestMeta,
    };
    let result = await this.account.transact({
      transfer: { prvPayments: [], tokenPayments: burningPayments, fee, info, tokenID: nftID },
      extra: { metadata, version, txType: TX_TYPE.STAKING_WITHDRAW }
    });
    if (result) {
      const { status, txId, tx } = result;
      const params = {
        isStaking: false,
        requestTx: txId,
        status,
        tokenId: stakingTokenID,
        nftId: nftID,
        amount: unstakingAmount,
        requestTime: tx?.LockTime ? tx?.LockTime : tx?.Tx.LockTime,
      }
      console.log('setStorageStakingTxs: ', params)
      await this.setStorageStakingTxs(params)
    }
    await this.account.updateProgressTx(100, 'Completed');
    return result;
  } catch (e) {
    throw e;
  }
}

async function stakeWithdrawRewardRequestTx({
  fee,
  info = "",
  stakingTokenID,
  nftID,
  version = PrivacyVersion.ver2,
  receiveTokenIDs = []
}) {
  try {
    new Validator("createAndSendStakeWithdrawRewardRequestTx-fee", fee).required().amount();
    new Validator("createAndSendStakeWithdrawRewardRequestTx-info", info).required().string();
    new Validator("createAndSendStakeWithdrawRewardRequestTx-stakingTokenID", stakingTokenID).required().string();
    new Validator("createAndSendStakeWithdrawRewardRequestTx-nftID", nftID).required().string();
    new Validator("createAndSendStakeWithdrawRewardRequestTx-version", version).required().number();
    await this.account.updateProgressTx(10, 'Generating Metadata');
    let burningAddress = await getBurningAddress(this.rpc);
    let burningPayments = [{
      PaymentAddress: burningAddress,
      Amount: new bn(1).toString(), // burn 1 of NFTID
      Message: info
    }];
    let receivingTokens = uniq(receiveTokenIDs.concat([stakingTokenID, nftID]));
    let receiver = {};
    for (const t of receivingTokens) {
      receiver[t] = await this.getOTAReceive();
    }
    let metadata = {
      StakingPoolID: stakingTokenID,
      NftID: nftID,
      Receivers: receiver,
      Type: pdexv3.WithdrawStakingRewardRequestMeta,
    };
    let result = await this.account.transact({
      transfer: { prvPayments: [], tokenPayments: burningPayments, fee, info, tokenID: nftID },
      extra: { metadata, version, txType: TX_TYPE.STAKING_WITHDRAW_REWARD }
    });

    if (result) {
      const { status, txId, tx } = result;
      const params = {
        isStaking: undefined,
        requestTx: txId,
        status,
        tokenId: stakingTokenID,
        nftId: nftID,
        amount: 0,
        requestTime: tx?.LockTime ? tx?.LockTime : tx?.Tx.LockTime,
      }
      console.log('setStorageStakingTxs: ', params)
      await this.setStorageStakingTxs(params)
    }

    await this.account.updateProgressTx(100, 'Completed');
    return result;
  } catch (e) {
    throw e;
  }
}

export default ({
  stakeCreateRequestTx,
  stakeWithdrawRequestTx,
  stakeWithdrawRewardRequestTx,
})
