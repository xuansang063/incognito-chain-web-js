const chai = require('chai');
const expect = chai.expect;
const chaiAsPromised = require('chai-as-promised');
chai.use(chaiAsPromised);
const bn = require('bn.js');
chai.use(require('chai-bn')(bn));
const Inc = require('..');

let setup = () => async function() {
    await Inc.init();
    this.inc = new Inc.SimpleWallet();

    const providers = ['http://127.0.0.1:9334']
    const privkeys = ['112t8roafGgHL1rhAP9632Yef3sx5k8xgp8cwK4MCJsCL1UWcxXvpzg97N4dwvcD735iKf31Q2ZgrAvKfVjeSUEvnzKJyyJD3GqqSZdxN4or', '112t8rnZDRztVgPjbYQiXS7mJgaTzn66NvHD7Vus2SrhSAY611AzADsPFzKjKQCKWTgbkgYrCPo9atvSMoCf9KT23Sc7Js9RKhzbNJkxpJU6', '112t8rne7fpTVvSgZcSgyFV23FYEv3sbRRJZzPscRcTo8DsdZwstgn6UyHbnKHmyLJrSkvF13fzkZ4e8YD5A2wg8jzUZx6Yscdr4NuUUQDAt'];
    this.transactors = await Promise.all(privkeys.map((k, i) => {
        this.inc.setProvider(providers[i]);
        return this.inc.NewTransactor(k);
    }));
    this.transactors.map(_t => _t.useCoinsService = false);
    this.inc.setProvider(providers[0]);
}

let generateBTCShieldingAddress = (incAddress, chainName) => async function() {
    console.log("Generate BTC Shielding Address For Inc Payment Address:", incAddress)
    let portal = this.inc.NewPortal(chainName)
    let btcAddress = await portal.generateBTCMultisigAddress(incAddress)
    console.log("BTC Address:", btcAddress)
}

let sendUnshieldingRequest = (tokenID, unshieldAmount, remoteAddress) => async function() {
    let fee = 100
    try {
        result = await this.transactors[0].unshieldPortal({
            transfer: {fee, tokenID},
            extra: {unshieldAmount, remoteAddress},
        })
        console.log("TxHash:", result.Hash)
    } catch (e) {
        console.log("Error when sending unshielding request:", e)
        throw e
    }
}

describe('Portal V4 Tests', async function() {
    before(setup())
    let incAddress = '12svfkP6w5UDJDSCwqH978PvqiqBxKmUnA9em9yAYWYJVRv7wuXY1qhhYpPAm4BDz2mLbFrRmdK3yRhnTqJCZXKHUmoi7NV83HCH2YFpctHNaDdkSiQshsjw2UFUuwdEvcidgaKmF3VJpY5f8RdN'
    let chainName = 'testnet'
    it('generate bitcoin shielding address ICO testnet', generateBTCShieldingAddress(incAddress, chainName))
    let unshieldAmount = 100000
    let remoteAddress = 'mxQAt2EJGrGJHtozUXmWMMFsFnBtfZD4ia'
    let unshieldingTokenID = 'ef5947f70ead81a76a53c7c8b7317dd5245510c665d3a13921dc9a581188728b'
    it('generate unshielding request', sendUnshieldingRequest(unshieldingTokenID, unshieldAmount, remoteAddress))
})