import {
  getBurningAddress,
  PaymentAddressType,
  PDECrossPoolTradeRequestMeta,
  PRVIDSTR,
} from "@lib/core";
import Validator from "@lib/utils/validator";
import { TX_TYPE } from "@lib/module/Account//account.constants";
import { createCoin } from "@lib/module/Account//account.utils";
import { flatten, orderBy } from "lodash";
import { PrivacyVersion } from '@lib/core/constants';

/**
 * @param {string} info
 * @param {number} fee
 * @param {string} tokenIDToBuy
 * @param {string} tokenIDToSell
 * @param {number} sellAmount
 * @param {number} minAcceptableAmount
 * @param {number} tradingFee
 */
async function createAndSendTradeRequestTx({
  transfer: { fee },
  extra: {
    tokenIDToBuy,
    tokenIDToSell,
    sellAmount,
    minAcceptableAmount,
    tradingFee,
    version,
  } = {},
}) {
  new Validator("createAndSendTradeRequestTx-tokenIDToBuy", tokenIDToBuy)
    .required()
    .string();
  new Validator("createAndSendTradeRequestTx-tokenIDToSell", tokenIDToSell)
    .required()
    .string();
  new Validator("createAndSendTradeRequestTx-sellAmount", sellAmount)
    .required()
    .amount();
  new Validator(
    "createAndSendTradeRequestTx-minAcceptableAmount",
    minAcceptableAmount
  )
    .required()
    .amount();
  new Validator("createAndSendTradeRequestTx-tradingFee", tradingFee)
    .required()
    .amount();
  new Validator("createAndSendTradeRequestTx-fee", fee).required().amount();
  new Validator("createAndSendTradeRequestTx-version", version)
    .required()
    .number();
  if (fee < 0) {
    fee = 0;
  }
  await this.updateProgressTx(10, "Generating Metadata");
  let sellPRV = tokenIDToSell === PRVIDSTR;
  const burningAddress = await getBurningAddress(this.rpc);
  new Validator("createAndSendTradeRequestTx-burningAddress", burningAddress)
    .required()
    .paymentAddress();
  let amount = tradingFee;
  let tokenPaymentInfos = [];
  if (sellPRV) {
    amount += sellAmount;
  } else {
    tokenPaymentInfos = [
      {
        PaymentAddress: burningAddress,
        Amount: sellAmount,
        Message: "",
      },
    ];
  }
  const prvPaymentInfos = [
    {
      PaymentAddress: burningAddress,
      Amount: amount,
      Message: "",
    },
  ];
  let myAddressStr = this.key.base58CheckSerialize(PaymentAddressType);
  let pInf = {
    PaymentAddress: myAddressStr,
    Amount: "0",
  };
  let newCoinsTask = [
    createCoin({ paymentInfo: pInf, tokenID: tokenIDToBuy }),
    createCoin({ paymentInfo: pInf, tokenID: tokenIDToSell }),
  ];
  const [newCoin, newCoinForSub] = await Promise.all(newCoinsTask);
  // prepare meta data for tx. It is normal trade request at first
  let metadata = {
    TokenIDToBuyStr: tokenIDToBuy,
    TokenIDToSellStr: tokenIDToSell,
    SellAmount: sellAmount,
    Type: PDECrossPoolTradeRequestMeta,
    MinAcceptableAmount: minAcceptableAmount,
    TradingFee: tradingFee,
    TraderAddressStr: newCoin.PublicKey,
    TxRandomStr: newCoin.TxRandom,
    SubTraderAddressStr: newCoinForSub.PublicKey,
    SubTxRandomStr: newCoinForSub.TxRandom,
  };
  console.log(metadata);
  try {
    let tx;
    if (sellPRV) {
      tx = await this.transact({
        transfer: { prvPayments: prvPaymentInfos, fee },
        extra: { metadata, txType: TX_TYPE.TRADE, version },
      });
    } else {
      tx = await this.transact({
        transfer: {
          prvPayments: prvPaymentInfos,
          fee,
          tokenID: tokenIDToSell,
          tokenPayments: tokenPaymentInfos,
        },
        extra: { metadata, txType: TX_TYPE.TRADE, version },
      });
    }
    await this.updateProgressTx(100, "Completed");
    return tx;
  } catch (e) {
    throw e;
  }
}

async function getPDeState() {
  return this.rpcCoinService.apiGetPDeState();
}

async function getPDexHistories({ offset, limit } = {}) {
  const otakey = this.getOTAKey();
  offset = offset || 0;
  limit = limit || 100000;
  return this.rpcCoinService.apiGetPDexHistories({ otakey, offset, limit });
}

class PDexHistoryStoragePureModel {
  constructor({ history, accountName }) {
    const { metadata, txId, status, tx } = history;
    this.sellAmount = metadata?.SellAmount;
    this.buyAmount = metadata?.MinAcceptableAmount;
    this.buyTokenId = metadata?.TokenIDToBuyStr;
    this.sellTokenId = metadata?.TokenIDToSellStr;
    this.requestTx = txId;
    this.status = status;
    this.networkFee = tx?.Fee;
    this.requesttime = tx?.LockTime;
    this.accountName = accountName;
  }
}

async function getTxPdexStorageHistories() {
  try {
    const version = PrivacyVersion.ver1;
    const keyInfo = await this.getKeyInfo({ version });
    let tokenIds = [];
    const coinsIndex = keyInfo?.coinindex;
    if (coinsIndex) {
      tokenIds = Object.keys(coinsIndex);
    }
    const tasks = tokenIds.map(async (tokenID) => {
      const histories =
        (await this.getTransactorHistoriesByTokenID({ tokenID, version })) ||
        [];
      return histories.filter((item) => item?.txType === TX_TYPE.TRADE);
    });

    const accountName = this.name || "";
    return orderBy(flatten(await Promise.all(tasks))).map(
      (history) => new PDexHistoryStoragePureModel({ history, accountName })
    );
  } catch (error) {
    throw error;
  }
}

export default {
  createAndSendTradeRequestTx,
  getPDeState,
  getPDexHistories,
  getTxPdexStorageHistories,
};
