import { pdexv3, PrivacyVersion } from "@lib/core/constants";
import Validator from "@lib/utils/validator";
import bn from "bn.js";
import { MAX_FEE_PER_TX, TX_TYPE } from "@lib/module/Account";
import { getBurningAddress } from "@lib/core";
import uniq from "lodash/uniq";
import flatten from 'lodash/flatten';
import { CustomError, ErrorObject } from "@lib/common/errorhandler";

function getKeyStorageMintedNTFToken({ version }) {
  new Validator("getKeyStorageMintedNTFToken-version", version)
    .required()
    .number();
  return `${this.account?.getOTAKey()}-MINTED-NFT-TOKEN-ver-${version}`;
}

async function createAndMintNftTx({
  transfer: { fee = MAX_FEE_PER_TX, info = "" } = {},
  extra: { version },
}) {
  new Validator("createAndMintNftTx-fee", fee).amount();
  new Validator("createAndMintNftTx-info", info).string();
  new Validator("createAndSendTradeRequestTx-version", version)
    .required()
    .number();
  await this.account?.updateProgressTx(10, "Generating Metadata");
  const burningAddress = await getBurningAddress(this.rpc);
  let burningPayments = [
    {
      PaymentAddress: burningAddress,
      Amount: new bn(pdexv3.MintNftAmount).toString(),
      Message: info,
    },
  ];
  const otaReceive = await this.getOTAReceive();
  new Validator("createAndMintNftTx-otaReceive", otaReceive)
    .string()
    .required();
  const metadata = {
    Amount: pdexv3.MintNftAmount,
    OtaReceiver: otaReceive,
    Type: pdexv3.UserMintNftRequestMeta,
  };
  try {
    const tx = await this.account?.transact({
      transfer: { prvPayments: burningPayments, fee, info },
      extra: { metadata, txType: TX_TYPE.MINT_NFT_TOKEN, version },
    });
    await this.account?.updateProgressTx(100, "Completed");
    return tx;
  } catch (e) {
    throw e;
  } finally {
    const key = this.getKeyStorageMintedNTFToken({ version });
    await this.setStorage(key, true);
  }
}

async function getNFTTokenDataNoCache(params) {
  try {
    const { version } = params;
    const key = this.getKeyStorageMintedNTFToken({ version });
    let payload = {
      nftToken: "",
      nftTokenAvailable: "",
      initNFTToken: !!(await this.getStorage(key)),
      list: [],
      pending: false,
      listNFTToken: [],
    };
    const keyInfo = await this.account?.getKeyInfo({ version });
    if (!keyInfo?.nftindex) return payload;
    const nftIDS = Object.keys(keyInfo?.nftindex).map((key) => key);
    if (nftIDS.length === 0) {
      return payload;
    }
    payload.initNFTToken = true;
    let task1 = nftIDS.map((nft) =>
      this.account?.getUnspentCoinsV2({
        version,
        tokenID: nft,
        isNFT: true,
      })
    );
    let task2 = nftIDS.map((nft) =>
      this.account?.getUnspentCoinsExcludeSpendingCoins({
        version,
        tokenID: nft,
        isNFT: true,
      })
    );
    const implTask1 = await Promise.all(task1);
    const implTask2 = await Promise.all(task2);
    let list = nftIDS.map((nftToken, index) => {
      const amount =
        implTask1[index]?.reduce(
          (totalAmount, coin) => totalAmount.add(new bn(coin.Value)),
          new bn(0)
        ) || new bn(0);
      const realAmount =
        implTask2[index]?.reduce(
          (totalAmount, coin) => totalAmount.add(new bn(coin.Value)),
          new bn(0)
        ) || new bn(0);
      return {
        amount: amount.toString(),
        realAmount: realAmount.toString(),
        nftToken,
      };
    });
    payload.list = list;
    const { nftToken } = list.find(({ amount }) => new bn(amount).eqn(1)) || {};
    const { nftToken: nftTokenAvailable } =
      list.find(({ realAmount }) => new bn(realAmount).eqn(1)) || {};
    payload.nftToken = nftToken || "";
    payload.nftTokenAvailable = nftTokenAvailable || "";
    if (payload.nftToken && !payload.nftTokenAvailable) {
      payload.pending = true;
    }
    payload.listNFTToken = list.map(({ nftToken }) => nftToken);
    return payload;
  } catch (error) {
    console.log("getNFTTokenData-error", error);
    throw error;
  }
}

async function getNFTTokenData(params) {
  let payload = {
    nftToken: "",
    nftTokenAvailable: "",
    initNFTToken: false,
    list: [],
    pending: false,
    listNFTToken: [],
  };
  try {
    const { version } = params;
    new Validator(`getNFTTokens-version`, version).required().number();
    payload = await this.getNFTTokenDataNoCache(params);
  } catch (error) {
    throw error;
  }
  return payload;
}

async function getNFTTokenIDs() {
  const { list: listNFTs } = await this.getNFTTokenData({
    version: PrivacyVersion.ver2,
  });
  const nftIDs = listNFTs.map((item) => item.nftToken);
  return uniq(nftIDs);
}

async function mapNFIDWithFollowPool() {
  const followPools = await this.getListFollowingPools();
  // const poolIds = ["0000000000000000000000000000000000000000000000000000000000000004-6133dbf8e3d71a8f8e406ebd459492d34180622ba572b2d8f0fc8484b09ddd47-13a6c00e978a0073f28b19a2a1298542341fad56d0dd4eb27f0acfcede0aef35","0000000000000000000000000000000000000000000000000000000000000004-6133dbf8e3d71a8f8e406ebd459492d34180622ba572b2d8f0fc8484b09ddd47-1437fbee7030f8e0d52ddb157edb2d4f61d4ca851a161f5f716d754951e57337","0000000000000000000000000000000000000000000000000000000000000004-6133dbf8e3d71a8f8e406ebd459492d34180622ba572b2d8f0fc8484b09ddd47-336821fb92dd5035beb71c94be07fe429af040e7ae25e058d5972e9bcfcc1d5d","0000000000000000000000000000000000000000000000000000000000000004-7a9dc93436cb29ba733ad03d3bdb841f6c7b8f6eba30b86217320b7be21cf9cb-097251ed10c56d6e01d009d7f4b033d1e23154642c3d5c0a050f812be636aeed"]
  const nftIds = (await this.getNFTTokenIDs()) || [];
  const arrayMap = flatten(followPools.map(poolId =>
    nftIds.map(nftId => ({
      poolId,
      nftId
    }))
  ));
  return arrayMap || [];
}

async function getAvailableNFTToken({ version }) {
  let nftID = "";
  try {
    const { nftTokenAvailable, pending } = await this.getNFTTokenData({
      version,
    });
    if (pending) {
      throw new CustomError(
        ErrorObject.NFTTokenPending,
        ErrorObject.NFTTokenPending.description
      );
    }
    nftID = nftTokenAvailable;
  } catch (error) {
    throw error;
  }
  return nftID;
}

export default {
  getNFTTokenData,
  getNFTTokenDataNoCache,
  createAndMintNftTx,
  getKeyStorageMintedNTFToken,
  getNFTTokenIDs,
  mapNFIDWithFollowPool,
  getAvailableNFTToken,
};
