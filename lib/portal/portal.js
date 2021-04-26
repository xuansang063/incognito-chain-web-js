
import {
    base64Encode
} from '../privacy/utils';

import {
    wasm
} from '../wasm/loader';

class Portal {
    constructor() {
        this.PaymentAddressStr = ""
        this.BTCAddressStr = ""
        this.Params = PortalParams("testnet")
    }

    async generateBTCMultisigAddress(paymentAddressStr) {
        masterPubKeysEncoded = new Array()
        for (pubKeyBytes in this.Params.MasterPubKeys) {
            masterPubKeysEncoded.push(base64Encode(pubKeyBytes))
        }
        let params = {
            MasterPubKeys: masterPubKeysEncoded,
            NumSigsRequired: this.Params.NumSigsRequired,
            ChainName: this.Params.ChainName,
            ChainCodeSeed: paymentAddressStr,
        }
        let resp = await wasm.generateBTCMultisigAddress(JSON.stringify(params), paymentAddressStr)
        this.PaymentAddressStr = paymentAddressStr
        this.BTCAddressStr = string(resp)

        return this.BTCAddressStr
    }
}

export {
    Portal
};