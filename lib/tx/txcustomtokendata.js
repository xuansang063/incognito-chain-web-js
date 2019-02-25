import * as key from '../key';
import * as base58 from '../base58';
import * as constants from "privacy-js-lib/lib/constants";
import * as privacyUtils from 'privacy-js-lib/lib/privacy_utils';


// TxTokenVin - vin format for custom token data
// It look like vin format of bitcoin
class TxTokenVin {
    constructor() {
        this.txCustomTokenID = [];                      // TxNormal-id(or hash) of before tx, which is used as a input for current tx as a pre-utxo
        this.voutIndex = 0;                             // index in vouts array of before TxNormal-id
        this.signature = '';                            // Signature to verify owning before tx(pre-utxo)
        this.paymentAddress = new key.PaymentAddress(); // use to verify signature of pre-utxo of token
    }

    // string convert TxTokenVin to string
    string(){
        let record = this.txCustomTokenID.toString();
        record += this.voutIndex.toString();
        record += this.signature;
        record += base58.checkEncode(this.paymentAddress.PublicKey, constants.PRIVACY_VERSION);
        return record;
    }

    hash(){
        return privacyUtils.hashBytesToBytes(privacyUtils.stringToBytes(this.string()));
    }
}

// TxTokenVout - vout format for custom token data
// It look like vout format of bitcoin
class TxTokenVout {
    constructor(){
        this.value = 0;                                     // Amount to transfer
        this.paymentAddress = new key.PaymentAddress();     // payment address of receiver

        // temp variable to determine position of itself in vouts arrays of tx which contain this
        this.index = 0;
        // temp variable to know what is id of tx which contain itself
        this.txCustomTokenID = [];
    }

    // string convert TxTokenVout to string
    string() {
        let record = this.value.toString();
        record += base58.checkEncode(this.paymentAddress.PublicKey, constants.PRIVACY_VERSION);
        return record;
    }

    hash(){
        return privacyUtils.hashBytesToBytes(privacyUtils.stringToBytes(this.string()));
    }

    setIndex(index){
        this.index = index;
    }

    getIndex(){
        return this.index;
    }

    setTxCustomTokenID(txCustomTokenID){
        this.txCustomTokenID = txCustomTokenID;
    }

    getTxCustomTokenID(){
        return this.txCustomTokenID;
    }
}


// TxTokenData - main struct which contain vin and vout array for transferring or issuing custom token
// of course, it also contain token metadata: name, symbol, id(hash of token data)
class TxTokenData {
    constructor(){
        this.propertyID = [];       // = hash of TxTokenData data
        this.propertyName = '';
        this.propertySymbol = '';

        this.type = 0;          // action type [init, transfer]
        this.mintable = false;  // can mine, default false
        this.amount = 0;        // init amount
        this.vins = [];         // []TxTokenVin
        this.vouts = [];        //[]TxTokenVout
    }

    string(){
        let record = this.propertyName +  this.propertySymbol + this.amount.toString();
        for (let i=0; i<this.vins.length; i++){
            record += this.vins[i].string();
        }
        for (let i=0; i<this.vouts.length; i++){
            record += this.vouts[i].string();
        }
        return record;
    }

    hash(){
        if (this.vouts === null) {
            return {
                data: null,
                err: new Error("Vout is empty")
            }
        }

        let hash = privacyUtils.hashBytesToBytes(privacyUtils.stringToBytes(this.string()));
        return {
            data: hash,
            err: null
        }
    }
}

export {TxTokenVin, TxTokenVout, TxTokenData};