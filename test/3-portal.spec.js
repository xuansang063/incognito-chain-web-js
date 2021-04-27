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
}

let generateBTCShieldingAddress = (incAddress, chainName) => async function() {
    console.log("Generate BTC Shielding Address For Inc Payment Address:", incAddress)
    let portal = this.inc.NewPortal(chainName)
    let btcAddress = await portal.generateBTCMultisigAddress(incAddress)
    console.log("BTC Address:", btcAddress)
}

describe('Portal V4 Tests', async function() {
    before(setup())
    let incAddress = '12svfkP6w5UDJDSCwqH978PvqiqBxKmUnA9em9yAYWYJVRv7wuXY1qhhYpPAm4BDz2mLbFrRmdK3yRhnTqJCZXKHUmoi7NV83HCH2YFpctHNaDdkSiQshsjw2UFUuwdEvcidgaKmF3VJpY5f8RdN'
    let chainName = 'testnet'
    it('generate bitcoin shielding address ICO testnet', generateBTCShieldingAddress(incAddress, chainName))
})