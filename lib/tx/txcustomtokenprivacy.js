import {Tx} from './txprivacy';
import {TxTokenVin, TxTokenVout, TxTokenData} from './txcustomtokendata';
import * as privacyUtils from "privacy-js-lib/lib/privacy_utils";
import * as constantsTx from './constants';
import {newHashFromStr, convertHashToStr} from "../common";
import {TxTokenPrivacyData, CustomTokenPrivacyParamTx} from './txcustomkenprivacydata';

import {PaymentProof} from '../payment';

import {Coin, Inputcoin, OutputCoin} from '../coin';
import {P256} from 'privacy-js-lib/lib/ec';
import bn from 'bn.js';
import * as base58 from '../base58';


class TxCustomTokenPrivacy extends Tx {
  constructor(rpcClient) {
    super(rpcClient);      // call constructor of Tx
    this.txTokenPrivacyData = new TxTokenPrivacyData();
  }

  toString() {
    let normalTxHash = super.hash();
    let record = normalTxHash.toString();

    record += this.txTokenPrivacyData.hash().toString();

    if (this.metadata !== null) {
      record += this.metadata.hash().toString();
    }
    return record;
  }

  hash() {
    return privacyUtils.hashBytesToBytes(privacyUtils.stringToBytes(this.toString()));
  }

  convertTxCustomTokenPrivacyToByte() {
    super.convertTxToByte();
    this.txTokenPrivacyData.txNormal = this.txTokenPrivacyData.txNormal.convertTxToByte();
    // this.txTokenPrivacyData.propertyID = convertHashToStr(this.txTokenPrivacyData.propertyID);

    return this;
  };

  async init(senderSK, paymentAddressStr, paymentInfo, inputCoins, inputCoinStrs, fee, tokenParams, listCustomTokens, metaData, hasPrivacy) {
    // create normal tx for fee
    await super.init(senderSK, paymentAddressStr, paymentInfo, inputCoins, inputCoinStrs, fee, hasPrivacy, null, metaData);

    // override txCustomTokenPrivacy type
    this.type = constantsTx.TxCustomTokenPrivacyType;

    // create txTokenPrivacyData
    this.txTokenPrivacyData = new TxTokenPrivacyData();

    let handled = false;

    switch (tokenParams.tokenTxType) {
      case constantsTx.CustomTokenInit: {
        handled = true;

        // create tx normal for tx custom token privacy data
        // issue token with data of privacy
        let txNormal = new Tx();
        txNormal.proof = new PaymentProof();

        txNormal.proof.outputCoins = new Array(1);

        txNormal.proof.outputCoins[0] = new OutputCoin();
        txNormal.proof.outputCoins[0].coinDetails = new Coin();
        txNormal.proof.outputCoins[0].coinDetails.value = new bn(tokenParams.amount);
        txNormal.proof.outputCoins[0].coinDetails.publicKey = P256.decompress(tokenParams.receivers[0].PaymentAddress.Pk);
        txNormal.proof.outputCoins[0].coinDetails.randomness = privacyUtils.randScalar();
        txNormal.proof.outputCoins[0].coinDetails.snderivator = privacyUtils.randScalar();

        // create coin commitment
        txNormal.proof.outputCoins[0].coinDetails.commitAll();
        // get last byte
        txNormal.pubKeyLastByteSender = tokenParams.receivers[0].PaymentAddress.Pk[tokenParams.receivers[0].PaymentAddress.Pk.length - 1];

        // sign Tx
        txNormal.SigPubKey = tokenParams.receivers[0].PaymentAddress.Pk;
        txNormal.sigPrivKey = senderSK;
        let err = txNormal.sign();
        if (err !== null) {
          throw new Error("Can not sign tx nornal in tx custom token data");
        }

        // this.txTokenPrivacyData.txNormal = txNormal;
        this.txTokenPrivacyData.set(txNormal, null, tokenParams.propertyName, tokenParams.propertySymbol, tokenParams.tokenTxType, false, tokenParams.amount);

        let hashTxTokenPrivacyData = this.txTokenPrivacyData.hash();

        // validate PropertyID is the only one
        for (let i = 0; i < listCustomTokens.length; i++) {
          if (convertHashToStr(hashTxTokenPrivacyData) === listCustomTokens[i].ID) {
            throw new Error("Custom token privacy is existed");
          }
        }

        this.txTokenPrivacyData.propertyID = convertHashToStr(hashTxTokenPrivacyData);

        console.log("Token ID: ", this.txTokenPrivacyData.propertyID);
        break;
      }

      case constantsTx.CustomTokenTransfer: {
        handled = true;
        // make a transfering for privacy custom token
        // fee always 0 and reuse function of normal tx for custom token ID

        // check propertyId is existed or not
        // let propertyID = privacyUtils.hashBytesToBytes(tokenParams.propertyID);
        let i = 0;
        for (i = 0; i < listCustomTokens.length; i++) {
          console.log("custom token ID: ", listCustomTokens[i].ID);
          console.log("token param ID: ", tokenParams.propertyID);
          if (listCustomTokens[i].ID.toUpperCase() === tokenParams.propertyID.toUpperCase()) {
            break;
          }
        }
        if (i === listCustomTokens.length) {
          throw new Error("invalid token ID")
        }

        // create tx normal for txCustomTokenPrivacyData
        let txNormal = new Tx(this.rpcClient);

        //prepare input for tx
        // let res = this.rpcClient.prepareInputForTxCustomTokenPrivacy();

        // let tokenInputsStr = new Array(tokenParams.tokenInputs.length);
        // for (let i=0; i<tokenInputsStr.length; i++){
        //     tokenInputsStr[i] = tokenParams.tokenInputs[i].convertInputCoinToStr();
        // }

        let tokenInputsStr = this.rpcClient.parseInputCoinToEncodedObject(tokenParams.tokenInputs);

        let err = await txNormal.init(senderSK, paymentAddressStr, tokenParams.receivers, tokenParams.tokenInputs, tokenInputsStr, fee, true, tokenParams.propertyID, null);
        if (err !== null) {
          throw new Error("Can not create normal tx for tx custom token privacy data")
        }

        this.txTokenPrivacyData.set(txNormal, tokenParams.propertyID, tokenParams.propertyName, tokenParams.propertySymbol, tokenParams.tokenTxType, false, 0);
      }
    }
    if (!handled) {
      throw new Error("Wrong token tx type");
    }

    return null;
  }
}

export {TxCustomTokenPrivacy};