import { checkSumFirst4Bytes } from '../base58';
import { PrivacyUnit } from './constants';
import { hybridEncryption, KeyWallet } from './wallet';
import { stringToBytes, base64Encode, base64Decode } from '../privacy/utils';
import { CustomError, ErrorObject } from '../errorhandler';

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
async function encryptMessageOutCoin(paramPaymentInfos){
  for (p in paramPaymentInfos){
    if (p.message != "" && p.message != null){
      // get transmission key of receiver
      let keyWallet = KeyWallet.base58CheckDeserialize(p.paymentAddressStr);
      let transmissionKey = keyWallet.KeySet.PaymentAddress.Tk;
      let msgBytes = stringToBytes(p.message);

      // encrypt message
      let ciphertextBytes;
      try {
        ciphertextBytes = await hybridEncryption(transmissionKey, msgBytes);
      } catch(e){
        throw new CustomError(ErrorObject.EncryptMsgOutCoinErr, `PaymentAddress: ${p.paymentAddressStr}$`);
      }
     

      // base64 encode ciphertext
      let ciphertextEncode = base64Encode(ciphertextBytes);
      p.message = ciphertextEncode;
    } 
  }

  return paramPaymentInfos;
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
const toNanoPRV = (amountPRV) =>  Number(amountPRV * PrivacyUnit);



export  { addChecksumToBytes, toPRV, toNanoPRV, encryptMessageOutCoin };