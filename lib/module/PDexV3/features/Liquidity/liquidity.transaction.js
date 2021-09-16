import { PaymentAddressType, Validator } from '@lib/wallet';
import { getBurningAddress, PRVIDSTR } from '@lib/core';
import bn from 'bn.js';
import { pdexv3 } from '@lib/core/constants';
import { TX_TYPE } from '@lib/module/Account';

async function createAndSendContributeRequestTx(params) {
  try {
    const {
      transfer: { fee, info = "", tokenID },
      extra: {
        pairID = "",
        pairHash,
        contributedAmount,
        nftID = "",
        amplifier,
        version
      },
    } = params;
    new Validator("createAndSendContributeRequestTx-tokenID", tokenID).required().string();
    new Validator("createAndSendContributeRequestTx-fee", fee).required().amount();
    new Validator("createAndSendContributeRequestTx-info", info).string();
    new Validator("createAndSendContributeRequestTx-pairID", pairID).string();
    new Validator("createAndSendContributeRequestTx-pairHash", pairHash).required().string();
    new Validator("createAndSendContributeRequestTx-contributedAmount", contributedAmount).required().amount();
    new Validator("createAndSendContributeRequestTx-nftID", nftID).required().string();
    new Validator("createAndSendContributeRequestTx-amplifier", amplifier).required().number();
    new Validator("createAndSendContributeRequestTx-version", version).required().number();
    await this.account?.updateProgressTx(10, "Generating Metadata");
    let burningAddress = await getBurningAddress(this.rpc);
    let burningPayments = [{
      PaymentAddress: burningAddress,
      Amount: new bn(contributedAmount).toString(),
      Message: info
    }];
    let isToken = tokenID !== PRVIDSTR;
    const otaReceiver = await this.getOTAReceive();
    let metadata = {
      PoolPairID: pairID,
      PairHash: pairHash,
      TokenAmount: contributedAmount,
      TokenID: tokenID,
      NftID: nftID,
      Amplifier: amplifier,
      OtaReceiver: otaReceiver,
      Type: pdexv3.AddLiquidityRequestMeta,
    };
    let result;
    if (isToken) {
      result = await this.account?.transact({
        transfer: {
          fee,
          info,
          tokenID,
          prvPayments: [],
          tokenPayments:
          burningPayments
        }, extra: { metadata, version, txType: TX_TYPE.CONTRIBUTE }
      });
    } else {
      result = await this.account?.transact({
        transfer: {
          fee,
          info,
          tokenID,
          prvPayments: burningPayments
        }, extra: { metadata, version, txType: TX_TYPE.CONTRIBUTE }
      });
    }
    await this.account?.updateProgressTx(100, "Completed");
    return result;
  } catch (e) {
    throw e;
  }
}
async function createAndSendWithdrawContributeRequestTx(params) {
  try {
    const {
      transfer: { fee, info = "" },
      extra: { poolTokenIDs, poolPairID, shareAmount, nftID, version }
    } = params
    new Validator("createAndSendContributeRequestTx-info", info).required().string();
    new Validator("createAndSendContributeRequestTx-fee", fee).required().amount();
    new Validator("createAndSendContributeRequestTx-poolTokenIDs", poolTokenIDs).required().array();
    new Validator("createAndSendContributeRequestTx-poolPairID", poolPairID).required().string();
    new Validator("createAndSendContributeRequestTx-shareAmount", shareAmount).required().amount();
    new Validator("createAndSendContributeRequestTx-nftID", nftID).required().string();
    new Validator("createAndSendContributeRequestTx-version", version).required().number();

    await this.account?.updateProgressTx(10, "Generating Metadata");
    let burningAddress = await getBurningAddress(this.rpc);
    const burningPayments = [{
      PaymentAddress: burningAddress,
      Amount: new bn(1).toString(), // burn 1 of NFTID
      Message: info
    }];
    let receivingTokens = [nftID].concat(poolTokenIDs);
    let receiver = {};
    // create new OTAs
    for (const t of receivingTokens) {
      receiver[t] = await this.getOTAReceive();
    }
    // prepare meta data for tx
    let metadata = {
      PoolPairID: poolPairID,
      ShareAmount: shareAmount,
      NftID: nftID,
      OtaReceivers: receiver,
      Type: pdexv3.WithdrawLiquidityRequestMeta,
    };
    let result = await this.account?.transact({
      transfer: { prvPayments: [], tokenPayments: burningPayments, fee, info, tokenID: nftID },
      extra: { metadata, version, txType: TX_TYPE.WITHDRAW_CONTRIBUTE }
    });
    await this.account?.updateProgressTx(100, "Completed");
    return result;
  } catch (e) {
    throw e;
  }
}
async function createAndSendWithdrawLPFeeRequestTx (params) {
  try {
    const {
      transfer: { fee, info = "" },
      extra: { withdrawTokenIDs, poolPairID, nftID, version }
    } = params;
    new Validator("createAndSendWithdrawLPFeeRequestTx-fee", fee).required().amount();
    new Validator("createAndSendWithdrawLPFeeRequestTx-info", info).required().string();
    new Validator("createAndSendWithdrawLPFeeRequestTx-withdrawTokenIDs", withdrawTokenIDs).required().array();
    new Validator("createAndSendWithdrawLPFeeRequestTx-poolPairID", poolPairID).required().string();
    new Validator("createAndSendWithdrawLPFeeRequestTx-nftID", nftID).required().string();
    new Validator("createAndSendWithdrawLPFeeRequestTx-version", version).required().number();
    await this.account?.updateProgressTx(10, "Generating Metadata");
    const burningAddress = await getBurningAddress(this.rpc);
    let burningPayments = [{
      PaymentAddress: burningAddress,
      Amount: new bn(1).toString(), // burn 1 of NFTID
      Message: info
    }];
    let receivingTokens = [nftID].concat(withdrawTokenIDs);
    let receiver = {};
    // create new OTAs
    for (const t of receivingTokens) {
      receiver[t] = await this.getOTAReceive();
    }
    // prepare meta data for tx
    let metadata = {
      PoolPairID: poolPairID,
      NftID: nftID,
      Receivers: receiver,
      Type: pdexv3.WithdrawLPFeeRequestMeta,
    };
    let result = await this.account?.transact({
      transfer: { prvPayments: [], tokenPayments: burningPayments, fee, info, tokenID: nftID },
      extra: { metadata, version, txType: TX_TYPE.WITHDRAW_CONTRIBUTE_REWARD }
    });
    await this.account?.updateProgressTx(100, "Completed");
    return result;
  } catch (e) {
    throw e;
  }
}

export default ({
  createAndSendContributeRequestTx,
  createAndSendWithdrawContributeRequestTx,
  createAndSendWithdrawLPFeeRequestTx,
})
