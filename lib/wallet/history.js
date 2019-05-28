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
    }
  
    setHistoryInfo(txID, type, amount, fee, receivers, miliseconds, isIn, isPrivacy, tokenName = '', tokenID = '', tokenSymbol = '') {
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
    }
  
    updateStatus(newStatus) {
      this.status = newStatus
    }
}

export { TxHistoryInfo };
  