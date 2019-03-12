import {Tx} from './txprivacy';
import {TxTokenVin, TxTokenVout, TxTokenData} from './txcustomtokendata';
import * as privacyUtils from "privacy-js-lib/lib/privacy_utils";
import * as constantsTx from './constants';
import {newHashFromStr, convertHashToStr} from "../common";


class TxCustomToken extends Tx {
  constructor(rpcClient) {
    super(rpcClient);      // call constructor of Tx
    this.txTokenData = new TxTokenData();
  }

  toString() {
    let normalTxHash = super.hash();
    let record = normalTxHash.toString();
    record += this.txTokenData.hash().toString();

    if (this.metadata !== null) {
      record += this.metadata.hash().toString();
    }
    return record;
  }

  hash() {
    return privacyUtils.hashBytesToBytes(privacyUtils.stringToBytes(this.toString()));
  }

  convertTxCustomTokenToByte() {

    // console.log('super.convertTxToByte', super.convertTxToByte);
    super.convertTxToByte();
    this.txTokenData.propertyID = convertHashToStr(this.txTokenData.propertyID);
    for (let i = 0; i < this.txTokenData.vouts.length; i++) {
      this.txTokenData.vouts[i] = this.txTokenData.vouts[i].convertToByte();
      delete this.txTokenData.vouts[i].index;
      delete this.txTokenData.vouts[i].txCustomTokenID;
    }

    if (this.txTokenData.vins !== null) {
      for (let i = 0; i < this.txTokenData.vins.length; i++) {
        this.txTokenData.vins[i] = this.txTokenData.vins[i].convertToByte();
      }
    }

    return this;
  };

  async init(senderSK, paymentAddressStr, paymentInfo, inputCoins, inputCoinStrs, fee, tokenParams, listCustomTokens, metaData, hasPrivacy) {
    console.log("Creating tx custom token ....");
    // create normal tx for fee
    await super.init(senderSK, paymentAddressStr, paymentInfo, inputCoins, inputCoinStrs, fee, hasPrivacy, null, metaData);

    // override txCustomToken type
    this.type = constantsTx.TxCustomTokenType;

    this.txTokenData = new TxTokenData();

    let handled = false;

    switch (tokenParams.tokenTxType) {
      case constantsTx.CustomTokenInit: {
        handled = true;
        // create vouts for txTokenData on tokenParam's receivers
        let receiver = tokenParams.receivers[0];

        let vouts = new Array(1);
        vouts[0] = new TxTokenVout();
        vouts[0].set(receiver.paymentAddress, receiver.value);
        
        console.log("Token param amount: ", tokenParams.amount);

        this.txTokenData.set(tokenParams.tokenTxType, tokenParams.propertyName, tokenParams.propertySymbol, null, vouts, tokenParams.amount);

        // hash tx token data
        let res = this.txTokenData.hash();
        if (res.err !== null) {
          return res.err;
        }
        let hashTxTokenData = res.data;
        hashTxTokenData.push(this.pubKeyLastByteSender);
        hashTxTokenData = privacyUtils.hashBytesToBytes(hashTxTokenData);

        // validate PropertyID is the only one
        for (let i=0; i<listCustomTokens.length; i++) {
          let str = convertHashToStr(hashTxTokenData);

          console.log("TEST TOKEN ID: new token id: ", str);
          console.log("TEST TOKEN ID: old token id: ", i, " : ", listCustomTokens[i].ID)
          if (str.toLowerCase() === listCustomTokens[i].ID.toLowerCase()) {
            throw new Error("Custom token is existed");
          }
        }

        // assign txTokenData's propertyId
        this.txTokenData.propertyID = hashTxTokenData;
        break;
      }

      case constantsTx.CustomTokenTransfer: {
        handled = true;
        let paymentTokenAmount = 0;
        for (let i = 0; i < tokenParams.receivers.length; i++) {
          paymentTokenAmount += tokenParams.receivers[i].value;
        }
        console.log("vinsAmount: ", tokenParams.vinsAmount);
        console.log("paymentTokenAmount: ", paymentTokenAmount);


        let refundTokenAmount = tokenParams.vinsAmount - paymentTokenAmount;
        if (refundTokenAmount < 0) {
          throw new Error("Not enough token for transferring")
        }

        this.txTokenData = new TxTokenData();
        this.txTokenData.set(tokenParams.tokenTxType, tokenParams.propertyName, tokenParams.propertySymbol, tokenParams.vins, null, null);

        this.txTokenData.propertyID = newHashFromStr(tokenParams.propertyID);

        let vouts = [];
        if (refundTokenAmount > 0) {
          vouts = new Array(tokenParams.receivers.length + 1);
          vouts[vouts.length - 1] = new TxTokenVout();
          vouts[vouts.length - 1].set(tokenParams.vins[0].paymentAddress, refundTokenAmount);
          console.log("aaaaaaaaaaaa: ", tokenParams.vins[0].paymentAddress);
        } else {
          vouts = new Array(tokenParams.receivers.length);
        }

        for (let i = 0; i < tokenParams.receivers.length; i++) {
          vouts[i] = new TxTokenVout();
          vouts[i].set(tokenParams.receivers[i].paymentAddress, tokenParams.receivers[i].value)
        }

        this.txTokenData.vouts = vouts;
      }
    }
    if (!handled) {
      throw new Error("Wrong token tx type");
    }

    return null;
  }


}

// can convert byte array to string?

export {TxCustomToken};