import * as key from "../lib/key"
import {byteToHexString} from "../lib/common"
import * as base58 from "../lib/base58"
import CryptoJS from "crypto-js";
import SHA512 from "crypto-js/sha512";


// const SHA512 =

function TestKey() {
  let sk = key.GenerateSpendingKey([123]);
  console.log("Spending key : ", sk);

  let pk = key.GeneratePublicKey(sk);
  console.log("Public key : ", pk);

  let rk = key.GenerateReceivingKey(sk);
  console.log('Receiving key: ', rk);

  let tk = key.GenerateTransmissionKey(rk);
  console.log('Transmission key: ', tk);

  let vk = new key.ViewingKey(sk);
  console.log('Viewing key: ', vk);

  let paymentAddr = new key.PaymentAddress().fromSpendingKey(sk);
  console.log('Payment addr: ', paymentAddr);
  // let paymentAddrBytes = paymentAddr.toBytes();

  // let paymentAddr2 = new PaymentAddress().fromBytes(paymentAddrBytes);
  // console.log('Payment addr 2: ', paymentAddr2);
}

// TestKey();

function TestBase58(){
  let pkArray =  [2, 194, 130, 176 ,102, 36, 183, 114, 109, 135, 49, 114, 177, 92, 214, 31, 25, 4 ,72, 103, 196, 161, 36, 69, 121, 102, 159, 24, 31, 131, 101, 20, 0];
  let res = base58.checkEncode(pkArray, 0x00);
  console.log("REs: ", res);
}

// TestBase58()

function byteArrayToWordArray(ba) {
  var wa = [],
    i;
  for (i = 0; i < ba.length; i++) {
    wa[(i / 4) | 0] |= ba[i] << (24 - 8 * i);
  }

  return CryptoJS.lib.WordArray.create(wa, ba.length);
}