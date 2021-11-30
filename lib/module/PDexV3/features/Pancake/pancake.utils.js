import {
  MULTI_CALL_ABI,
  PANCAKE_ABI,
  PANCAKE_FACTORY_ABI,
} from "@lib/module/Pancake/pancake.constants";
import Web3 from "web3"; // ETH sdk
import { Token, TokenAmount, JSBI, Trade, Pair } from "@pancakeswap/sdk";
import secp256k1 from "secp256k1";
import bs58 from "bs58";
import eutil from "ethereumjs-util";
import Wallet from "ethereumjs-wallet";
import { Validator } from "@lib/wallet";

export async function getBestRateFromPancake(params) {
  const {
    sourceToken,
    destToken,
    amount,
    isSwapExactOut,
    listDecimals,
    bscConstants,
    pancakeConstants,
  } = params;
  console.log("params", params);
  new Validator("getBestRateFromPancake-sourceToken", sourceToken).required();
  new Validator("getBestRateFromPancake-destToken", destToken).required();
  new Validator("getBestRateFromPancake-amount", amount).required();
  new Validator("getBestRateFromPancake-isSwapExactOut", isSwapExactOut)
    .required()
    .boolean();
  new Validator("getBestRateFromPancake-listDecimals", listDecimals)
    .required()
    .array();
  new Validator("getBestRateFromPancake-bscConstants", bscConstants)
    .required()
    .object();
  new Validator("getBestRateFromPancake-pancakeConstants", pancakeConstants)
    .required()
    .object();
  const {
    routerV2: pancakeRouterV2,
    factoryAddress: pancakeFactoryAddress,
    chainID: pancakeChainID,
    multiCallContract: pancakeMultiCallContract,
  } = pancakeConstants;
  const listCommon = [...Object.keys(listDecimals)]; // pairs token => sell/buy token -> find best rate
  const web3 = new Web3(bscConstants.host);
  const MULTI_CALL_INST = new web3.eth.Contract(
    MULTI_CALL_ABI,
    pancakeMultiCallContract
  );
  const FACTORY_INST = new web3.eth.Contract(
    PANCAKE_FACTORY_ABI,
    pancakeFactoryAddress
  );
  const PANCAKE_ROUTER_INST = new web3.eth.Contract(
    PANCAKE_ABI,
    pancakeRouterV2
  );
  let pairList = [];
  // get list LPs
  let abiCallGetLPs = [];
  let token_pair = [];
  let listTokens = listCommon.slice();
  let listTokenDecimals = Object.assign({}, listDecimals);
  [sourceToken, destToken].forEach(function (item) {
    if (!listTokenDecimals[item.address.toLowerCase()]) {
      listTokenDecimals[item.address.toLowerCase()] = {
        decimals: item.decimals,
        symbol: item.symbol,
      };
      listTokens.push(item.address);
    }
  });
  for (let i = 0; i < listTokens.length - 1; i++) {
    for (let j = i + 1; j < listTokens.length; j++) {
      if (
        listTokens[i].toLocaleLowerCase() === listTokens[j].toLocaleLowerCase()
      )
        continue;
      const temp = FACTORY_INST.methods
        .getPair(listTokens[i], listTokens[j])
        .encodeABI();
      abiCallGetLPs.push([pancakeFactoryAddress, temp]);
      token_pair.push({ token0: listTokens[i], token1: listTokens[j] });
    }
  } // pair sell / buy: [{sell, buy}]

  // detect exited pair between sell/buy in pancake
  const listLPs = await MULTI_CALL_INST.methods
    .tryAggregate(false, abiCallGetLPs)
    .call();
  let listPairExist = [];
  let getPairResrved = [];
  for (let i = 0; i < listLPs.length; i++) {
    if (!listLPs[i].success) {
      continue;
    }
    const contractLPAddress = "0x" + listLPs[i].returnData.substring(26);
    if (contractLPAddress === "0x0000000000000000000000000000000000000000") {
      continue;
    }
    const contractTemp = new web3.eth.Contract(
      PANCAKE_PAIR_ABI,
      contractLPAddress
    );
    const temp = contractTemp.methods.getReserves().encodeABI();
    const temp2 = contractTemp.methods.token0().encodeABI();
    getPairResrved.push([contractLPAddress, temp]);
    getPairResrved.push([contractLPAddress, temp2]);
    listPairExist.push(token_pair[i]);
  }

  if (getPairResrved.length === 0) {
    console.log("no LPs exist!!!");
    return null, null;
  }

  // get rate of pair
  const listReserved = await MULTI_CALL_INST.methods
    .tryAggregate(false, getPairResrved)
    .call();
  if (listReserved.length < 2) {
    console.log("no LPs exist!!!");
    return null, null;
  }

  for (let i = 0; i < listReserved.length; i += 2) {
    const reserve0 = JSBI.BigInt(
      "0x" + listReserved[i].returnData.substring(2, 66),
      16
    );
    const reserve1 = JSBI.BigInt(
      "0x" + listReserved[i].returnData.substring(66, 130),
      16
    );
    const token0 = "0x" + listReserved[i + 1].returnData.substring(26);
    let token1 = listPairExist[i / 2].token1;
    if (listPairExist[i / 2].token0.toLowerCase() !== token0.toLowerCase()) {
      token1 = listPairExist[i / 2].token0;
    }
    const token0Ins = new Token(
      pancakeChainID,
      token0,
      listTokenDecimals[token0.toLocaleLowerCase()].decimals,
      listTokenDecimals[token0.toLocaleLowerCase()].symbol
    );
    const token1Ins = new Token(
      pancakeChainID,
      token1,
      listTokenDecimals[token1.toLocaleLowerCase()].decimals,
      listTokenDecimals[token1.toLocaleLowerCase()].symbol
    );
    const pair = new Pair(
      new TokenAmount(token0Ins, reserve0),
      new TokenAmount(token1Ins, reserve1)
    );
    pairList.push(pair);
  }

  const sellAmount = JSBI.BigInt(
    amount * 10 ** (isSwapExactOut ? destToken.decimals : sourceToken.decimals)
  );
  const seltTokenInst = new Token(
    pancakeChainID,
    sourceToken.address,
    sourceToken.decimals,
    sourceToken.symbol
  );
  const buyTokenInst = new Token(
    pancakeChainID,
    destToken.address,
    destToken.decimals,
    destToken.symbol
  );
  let result;
  if (!isSwapExactOut) {
    result = Trade.bestTradeExactIn(
      // find best route
      pairList,
      new TokenAmount(seltTokenInst, sellAmount),
      buyTokenInst,
      { maxNumResults: 1 }
    );
  } else {
    result = Trade.bestTradeExactOut(
      pairList,
      seltTokenInst,
      new TokenAmount(buyTokenInst, sellAmount),
      { maxNumResults: 1 }
    );
  }
  if (result.length === 0) {
    console.log("Can not find the best path for this pair");
    return null, null;
  }

  const bestPath = result[0].route.path;
  let paths = [];
  bestPath.forEach(function (item) {
    paths.push(item.address);
  });

  let outputs;
  if (!isSwapExactOut) {
    outputs = await PANCAKE_ROUTER_INST.methods
      .getAmountsOut(sellAmount.toString(), paths)
      .call();
  } else {
    outputs = await PANCAKE_ROUTER_INST.methods
      .getAmountsIn(sellAmount.toString(), paths)
      .call();
  }
  return { paths, outputs };
}

// generated eth from incKey success
function genETHAccFromIncPrivKey(incPrivKey) {
  const web3 = new Web3();
  let bytes = bs58.decode(incPrivKey);
  bytes = bytes.slice(1, bytes.length - 4);
  const privHexStr = web3.utils.bytesToHex(bytes);
  let privKey = web3.utils.keccak256(privHexStr);
  let temp, temp2;
  temp = web3.utils.hexToBytes(privKey);
  temp2 = new Uint8Array(temp);
  while (!secp256k1.privateKeyVerify(temp2)) {
    privKey = web3.utils.keccak256(privKey);
    temp = web3.utils.hexToBytes(privKey);
    temp2 = new Uint8Array(temp);
  }
  const fixturePrivateBuffer = Buffer.from(privKey.replace("0x", ""), "hex");
  const fixtureWallet = Wallet.fromPrivateKey(fixturePrivateBuffer);
  return fixtureWallet;
}

function signMessage(mess, privateKey) {
  let dataToSigBuff = Buffer.from(mess.replace("0x", ""), "hex");
  let privateKeyBuff = Buffer.from(privateKey.replace("0x", ""), "hex");
  let signature = eutil.ecsign(dataToSigBuff, privateKeyBuff);
  return (
    "0x" +
    signature.r.toString("hex") +
    signature.s.toString("hex") +
    "0" +
    (signature.v - 27).toString(16)
  );
}
