import { FailedTx } from "./constants";

class TxHistoryInfo {
    constructor() {
      this.amount = 0;
      this.fee = 0;
      this.txID = "";
      this.type = "";
      this.receivers = [];
      this.tokenName = "";
      this.tokenID = "";
      this.tokenSymbol = "";
      this.isIn = null;
      this.time = ""
      this.status = FailedTx;
      this.isPrivacy = false;
      this.listUTXOForPRV = [];
      this.listUTXOForPToken = [];
      this.hashOriginalTx = "";
      this.feePToken = 0; 
    }
  
    setHistoryInfo(historyObject) {
      this.amount = historyObject.amount;
      this.fee = historyObject.fee;
      this.feePToken = historyObject.feePToken;
      this.receivers = historyObject.receivers;
      this.txID = historyObject.txID;
      this.type = historyObject.type;
      this.time = new Date(historyObject.time);
      this.isIn = historyObject.isIn;
      this.isPrivacy = historyObject.isPrivacy;
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
  