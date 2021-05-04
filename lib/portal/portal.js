import {
    PortalParams
} from './params';

import {
    base64Encode
} from '../privacy/utils';

import {
    wasm
} from '../wasm/loader';

import {
    PortalV4UnshieldRequestMeta
} from '../core';

class Portal {
    /**
     * @param {string} chainName - testnet/mainnet
     */
    constructor(chainName) {
        this.Params = new PortalParams(chainName)
    }

    async generateBTCMultisigAddress(paymentAddressStr) {
        let masterPubKeysEncoded = new Array()
        this.Params.MasterPubKeys.forEach(function(item, _index, _array) {
            masterPubKeysEncoded.push(base64Encode(item))
        })
        let params = {
            MasterPubKeys: masterPubKeysEncoded,
            NumSigsRequired: this.Params.NumSigsRequired,
            ChainName: this.Params.ChainName,
            ChainCodeSeed: paymentAddressStr,
        }
        let resp = await wasm.generateBTCMultisigAddress(JSON.stringify(params), paymentAddressStr)
        return String(resp)
    }

      // createAndSendUnshieldPortalV4RequestTx create and send tx unshield ptoken portalv4
    /**
     *
     * @param {...{paymentAddressStr: string, amount: number, message: string}} prvPaymentsForNativeToken
     * @param {{Privacy: bool, TokenID: string, TokenName: string, TokenSymbol: string, TokenTxType: bool, TokenAmount: number, TokenReceivers : {PaymentAddress: string, Amount: number, Message: string}}} submitParam
     * @param {number} fee
     * @param {number} feePToken
     * @param {string} remoteAddress
     */
    async createAndSendUnshieldPortalV4RequestTx({ transfer: { prvPayments = [], fee, info = "", tokenID = null }, extra: { burningType = PortalV4UnshieldRequestMeta, isEncryptMessage = false, isEncryptMessageToken = false, unshieldAmount, remoteAddress } = {}}) {
        const unshieldTokenID = tokenID;
        
        if (fee < 0) {
            fee = 0
        }
        await this.updateProgressTx(10, 'Encrypting Message');
        let burningAddress = await getBurningAddress(this.rpc);
        let tokenPayments = [{
            PaymentAddress: burningAddress,
            Amount: new bn(unshieldAmount).toString(),
            Message: ""
        }];
        let messageForNativeToken = "";
        if (prvPayments.length>0){
            messageForNativeToken = prvPayments[0].Message;
        }
        let isEncodeOnly = !isEncryptMessage;
        prvPayments = await encryptMessageOutCoin(prvPayments, isEncodeOnly);
        isEncodeOnly = !isEncryptMessageToken;
        tokenPayments = await encryptMessageOutCoin(tokenPayments, isEncodeOnly);
        // use an empty payment address
        let emptyKeySet = new KeySet();
        await emptyKeySet.importFromPrivateKey(new Uint8Array(32));
        await this.updateProgressTx(15, 'Generating Metadata');
        let newCoin;
        try {
            // since we only use the PublicKey and TxRandom fields, the tokenID is irrelevant
            let temp = await wasm.createCoin(JSON.stringify({PaymentInfo : pInf, TokenID: null}));
            newCoin = JSON.parse(temp);
        }catch(e){
            throw e;
        }

        // prepare meta data for tx
        portalUnshieldRequest = {
            OTAPubKeyStr: newCoin.PublicKey,
            TxRandomStr: newCoin.TxRandom,
            RemoteAddress: remoteAddress,
            TokenID: tokenID,
            UnshieldAmount: unshieldAmount,
            Type: burningType,
        }

        try {
            let result = await this._transact({ transfer: { prvPayments, fee, info, tokenID: unshieldTokenID, tokenPayments }, extra: { metadata: portalUnshieldRequest }});
                // prvPayments, fee, portalUnshieldRequest, info, unshieldTokenID, tokenPayments);
            this.saveTxHistory(result, false, "", messageForNativeToken);
            await this.updateProgressTx(100, 'Completed');
            return result;
        } catch (e) {
            throw e;
        }
    };
}

export {
    Portal,
};