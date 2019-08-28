class CustomError extends Error {
  constructor(errorObj, message) {
    super(message);
    this.code = errorObj.code;
    this.description = errorObj.description;
  }
}

const ErrorObject = {
    UnexpectedError : {code: -1, description: "Unexpected error"},
    NotEnoughPRVError : {code: -2, description: "Not enough PRV"},
};

// console.log(ErrorObject.UnexpectedError);
// let errorH = new CustomError(ErrorObject.UnexpectedError, "Not enough PRV");


// console.log("errorH: ", errorH)



export {
    CustomError, ErrorObject
};