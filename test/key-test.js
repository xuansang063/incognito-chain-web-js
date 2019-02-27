import * as key from "../lib/key"

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

TestKey();