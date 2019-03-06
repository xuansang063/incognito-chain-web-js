import * as key from '../key';
import * as base58 from '../base58';
import * as constants from "privacy-js-lib/lib/constants";
import * as privacyUtils from 'privacy-js-lib/lib/privacy_utils';
import {KeyWallet} from '../wallet/hdwallet';
import {convertHashToStr} from "../common";


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
    toString() {
        let record = this.txCustomTokenID.toString();
        record += this.voutIndex.toString();
        record += this.signature;
        record += base58.checkEncode(this.paymentAddress.Pk, constants.PRIVACY_VERSION);
        return record;
    }

    convertToByte(){
        this.txCustomTokenID = convertHashToStr(this.txCustomTokenID);
        this.paymentAddress.Pk = privacyUtils.convertUint8ArrayToArray(this.paymentAddress.Pk);
        this.paymentAddress.Tk = privacyUtils.convertUint8ArrayToArray(this.paymentAddress.Tk);
        return this;
    }

    hash() {
        return privacyUtils.hashBytesToBytes(privacyUtils.stringToBytes(this.toString()));
    }
}

// TxTokenVout - vout format for custom token data
// It look like vout format of bitcoin
class TxTokenVout {
    constructor() {
        this.value = 0;                                     // Amount to transfer
        this.paymentAddress = new key.PaymentAddress();     // payment address of receivers

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
        record += base58.checkEncode(this.paymentAddress.Pk, constants.PRIVACY_VERSION);
        return record;
    }

    hash() {
        return privacyUtils.hashBytesToBytes(privacyUtils.stringToBytes(this.toString()));
    }

    setIndex(index) {
        this.index = index;
    }

    getIndex() {
        return this.index;
    }

    setTxCustomTokenID(txCustomTokenID) {
        this.txCustomTokenID = txCustomTokenID;
    }

    getTxCustomTokenID() {
        return this.txCustomTokenID;
    }

    convertToByte = () =>{
        this.txCustomTokenID = convertHashToStr(this.txCustomTokenID);
        this.paymentAddress.Pk = privacyUtils.convertUint8ArrayToArray(this.paymentAddress.Pk);
        this.paymentAddress.Tk = privacyUtils.convertUint8ArrayToArray(this.paymentAddress.Tk);
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
        console.log("amout tx token data: ", this.amount);
    }

    toString = () =>  {
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

        let hash = privacyUtils.hashBytesToBytes(privacyUtils.stringToBytes(this.toString()));
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

    setVins(vins) {
        this.vins = vins;
    }

    setVinsAmount(vinsAmount) {
        this.vinsAmount = vinsAmount;
    }

}


// CreateCustomTokenReceiverArray - parse data frm rpc request to create a list vout for preparing to create a custom token tx
// data interface is a map[paymentt-address]{transferring-amount}
function CreateCustomTokenReceiverArray(data) {
    let result = new Array(data.length);
    let voutsAmount = 0;

    let i = 0;
    for (let [key, value] of  data) {
        let keyWallet = KeyWallet.base58CheckDeserialize(key);
        let keySet = keyWallet.KeySet;
        let temp = new TxTokenVout();
        temp.set(keySet.PaymentAddress, value);

        result[i] = temp;
        voutsAmount += value;
        i++;
    }

    return {
        vouts: result,
        voutsAmount: voutsAmount,
    }
}


export {TxTokenVin, TxTokenVout, TxTokenData, CustomTokenParamTx, CreateCustomTokenReceiverArray};