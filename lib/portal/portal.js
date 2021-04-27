import {
    PortalParams
} from './params';

import {
    base64Encode
} from '../privacy/utils';

import {
    wasm
} from '../wasm/loader';

class Portal {
    /**
     * @param {string} chainName - testnet/mainnet
     */
    constructor(chainName) {
        this.PaymentAddressStr = ""
        this.BTCAddressStr = ""
        this.Params = new PortalParams(chainName)
    }

    async generateBTCMultisigAddress(paymentAddressStr) {
        let masterPubKeysEncoded = new Array()
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
    Portal,
};