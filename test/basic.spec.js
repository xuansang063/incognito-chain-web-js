const chai = require('chai');
const expect = chai.expect;
const chaiAsPromised = require('chai-as-promised');
chai.use(chaiAsPromised);
const bn = require('bn.js');
const Inc = require('..');

let loadLegacyTests = (...filenames) => async function() {
    // require = require("esm")(module);
    this.legacyTests = {};
    filenames.forEach(f => {
        const m = require(f);
        Object.assign(this.legacyTests, m);
    })
}

let setup = () => async function() {
    await Inc.init();
    // Wallet defaults to devnet
    Inc.Wallet.RpcClient = new Inc.types.RpcClient('http://139.162.55.124:8334');
    this.inc = new Inc.SimpleWallet();

    const providers = ['http://139.162.55.124:8334', 'http://139.162.55.124:8334', 'http://139.162.55.124:8334']
    // shard : 0,0,1 (we test in a 2-shard environment)
    const privkeys = ['112t8roafGgHL1rhAP9632Yef3sx5k8xgp8cwK4MCJsCL1UWcxXvpzg97N4dwvcD735iKf31Q2ZgrAvKfVjeSUEvnzKJyyJD3GqqSZdxN4or', '112t8rnZDRztVgPjbYQiXS7mJgaTzn66NvHD7Vus2SrhSAY611AzADsPFzKjKQCKWTgbkgYrCPo9atvSMoCf9KT23Sc7Js9RKhzbNJkxpJU6', '112t8rne7fpTVvSgZcSgyFV23FYEv3sbRRJZzPscRcTo8DsdZwstgn6UyHbnKHmyLJrSkvF13fzkZ4e8YD5A2wg8jzUZx6Yscdr4NuUUQDAt'];
    this.transactors = await Promise.all(privkeys.map((k, i) => {
        this.inc.setProvider(providers[i]);
        return this.inc.NewTransactor(k);
    }));
    this.transactors.map(_t => _t.useCoinsService = false);

    // await Promise.all(this.transactors.map(t => t.submitKeyAndSync()));
    // reset to shard 0 endpoint
    this.inc.setProvider(providers[0]);
    this.incAddresses = this.transactors.map(_t => _t.key.base58CheckSerialize(Inc.constants.PaymentAddressType));
    const resp = await this.inc.rpc.listTokens();
    this.incTokens = resp.listPrivacyToken;
}

describe('Basic Tests for Web-js module', async function() {
    before(setup());
    before(loadLegacyTests("./wallet/accountwallet-test", "./wallet/wallet-test"));
    describe('Legacy tests', async function() {
        it.skip('main flow', async function() {
            await this.legacyTests.MainRoutine();
        });
        it.skip('PDex flow', async function() {
            await this.legacyTests.PDERoutine();
        });
        it.skip('Defrag flow', async function() {
            await this.legacyTests.DefragmentRoutine();
        })
        it('Wallet creation/import tests', async function() {
            await this.legacyTests.TestInitWallet();
            await this.legacyTests.TestImportWallet();
            await this.legacyTests.TestImportAccount();
        })
    })
})

module.exports = {
    setup
}