import { PrivacyVersion, PRVIDSTR, Validator } from '@lib/wallet';
import { getBurningAddress, PDEX_ACCESS_ID } from '@lib/core';
import bn from 'bn.js';
import { pdexv3 } from '@lib/core/constants';
import { TX_TYPE } from '@lib/module/Account';
import uniq from 'lodash/uniq';
import { AccessTicketChooser } from "@lib/services/coinChooser";

async function stakeCreateRequestTx({
  fee,
  info = "",
  tokenID,
  tokenAmount,
  // nftID,
  version = PrivacyVersion.ver2,
}) {
  try {
    new Validator("createAndSendStakeRequestTx-fee", fee).required().amount();
    new Validator("createAndSendStakeRequestTx-info", info).required().string();
    new Validator("createAndSendStakeRequestTx-tokenID", tokenID).required().string();
    new Validator("createAndSendStakeRequestTx-tokenAmount", tokenAmount).required().amount();
    // nftID is deprecated
    // new Validator("createAndSendStakeRequestTx-nftID", nftID).required().string();
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
    let otaReceivers = {};
    for (const id of [tokenID, PDEX_ACCESS_ID]) otaReceivers[id] = await this.getOTAReceive();
    let metadata = {
      TokenID: tokenID,
      TokenAmount: tokenAmount,
      // NftID: nftID,
      OtaReceivers: otaReceivers,
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
        // nftId: nftID,
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
  // nftID,
  burnOTA,
  accessID,
  stakingPoolID,
  version = PrivacyVersion.ver2,
}) {
  try {
    new Validator("createAndSendStakeWithdrawRequestTx-fee", fee).required().amount();
    new Validator("createAndSendStakeWithdrawRequestTx-info", info).required().string();
    new Validator("createAndSendStakeWithdrawRequestTx-unstakingAmount", unstakingAmount).required().amount();
    new Validator("createAndSendStakeWithdrawRequestTx-stakingPoolID", stakingPoolID).required().string();
    // nftID is deprecated
    // new Validator("createAndSendStakeWithdrawRequestTx-nftID", nftID).required().string();
    new Validator("createAndSendStakeWithdrawRequestTx-version", version).required().number();
    new Validator("createAndSendStakeWithdrawRequestTx-burnOTA", burnOTA).required().string();
    new Validator("createAndSendStakeWithdrawRequestTx-accessID", accessID).required().string();
    await this.account.updateProgressTx(10, 'Generating Metadata');
    const burningAddress = await getBurningAddress(this.rpc);
    let burningPayments = [{
      PaymentAddress: burningAddress,
      Amount: new bn(1).toString(), // burn 1 access token
      Message: info
    }];
    let receivingTokens = [PDEX_ACCESS_ID, stakingPoolID];
    let receiver = {};
    // create new OTAs
    for (const t of receivingTokens) {
      receiver[t] = await this.getOTAReceive();
    }
    // prepare meta data for tx
    let metadata = {
      StakingPoolID: stakingPoolID,
      UnstakingAmount: unstakingAmount,
      // NftID: nftID,
      BurntOTA: burnOTA,
      AccessID: accessID,
      OtaReceivers: receiver,
      Type: pdexv3.UnstakingRequestMeta,
    };
    let result = await this.account.transact({
      transfer: { prvPayments: [], tokenPayments: burningPayments, fee, info, tokenID: PDEX_ACCESS_ID, tokenCoinChooser: new AccessTicketChooser(burnOTA), tokenCoinForRingCount: 0 },
      extra: { metadata, version, txType: TX_TYPE.STAKING_WITHDRAW }
    });
    if (result) {
      const { status, txId, tx } = result;
      const params = {
        isStaking: false,
        requestTx: txId,
        status,
        tokenId: stakingPoolID,
        // nftId: nftID,
        burnOTA,
        accessID,
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
  // nftID,
  burnOTA,
  accessID,
  version = PrivacyVersion.ver2,
  receiveTokenIDs = []
}) {
  try {
    new Validator("createAndSendStakeWithdrawRewardRequestTx-fee", fee).required().amount();
    new Validator("createAndSendStakeWithdrawRewardRequestTx-info", info).required().string();
    new Validator("createAndSendStakeWithdrawRewardRequestTx-stakingTokenID", stakingTokenID).required().string();
    // nftID is deprecated
    // new Validator("createAndSendStakeWithdrawRewardRequestTx-nftID", nftID).required().string();
    new Validator("createAndSendStakeWithdrawRewardRequestTx-version", version).required().number();
    new Validator("createAndSendStakeWithdrawRewardRequestTx-burnOTA", burnOTA).required().string();
    new Validator("createAndSendStakeWithdrawRewardRequestTx-accessID", accessID).required().string();
    await this.account.updateProgressTx(10, 'Generating Metadata');
    let burningAddress = await getBurningAddress(this.rpc);
    let burningPayments = [{
      PaymentAddress: burningAddress,
      Amount: new bn(1).toString(), // burn 1 access token
      Message: info
    }];
    let receivingTokens = uniq(receiveTokenIDs.concat([stakingTokenID, PDEX_ACCESS_ID]));
    let receiver = {};
    for (const t of receivingTokens) {
      receiver[t] = await this.getOTAReceive();
    }
    let metadata = {
      StakingPoolID: stakingTokenID,
      // NftID: nftID,
      BurntOTA: burnOTA,
      AccessID: accessID,
      Receivers: receiver,
      Type: pdexv3.WithdrawStakingRewardRequestMeta,
    };
    let result = await this.account.transact({
      transfer: { prvPayments: [], tokenPayments: burningPayments, fee, info, tokenID: PDEX_ACCESS_ID, tokenCoinChooser: new AccessTicketChooser(burnOTA), tokenCoinForRingCount: 0 },
      extra: { metadata, version, txType: TX_TYPE.STAKING_WITHDRAW_REWARD }
    });

    if (result) {
      const { status, txId, tx } = result;
      const params = {
        isStaking: undefined,
        requestTx: txId,
        status,
        tokenId: stakingTokenID,
        // nftId: nftID,
        burnOTA,
        accessID,
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
