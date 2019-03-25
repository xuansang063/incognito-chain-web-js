import {Tx} from './txprivacy';
import * as privacyUtils from 'privacy-js-lib/lib/privacy_utils';

class TxTokenPrivacyData {
    constructor(){
        this.txNormal = new Tx();       // used for privacy functionality

        this.propertyID = [];   // = hash of TxCustomTokenprivacy data
        this.propertyName = '';
        this.propertySymbol = '';

        this.type = 0;    // action type
        this.mintable =  false;   // default false
        this.amount = 0; // init amount
    }

    toString = () => {
        let record = this.propertyName + this.propertySymbol + this.amount.toString();

        if (this.txNormal.proof !== null) {
            for (let i=0; i< this.txNormal.proof.outputCoins.length; i++){
                let outCoin = this.txNormal.proof.outputCoins[i];
                record += outCoin.coinDetails.publicKey.compress().toString();
                record += outCoin.coinDetails.value.toString();
            }

            for (let i=0; i< this.txNormal.proof.inputCoins.length; i++){
                let inCoin = this.txNormal.proof.inputCoins[i];
                if (inCoin.coinDetails.publicKey !== null){
                    record += inCoin.coinDetails.publicKey.compress().toString();
                }

                if (inCoin.coinDetails.value > 0 ){
                    record += inCoin.coinDetails.value.toString();
                }
            }
        }
        return record
    };

    hash = () => {
        return privacyUtils.hashSha3BytesToBytes(privacyUtils.stringToBytes(this.toString()));
    };

    set(txnormal, propertyID, propertyName, propertySymbol, type, mintable, amount){
        this.txNormal = txnormal;
        this.propertyID = propertyID;
        this.propertyName = propertyName;
        this.propertySymbol = propertySymbol;

        this.type = type;
        this.mintable = mintable;
        this.amount = amount;
    }
}

// CustomTokenParamTx - use for rpc request json body
class CustomTokenPrivacyParamTx {
    constructor(){
        this.propertyID = '';
        this.propertyName  = '';
        this.propertySymbol  = '';
        this.amount = 0;
        this.tokenTxType = 0;
        this.receivers = [];       // []*privacy.PaymentInfo
        this.tokenInputs = [];     // []*privacy.InputCoin
    }
    set(propertyID, propertyName, propertySymbol, amount, tokenTxType, receivers, tokenInputs){
        this.propertyID = propertyID;
        this.propertyName = propertyName;
        this.propertySymbol = propertySymbol;
        this.amount = amount;
        this.tokenTxType = tokenTxType;
        this.receivers = receivers;
        this.tokenInputs = tokenInputs
    }
}

export {TxTokenPrivacyData, CustomTokenPrivacyParamTx};
