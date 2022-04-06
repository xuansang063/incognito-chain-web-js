import "core-js/stable";
import "regenerator-runtime/runtime";
import PDexV3 from "@lib/module/PDexV3";
import { PANCAKE_CONSTANTS } from "@lib/module/Pancake";
import { UNI_CONSTANTS } from "@lib/module/Uni";
import { CURVE_CONSTANTS } from "@lib/module/Curve";
import { BSC_CONSTANT } from "@lib/module/BinanceSmartChain";
import { WEB3_CONSTANT } from "@lib/module/Web3";
import { PaymentInfo } from "./common/key";
import { RpcClient } from "./rpcclient/rpcclient";
import {
    hashSha3BytesToBytes,
    base64Decode,
    base64Encode,
    bytesToString,
    stringToBytes,
} from "./privacy/utils";
import {
    FailedTx,
    SuccessTx,
    ConfirmedTx,
    MetaStakingBeacon,
    MetaStakingShard,
    PaymentAddressType,
    ReadonlyKeyType,
    PriKeyType,
    OTAKeyType,
    BurningRequestMeta,
    BurningRequestToSCMeta,
    IssuingETHRequestMeta,
    WithDrawRewardRequestMeta,
    PDEContributionMeta,
    PDEPRVRequiredContributionRequestMeta,
    PDETradeRequestMeta,
    PDECrossPoolTradeRequestMeta,
    PDEWithdrawalRequestMeta,
    PortalV4ShieldingRequestMeta,
    PortalV4ShieldingResponseMeta,
    PortalV4UnshieldRequestMeta,
    PortalV4UnshieldingResponseMeta,
    PRVIDSTR,
    KeyWallet,
    TxHistoryInfo,
    toNanoPRV,
    toPRV,
    encryptMessageOutCoin,
    decryptMessageOutCoin,
} from "./core";
import {
    CustomTokenTransfer,
    CustomTokenInit,
    MAX_INPUT_PER_TX,
} from "./tx/constants";
import {
    checkEncode as base58CheckEncode,
    checkDecode as base58CheckDecode,
} from "./common/base58";
import {
    getShardIDFromLastByte,
    byteToHexString,
    hexStringToByte,
    convertHashToStr,
} from "./common/common";
import { Wallet, DefaultStorage } from "./wallet";
import { getMaxWithdrawAmount } from "./tx/utils";
import { generateECDSAKeyPair } from "./privacy/ecdsa";
import { generateBLSKeyPair } from "./privacy/bls";
import {
    generateBLSPubKeyB58CheckEncodeFromSeed,
    generateCommitteeKeyFromHashPrivateKey,
} from "./common/committeekey";
import { hybridEncryption, hybridDecryption } from "./privacy/hybridEncryption";
import { Account } from "./module/Account";
import StorageServices from "./services/storage";
import { StatelessTransactor, TxBuilder, wasm } from "./tx/stateless";
import { newMnemonic } from "./core/mnemonic";
import { ENCODE_VERSION, setShardNumber } from "./common/constants";
import { isPaymentAddress, isOldPaymentAddress } from "./utils/paymentAddress";
import VerifierTx from "./module/VerifierTx";
import axios from "axios";

let coinsToBase64 = (coinArray) =>
    coinArray.map((c) => {
        let result = {};
        Object.keys(c).forEach((k) => {
            try {
                const temp = base58CheckDecode(c[k]);
                result[k] = base64Encode(temp.bytesDecoded);
            } catch (e) {
                result[k] = c[k];
            } // keep any field that's not in base58 as-is
        });
        return result;
    });

const constants = {
    PaymentAddressType,
    PriKeyType,
    ReadonlyKeyType,
    OTAKeyType,
    CustomTokenTransfer,
    CustomTokenInit,
    PRVIDSTR,
    ENCODE_VERSION,
    FailedTx,
    SuccessTx,
    ConfirmedTx,
    MetaStakingBeacon,
    MetaStakingShard,
    BurningRequestMeta,
    BurningRequestToSCMeta,
    IssuingETHRequestMeta,
    WithDrawRewardRequestMeta,
    PDEContributionMeta,
    PDEPRVRequiredContributionRequestMeta,
    PDETradeRequestMeta,
    PDECrossPoolTradeRequestMeta,
    PDEWithdrawalRequestMeta,
    PortalV4ShieldingRequestMeta,
    PortalV4ShieldingResponseMeta,
    PortalV4UnshieldRequestMeta,
    PortalV4UnshieldingResponseMeta,
    CustomTokenTransfer,
    MAX_INPUT_PER_TX,
    Pancake: PANCAKE_CONSTANTS,
    Uni: UNI_CONSTANTS,
    Web3: WEB3_CONSTANT,
    Bsc: BSC_CONSTANT,
    Curve: CURVE_CONSTANTS,
};
const utils = {
    base58CheckEncode,
    base58CheckDecode,
    base58CheckDeserialize: KeyWallet.base58CheckDeserialize,
    base64Encode,
    base64Decode,
    getMaxWithdrawAmount,
    toNanoPRV,
    toPRV,
    getShardIDFromLastByte,
    generateECDSAKeyPair,
    generateBLSKeyPair,
    encryptMessageOutCoin,
    decryptMessageOutCoin,
    byteToHexString,
    hexStringToByte,
    generateBLSPubKeyB58CheckEncodeFromSeed,
    generateCommitteeKeyFromHashPrivateKey,
    hashSha3BytesToBytes,
    convertHashToStr,
    hybridEncryption,
    hybridDecryption,
    bytesToString,
    stringToBytes,
    coinsToBase64,
    setShardNumber,
    isPaymentAddress,
    isOldPaymentAddress,
    newMnemonic,
};
const types = {
    TxHistoryInfo,
    RpcClient,
    PaymentInfo,
    KeyWallet,
    DefaultStorage,
    Wallet,
    Transactor: StatelessTransactor,
    Account,
    TxBuilder,
    StorageServices,
    VerifierTx,
    PDexV3,
};

let rpc = new RpcClient();
let services = null;

const NewTransactor = async (privateKey, services = null) => {
    if (Boolean(services)) {
        let { coinSvc, apiSvc, txSvc, reqSvc, deviceID } = services;
        if (!txSvc) txSvc = `${coinSvc}/txservice`;
        if (!reqSvc) reqSvc = `${coinSvc}/airdrop-service`;
        let t = new Account({ rpc });
        await t.setKey(privateKey);
        t.setRPCCoinServices(coinSvc);
        t.setRPCClient(rpc.rpcHttpService.url);
        t.setRPCTxServices(txSvc);
        t.setRPCRequestServices(reqSvc);
        const authTokenDt = await axios.post(`${apiSvc}/auth/new-token`, { DeviceID: deviceID });
        const authToken = authTokenDt.data.Result.Token;
        t.setAuthToken(authToken);
        t.setRPCApiServices(apiSvc, authToken);
        return t;
    } else {
        let t = new StatelessTransactor({ rpc });
        t.init(rpc.rpcHttpService.url);
        await t.setKey(privateKey);
        return t;
    }
}

const setProvider = (rpcURL, svcs) => {
    rpc = new RpcClient(rpcURL);
    services = svcs;
}

const init = async (wasmFile, providerURL, shardCount = 8, svcs = null) => {
    setProvider(providerURL, svcs);
    const { load } = require("./wasm/loader.js");
    wasmFile = wasmFile || __dirname + "/../privacy.wasm";
    await load(wasmFile);
    await wasm.setCfg(JSON.stringify({ shardCount, allowBase58: true }));
};

export {
    NewTransactor,
    setProvider,
    constants,
    types,
    utils,
    init,
    wasm,
    rpc,
};