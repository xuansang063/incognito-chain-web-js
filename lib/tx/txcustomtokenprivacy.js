import bn from 'bn.js';
import { stringToBytes, hashSha3BytesToBytes, randScalar } from "privacy-js-lib/lib/privacy_utils";
import { P256 } from 'privacy-js-lib/lib/ec';
import { Tx } from './txprivacy';
import { TxCustomTokenPrivacyType, CustomTokenInit, CustomTokenTransfer, TxNormalType } from './constants';
import { convertHashToStr} from "../common";
import { TxTokenPrivacyData } from './txcustomkenprivacydata';
import { PaymentProof } from '../payment';
import { Coin, OutputCoin } from '../coin';
import { parseInputCoinToEncodedObject } from './utils';

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
    return hashSha3BytesToBytes(stringToBytes(this.toString()));
  }

  convertTxCustomTokenPrivacyToByte() {
    super.convertTxToByte();
    this.txTokenPrivacyData.txNormal = this.txTokenPrivacyData.txNormal.convertTxToByte();
    // this.txTokenPrivacyData.propertyID = convertHashToStr(this.txTokenPrivacyData.propertyID);

    return this;
  };

  async init(senderSK, paymentAddressStr, paymentInfo, inputCoins, inputCoinStrs, feePRV, feeToken, tokenParams, listCustomTokens, metaData, hasPrivacyForToken, info = "") {
    
    // create normal tx for fee
    await super.init(senderSK, paymentAddressStr, paymentInfo, inputCoins, inputCoinStrs, feePRV, false, null, metaData, info);

    // override txCustomTokenPrivacy type
    this.type = TxCustomTokenPrivacyType; 

    // create txTokenPrivacyData
    this.txTokenPrivacyData = new TxTokenPrivacyData();

    let handled = false;
    switch (tokenParams.tokenTxType) {
      case CustomTokenInit: {
        handled = true;

        // create tx normal for tx custom token privacy data
        // issue token with data of privacy
        let txNormal = new Tx();
        txNormal.type = TxNormalType;
        txNormal.proof = new PaymentProof();
        txNormal.fee = new bn(0);
        txNormal.proof.outputCoins = new Array(1);

        txNormal.proof.outputCoins[0] = new OutputCoin();
        txNormal.proof.outputCoins[0].coinDetails = new Coin();
        txNormal.proof.outputCoins[0].coinDetails.value = new bn(tokenParams.amount);
        txNormal.proof.outputCoins[0].coinDetails.publicKey = P256.decompress(tokenParams.receivers[0].PaymentAddress.Pk);
        txNormal.proof.outputCoins[0].coinDetails.randomness = randScalar();
        txNormal.proof.outputCoins[0].coinDetails.snderivator = randScalar();

        // create coin commitment
        txNormal.proof.outputCoins[0].coinDetails.commitAll();
        // get last byte
        txNormal.pubKeyLastByteSender = tokenParams.receivers[0].PaymentAddress.Pk[tokenParams.receivers[0].PaymentAddress.Pk.length - 1];

        // sign Tx
        txNormal.sigPubKey = tokenParams.receivers[0].PaymentAddress.Pk;
        txNormal.sigPrivKey = senderSK;
        let err = txNormal.sign();
        if (err !== null) {
          throw new Error("Can not sign tx nornal in tx custom token data");
        }

        // this.txTokenPrivacyData.txNormal = txNormal;
        this.txTokenPrivacyData.set(txNormal, null, tokenParams.propertyName, tokenParams.propertySymbol, tokenParams.tokenTxType, false, tokenParams.amount);

        let hashTxTokenPrivacyData = this.txTokenPrivacyData.hash();
        hashTxTokenPrivacyData.push(this.pubKeyLastByteSender);
        hashTxTokenPrivacyData = hashSha3BytesToBytes(hashTxTokenPrivacyData);

        let tokenIDStr = convertHashToStr(hashTxTokenPrivacyData).toLowerCase();

        // validate PropertyID is the only one
        for (let i = 0; i < listCustomTokens.length; i++) {
          if (tokenIDStr === listCustomTokens[i].ID.toLowerCase()) {
            throw new Error("Custom token privacy is existed");
          }
        }

        this.txTokenPrivacyData.propertyID = tokenIDStr;
        console.log("Token ID: ", this.txTokenPrivacyData.propertyID);
        break;
      }
      case CustomTokenTransfer: {
        handled = true;
        // make a transfering for privacy custom token
        // fee always 0 and reuse function of normal tx for custom token ID

        // check propertyId is existed or not
        let i = 0;
        for (i = 0; i < listCustomTokens.length; i++) {
          if (listCustomTokens[i].ID.toLowerCase() === tokenParams.propertyID.toLowerCase()) {
            break;
          }
        }
        if (i === listCustomTokens.length) {
          throw new Error("invalid token ID")
        }

        // create tx normal for txCustomTokenPrivacyData
        let txNormal = new Tx(this.rpcClient);
        txNormal.fee = 0

        let tokenInputsStr = parseInputCoinToEncodedObject(tokenParams.tokenInputs);

        let err = await txNormal.init(senderSK, paymentAddressStr, tokenParams.receivers, tokenParams.tokenInputs, tokenInputsStr, new bn(feeToken), hasPrivacyForToken, tokenParams.propertyID, null);
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

export { TxCustomTokenPrivacy };
