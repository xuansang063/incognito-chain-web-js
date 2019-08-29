class CustomError extends Error {
  constructor(errorObj, message) {
    super(message);
    this.code = errorObj.code;
    this.description = errorObj.description;
  }
}

const ErrorObject = {
  // -1 -> -1000: util error
  UnexpectedErr : {code: -1, description: "Unexpected error"},
  B58CheckDeserializedErr : {code: -2, description: "Base58 check deserialized error"},
  B58CheckSerializedErr : {code: -3, description: "Base58 check serialized error"},


  // -2000 -> -2999: wallet error
  WrongPassPhraseErr : {code: -2000, description: "Passphrase is not correct"},
  ExistedAccountErr : {code: -2001, description: "Account was existed"},
  NotEnoughPRVError : {code: -2, description: "Not enough PRV"},

  // -3000 -> -3999: transaction error
  PrepareInputNormalTxErr : {code: -3000, description: "Prepare input coins for normal transaction error"},
  InitNormalTxErr : {code: -3001, description: "Can not init normal transaction"},
  SendTxErr : {code: -3002, description: "Can not send transaction"},

  // -4000 -> -4999: RPC error
  GetStakingAmountErr : {code: -4000, description: "Can not get staking amount"},
};

// console.log(ErrorObject.UnexpectedErr);
// let errorH = new CustomError(ErrorObject.UnexpectedErr, "Not enough PRV");


// console.log("errorH: ", errorH.message)



export {
    CustomError, ErrorObject
};