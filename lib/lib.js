import "core-js/stable";
import "regenerator-runtime/runtime";
import bn from 'bn.js';
const webJsPath = './';
import {
    PaymentAddress,
    ViewingKey,
    OTAKey,
    PaymentInfo
} from './common/key';
import {
    RpcClient
} from './rpcclient/rpcclient';
import {
    setRandBytesFunc,
    hashSha3BytesToBytes,
    base64Decode,
    base64Encode,
} from './privacy/utils';
import {
    FailedTx,
    SuccessTx,
    ConfirmedTx,
    MetaStakingBeacon,
    MetaStakingShard,
    PaymentAddressType,
    ReadonlyKeyType,
    PriKeyType,
    BurningRequestMeta,
    BurningRequestToSCMeta,
    IssuingETHRequestMeta,
    WithDrawRewardRequestMeta,
    PDEContributionMeta,
    PDEPRVRequiredContributionRequestMeta,
    PDETradeRequestMeta,
    PDECrossPoolTradeRequestMeta,
    PDEWithdrawalRequestMeta,
    PRVIDSTR,
    KeyWallet,
    NewMasterKey,
    MnemonicGenerator,
    TxHistoryInfo,
    toNanoPRV,
    toPRV,
    encryptMessageOutCoin,
    decryptMessageOutCoin,
} from './core';
import {
    CustomTokenTransfer,
    CustomTokenInit,
    MAX_INPUT_PER_TX
} from './tx/constants';
import {
    checkEncode as base58CheckEncode,
    checkDecode as base58CheckDecode,
} from './common/base58';
import {
    getShardIDFromLastByte,
    byteToHexString,
    hexStringToByte,
} from './common/common';
import {
    Transactor
} from './transactor';
import {
    Wallet,
    DefaultStorage
} from './wallet';
import {
    // getEstimateFee,
    // getEstimateFeeForPToken,
    getMaxWithdrawAmount
} from './tx/utils';
import {
    generateECDSAKeyPair
} from './privacy/ecdsa';
import {
    generateBLSKeyPair
} from './privacy/bls';
import {
    ENCODE_VERSION,
    ED25519_KEY_SIZE
} from './common/constants';
import {
    CustomError,
    ErrorObject
} from './common/errorhandler';
import {
    generateBLSPubKeyB58CheckEncodeFromSeed
} from './common/committeekey';
import {
    BaseTrie as Trie
} from 'merkle-patricia-tree';

let sleep = (ms) => {
    return new Promise(resolve => setTimeout(resolve, ms));
}

const constants = {
    PaymentAddressType,
    PriKeyType,
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
    CustomTokenTransfer,
    MAX_INPUT_PER_TX,
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
    Trie,
    byteToHexString,
    hexStringToByte,
};
const types = {
    TxHistoryInfo,
    RpcClient,
    PaymentInfo,
    KeyWallet,
    DefaultStorage
};

class SimpleWallet {
    constructor() {
        this.Name = "";
        // timeout when waiting for TX confirmations
        this.timeout = 200;
        this.rpc = new RpcClient();
    }

    NewTransactor(privateKey) {
        let t = new Transactor(this, this.rpc.rpcHttpService.url);
        // by default, Transactors of SimpleWallet does NOT connect to coin service, but normal node instead
        t.useCoinsService = false;
        return t.setKey(privateKey)
        .then(_ => {
            return t;
        })
    }

    setProvider(url, user, password) {
        this.rpc = new RpcClient(url, user, password);
    }
}

const init = async (wasmFile) => {
    const {load} = require('./wasm/loader.js');
    wasmFile = wasmFile ||  __dirname + '/../privacy.wasm';
    return await load(wasmFile);
}

// these libraries are built to NodeJS (for testing / requiring from Node REPL etc.)
export {
    SimpleWallet,
    Transactor,
    Wallet,
    constants,
    types,
    utils,
    init
    // getEstimateFee,
    // getEstimateFeeForPToken,
}