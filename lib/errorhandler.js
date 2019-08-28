class CustomError extends Error {
  constructor(code, message, description) {
    // Pass remaining arguments (including vendor specific ones) to parent constructor
    super(message);
    this.code = code;
    this.description = description;
  }
}

const createError = (code, message, description) => {
  return new CustomError(code, message, description);
};

export default createError;