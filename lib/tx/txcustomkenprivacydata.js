import {Tx} from './txprivacy';

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

    toString(){
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
    }

    hash(){

    }



}