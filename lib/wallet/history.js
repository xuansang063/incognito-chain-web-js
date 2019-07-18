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
  
    setHistoryInfo(txID, type, amount, fee, receivers, miliseconds, isIn, isPrivacy, 
      tokenName = '', tokenID = '', tokenSymbol = '', listUTXOForPRV, listUTXOForPToken, hashOriginalTx, feePToken = 0) 
    {
      this.amount = amount;
      this.fee = fee;
      this.receivers = receivers;
      this.txID = txID;
      this.type = type;
      this.time = new Date(miliseconds);
      this.isIn = isIn;
      this.isPrivacy = isPrivacy;

      this.tokenName = tokenName;
      this.tokenID = tokenID;
      this.tokenSymbol = tokenSymbol;

      this.listUTXOForPRV = listUTXOForPRV;
      this.listUTXOForPToken = listUTXOForPToken;
      this.hashOriginalTx = hashOriginalTx;

      this.feePToken = feePToken;
    }
  
    updateStatus(newStatus) {
      this.status = newStatus
    }
}

export { TxHistoryInfo };
  