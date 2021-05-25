import {
  getBurningAddress,
  PaymentAddressType,
  PDECrossPoolTradeRequestMeta,
  PRVIDSTR,
} from "@lib/core";
import Validator from "@lib/utils/validator";
import { TX_TYPE } from "./account.constants";
import { createCoin } from "./account.utils";
import { PrivacyVersion } from "@lib/core/constants";

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
    tokenIDToBuy = PRVIDSTR,
    tokenIDToSell = PRVIDSTR,
    sellAmount,
    minAcceptableAmount,
    tradingFee,
  } = {},
}) {
  new Validator("tokenIDToBuy", tokenIDToBuy).required().string();
  new Validator("tokenIDToSell", tokenIDToSell).required().string();
  new Validator("sellAmount", sellAmount).required().amount();
  new Validator("minAcceptableAmount", minAcceptableAmount).required().amount();
  new Validator("tradingFee", tradingFee).required().amount();
  new Validator("fee", fee).required().amount();
  this.setPrivacyVersion(PrivacyVersion.ver2);
  if (fee < 0) {
    fee = 0;
  }
  await this.updateProgressTx(10, "Generating Metadata");
  let sellPRV = tokenIDToSell === PRVIDSTR;
  const burningAddress = await getBurningAddress(this.rpc);
  new Validator("burningAddress", burningAddress).required().paymentAddress();
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
        extra: { metadata, txType: TX_TYPE.TRADE },
      });
    } else {
      tx = await this.transact({
        transfer: {
          prvPayments: prvPaymentInfos,
          fee,
          tokenID: tokenIDToSell,
          tokenPayments: tokenPaymentInfos,
        },
        extra: { metadata, txType: TX_TYPE.TRADE },
      });
    }
    await this.saveTxHistory({
      tx,
    });
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
  this.setPrivacyVersion(PrivacyVersion.ver2);
  const version = this.privacyVersion;
  const otaKey = this.getOTAKey();
  const keyInfo = await this.rpcCoinService.apiGetKeyInfo({
    key: otaKey,
    version,
  });

  let tokenIds = [];
  const coinsIndex = keyInfo?.coinindex;
  if (coinsIndex) {
    tokenIds = Object.keys(coinsIndex);
  }
  const tasks = tokenIds.map(async (tokenId) => {
    const histories = (await this.getTxHistory({ tokenId })) || [];
    return histories.filter((item) => item?.txType === TX_TYPE.TRADE);
  });

  const accountName = this.name || "";
  return orderBy(flatten(await Promise.all(tasks))).map(
    (history) => new PDexHistoryStoragePureModel({ history, accountName })
  );
}

export default {
  createAndSendTradeRequestTx,
  getPDeState,
  getPDexHistories,
  getTxPdexStorageHistories,
};
