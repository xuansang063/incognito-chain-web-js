// this file uses the ES module system to import names from web-js repo, plus BaseTrie class from merkle-patricia-tree.
// we will then wrap this into CommonJS using esm
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
    WithDrawRewardRequestMeta,
    PDEContributionMeta,
    PDEPRVRequiredContributionRequestMeta,
    PDETradeRequestMeta,
    PDECrossPoolTradeRequestMeta,
    PDEWithdrawalRequestMeta,
    PRVIDSTR,
    KeyWallet,
    base58CheckDeserialize,
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
    getShardIDFromLastByte
} from './common/common';
import {
    Transactor
} from './transactor';
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
    base58CheckDeserialize,
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
};
const types = {
    TxHistoryInfo,
    RpcClient,
    PaymentInfo,
    KeyWallet,
};

class Lib {
    constructor() {
        this.Name = "";
        this.timeout = 200;
        this.rpc = null;
        this.progressTx = 0;
    }

    NewTransactor(privateKey) {
        let t = new Transactor(this);
        return t.setKey(privateKey)
        .then(_ => {
            return t;
        })
    }

    async init(walletName = 'Default Wallet', wasmFile, incNodeUrl) {
        this.Name = walletName;

        this.setProvider(incNodeUrl);
        this.setPrivacy(wasmFile);
    }

    setProvider(url, user, password) {
        this.rpc = new RpcClient(url, user, password);
    }

    updateProgressTx(progress) {
        this.progressTx = progress;
    }
}

export {
    Lib,
    constants,
    types,
    utils,
    // DefaultStorage,
    // getEstimateFee,
    // getEstimateFeeForPToken,
}