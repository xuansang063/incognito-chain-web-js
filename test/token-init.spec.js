const { expect } = require('chai');
const bn = require('bn.js');
const Inc = require('..');

let loadLegacyTests = (name) => async function() {
    require = require("esm")(module);
    const m = require(name);
    this.legacyTests = m;
}

let setup = () => async function() {
    this.inc = new Inc.Lib();
    await this.inc.init();
    const t0 = await this.inc.NewTransactor('112t8rnXoBXrThDTACHx2rbEq7nBgrzcZhVZV4fvNEcGJetQ13spZRMuW5ncvsKA1KvtkauZuK2jV8pxEZLpiuHtKX3FkKv2uC5ZeRC8L6we');
    const t1 = await this.inc.NewTransactor('112t8rne7fpTVvSgZcSgyFV23FYEv3sbRRJZzPscRcTo8DsdZwstgn6UyHbnKHmyLJrSkvF13fzkZ4e8YD5A2wg8jzUZx6Yscdr4NuUUQDAt');
    // currently using a 2-shard environment
    this.transactorOfShard = [t0, t1];
    this.incAddresses = this.transactorOfShard.map(_t => _t.key.base58CheckSerialize(Inc.constants.PaymentAddressType));
}

let initToken = (amount) => async function() {
    amount = new bn(amount).toString();
    let res = await this.transactorOfShard[0].newToken(new Inc.types.PaymentInfo(this.incAddresses[0], amount), 40, "My New Token", "MNT");
    console.log("Must now wait balance change for token", res.TokenID);
    let change = await this.transactorOfShard[0].waitBalanceChange(res.TokenID);
    console.log(change);
    change = new bn(change.balance) - new bn(change.oldBalance);
    await expect(change.toString()).to.equal(amount, "Created Token balance mismatch")
    // console.log("PLZ look in beacon logs")
}
let transferToken = () => async function() {}

describe('Tests for Web-js module', async function() {
    before(setup());
    before(loadLegacyTests("./wallet/accountwallet-test"));
    describe('Init token with updated flow', async function() {
        const startAmount = 808080;
        it('should create new token & see balance update', initToken(startAmount))
        it.skip('should send some new token to the same shard', transferToken())
        it.skip('should send some new token to another shard', transferToken())
    })
    describe('Legacy tests', async function() {
        it('runs main flow', async function() {
            await this.legacyTests.MainRoutine();
        });
        it.skip('runs PDex flow', async function() {
            await this.legacyTests.PDERoutine();
        });
        it.skip('runs Defrag flow', async function() {
            await this.legacyTests.DefragmentRoutine();
        })
    })
})