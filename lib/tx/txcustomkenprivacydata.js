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
            //
            // for (let outCoin in this.txNormal.proof.OutputCoins)
            // for _, out := range txTokenPrivacyData.TxNormal.proof.OutputCoins {
            //     record += string(out.coinDetails.publicKey.Compress())
            //     record += strconv.FormatUint(out.coinDetails.value, 10)
            // }
            // for _, in := range txTokenPrivacyData.TxNormal.proof.InputCoins {
            //     if in.coinDetails.publicKey != nil {
            //         record += string(in.coinDetails.publicKey.Compress())
            //     }
            //     if in.coinDetails.value > 0 {
            //         record += strconv.FormatUint(in.coinDetails.value, 10)
            //     }
            // }
        }
        return record
    }



}