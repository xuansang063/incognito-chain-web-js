import bn from 'bn.js';
import {
    CustomTokenInit,
    TxNormalType,
    TxCustomTokenPrivacyType,
    CustomTokenTransfer,
    MaxInputNumberForDefragment,
    MAX_INPUT_PER_TX,
} from './tx/constants';
// import {
//     KeyWallet
// } from "./hdwallet";
import {
    FailedTx,
    SuccessTx,
    MetaStakingBeacon,
    MetaStakingShard,
    PaymentAddressType,
    ReadonlyKeyType,
    PriKeyType,
    OTAKeyType,
    PDETradeRequestMeta,
    PDEWithdrawalRequestMeta,
    PDEContributionMeta,
    StopAutoStakingMeta,
    ShardStakingType,
    BurningRequestMeta,
    WithDrawRewardRequestMeta,
    PRVID,
    PRVIDSTR,
    PercentFeeToReplaceTx,
    encryptMessageOutCoin,
    decryptMessageOutCoin,
    getBurningAddress,
    TxHistoryInfo,
    KeyWallet
} from "./core";
import {
    checkEncode,
    checkDecode
} from "./base58";
import {
    // prepareInputForTx,
    prepareInputForTxV2,
    // prepareInputForTxPrivacyToken,
    getUnspentCoin,
    // newParamInitTx,
    // newParamInitPrivacyTokenTx,
    newParamTxV2,
    newTokenParamV2,
    // prepareInputForReplaceTxNormal,
    // prepareInputForReplaceTxPrivacyToken,
    // prepareInputForDefragments,
} from "./tx/utils";
import {
    ENCODE_VERSION,
    ED25519_KEY_SIZE
} from "./constants";
// import JSON from "circular-json";
import {
    convertHashToStr
} from "./common";
import {
    generateCommitteeKeyFromHashPrivateKey
} from "./committeekey";
import {
    hashSha3BytesToBytes,
    base64Decode,
    base64Encode,
    stringToBytes,
    bytesToString
} from "./privacy/utils";
import {
    CustomError,
    ErrorObject
} from './errorhandler';

import {addressToUnmarshallable} from './keySet';

import {wasm} from './wasm/loader';

class AccountWallet {
    constructor(w) {
    	this.Wallet = w;
        this.name = "";
        this.key = null;
        this.child = [];
        this.isImport = false;
        this.followingTokens = [];
        this.txHistory = {
            NormalTx: [],
            CustomTokenTx: [],
            PrivacyTokenTx: []
        };
        this.txReceivedHistory = {
            NormalTx: [],
            CustomTokenTx: [],
            PrivacyTokenTx: []
        };

        // derivatorPointCached is used for saving derivator (encoded) with corresponding encoded serial number in bytes array that was calculated before
        this.derivatorToSerialNumberCache = {}
            // spentCoinCached is used for cache spent coin
        this.spentCoinCached = {}
            // list of serial number of coins in tx in mempool
        this.spendingCoins = [];

        // isRevealViewKeyToGetCoins is true: reveal private viewing key when request for getting all output coins
        this.isRevealViewKeyToGetCoins = false;
    };



    /**
     * setIsRevealViewKeyToGetCoins updates isRevealViewKeyToGetCoins of AccountWallet
     * @param {bool} isRevealViewKeyToGetCoins
     */
    setIsRevealViewKeyToGetCoins(isRevealViewKeyToGetCoins) {
        this.isRevealViewKeyToGetCoins = isRevealViewKeyToGetCoins;
    }

    // addSpendingCoins adds spending coin object to spending coins list
    /**
     * @param {txID: string, spendingSNs: array} spendingCoinObj
     */
    addSpendingCoins(spendingCoinObj) {
        if (!this.spendingCoins) {
            this.spendingCoins = [];
        }

        this.spendingCoins.push(spendingCoinObj);
    }

    // removeObjectFromSpendingCoins removes spending coins in txId from list of spending coins
    /**
     *
     * @param {string} txId
     */
    removeObjectFromSpendingCoins(txId) {
        for (let i = 0; i < this.spendingCoins.length; i++) {
            if (this.spendingCoins[i].txID === txId) {
                this.spendingCoins.splice(i, 1);
                break;
            }
        }
    }

    // clearCached clears all caches
    clearCached() {
        this.derivatorToSerialNumberCache = {};
        this.spentCoinCached = {};

    }

    // saveAccountCached saves derivatorToSerialNumberCache and spentCoinCached for account
    /**
     *
     * @param {object} storage
     */
    saveAccountCached(storage) {
        const cacheObject = {
            derivatorToSerialNumberCache: this.derivatorToSerialNumberCache,
            spentCoinCached: this.spentCoinCached
        };

        const data = JSON.stringify(cacheObject);

        // storage
        if (storage != null) {
            return storage.setItem(`${this.name}-cached`, data);
        }
    }

    // loadAccountCached loads cache that includes derivatorToSerialNumberCache, inputCoinJsonCached and spentCoinCached for account
    /**
     *
     * @param {string} password
     * @param {object} storage
     */
    async loadAccountCached(storage) {
        if (storage != null) {
            const text = await storage.getItem(`${this.name}-cached`);
            if (!text) return false;
            const data = JSON.parse(text);
            this.derivatorToSerialNumberCache = data.derivatorToSerialNumberCache;
            this.spentCoinCached = data.spentCoinCached;
        }
    }

    // analyzeOutputCoinFromCached devides allOutputCoinStrs into list of cached output coins and list of uncached output coins
    /**
     *
     * @param {[Coin]} allOutputCoinStrs
     * @param {string} tokenID
     */
    analyzeOutputCoinFromCached(allOutputCoinStrs, tokenID) {
        if (!tokenID) {
            tokenID = PRVIDSTR;
        }
        this.derivatorToSerialNumberCache = this.derivatorToSerialNumberCache === undefined ? {} : this.derivatorToSerialNumberCache;
        let uncachedOutputCoinStrs = [];
        let cachedOutputCoinStrs = [];

        for (let i = 0; i < allOutputCoinStrs.length; i++) {
            const sndStr = `${tokenID}_${allOutputCoinStrs[i].KeyImage}`;

            if (this.derivatorToSerialNumberCache[sndStr] !== undefined) {
                allOutputCoinStrs[i].SerialNumber = this.derivatorToSerialNumberCache[sndStr];
                cachedOutputCoinStrs.push(allOutputCoinStrs[i]);
            } else {
                uncachedOutputCoinStrs.push(allOutputCoinStrs[i]);
            }
        }
        return {
            uncachedOutputCoinStrs: uncachedOutputCoinStrs,
            cachedOutputCoinStrs: cachedOutputCoinStrs,
        }
    }

    // mergeSpentCoinCached caches spent input coins to spentCoinCached
    /**
     *
     * @param {[Coin]} unspentCoinStrs
     * @param {[Coin]} unspentCoinStrsFromCache
     * @param {string} tokenID
     */
    async mergeSpentCoinCached(unspentCoinStrs, unspentCoinStrsFromCache, tokenID) {
        if (!tokenID) {
            tokenID = PRVIDSTR;
        }
        this.spentCoinCached = this.spentCoinCached === undefined ? {} : this.spentCoinCached;
        let chkAll = {};
        for (let i = 0; i < unspentCoinStrsFromCache.length; i++) {
            const sndStr = `${tokenID}_${unspentCoinStrsFromCache[i].SNDerivator}`;
            chkAll[sndStr] = true;
        }
        for (let i = 0; i < unspentCoinStrs.length; i++) {
            const sndStr = `${tokenID}_${unspentCoinStrs[i].SNDerivator}`;
            chkAll[sndStr] = false;
        }
        for (let sndStr in chkAll) {
            if (sndStr != undefined && chkAll[sndStr] === true) {
                this.spentCoinCached[sndStr] = true;
            }
        }
    }

    // analyzeSpentCoinFromCached returns input coins which it not existed in list of cached spent input coins
    /**
     *
     * @param {[Coin]} inCoinStrs
     * @param {string} tokenID
     */
    analyzeSpentCoinFromCached(inCoinStrs, tokenID) {
        if (!tokenID) {
            tokenID = PRVIDSTR;
        }
        this.spentCoinCached = this.spentCoinCached === undefined ? {} : this.spentCoinCached;
        let unspentInputCoinsFromCachedStrs = [];

        for (let i = 0; i < inCoinStrs.length; i++) {
            const sndStr = `${tokenID}_${inCoinStrs[i].SNDerivator}`;
            if (this.spentCoinCached[sndStr] === undefined) {
                unspentInputCoinsFromCachedStrs.push(inCoinStrs[i]);
            }
        }

        return {
            unspentInputCoinsFromCachedStrs: unspentInputCoinsFromCachedStrs,
        };
    }


    // listFollowingTokens returns list of following tokens
    listFollowingTokens() {
        return this.followingTokens;
    };

    // addFollowingToken adds token data array to following token list
    /**
     * @param {...{ID: string, Image: string, Name: string, Symbol: string, Amount: number, IsPrivacy: boolean, isInit: boolean, metaData: object}} tokenData - tokens to follow
     */
    addFollowingToken(...tokenData) {
        if (tokenData.constructor === Array) {
            const addedTokenIds = this.followingTokens.map(t => t.ID);
            const tokenDataSet = {};
            tokenData.forEach(t => {
                if (!addedTokenIds.includes(t.ID)) {
                    tokenDataSet[t.ID] = t;
                }
            });

            const tokens = Object.values(tokenDataSet);
            this.followingTokens.unshift(...tokens);
        }
    };

    // removeFollowingToken removes token which has tokenId from list of following tokens
    /**
     *
     * @param {string} tokenId
     */
    removeFollowingToken(tokenId) {
        const removedIndex = this.followingTokens.findIndex(token => token.ID === tokenId);
        if (removedIndex !== -1) {
            this.followingTokens.splice(removedIndex, 1);
        }
    }

    // saveNormalTxHistory save history of normal tx to history account
    /**
     * @param {{txId: string, typeTx: string, amountNativeToken: number, feeNativeToken: number, txStatus: number, lockTime: number}} tx
     *  @param {[string]} receivers
     * @param {bool} isIn
     * @param {bool} isPrivacy
     * @param {[string]} listUTXOForPRV
     * @param {string} hashOriginalTx
     */
    // saveNormalTxHistory(response, tx, amount, inputs, receivers, isIn, isPrivacyNativeToken,
    //     hashOriginalTx = "", metaData = null, info = "", messageForNativeToken = "") 
    saveNormalTxHistory(txResult, isIn, hashOriginalTx = "", messageForNativeToken = "") {
        let txHistory = new TxHistoryInfo();
        let response = txResult.Response;
        // check status of tx and add coins to spending coins
        let listUTXOForPRV = [];
        let listUTXOForPToken = [];
        let status = FailedTx;
        if (txResult.Response.txId) {
            status = SuccessTx;
            // add spending list
            let spendingSNs = [];
            for (let i = 0; i < txResult.Inputs.length; i++) {
                spendingSNs.push(txResult.Inputs[i].KeyImage);
                listUTXOForPRV.push(txResult.Inputs[i].PublicKey);
            }
            this.addSpendingCoins({
                txID: txResult.Response.txId,
                spendingSNs: spendingSNs
            });
            spendingSNs = [];
            if (txResult.TokenInputs){
	            for (let i = 0; i < txResult.TokenInputs.length; i++) {
	                spendingSNs.push(txResult.TokenInputs[i].KeyImage);
	                listUTXOForPToken.push(txResult.TokenInputs[i].PublicKey);
	            }
	            this.addSpendingCoins({
	                txID: txResult.Response.txId,
	                spendingSNs: spendingSNs
	            });
	        }
        }

        let historyObj = {
            txID: txResult.Response.txId,
            amountNativeToken: txResult.Amount, // in nano PRV
            amountPToken: txResult.TokenAmount,
            feeNativeToken: txResult.Tx.Fee, // in nano PRV
            feePToken: 0, // in nano PRV
            typeTx: txResult.Tx.Type,
            receivers: txResult.Receivers,
            tokenName: "",
            tokenID: txResult.TokenID,
            tokenSymbol: "",
            isIn: isIn,
            time: txResult.Tx.LockTime * 1000, // in mili-second
            status: status,
            isPrivacyNativeToken: txResult.IsPrivacy,
            isPrivacyForPToken: false,
            listUTXOForPRV: listUTXOForPRV,
            listUTXOForPToken: listUTXOForPToken,
            hashOriginalTx: hashOriginalTx,
            metaData: txResult.Metadata,
            info: txResult.Info,
            messageForNativeToken: messageForNativeToken,
            messageForPToken: ""
        }

        txHistory.setHistoryInfo(historyObj);
        let isPRV = (txResult.Tx.Type=="n") || (txResult.TokenInputs);
        if (isPRV){
        	this.txHistory.NormalTx.unshift(txHistory);
        }else{
        	this.txHistory.PrivacyTokenTx.unshift(txHistory);
        }
    };

    // getNormalTxHistory return history of normal txs
    getNormalTxHistory() {
        return this.txHistory.NormalTx;
    };

    // getTxHistoryByTxID returns tx history for specific tx id
    /**
     *
     * @param {string} txID
     */
    getTxHistoryByTxID(txID) {
        return this.txHistory.NormalTx.find(item => item.txID === txID) ||
            this.txHistory.PrivacyTokenTx.find(item => item.txID === txID) ||
            this.txHistory.CustomTokenTx.find(item => item.txID === txID)
    }

    // getPrivacyTokenTxHistoryByTokenID returns privacy token tx history with specific tokenID
    /**
     *
     * @param {string} id
     */
    getPrivacyTokenTxHistoryByTokenID(id) {
        let queryResult = new Array();
        for (let i = 0; i < this.txHistory.PrivacyTokenTx.length; i++) {
            if (this.txHistory.PrivacyTokenTx[i].tokenID === id)
                queryResult.push(this.txHistory.PrivacyTokenTx[i]);
        }
        return queryResult;
    }

    // fetchOutputCoins returns all output coins with tokenID
    // for native token: tokenId is null
    /**
     *
     * @param {string} tokenID
     * @param {RpcClient} rpcClient
     */
    async fetchOutputCoins(tokenID, rpcClient, version = "2") {
        let paymentAddrSerialize = this.key.base58CheckSerialize(PaymentAddressType);
        let readOnlyKeySerialize = this.key.base58CheckSerialize(ReadonlyKeyType);
        let otaKeySerialize = this.key.base58CheckSerialize(OTAKeyType);
        let privKeySerialize = "";
        let handle = async (res, sk, ver, ret) => {
        	let coins = res.outCoins;
        	// console.log(coins)
        	for (let i = 0; i < coins.length; i++) {
            	// match the desired version. Version -1 means any
            	if (ver==-1 || coins[i].Version==ver){
            		ret.push(coins[i]);
            	}
            }
            // finished
            return 0;
        }
        if (!this.isRevealViewKeyToGetCoins) {
            readOnlyKeySerialize = "";
            // otaKeySerialize = "";
            privKeySerialize = this.key.base58CheckSerialize(PriKeyType);
            handle = async (res, sk, ver, ret) => {
            	let coins = res.outCoins;
            	for (let i = 0; i < coins.length; i++) {
	            	// match the desired version. Version -1 means any
	            	if (ver==-1 || coins[i].Version==ver){
			            let params = {
			                Coin: coins[i],
			                KeySet: sk
			            }
			            try{
			                let coinStr = await wasm.decryptCoin(JSON.stringify(params));
			                let coin = JSON.parse(coinStr);
			                // console.log("decrypt coin", coin.PublicKey);
			                // console.log("from", params.Coin);
			                if (coins[i].Version==2 || res.next==0) ret.push(coin);
			            }catch(e){
                            console.error(e);
			            	console.log("skip coin", params.Coin.PublicKey);
			            }
			        }
	            }
	            // point to next height
	            return res.next;
            }
        }

        let req = async (paymentAddr, roKey, otaKey, tid, toHeight = 0) => {
	        try {
	            let res = await rpcClient.getOutputCoin(paymentAddr, roKey, otaKey, tid, toHeight, this.isRevealViewKeyToGetCoins);
	            return res;
	        } catch (e) {
	            throw new CustomError(ErrorObject.GetOutputCoinsErr, e.message || "Can not get output coins when get unspent token");
	        }
	    }
        
        let result = [];
        let h = 0;
        // this client config searches up to 9yrs
        for (let i = 0; i < 3000; i++) {
            try{
            	let response = await req(paymentAddrSerialize, readOnlyKeySerialize, otaKeySerialize, tokenID, h);
            	h = await handle(response, privKeySerialize, version, result);
            	if (h==0) break;
            }catch(e){
                console.error(e);
                throw e;
            }
        }
        return result;
    }

    // getUnspentToken returns unspent output coins with tokenID
    // for native token: tokenId is null
    /**
     *
     * @param {string} tokenID
     * @param {RpcClient} rpcClient
     */
    async getUnspentToken(tokenID, rpcClient, version = "2") {
        let paymentAddrSerialize = this.key.base58CheckSerialize(PaymentAddressType);
        // get all output coins of spendingKey
        let allOutputCoinStrs;
        try {
            allOutputCoinStrs = await this.fetchOutputCoins(tokenID, rpcClient, version);
        } catch (e) {
            throw new CustomError(ErrorObject.GetOutputCoinsErr, e.message || "Can not get output coins when get unspent token");
        }

        // devide all of output coins into uncached and cached out put coins list
        let { uncachedOutputCoinStrs, cachedOutputCoinStrs } = this.analyzeOutputCoinFromCached(allOutputCoinStrs, tokenID);

        // get unspent output coin from cache
        let { unspentInputCoinsFromCachedStrs } = this.analyzeSpentCoinFromCached(allOutputCoinStrs, tokenID);
        // check whether unspent coin from cache is spent or not
        let { unspentCoinStrs } = await getUnspentCoin(paymentAddrSerialize, unspentInputCoinsFromCachedStrs, tokenID, rpcClient);
        // cache spent output coins
        this.mergeSpentCoinCached(unspentCoinStrs, unspentInputCoinsFromCachedStrs, tokenID);

        if (!this.coinUTXOs) {
            this.coinUTXOs = {};
        }
        this.coinUTXOs[tokenID || PRVIDSTR] = unspentCoinStrs.length;

        return unspentCoinStrs;
    }

    // getBalance returns balance for token (native token or privacy token)
    // tokenID default is null: for PRV
    /**
     *
     * @param {string} tokenID
     */
    async getBalance(tokenID) {
        let unspentCoinStrs = await this.getUnspentToken(tokenID, this.Wallet.RpcClient, -1);


        let accountBalance = 0;
        for (let i = 0; i < unspentCoinStrs.length; i++) {
            accountBalance += parseInt(unspentCoinStrs[i].Value)
        }

        return accountBalance
    }

    // getAllPrivacyTokenBalance returns list of privacy token's balance
    /**
     *
     * @returns [{TokenID: string, Balance: number}]
     */
    async getAllPrivacyTokenBalance() {
        try {
            // get list privacy token
            let privacyTokens = await this.Wallet.RpcClient.listPrivacyCustomTokens();
            let pTokenList = privacyTokens.listPrivacyToken;

            // get balance for each privacy token
            let tasks = [];
            for (let i = 0; i < pTokenList.length; i++) {
                let tokenID = pTokenList[i].ID;

                const tokenBalanceItemPromise = new Promise((resolve) => {
                    this.getBalance(tokenID, -1)
                        .then(balance => {
                            resolve({
                                TokenID: tokenID,
                                Balance: balance,
                            });
                        })
                        .catch(() => null)
                });
                tasks.push(tokenBalanceItemPromise);
            }

            const allResult = await Promise.all(tasks);
            const hasBalanceResult = allResult && allResult.filter(r => r && r.Balance > 0)

            return hasBalanceResult;
        } catch (e) {

            throw e;
        }
    }

    /**
     *
     * @param {{paymentAddressStr: string (B58checkencode), amount: number, message: "" }} paramPaymentInfos
     * @param {number} fee
     * @param {bool} isPrivacy
     * @param {string} info
     */
    async createAndSendNativeToken(paramPaymentInfos, fee, isPrivacy, info = "", isEncryptMessageOutCoin = false, metadata = null) {
        // check fee
        if (fee < 0) {
            fee = 0
        }
        let messageForNativeToken = "";
        if (paramPaymentInfos.length > 0) {
            messageForNativeToken = paramPaymentInfos[0].Message;
        }
        await this.Wallet.updateProgressTx(10);

        const isEncodeOnly = !isEncryptMessageOutCoin;
        paramPaymentInfos = await encryptMessageOutCoin(this, paramPaymentInfos, isEncodeOnly);

        try {
            let result = await this.doPRVTransactionV2(paramPaymentInfos, fee, isPrivacy, metadata, info);
            this.saveNormalTxHistory(result, false, "", messageForNativeToken);
            await this.Wallet.updateProgressTx(100);
            return result.Response;
        } catch (e) {
            await this.Wallet.updateProgressTx(0);
            throw e;
        }
    };

    async doPRVTransactionV2(paramPaymentInfos, fee, isPrivacy, metadata, info, tokenID = null, tokenPayments = null, tokenParams = null) {
    	let receiverPaymentAddrStr = new Array(paramPaymentInfos.length);
        let totalAmountTransfer = new bn(0);
        for (let i = 0; i < paramPaymentInfos.length; i++) {
            receiverPaymentAddrStr[i] = paramPaymentInfos[i].paymentAddressStr;
            totalAmountTransfer = totalAmountTransfer.add(new bn(paramPaymentInfos[i].Amount));
            paramPaymentInfos[i].Amount = new bn(paramPaymentInfos[i].Amount).toString();
        }

        let inputForTx;
        try{
        	inputForTx = await prepareInputForTxV2(totalAmountTransfer, fee, null, this, this.Wallet.RpcClient);
        }catch(e){
    		throw new CustomError(ErrorObject.InitNormalTxErr, "Error while preparing inputs", e);
    	}

        if (inputForTx.inputCoinStrs.length > MAX_INPUT_PER_TX) {
            throw new CustomError(ErrorObject.TxSizeExceedErr);
        }
        await this.Wallet.updateProgressTx(30);

        let txParams = newParamTxV2(
            this.key,
            paramPaymentInfos,
            inputForTx.inputCoinStrs,
            fee,
            isPrivacy,
            null,
            metadata,
            info,
            inputForTx.coinsForRing
        );
        // handle token transfer
        let tokenReceiverPaymentAddrStr = [];
        let totalAmountTokenTransfer = new bn(0);
        let inputForToken = {
        	inputCoinStrs: [],
        	coinsForRing: {}
        };
        // tokenID is non-null when transferring token; tokenParams is non-null when creating new token
        if (tokenPayments){
        	let isInit = Boolean(tokenParams);
        	let isTransfer = Boolean(tokenID);
        	if (!(isInit || isTransfer)){
        		throw new CustomError(ErrorObject.InitNormalTxErr, "Invalid Token parameters");
        	}
        	tokenReceiverPaymentAddrStr = new Array(tokenPayments.length);
	        for (let i = 0; i < tokenPayments.length; i++) {
	            receiverPaymentAddrStr[i] = tokenPayments[i].paymentAddressStr;
	            totalAmountTokenTransfer = totalAmountTokenTransfer.add(new bn(tokenPayments[i].Amount));
	            tokenPayments[i].Amount = new bn(tokenPayments[i].Amount).toString();
	        }
	        if (isTransfer){
	        	try{
	        		inputForToken = await prepareInputForTxV2(totalAmountTokenTransfer, 0, tokenID, this, this.Wallet.RpcClient);
	        	}catch(e){
	        		throw new CustomError(ErrorObject.InitNormalTxErr, "Error while preparing inputs");
	        	}
	        }
	        tokenParams = newTokenParamV2(
	            tokenPayments,
	            inputForToken.inputCoinStrs,
	            tokenID,
	            inputForToken.coinsForRing,
	            tokenParams || {}
	        );
	        txParams.TokenParams = tokenParams;
        }
        // console.log("params are",txParams);

        let txParamsJson = JSON.stringify(txParams);
        let theirTime = await this.Wallet.RpcClient.getNodeTime();
        let b58EncodedTx = await wasm.createTransaction(txParamsJson, theirTime);
        if (b58EncodedTx === null || b58EncodedTx === "") {
            throw new CustomError(ErrorObject.InitNormalTxErr, "Can not init transaction tranfering PRV");
        }
        let tempBuf = checkDecode(b58EncodedTx).bytesDecoded;
        let theString = new TextDecoder("utf-8").decode(tempBuf);
        let txObj = JSON.parse(theString);
        console.log("TX: ", txObj);
        // console.log("Encoded: ", b58EncodedTx)

        await this.Wallet.updateProgressTx(60);
        let response;
        try {
        	if (tokenPayments){
            	response = await this.Wallet.RpcClient.sendRawTxCustomTokenPrivacy(b58EncodedTx);
            }else{
            	response = await this.Wallet.RpcClient.sendRawTx(b58EncodedTx);
            }
        } catch (e) {
            throw new CustomError(ErrorObject.SendTxErr, "Can not send PRV transaction", e);
        }
        await this.Wallet.updateProgressTx(90)
        // console.log("Received", response)
        if (response.TokenID && response.TokenID.length>0){
        	tokenID = response.TokenID;
        }
        return {
        	Response: response,
        	Tx: txObj,
        	Amount: totalAmountTransfer.toNumber(),
        	Inputs: inputForTx.inputCoinStrs,
        	Receivers: receiverPaymentAddrStr,
        	TokenID: tokenID,
        	TokenAmount: totalAmountTokenTransfer.toNumber(),
        	TokenInputs: inputForToken.inputCoinStrs,
        	TokenReceivers: tokenReceiverPaymentAddrStr,
        	IsPrivacy: isPrivacy,
        	Metadata: metadata,
        }
    }

    async createAndSendConvertTx(paramPaymentInfos, fee, info = "", isEncryptMessageOutCoin = false) {
        // check fee
        if (fee < 0) {
            fee = 0
        }
        let messageForNativeToken = "";
        if (paramPaymentInfos.length > 0) {
            messageForNativeToken = paramPaymentInfos[0].Message;
        }
        await this.Wallet.updateProgressTx(10);
        const isEncodeOnly = !isEncryptMessageOutCoin;
        paramPaymentInfos = await encryptMessageOutCoin(this, paramPaymentInfos, isEncodeOnly);

        try {
            let result = await this.doConvertTx(paramPaymentInfos, fee, info);
            this.saveNormalTxHistory(result, false, "", messageForNativeToken);
            await this.Wallet.updateProgressTx(100);
            return result.Response;
        } catch (e) {
            await this.Wallet.updateProgressTx(0);
            throw e;
        }
    };

    async createAndSendTokenConvertTx(tokenID, prvPaymentInfo, tokenPaymentInfo, fee, info = "", isEncryptMessage = false, isEncryptMessageToken = false) {
        // check fee
        if (fee < 0) {
            fee = 0
        }
        let messageForNativeToken = "";
        if (prvPaymentInfo.length > 0) {
            messageForNativeToken = prvPaymentInfo[0].Message;
        }
        await this.Wallet.updateProgressTx(10);
        let isEncodeOnly = !isEncryptMessage;
        prvPaymentInfo = await encryptMessageOutCoin(this, prvPaymentInfo, isEncodeOnly);
        isEncodeOnly = !isEncryptMessageToken;
        tokenPaymentInfo = await encryptMessageOutCoin(this, tokenPaymentInfo, isEncodeOnly);

        await this.Wallet.updateProgressTx(30);

        try {
            let result = await this.doConvertTx(prvPaymentInfo, fee, info, tokenID, tokenPaymentInfo);
            this.saveNormalTxHistory(result, false, "", messageForNativeToken);
            await this.Wallet.updateProgressTx(100);
            return result.Response;
        } catch (e) {
            await this.Wallet.updateProgressTx(0);
            throw e;
        }
    };

    async doConvertTx(paramPaymentInfos, fee, info, tokenID = null, tokenPayments = null, numOfDefragInputs = 0) {
    	let isPrivacy = false;
    	let metadata = null;
    	let receiverPaymentAddrStr = new Array(paramPaymentInfos.length);
        let totalAmountTransfer = new bn(0);
        for (let i = 0; i < paramPaymentInfos.length; i++) {
            receiverPaymentAddrStr[i] = paramPaymentInfos[i].paymentAddressStr;
            totalAmountTransfer = totalAmountTransfer.add(new bn(paramPaymentInfos[i].Amount));
            paramPaymentInfos[i].Amount = new bn(paramPaymentInfos[i].Amount).toString();
        }
        let isTokenConvert = (tokenID && tokenPayments);
        let isDefrag = numOfDefragInputs > 0;
        if (isDefrag && isTokenConvert){
        	throw new CustomError(ErrorObject.SendTxErr, "Error: token defragment is not supported");
        }
    	let inputForTx;
    	try{
    		if (isTokenConvert){
    			// converting token. We need v2 PRV coins
    			inputForTx = await prepareInputForTxV2(totalAmountTransfer, fee, null, this, this.Wallet.RpcClient);
    		}else{
    			// 0 means convert, otherwise we defrag
    			if (isDefrag){
        			inputForTx = await prepareInputForTxV2(-1, fee, null, this, this.Wallet.RpcClient, 2, 20, numOfDefragInputs);
        		}else{
        			inputForTx = await prepareInputForTxV2(-1, fee, null, this, this.Wallet.RpcClient, 1, 0);
        		}
        	}
        }catch(e){
        	throw new CustomError(ErrorObject.SendTxErr, "Can not prepare inputs", e);
        }
        if (inputForTx.inputCoinStrs.length > MAX_INPUT_PER_TX) {
            throw new CustomError(ErrorObject.TxSizeExceedErr);
        }
        await this.Wallet.updateProgressTx(30);
        
        let txParams = newParamTxV2(
            this.key,
            paramPaymentInfos,
            inputForTx.inputCoinStrs,
            fee,
            isPrivacy,
            null,
            null,
            info,
            inputForTx.coinsForRing
        );
        // handle token transfer
        let tokenReceiverPaymentAddrStr = [];
        let totalAmountTokenTransfer = new bn(0);
        let inputForToken = {};
        if (isTokenConvert){
        	tokenReceiverPaymentAddrStr = new Array(tokenPayments.length);
	        for (let i = 0; i < tokenPayments.length; i++) {
	            receiverPaymentAddrStr[i] = tokenPayments[i].paymentAddressStr;
	            totalAmountTokenTransfer = totalAmountTokenTransfer.add(new bn(tokenPayments[i].Amount));
	            tokenPayments[i].Amount = new bn(tokenPayments[i].Amount).toString();
	        }
	        inputForToken = await prepareInputForTxV2(-1, 0, tokenID, this, this.Wallet.RpcClient, 1, 0);
	        let tokenParams = newTokenParamV2(
	            tokenPayments,
	            inputForToken.inputCoinStrs,
	            tokenID,
	            inputForToken.coinsForRing
	        );
	        txParams.TokenParams = tokenParams;
        }
        // console.log("params are",txParams);

        let txParamsJson = JSON.stringify(txParams);
        let b58EncodedTx;
        let theirTime = await this.Wallet.RpcClient.getNodeTime();
        if (isDefrag){
        	b58EncodedTx = await wasm.createTransaction(txParamsJson, theirTime);
        }else{
        	b58EncodedTx = await wasm.createConvertTx(txParamsJson, theirTime);
        }
        if (b58EncodedTx === null || b58EncodedTx === "") {
            throw new CustomError(ErrorObject.InitNormalTxErr, "Can not init transaction tranfering PRV");
        }
        let tempBuf = checkDecode(b58EncodedTx).bytesDecoded;
        let theString = new TextDecoder("utf-8").decode(tempBuf);
        let txObj = JSON.parse(theString);
        console.log("TX: ", txObj);

        await this.Wallet.updateProgressTx(60);
        let response;
        try {
        	if (tokenID && tokenPayments){
            	response = await this.Wallet.RpcClient.sendRawTxCustomTokenPrivacy(b58EncodedTx);
            }else{
            	response = await this.Wallet.RpcClient.sendRawTx(b58EncodedTx);
            }
        } catch (e) {
            throw new CustomError(ErrorObject.SendTxErr, "Can not send PRV transaction", e);
        }
        await this.Wallet.updateProgressTx(90)
        return {
        	Response: response,
        	Tx: txObj,
        	Amount: totalAmountTransfer.toNumber(),
        	Inputs: inputForTx.inputCoinStrs,
        	Receivers: receiverPaymentAddrStr,
        	TokenAmount: totalAmountTokenTransfer.toNumber(),
        	TokenInputs: inputForToken.inputCoinStrs,
        	TokenReceivers: tokenReceiverPaymentAddrStr,
        	IsPrivacy: isPrivacy,
        	Metadata: metadata,
        }
    }

    // staking tx always send PRV to burning address with no privacy
    // type: 0 for shard
    // type: 1 for beacon
    /**
     *
     * @param {{type: number}} param
     * @param {number} feeNativeToken
     * @param {string} candidatePaymentAddress
     * @param {string} candidateMiningSeedKey
     * @param {string} rewardReceiverPaymentAddress
     * @param {bool} autoReStaking
     */
    async createAndSendStakingTx(param, feeNativeToken, candidatePaymentAddress, candidateMiningSeedKey, rewardReceiverPaymentAddress, autoReStaking = true) {
        await this.Wallet.updateProgressTx(10);
        // check fee
        if (feeNativeToken < 0) {
            feeNativeToken = 0
        }
        // get amount staking
        let amountBN = new bn("1750000000000", 10);
        let feeBN = new bn(feeNativeToken);

        // generate committee key
        let candidateKeyWallet = KeyWallet.base58CheckDeserialize(candidatePaymentAddress);
        let publicKeyBytes = candidateKeyWallet.KeySet.PaymentAddress.Pk;
        let candidateHashPrivateKeyBytes = checkDecode(candidateMiningSeedKey).bytesDecoded;
        let committeeKey;
        try {
            committeeKey = await generateCommitteeKeyFromHashPrivateKey(candidateHashPrivateKeyBytes, publicKeyBytes);
        } catch (e) {
            throw e;
        }
        let paymentAddressStr = this.key.base58CheckSerialize(PaymentAddressType);

        let type = param.type === ShardStakingType ? MetaStakingShard : MetaStakingBeacon;
        let meta = {
            Type: type,
            FunderPaymentAddress: paymentAddressStr,
            RewardReceiverPaymentAddress: rewardReceiverPaymentAddress,
            StakingAmountShard: amountBN.toNumber(),
            CommitteePublicKey: committeeKey,
            AutoReStaking: autoReStaking,
        };

        let burningAddress = await getBurningAddress(this.Wallet.RpcClient);
        let paramPaymentInfos = [{
            PaymentAddress: burningAddress,
            Amount: amountBN.toString(),
            Message: ""
        }];

        let messageForNativeToken = paramPaymentInfos[0].Message;

        try {
            let result = await this.doPRVTransactionV2(paramPaymentInfos, feeNativeToken, false, meta, "");
            this.saveNormalTxHistory(result, false, "", messageForNativeToken);
            await this.Wallet.updateProgressTx(100);
            return result.Response;
        } catch (e) {
            await this.Wallet.updateProgressTx(0);
            throw e;
        }
	}

    // staking tx always send PRV to burning address with no privacy
    // type: 0 for shard
    // type: 1 for beacon
    /**
     *
     * @param {{type: number}} param
     * @param {number} feeNativeToken
     * @param {string} candidatePaymentAddress
     * @param {string} candidateMiningSeedKey
     * @param {string} rewardReceiverPaymentAddress
     * @param {bool} autoReStaking
     */
    async createAndSendStopAutoStakingTx(feeNativeToken, candidatePaymentAddress, candidateMiningSeedKey) {        
        // check fee
        if (feeNativeToken < 0) {
            feeNativeToken = 0
        }
        let amountBN = new bn(0);
        let feeBN = new bn(feeNativeToken);
        await this.Wallet.updateProgressTx(10);

        // generate committee key
        let candidateKeyWallet = KeyWallet.base58CheckDeserialize(candidatePaymentAddress);
        let publicKeyBytes = candidateKeyWallet.KeySet.PaymentAddress.Pk;

        let candidateHashPrivateKeyBytes = checkDecode(candidateMiningSeedKey).bytesDecoded;

        const committeeKey = await generateCommitteeKeyFromHashPrivateKey(candidateHashPrivateKeyBytes, publicKeyBytes);

        let meta = {
            Type: StopAutoStakingMeta,
            CommitteePublicKey: committeeKey
        };

        let burningAddress = await getBurningAddress(this.Wallet.RpcClient);
        let paramPaymentInfos = [{
            PaymentAddress: burningAddress,
            Amount: "0",
            Message: ""
        }];
        let messageForNativeToken = paramPaymentInfos[0].Message;

        try {
            let result = await this.doPRVTransactionV2(paramPaymentInfos, feeNativeToken, false, meta, "");
            this.saveNormalTxHistory(result, false, "", messageForNativeToken);
            await this.Wallet.updateProgressTx(100);
            return result.Response;
        } catch (e) {
            await this.Wallet.updateProgressTx(0);
            throw e;
        }
    }

    /**
     *
     * @param {{paymentAddressStr: string, amount: number, message: string}} paramPaymentInfosForNativeToken
     * @param {{Privacy: bool, TokenID: string, TokenName: string, TokenSymbol: string, TokenTxType: bool, TokenAmount: number, TokenReceivers : [{PaymentAddress: string, Amount: number, Message: string}]}} submitParam
     * @param {number} feeNativeToken
     * @param {number} feePToken
     * @param {bool} hasPrivacyForNativeToken
     * @param {bool} hasPrivacyForPToken
     * @param {string} info
     */
    async createAndSendPrivacyToken(
        tokenID,
        prvPaymentInfo = [],
        tokenPaymentInfo,
        feeNativeToken,
        isPrivacy,
        info = "",
        isEncryptMessageOutCoinNativeToken = false,
        isEncryptMessageOutCoinPToken = false,
        tokenParams = {},
        metadata = null
    ) {
    	if (feeNativeToken < 0) {
            feeNativeToken = 0
        }
        await this.Wallet.updateProgressTx(10);

        let messageForNativeToken = "";
        if (prvPaymentInfo.length > 0) {
            messageForNativeToken = prvPaymentInfo[0].Message;
        }
        let messageForPToken = tokenPaymentInfo[0].Message;
        let isEncodeOnly = !isEncryptMessageOutCoinNativeToken;
        prvPaymentInfo = await encryptMessageOutCoin(this, prvPaymentInfo, isEncodeOnly);
        isEncodeOnly = !isEncryptMessageOutCoinPToken;
        tokenPaymentInfo = await encryptMessageOutCoin(this, tokenPaymentInfo, isEncodeOnly);

        try {
            let result = await this.doPRVTransactionV2(prvPaymentInfo, feeNativeToken, isPrivacy, metadata, info, tokenID, tokenPaymentInfo, tokenParams);
            this.saveNormalTxHistory(result, false, "", messageForNativeToken);
            await this.Wallet.updateProgressTx(100);
            return result.Response;
        } catch (e) {
            await this.Wallet.updateProgressTx(0);
            throw e;
        }
    };

    // TODO: need to update later
    // recursively sweep up everything into one UTXO
    async defragmentNativeCoin(fee, isPrivacy = true, noOfInputPerTx = MaxInputNumberForDefragment) {
    	
        await this.Wallet.updateProgressTx(10);
        const info = base64Encode(Uint8Array.from("defragment"));

        // loop up to 30 times
        for (let i=0;i<MaxInputNumberForDefragment;i++){
	        try{
	        	let inputForTx;
		        try{
		        	inputForTx = await prepareInputForTxV2(-1, fee, null, this, this.Wallet.RpcClient, 2, 0, noOfInputPerTx);
		        }catch(e){
		    		throw new CustomError(ErrorObject.InitNormalTxErr, "Error while preparing inputs", e);
		    	}
		    	console.log("We still have", inputForTx.inputCoinStrs.length, "coins")
		    	if (inputForTx.inputCoinStrs.length==1){
		    		break;
		    	}
		    	try {
		            let result = await this.doConvertTx([], fee, info, null, null, noOfInputPerTx);
		            await this.Wallet.updateProgressTx(100);
		            console.log("Sent Defrag TX: ", result.Response);
		            await this.Wallet.sleep(20000);
		            console.log("Yielding for block confirmation");
		        } catch (e) {
		            await this.Wallet.updateProgressTx(0);
		            throw e;
		        }
	        } catch (e) {
	            await this.Wallet.updateProgressTx(0);
	            throw e;
	        }
	    }
    }

    // createAndSendBurningRequestTx create and send tx burning ptoken when withdraw
    // remoteAddress (string) is an ETH/BTC address which users want to receive ETH/BTC (without 0x)
    /**
     *
     * @param {...{paymentAddressStr: string, amount: number, message: string}} paramPaymentInfosForNativeToken
     * @param {{Privacy: bool, TokenID: string, TokenName: string, TokenSymbol: string, TokenTxType: bool, TokenAmount: number, TokenReceivers : {PaymentAddress: string, Amount: number, Message: string}}} submitParam
     * @param {number} feeNativeToken
     * @param {number} feePToken
     * @param {string} remoteAddress
     */
    async createAndSendBurningRequestTx(
        prvPaymentInfo = [],
        fee,
        burningTokenID,
        remoteAddress,
        burnAmount,
        info = "",
        burningType = BurningRequestMeta,
        isEncryptMessageOutCoinNativeToken = false,
        isEncryptMessageOutCoinPToken = false,
    ) {
        if (remoteAddress.startsWith("0x")) {
            remoteAddress = remoteAddress.slice(2);
        }
        if (fee < 0) {
            fee = 0
        }
        await this.Wallet.updateProgressTx(10);

        let burningAddress = await getBurningAddress(this.Wallet.RpcClient);
        let tokenPaymentInfo = [{
            PaymentAddress: burningAddress,
            Amount: new bn(burnAmount).toString(),
            Message: ""
        }];
        let messageForNativeToken = "";
        if (prvPaymentInfo.length>0){
			messageForNativeToken = prvPaymentInfo[0].Message;
		}
		let isEncodeOnly = !isEncryptMessageOutCoinNativeToken;
        prvPaymentInfo = await encryptMessageOutCoin(this, prvPaymentInfo, isEncodeOnly);
        isEncodeOnly = !isEncryptMessageOutCoinPToken;
        tokenPaymentInfo = await encryptMessageOutCoin(this, tokenPaymentInfo, isEncodeOnly);
        await this.Wallet.updateProgressTx(30);
        
        let addrForMd = addressToUnmarshallable(this.key.KeySet.PaymentAddress);
        const paymentAddressStr = this.key.base58CheckSerialize(PaymentAddressType);

        // prepare meta data for tx
        let burningReqMetadata = {
            BurnerAddress: addrForMd,
            BurningAmount: burnAmount,
            TokenID: burningTokenID,
            RemoteAddress: remoteAddress,
            Type: burningType,
        };
        try {
        	let result = await this.doPRVTransactionV2(prvPaymentInfo, fee, false, burningReqMetadata, info, burningTokenID, tokenPaymentInfo);
            this.saveNormalTxHistory(result, false, "", messageForNativeToken);
            await this.Wallet.updateProgressTx(100);
            return result.Response;
        } catch (e) {
            await this.Wallet.updateProgressTx(0);
            throw e;
        }
    };

    // getRewardAmount returns amount rewards
    // if isGetAll is true: return all of reward types (such as PRV, pToken,..)
    /**
     *
     * @param {string} paymentAddrStr
     * @param {bool} isGetAll
     * @param {string} tokenID
     * @returns {number} (if isGetAll = false)
     * @returns {map[TokenID] : number} (if isGetAll = true)
     */
    static async getRewardAmount(paymentAddrStr, isGetAll = true, tokenID = "") {
        let resp;
        try {
            resp = await this.Wallet.RpcClient.getRewardAmount(paymentAddrStr);
        } catch (e) {

            throw new CustomError(ErrorObject.GetRewardAmountErr, "Can not get reward amount");
        }

        if (isGetAll) {
            return resp.rewards;
        } else {
            if (tokenID === "") {
                tokenID = "PRV";
            }

            return resp.rewards[tokenID];
        }
    }

    // createAndSendWithdrawRewardTx create and send tx withdraw reward amount
    /**
     *
     * @param {string} tokenID
     */
    async createAndSendWithdrawRewardTx(fee, tokenID = null) {
    	
        if (!tokenID || tokenID === "") {
            tokenID = convertHashToStr(PRVID)
        }

        // let senderSkStr = this.key.base58CheckSerialize(PriKeyType);
        // let paymentAddressStr = this.key.base58CheckSerialize(PaymentAddressType);
        let addrForMd = addressToUnmarshallable(this.key.KeySet.PaymentAddress);
        let md = {
            Type: WithDrawRewardRequestMeta,
            PaymentAddress: addrForMd,
            TokenID: tokenID
        };
        let isPrivacy = false;

        try {
        	let result = await this.doPRVTransactionV2([], fee, isPrivacy, md, "");
            this.saveNormalTxHistory(result, false, "", "");
            await this.Wallet.updateProgressTx(100);
            return result.Response;
        } catch (e) {
            await this.Wallet.updateProgressTx(0);
            throw e;
        }
    }

    // toSerializedAccountObj returns account with encoded key set
    toSerializedAccountObj() {
        return {
            "AccountName": this.name,
            "PrivateKey": this.key.base58CheckSerialize(PriKeyType),
            "PaymentAddress": this.key.base58CheckSerialize(PaymentAddressType),
            "ReadonlyKey": this.key.base58CheckSerialize(ReadonlyKeyType),
            "PublicKey": this.key.getPublicKeyByHex(),
            "PublicKeyCheckEncode": this.key.getPublicKeyCheckEncode(),
            "PublicKeyBytes": this.key.KeySet.PaymentAddress.Pk.toString(),
            "ValidatorKey": checkEncode(hashSha3BytesToBytes(hashSha3BytesToBytes(this.key.KeySet.PrivateKey)), ENCODE_VERSION),
        }
    }

    /**
     *
     */
    // stakerStatus return status of staker
    // return object {{Role: int, ShardID: int}}
    // Role: -1: is not staked, 0: candidate, 1: validator
    // ShardID: beacon: -1, shardID: 0->MaxShardNumber
    async stakerStatus() {
        let blsPubKeyB58CheckEncode = await this.key.getBLSPublicKeyB58CheckEncode();


        let reps;
        try {
            reps = await this.Wallet.RpcClient.getPublicKeyRole("bls:" + blsPubKeyB58CheckEncode);
        } catch (e) {
            throw e;
        }

        return reps.status;
    }


    /********************** DEX **********************/
    /**
     *
     * @param {number} fee
     * @param {string} pdeContributionPairID
     * @param {number} contributedAmount
     * @param {string} info
     */
    async createAndSendTxWithContribution(fee, pdeContributionPairID, contributedAmount, info = "", tokenIDStr = null) {
        if (fee < 0) {
            fee = 0
        }
        let isPrivacy = false; // always false
        let burningAddress = await getBurningAddress(this.Wallet.RpcClient);
        let paramPaymentInfos = [{
            PaymentAddress: burningAddress,
            Amount: new bn(contributedAmount).toString(),
            Message: ""
        }];
        let messageForNativeToken = paramPaymentInfos[0].Message;
        await this.Wallet.updateProgressTx(10);

        let contributorAddressStr = this.key.base58CheckSerialize(PaymentAddressType);
        let isToken = true;
        if (!tokenIDStr){
        	isToken = false;
        	tokenIDStr = convertHashToStr(PRVID);
        }
        // prepare meta data for tx
        let metadata = {
            PDEContributionPairID: pdeContributionPairID,
            ContributorAddressStr: contributorAddressStr,
            ContributedAmount: contributedAmount,
            TokenIDStr: tokenIDStr,
            Type: PDEContributionMeta,
        };

        try {
        	let result;
        	if (isToken){
        		result = await this.doPRVTransactionV2([], fee, isPrivacy, metadata, info, tokenIDStr, paramPaymentInfos);
        	}else{
            	result = await this.doPRVTransactionV2(paramPaymentInfos, fee, isPrivacy, metadata, info);
            }
            this.saveNormalTxHistory(result, false, "", messageForNativeToken);
            await this.Wallet.updateProgressTx(100);
            return result.Response;
        } catch (e) {
            await this.Wallet.updateProgressTx(0);
            throw e;
        }
    };

    /**
     *
     * @param {number} fee
     * @param {string} pdeContributionPairID
     * @param {number} sellAmount
     * @param {number} minimumAcceptableAmount
     * @param {number} tradingFee
     * @param {string} info
     */
    async createAndSendNativeTokenTradeRequestTx(fee, tokenIDToBuyStr, sellAmount, minimumAcceptableAmount, tradingFee, info = "", tokenIDToSellStr = null) {
        if (fee < 0) {
            fee = 0
        }
        let isPrivacy = false; // always false
		await this.Wallet.updateProgressTx(10);
        const burningAddress = await getBurningAddress(this.Wallet.RpcClient);
        const amount = sellAmount + tradingFee;
        const paramPaymentInfos = [{
            PaymentAddress: burningAddress,
            Amount: amount,
            Message: "",
        }];
        let messageForNativeToken = paramPaymentInfos[0].Message;

        let myAddressStr = this.key.base58CheckSerialize(PaymentAddressType);
        let pInf = {
        	PaymentAddress: myAddressStr,
        	Amount: "0"
        }
        let newCoin;
        try {
        	let temp = await wasm.createCoin(JSON.stringify({PaymentInfo : pInf, TokenID: null}));
        	newCoin = JSON.parse(temp);
        	await this.Wallet.updateProgressTx(20);
        }catch(e){
        	await this.Wallet.updateProgressTx(0);
            throw e;
        }
        console.log("created new OTA in", newCoin);
        
        let isToken = true;
        let prv = convertHashToStr(PRVID);
        if (!tokenIDToSellStr || tokenIDToSellStr==prv){
        	isToken = false;
        	tokenIDToSellStr = prv;
        }

        // prepare meta data for tx
        let metadata = {
            TokenIDToBuyStr: tokenIDToBuyStr,
            TokenIDToSellStr: tokenIDToSellStr,
            SellAmount: sellAmount,
            TraderAddressStr: newCoin.PublicKey,
            Type: PDETradeRequestMeta,
            MinAcceptableAmount: minimumAcceptableAmount,
            TradingFee: tradingFee,
            TxRandomStr: newCoin.TxRandom
        };

        try {
        	let result;
        	if (isToken){
        		result = await this.doPRVTransactionV2([], fee, isPrivacy, metadata, info, tokenIDToSellStr, paramPaymentInfos);
        	}else{
            	result = await this.doPRVTransactionV2(paramPaymentInfos, fee, isPrivacy, metadata, info);
            }
            this.saveNormalTxHistory(result, false, "", messageForNativeToken);
            await this.Wallet.updateProgressTx(100);
            return result.Response;
        } catch (e) {
            await this.Wallet.updateProgressTx(0);
            throw e;
        }
    };

    async getReceivedTransaction() {
        let rpcClient = this.Wallet.RpcClient;
        // call api to get info from node
        const paymentAddress = this.key.base58CheckSerialize(PaymentAddressType);
        const viewingKey = this.key.base58CheckSerialize(ReadonlyKeyType);

        // cal rpc to get data
        let txs = await rpcClient.getTransactionByReceiver(paymentAddress, viewingKey);
        txs = txs.receivedTransactions;
        if (txs.length > 0) {
            this.txReceivedHistory.NormalTx = [];
            this.txReceivedHistory.PrivacyTokenTx = [];
            this.txReceivedHistory.CustomTokenTx = [];
        }
        for (let i = 0; i < txs.length; i++) {
            // loop and parse into history tx object
            const tx = txs[i].TransactionDetail;

            let messageForNativeToken = "";
            let messageForPToken = "";
            if (txs[i].ReceivedAmounts[PRVIDSTR]) {
                try{
                	messageForNativeToken = await decryptMessageOutCoin(this, txs[i].TransactionDetail.ProofDetail.OutputCoins[0].Info);
                }catch (e){
                	console.log("Skipping message because", e); // skip
                }
            }
            if (txs[i].ReceivedAmounts[tx.PrivacyCustomTokenID]) {
            	console.log(txs[i].TransactionDetail.PrivacyCustomTokenProofDetail)
            	try{
                	messageForPToken = await decryptMessageOutCoin(this, this, txs[i].TransactionDetail.PrivacyCustomTokenProofDetail.OutputCoins[0].Info);
                }catch (e){
                	console.log("Skipping message because", e); // skip
                }
            }

            let infoDecode = tx.Info;
            if (infoDecode) {
                infoDecode = checkDecode(tx.Info).bytesDecoded;
                infoDecode = bytesToString(infoDecode);
            }
            // console.log("TX", tx);

            try {
                const historyObj = {
                    txID: tx.Hash,
                    amountNativeToken: txs[i].ReceivedAmounts[PRVIDSTR], // in nano PRV
                    amountPToken: txs[i].ReceivedAmounts[tx.PrivacyCustomTokenID],
                    feeNativeToken: tx.Fee, // in nano PRV
                    feePToken: tx.PrivacyCustomTokenFee,
                    typeTx: tx.Type,
                    receivers: null,
                    tokenName: tx.PrivacyCustomTokenName,
                    tokenID: tx.PrivacyCustomTokenID,
                    tokenSymbol: tx.PrivacyCustomTokenIDSymbol,
                    isIn: true,
                    time: (new Date(tx.LockTime)).getTime(), // in mili-second
                    status: null,
                    isPrivacyNativeToken: null,
                    isPrivacyForPToken: null,
                    listUTXOForPRV: [],
                    listUTXOForPToken: [],
                    hashOriginalTx: "",
                    metaData: tx.Metadata,
                    info: infoDecode,
                    messageForNativeToken: messageForNativeToken,
                    messageForPToken: messageForPToken,
                };

                let txHistoryInfo = new TxHistoryInfo();
                txHistoryInfo.setHistoryInfo(historyObj);
                switch (tx.Type) {
                    case TxNormalType:
                        {
                            this.txReceivedHistory.NormalTx.push(txHistoryInfo);
                            break;
                        }
                    case TxCustomTokenPrivacyType:
                        {
                            this.txReceivedHistory.PrivacyTokenTx.push(txHistoryInfo)
                            break;
                        }
                }
            } catch (e) {
                throw e;
            }
        }
        return this.txReceivedHistory;
    };

    async generateIncognitoContractAddress(privateKey) {
        return generateIncognitoContractAddress(JSON.stringify({
            privateKey,
        }));
    }

}

export {
    AccountWallet
};