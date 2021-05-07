import Validator from "@lib/utils/validator";

const transactor = {
  /**
   * createAndSendNativeToken - Method use to send PRV
   * @param {{paymentAddressStr: string (B58checkencode), amount: number, message: "" }} prvPayments
   * @param {number} fee
   * @param {string} info
   * @param {object} metadata
   * @param {boolean} isEncryptMessage
   */
  createAndSendNativeToken: async function ({
    transfer: { prvPayments = [], fee, info = "" },
    extra: { metadata = null, isEncryptMessage = false } = {},
  } = {}) {
    new Validator("prvPayments", prvPayments).required().paymentInfoList();
    new Validator("fee", fee).required().number();
    new Validator("info", info).string();
    new Validator("metadata", metadata).object();
    new Validator("isEncryptMessage", isEncryptMessage).boolean();
    // check fee
    if (fee < 0) {
      fee = 0;
    }
    let messageForNativeToken = "";
    if (prvPayments.length > 0) {
      messageForNativeToken = prvPayments[0].Message;
    }
    await this.updateProgressTx(10, "Encrypting Message");
    const isEncodeOnly = !isEncryptMessage;
    prvPayments = await encryptMessageOutCoin(prvPayments, isEncodeOnly);
    try {
      let result = await this._transact({
        transfer: { prvPayments, fee, info },
        extra: { metadata },
      });
      this.saveTxHistory(result, false, "", messageForNativeToken);
      await this.updateProgressTx(100, "Completed");
      return result;
    } catch (e) {
      throw e;
    }
  },
  _transact: async function ({
    transfer: {
      prvPayments = [],
      fee = 10,
      info = "",
      tokenID = null,
      tokenPayments = null,
      tokenParams = null,
    } = {},
    extra: { metadata = null } = {},
  }) {
    await this.updateProgressTx(20, "Preparing Your Payments");
    info = base64Encode(stringToBytes(info));

    let receiverPaymentAddrStr = new Array(prvPayments.length);
    let totalAmountTransfer = new bn(0);
    for (let i = 0; i < prvPayments.length; i++) {
      receiverPaymentAddrStr[i] = prvPayments[i].paymentAddressStr;
      totalAmountTransfer = totalAmountTransfer.add(
        new bn(prvPayments[i].Amount)
      );
      prvPayments[i].Amount = new bn(prvPayments[i].Amount).toString();
    }

    await this.updateProgressTx(30, "Selecting Coins");
    let inputForTx;
    try {
      inputForTx = await prepareInputForTxV2(
        totalAmountTransfer,
        fee,
        null,
        this
      );
    } catch (e) {
      console.error(e);
      throw new CustomError(
        ErrorObject.InitNormalTxErr,
        "Error while preparing inputs",
        e
      );
    }

    if (inputForTx.inputCoinStrs.length > MAX_INPUT_PER_TX) {
      throw new CustomError(ErrorObject.TxSizeExceedErr);
    }
    await this.updateProgressTx(40, "Packing Parameters");

    let txParams = newParamTxV2(
      this.key,
      prvPayments,
      inputForTx.inputCoinStrs,
      fee,
      null,
      metadata,
      info,
      inputForTx.coinsForRing
    );
    // handle token transfer
    let tokenReceiverPaymentAddrStr = [];
    let totalAmountTokenTransfer = new bn(0);
    let inputForToken = {
      inputCoinStrs: [],
      coinsForRing: {},
    };

    await this.updateProgressTx(50, "Adding Token Info");
    // tokenID is non-null when transferring token; tokenParams is non-null when creating new token
    if (tokenPayments) {
      let isInit = Boolean(tokenParams);
      let isTransfer = Boolean(tokenID);
      if (!(isInit || isTransfer)) {
        throw new CustomError(
          ErrorObject.InitNormalTxErr,
          "Invalid Token parameters"
        );
      }
      tokenReceiverPaymentAddrStr = new Array(tokenPayments.length);
      for (let i = 0; i < tokenPayments.length; i++) {
        receiverPaymentAddrStr[i] = tokenPayments[i].paymentAddressStr;
        totalAmountTokenTransfer = totalAmountTokenTransfer.add(
          new bn(tokenPayments[i].Amount)
        );
        tokenPayments[i].Amount = new bn(tokenPayments[i].Amount).toString();
      }
      await this.updateProgressTx(60, "Selecting Token Coins");
      if (isTransfer) {
        try {
          inputForToken = await prepareInputForTxV2(
            totalAmountTokenTransfer,
            0,
            tokenID,
            this
          );
        } catch (e) {
          console.error(e);
          throw new CustomError(
            ErrorObject.InitNormalTxErr,
            `Error while preparing inputs ${e}`
          );
        }
      }
      await this.updateProgressTx(70, "Decorating Parameters");
      tokenParams = newTokenParamV2(
        tokenPayments,
        inputForToken.inputCoinStrs,
        tokenID,
        inputForToken.coinsForRing,
        tokenParams || {}
      );
      txParams.TokenParams = tokenParams;
    }

    let txParamsJson = JSON.stringify(txParams);
    await this.updateProgressTx(80, "Signing Transaction");
    let theirTime = await this.rpc.getNodeTime();
    let wasmResult = await wasm.createTransaction(txParamsJson, theirTime);
    let { b58EncodedTx, hash, outputs } = JSON.parse(wasmResult);
    // console.log(`Encoded TX : ${b58EncodedTx}, Hash : ${hash}`);
    if (b58EncodedTx === null || b58EncodedTx === "") {
      throw new CustomError(
        ErrorObject.InitNormalTxErr,
        "Can not init transaction tranfering PRV"
      );
    }
    let tempBuf = checkDecode(b58EncodedTx).bytesDecoded;
    let theString = new TextDecoder("utf-8").decode(tempBuf);
    let txObj = JSON.parse(theString);
    txObj.Encoded = b58EncodedTx;
    // console.log("TX: ", txObj);
    // console.log("Encoded: ", b58EncodedTx)

    await this.updateProgressTx(90, "Submitting Transaction");
    let response;
    try {
      response = await this.send(b58EncodedTx, Boolean(tokenPayments));
    } catch (e) {
      console.error(e);
      throw new CustomError(
        ErrorObject.SendTxErr,
        "Can not send PRV transaction",
        e
      );
    }

    if (response.TokenID && response.TokenID.length > 0) {
      tokenID = response.TokenID;
    }
    await this.updateProgressTx(95, "Saving Records");
    return {
      Response: response,
      Tx: txObj,
      Hash: hash,
      Outputs: outputs,
      Amount: totalAmountTransfer.toString(),
      Inputs: inputForTx.inputCoinStrs,
      Receivers: receiverPaymentAddrStr,
      TokenID: tokenID,
      TokenAmount: totalAmountTokenTransfer.toString(),
      TokenInputs: inputForToken.inputCoinStrs,
      TokenReceivers: tokenReceiverPaymentAddrStr,
      IsPrivacy: true,
      Metadata: metadata,
    };
  },
};

export default transactor;
