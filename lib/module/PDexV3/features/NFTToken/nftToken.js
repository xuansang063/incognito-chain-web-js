import { pdexv3, PrivacyVersion } from "@lib/core/constants";
import Validator from "@lib/utils/validator";
import bn from "bn.js";
import { MAX_FEE_PER_TX, TX_TYPE } from "@lib/module/Account";
import { getBurningAddress } from "@lib/core";
import uniq from "lodash/uniq";

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
  const metadata = {
    Amount: pdexv3.MintNftAmount,
    OtaReceive: otaReceive,
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
      initNFTToken: !!(await this.getStorage(key)),
      list: [],
    };
    const keyInfo = await this.account?.getKeyInfo({ version });
    if (!keyInfo?.nftindex) return payload;
    const nftIDS = Object.keys(keyInfo?.nftindex).map((key) => key);
    console.log("nftIDS", nftIDS);
    if (nftIDS.length === 0) {
      return payload;
    }
    payload.initNFTToken = true;
    let task = nftIDS.map((nft) =>
      this.account?.getUnspentCoinsExcludeSpendingCoins({
        version,
        tokenID: nft,
        isNFT: true,
      })
    );
    const implTask = await Promise.all(task);
    const list = implTask.map((unspentCoins, index) => {
      const amount =
        unspentCoins?.reduce(
          (totalAmount, coin) => totalAmount.add(new bn(coin.Value)),
          new bn(0)
        ) || new bn(0);
      return {
        amount: amount.toString(),
        nftToken: nftIDS[index],
      };
    });
    payload.list = list;
    const foundIndex = list.findIndex(({ amount }) => new bn(amount).eqn(1));
    if (foundIndex > -1) {
      payload.nftToken = nftIDS[foundIndex];
    }
    return payload;
  } catch (error) {
    throw error;
  }
}

async function getNFTTokenData(params) {
  let payload = {
    nftToken: "",
    initNFTToken: false,
    list: [],
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

export default {
  getNFTTokenData,
  getNFTTokenDataNoCache,
  createAndMintNftTx,
  getKeyStorageMintedNTFToken,
  getNFTTokenIDs,
};
