import { FailedTx } from "./constants";

class TxHistoryInfo {
    constructor() {
      this.txID = "";
      this.amountNativeToken = 0;
      this.amountPToken = 0;
      this.feeNativeToken = 0;
      this.feePToken = 0;
      
      this.typeTx = "";
      this.receivers = [];
      this.tokenName = "";
      this.tokenID = "";
      this.tokenSymbol = "";
      this.isIn = null;
      this.time = ""
      this.status = FailedTx;
      this.isPrivacyNativeToken = false;
      this.isPrivacyForPToken = false;
      this.listUTXOForPRV = [];
      this.listUTXOForPToken = [];
      this.hashOriginalTx = "";
    }
  
    setHistoryInfo(historyObject) {
      this.amountNativeToken = historyObject.amountNativeToken;
      this.amountPToken = historyObject.amountPToken;
      this.feeNativeToken = historyObject.feeNativeToken;
      this.feePToken = historyObject.feePToken;
      this.receivers = historyObject.receivers;
      this.txID = historyObject.txID;
      this.typeTx = historyObject.typeTx;
      this.time = new Date(historyObject.time);
      this.isIn = historyObject.isIn;
      this.isPrivacyNativeToken = historyObject.isPrivacyNativeToken;
      this.isPrivacyForPToken = historyObject.isPrivacyForPToken;
      this.status = historyObject.status;

      this.tokenName = historyObject.tokenName;
      this.tokenID = historyObject.tokenID;
      this.tokenSymbol = historyObject.tokenSymbol;

      this.listUTXOForPRV = historyObject.listUTXOForPRV;
      this.listUTXOForPToken = historyObject.listUTXOForPToken;
      this.hashOriginalTx = historyObject.hashOriginalTx;
    }
  
    updateStatus(newStatus) {
      this.status = newStatus
    }
}

export { TxHistoryInfo };
  