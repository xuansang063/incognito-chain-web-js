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
  
    addHistoryInfo(txID, type, amount, fee, receivers, tokenName, tokenID, tokenSymbol, mileseconds, isIn, isPrivacy) {
      this.amount = amount;
      this.fee = fee;
      this.receivers = receivers;
      this.txID = txID;
      this.type = type;
      this.tokenName = tokenName;
      this.tokenID = tokenID;
      this.tokenSymbol = tokenSymbol;
      this.time = new Date(mileseconds);
      this.isIn = isIn;
      this.isPrivacy = isPrivacy;
    }
  
    updateStatus(newStatus) {
      this.status = newStatus
    }
}

export { TxHistoryInfo };
  