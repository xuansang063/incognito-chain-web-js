import { PaymentAddress } from '../key';
import { checkEncode } from '../base58';
import { stringToBytes, hashSha3BytesToBytes, convertUint8ArrayToArray } from 'privacy-js-lib/lib/privacy_utils';
import { KeyWallet } from '../wallet/hdwallet';
import { convertHashToStr } from "../common";
import { ENCODE_VERSION } from "../constants";

// TxTokenVin - vin format for custom token data
// It look like vin format of bitcoin
class TxTokenVin {
    constructor() {
        this.txCustomTokenID = [];                      // TxNormal-id(or hash) of before tx, which is used as a input for current tx as a pre-utxo
        this.voutIndex = 0;                             // index in vouts array of before TxNormal-id
        this.signature = '';                            // Signature to verify owning before tx(pre-utxo)
        this.paymentAddress = new PaymentAddress(); // use to verify signature of pre-utxo of token
    }

    // string convert TxTokenVin to string
    toString() {
        let record = this.txCustomTokenID.toString();
        record += this.voutIndex.toString();
        record += this.signature;
        record += checkEncode(this.paymentAddress.Pk, ENCODE_VERSION);
        return record;
    }

    convertToByte(){
        this.txCustomTokenID = convertHashToStr(this.txCustomTokenID);
        this.paymentAddress.Pk = convertUint8ArrayToArray(this.paymentAddress.Pk);
        this.paymentAddress.Tk = convertUint8ArrayToArray(this.paymentAddress.Tk);
        return this;
    }

    hash() {
        return hashSha3BytesToBytes(stringToBytes(this.toString()));
    }
}

// TxTokenVout - vout format for custom token data
// It look like vout format of bitcoin
class TxTokenVout {
    constructor() {
        this.value = 0;                                     // Amount to transfer
        this.paymentAddress = new PaymentAddress();     // payment address of receivers

        // temp variable to determine position of itself in vouts arrays of tx which contain this
        this.index = 0;
        // temp variable to know what is id of tx which contain itself
        this.txCustomTokenID = [];
    }

    set(paymentAddress, value) {
        this.paymentAddress = paymentAddress;
        this.value = value;
    }

    // string convert TxTokenVout to string
    toString() {
        let record = this.value.toString();
        record += checkEncode(this.paymentAddress.Pk, ENCODE_VERSION);
        return record;
    }

    hash() {
        return hashSha3BytesToBytes(stringToBytes(this.toString()));
    }

    convertToByte(){
        this.txCustomTokenID = convertHashToStr(this.txCustomTokenID);
        this.paymentAddress.Pk = convertUint8ArrayToArray(this.paymentAddress.Pk);
        this.paymentAddress.Tk = convertUint8ArrayToArray(this.paymentAddress.Tk);
        return this;
    }
}


// TxTokenData - main struct which contain vin and vout array for transferring or issuing custom token
// of course, it also contain token metadata: name, symbol, id(hash of token data)
class TxTokenData {
    constructor() {
        this.propertyID = [];       // = hash of TxTokenData data
        this.propertyName = '';
        this.propertySymbol = '';

        this.type = 0;          // action type [init, transfer]
        this.mintable = false;  // can mine, default false
        this.amount = 0;        // init amount
        this.vins = [];         // []TxTokenVin
        this.vouts = [];        //[]TxTokenVout
    }

    set(type, name, symbol, vins, vouts, amount){
        this.type = type;
        this.propertyName = name;
        this.propertySymbol = symbol;
        this.vins = vins;
        this.vouts = vouts;
        this.amount = amount;
    }

    toString()  {
        let record = this.propertyName + this.propertySymbol + this.amount.toString();
        if (this.vins !== null){
            for (let i = 0; i < this.vins.length; i++) {
                record += this.vins[i].toString();
            }
        }

        for (let i = 0; i < this.vouts.length; i++) {
            record += this.vouts[i].toString();
        }
        return record;
    };

    hash = () => {
        if (this.vouts === null) {
            return {
                data: null,
                err: new Error("Vout is empty")
            }
        }

        let hash = hashSha3BytesToBytes(stringToBytes(this.toString()));
        return {
            data: hash,
            err: null
        }
    }
}

// CustomTokenParamTx - use for rpc request json body
class CustomTokenParamTx {
    constructor() {
        this.propertyID = '';
        this.propertyName = '';
        this.propertySymbol = '';

        this.amount = 0;
        this.tokenTxType = 0;
        this.receivers = [];          //       []TxTokenVout `json:"TokenReceiver"`

        // temp variable to process coding
        this.vins = [];        //[]TxTokenVin
        this.vinsAmount = 0;
    }

    set(propertyID, propertyName, propertySymbol, amount, tokenTxType, receivers, vins, vinsAmount){
        this.propertyID = propertyID;
        this.propertyName = propertyName;
        this.propertySymbol = propertySymbol;
        this.amount = amount;
        this.tokenTxType = tokenTxType;
        this.receivers = receivers;
        this.vins = vins;
        this.vinsAmount = vinsAmount;
    }
}

export { TxTokenVin, TxTokenVout, TxTokenData, CustomTokenParamTx };
