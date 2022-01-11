import bn from "bn.js";
import isArray from "lodash/isArray";
import { isPaymentAddress } from "./paymentAddress";

class Validator {
  constructor(label, value) {
    if (!label && typeof label !== "string")
      throw new Error(`Missing or invalid label of ${value}`);
    this.value = value;
    this.label = label;
    this.isRequired = false;
  }

  _throwError(message) {
    throw new Error(
      `Validating "${this.label}" failed: ${message}. Found ${
        this.value
      } (type of ${typeof this.value})`
    );
  }

  _isDefined() {
    return this.value !== null && typeof this.value !== "undefined";
  }

  _onCondition(condition, message) {
    if (
      ((!this.isRequired && this._isDefined()) || this.isRequired) &&
      !condition()
    ) {
      this._throwError(message);
    }

    return this;
  }

  required(message = "Required") {
    this.isRequired = true;
    return this._onCondition(() => this._isDefined(), message);
  }

  maxLength(length, message) {
    return this._onCondition(
      () => this.value.length > length,
      message || `Max length is ${length}`
    );
  }

  minLength(length, message) {
    return this._onCondition(
      () => this.value.length < length,
      message || `min length is ${length}`
    );
  }

  string(message = "Must be string") {
    return this._onCondition(() => typeof this.value === "string", message);
  }

  object(message = "Must be object") {
    return this._onCondition(() => typeof this.value === "object", message);
  }

  function(message = "Must be a function") {
    return this._onCondition(() => typeof this.value === "function", message);
  }

  boolean(message = "Must be boolean") {
    return this._onCondition(() => typeof this.value === "boolean", message);
  }

  number(message = "Must be number") {
    return this._onCondition(() => Number.isFinite(this.value), message);
  }

  positiveNumber(message = "Must be positive number") {
    return this._onCondition(
      () => Number.isFinite(this.value) && this.value > 0,
      message
    );
  }

  array(message = "Must be array") {
    return this._onCondition(() => this.value instanceof Array, message);
  }

  min(min, message) {
    new Validator("min", min).required().number();

    return this._onCondition(
      () => this.value >= min,
      message || `Minimum is ${min}`
    );
  }

  max(max, message) {
    new Validator("max", max).required().number();

    return this._onCondition(
      () => this.value <= max,
      message || `Maximum is ${max}`
    );
  }

  largerThan(number, message) {
    new Validator("number", number).required().number();

    return this._onCondition(
      () => this.value > number,
      message || `Must be larger than ${number}`
    );
  }

  lessThan(number, message) {
    new Validator("number", number).required().number();

    return this._onCondition(
      () => this.value < number,
      message || `Must be less than ${number}`
    );
  }

  inList(list = [], message = "Must be in provided list") {
    new Validator("list", list).required().array();

    message = `Must be one of ${JSON.stringify(list)}`;
    return this._onCondition(() => list.includes(this.value), message);
  }

  intergerNumber(message = "Must be an interger number") {
    return this._onCondition(() => Number.isInteger(this.value), message);
  }

  paymentAddress(message = "Invalid payment address") {
    return this._onCondition(
      () => this.string() && isPaymentAddress(this.value),
      message
    );
  }

  privateKey(message = "Invalid private key") {
    return this._onCondition(
      () => this.string() && isPrivateKey(this.value),
      message
    );
  }

  shardId(message = "Shard ID must be between 0 to 7") {
    return this._onCondition(
      () => this.intergerNumber() && this.inList([0, 1, 2, 3, 4, 5, 6, 7]),
      message
    );
  }

  /**
   *
   * @param {number} value amount in nano (must be an integer number)
   * @param {string} message error message
   */
  amount(message = "Invalid amount") {
    return this._onCondition(() => new bn(this.value).gte("0"), message);
  }

  paymentInfo(paymentInfo, message = "Invalid payment info") {
    let _paymentInfo = paymentInfo || this.value;
    return this._onCondition(() => {
      new Validator("Payment info", _paymentInfo).required();
      const { PaymentAddress, Amount, Message } = _paymentInfo;
      new Validator("Payment info paymentAddressStr", PaymentAddress)
        .required()
        .paymentAddress();
      new Validator("Payment info amount", Amount).required().amount();
      new Validator("Payment info message", Message).string();
      return true;
    }, message);
  }

  rawTx() {
    const rawTx = this.value;
    return this._onCondition(() => {
      new Validator("Raw tx hash", rawTx.txId).required().string();
      new Validator("Raw tx txType", rawTx.txType).required().number();
      new Validator("Raw tx status", rawTx.status).required().number();
      return true;
    }, "Invalid raw tx");
  }

  paymentInfoList(
    message = 'Invalid paymentInfoList, must be array of payment info "{ paymentAddressStr: string, amount: number, message: string }" (max 30 payment info)'
  ) {
    return this._onCondition(() => {
      if (!isArray(this.value) || this.value.length > 30) return false;
      return this.value.every((paymentInfo) => this.paymentInfo(paymentInfo));
    }, message);
  }
}

export default Validator;
