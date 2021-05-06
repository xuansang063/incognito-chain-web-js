const chai = require('chai');
const expect = chai.expect;
const chaiAsPromised = require('chai-as-promised');
chai.use(chaiAsPromised);
const bn = require('bn.js');
const Inc = require('..');

let setup = () => async function() {
    await Inc.init();
    // Wallet defaults to devnet
    Inc.Wallet.RpcClient = new Inc.types.RpcClient('http://139.162.55.124:8334');
    this.inc = new Inc.SimpleWallet();

    const providers = ['http://139.162.55.124:8334', 'http://139.162.55.124:8334', 'http://139.162.55.124:8334']
    // shard : 0,0,1 (we test in a 2-shard environment)
    const privkeys = ['112t8rnZDRztVgPjbYQiXS7mJgaTzn66NvHD7Vus2SrhSAY611AzADsPFzKjKQCKWTgbkgYrCPo9atvSMoCf9KT23Sc7Js9RKhzbNJkxpJU6', '112t8rnXoBXrThDTACHx2rbEq7nBgrzcZhVZV4fvNEcGJetQ13spZRMuW5ncvsKA1KvtkauZuK2jV8pxEZLpiuHtKX3FkKv2uC5ZeRC8L6we', '112t8rne7fpTVvSgZcSgyFV23FYEv3sbRRJZzPscRcTo8DsdZwstgn6UyHbnKHmyLJrSkvF13fzkZ4e8YD5A2wg8jzUZx6Yscdr4NuUUQDAt'];
    this.transactors = await Promise.all(privkeys.map((k, i) => {
        this.inc.setProvider(providers[i]);
        return this.inc.NewTransactor(k);
    }));
    this.transactors.map(_t => _t.useCoinsService = false);
    this.transactors.map(t => t.isSubmitOtaKey = true);
    // await Promise.all(this.transactors.map(t => t.submitKeyAndSync()));

    // reset to shard 0 endpoint
    this.inc.setProvider(providers[0]);
    this.incAddresses = this.transactors.map(_t => _t.key.base58CheckSerialize(Inc.constants.PaymentAddressType));
    let resp = {};
    try {
        resp = await this.inc.rpc.listTokens();
    } catch(e) {
        console.error(e);
        console.warn('Could not get token list. Maybe check your node endpoints')
    }
    this.incTokens = resp.listPrivacyToken;

    // fund acc3 if needed
    let bal = await this.transactors[1].balance(null, 2);
    bal = new bn(bal);
    if (bal.ltn(3000000)) {
        console.log(`Funding address ${this.incAddresses[1]}`);
        const resp = await this.transactors[0].prv({ transfer: { prvPayments: [new Inc.types.PaymentInfo(this.incAddresses[1], '30000000')], fee: 50 }});
        await this.transactors[1].waitTx(resp.Response.txId, 2);
    }
}

module.exports = {
    setup
}