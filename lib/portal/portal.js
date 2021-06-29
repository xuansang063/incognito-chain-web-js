import {
    PortalParams
} from './params';

import {
    base64Encode
} from '../privacy/utils';

import { wasm } from '../wasm';

class Portal {
    /**
     * @param {string} chainName - testnet/mainnet
     */
    constructor(chainName) {
        this.Params = new PortalParams(chainName)
    }

    async generateBTCMultisigAddress(paymentAddressStr) {
        let masterPubKeysEncoded = new Array()
        this.Params.MasterPubKeys.forEach(function(item, _index, _array) {
            masterPubKeysEncoded.push(base64Encode(item))
        })
        let params = {
            MasterPubKeys: masterPubKeysEncoded,
            NumSigsRequired: this.Params.NumSigsRequired,
            ChainName: this.Params.ChainName,
            ChainCodeSeed: paymentAddressStr,
        }
        let resp = await wasm.generateBTCMultisigAddress(JSON.stringify(params), paymentAddressStr)
        return String(resp)
    }
}

export {
    Portal,
};