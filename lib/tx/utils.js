/**
 *
 * @param {string} from
 * @param {string} to
 * @param {{Privacy: boolean, TokenID: string, TokenName: string, TokenSymbol: string, TokenTxType: number TokenAmount: number, TokenReceivers: {[string]: number}}} tokenObject
 * @param {AccountWallet} account
 * @param {RpcClient} rpcClient
 * @param {bool} isPrivacyForPrivateToken
 */
// getMaxWithdrawAmount return maximum amount pToken can be withdrawed
// it just be called before withdraw pToken
async function getMaxWithdrawAmount(
  from,
  to,
  tokenObject,
  account,
  rpcClient,
  isPrivacyForPrivateToken
) {
  let id = "";
  let name = "";
  let symbol = "";
  if (tokenObject.TokenID !== null) {
    id = tokenObject.TokenID;
  }
  if (tokenObject.TokenName !== null) {
    name = tokenObject.TokenName;
  }
  if (tokenObject.TokenSymbol !== null) {
    symbol = tokenObject.TokenSymbol;
  }

  // token param
  // get current token to get token param
  let tokenParamJson = {
    propertyID: id,
    propertyName: name,
    propertySymbol: symbol,
    amount: 0,
    tokenTxType: tokenObject.TokenTxType,
    fee: 0,
    paymentInfoForPToken: [
      {
        paymentAddressStr: tokenObject.TokenReceivers.PaymentAddress,
        amount: tokenObject.TokenReceivers.Amount,
      },
    ],
    tokenInputs: [],
  };

  let totalpTokenAmount = new bn(0);

  try {
    let { unspentCoins: unspentToken } = await account.getOutputCoins(
      tokenParamJson.propertyID.toLowerCase()
    );
    tokenParamJson.tokenInputs = unspentToken;

    for (let i = 0; i < unspentToken.length; i++) {
      totalpTokenAmount = totalpTokenAmount.add(new bn(unspentToken[i].Value));
    }
  } catch (e) {
    throw e;
  }

  let isRatePToken;
  try {
    isRatePToken = await rpcClient.isExchangeRatePToken(
      tokenParamJson.propertyID
    );
  } catch (e) {
    isRatePToken = false;
  }

  let isGetTokenFee = false;
  if (isRatePToken) {
    isGetTokenFee = true;
  }

  let fee;
  try {
    fee = await getEstimateFee(
      from,
      to,
      0,
      account,
      false,
      isPrivacyForPrivateToken,
      rpcClient,
      null,
      tokenParamJson,
      isGetTokenFee
    );
  } catch (e) {
    // get fee in native token
    if (isGetTokenFee) {
      isGetTokenFee = false;
      try {
        fee = await getEstimateFee(
          from,
          to,
          0,
          account,
          false,
          isPrivacyForPrivateToken,
          rpcClient,
          null,
          tokenParamJson,
          isGetTokenFee
        );
      } catch (e) {
        throw e;
      }
    } else {
      throw e;
    }
  }

  let maxWithdrawAmount = totalpTokenAmount;
  if (isGetTokenFee) {
    maxWithdrawAmount = maxWithdrawAmount.sub(new bn(fee));
  }

  return {
    maxWithdrawAmount: maxWithdrawAmount.toNumber(),
    feeCreateTx: fee,
    feeForBurn: fee,
    isGetTokenFee: isGetTokenFee,
  };
}
