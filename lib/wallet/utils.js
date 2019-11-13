import { checkSumFirst4Bytes, checkDecode } from '../base58';
import { PrivacyUnit, MaxSizeInfoCoin } from './constants';
import { KeyWallet } from './wallet';
import { stringToBytes, base64Encode, base64Decode, bytesToString } from '../privacy/utils';
import { CustomError, ErrorObject } from '../errorhandler';
import { hybridEncryption, hybridDecryption } from "../privacy/hybridEncryption";

function addChecksumToBytes(data) {
  let checksum = checkSumFirst4Bytes(data);

  let res = new Uint8Array(data.length + 4);
  res.set(data, 0);
  res.set(checksum, data.length);
  return res;
}

/**
 * 
 * @param {{paymentAddressStr: string (B58checkencode), amount: number, message: "" }} paramPaymentInfos 
 * return paramPaymentInfos with message that was encrypted by transmissionKey and base64 encoded
 */
async function encryptMessageOutCoin(paramPaymentInfos) {
  for (let i = 0; i < paramPaymentInfos.length; i++) {
    let p = paramPaymentInfos[i];
    if (p.message != "" && p.message != null) {
      // get transmission key of receiver
      let keyWallet = KeyWallet.base58CheckDeserialize(p.paymentAddressStr);
      let transmissionKey = keyWallet.KeySet.PaymentAddress.Tk;
      let msgBytes = stringToBytes(p.message);

      // encrypt message
      let ciphertextBytes;
      try {
        ciphertextBytes = await hybridEncryption(transmissionKey, msgBytes);
      } catch (e) {
        throw new CustomError(ErrorObject.EncryptMsgOutCoinErr, `PaymentAddress: ${p.paymentAddressStr}$`);
      }

      if (ciphertextBytes > MaxSizeInfoCoin) {
        throw new CustomError(ErrorObject.EncryptMsgOutCoinErr, "Message is too large");
      }

      // base64 encode ciphertext
      let ciphertextEncode = base64Encode(ciphertextBytes);
      paramPaymentInfos[i].message = ciphertextEncode;
    }
  }

  return paramPaymentInfos;
}
/**
 * @param {AccountWallet} accountWallet
 * @param {string} ciphertextInfoB58CheckEncode
 * @return string
 * 
 */
async function decryptMessageOutCoin(accountWallet, ciphertextInfoB58CheckEncode) {
  let privateKeyBytes = accountWallet.key.KeySet.ReadonlyKey.Rk;
  // console.log("privateKeyBytes:", privateKeyBytes);

  let ciphertextBytes = checkDecode(ciphertextInfoB58CheckEncode).bytesDecoded;
  if (ciphertextBytes != ""){
    let plaintextBytes = await hybridDecryption(privateKeyBytes, ciphertextBytes);
    let plaintextStr = bytesToString(plaintextBytes);
    console.log("plaintextStr: ", plaintextStr);
  
    return plaintextStr;
  } else{
    return "";
  }
}

/**
 * 
 * @param {nanoAmountPRV : number} nanoAmountPRV 
 */
const toPRV = (nanoAmountPRV) => parseFloat(nanoAmountPRV / PrivacyUnit);

/**
 * 
 * @param {amountPRV : number} amountPRV 
 */
const toNanoPRV = (amountPRV) => Number(amountPRV * PrivacyUnit);



export { addChecksumToBytes, toPRV, toNanoPRV, encryptMessageOutCoin, decryptMessageOutCoin };