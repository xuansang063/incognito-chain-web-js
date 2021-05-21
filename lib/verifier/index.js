import { RpcClient } from '@lib/rpcclient/rpcclient'
import { wasm } from '@lib/wasm';
import { load } from './browser-loader';
import { addressAsObject, otaKeyAsObject } from '@lib/common/keySet';
import { KeyWallet } from '@lib/core/hdwallet';

const rpc = new RpcClient('http://139.162.55.124:8334');
const requiredConfirmations = 5;

let formatResult = (nConfirms, coinPosition) => coinPosition < 0 ?
  'FAILED: TX does not include such transfer' :
  nConfirms <= 0 ?
  'MISSING: TX is not yet known by network' :
  nConfirms < requiredConfirmations ?
  `PENDING: transfer is included at UTXO #${coinPosition}\nConfirmations: ${nConfirms}` :
  `ACCEPTED: transfer is included at UTXO #${coinPosition}\nConfirmations: ${nConfirms}`

let verifySentTx = (seal, txId, paymentAddress) => {
  // load() skips from the 2nd call; we load WASM binary here to make page load faster
  const kw = KeyWallet.base58CheckDeserialize(paymentAddress);
  return Promise.all([
      load('/privacy.wasm'),
      rpc.getTransactionByHash(txId)
      .then(_resp => !_resp.blockHash ? [0, 0] : Promise.all([ // if TX is not in any block, skip other verifications
        rpc.getBlockByHash(_resp.blockHash).then(bhResponse => bhResponse.Confirmations),
        wasm.verifySentTx(JSON.stringify({ Tx: _resp, SenderSeal: seal, PaymentAddress: addressAsObject(kw.KeySet.PaymentAddress) }))
      ]))
    ])
    // discard the resolved load() result, pass the rest as arguments to formatResult
    .then(([, res]) => formatResult(...res))
}

let verifyReceivedTx = (txId, otaKey) => {
  const kw = KeyWallet.base58CheckDeserialize(otaKey);
  return Promise.all([
      load('/privacy.wasm'),
      rpc.getTransactionByHash(txId)
      .then(_resp => !_resp.blockHash ? [0, 0] : Promise.all([ // if TX is not in any block, skip other verifications
        rpc.getBlockByHash(_resp.blockHash).then(bhResponse => bhResponse.Confirmations),
        wasm.verifyReceivedTx(JSON.stringify({ Tx: _resp, OTAKey: otaKeyAsObject(kw.KeySet.OTAKey) }))
      ]))
    ])
    // discard the resolved load() result, pass the rest as arguments to formatResult
    .then(([, res]) => formatResult(...res))
};

export {
  wasm,
  verifySentTx,
  verifyReceivedTx,
}