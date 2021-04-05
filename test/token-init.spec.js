const chai = require('chai');
const expect = chai.expect;
const chaiAsPromised = require('chai-as-promised');
chai.use(chaiAsPromised);
const bn = require('bn.js');
const Inc = require('..');
const { setup } = require('./basic.spec.js');

let initToken = (amount) => async function() {
    amount = new bn(amount).toString();
    let res = await this.transactors[0].newToken(new Inc.types.PaymentInfo(this.incAddresses[0], amount), 40, "My New Token", "MNT");
    console.log(`after creation, wait balance change for token ${res.TokenID}, address ${this.incAddresses[0]}`);
    let change = await this.transactors[0].waitBalanceChange(res.TokenID);
    change = new bn(change.balance) - new bn(change.oldBalance);
    this.newTokenID = res.TokenID;
    await expect(change.toString(), "Created Token balance mismatch").to.equal(amount);
}

let transferToken = (amount) => async function() {
    amount = new bn(amount).toString();
    let res = await this.transactors[0].token(this.newTokenID, [], [new Inc.types.PaymentInfo(this.incAddresses[1], amount)], 40, "TOKEN TRANSFER");
    console.log(`after same-shard transfer, wait balance change for token ${this.newTokenID}, address ${this.incAddresses[1]}`);
    let change = await this.transactors[1].waitBalanceChange(this.newTokenID);
    change = new bn(change.balance) - new bn(change.oldBalance);
    await expect(change.toString(), "Transferred Token balance mismatch").to.equal(amount);
}

let crossTransferToken = (amount) => async function() {
    amount = new bn(amount).toString();
    let res = await this.transactors[0].token(this.newTokenID, [], [new Inc.types.PaymentInfo(this.incAddresses[2], amount)], 40, "CROSS-SHARD TOKEN TRANSFER");
    console.log(`after cross-shard transfer, wait balance change for token ${this.newTokenID}, address ${this.incAddresses[2]}`);
    let change = await this.transactors[2].waitBalanceChange(this.newTokenID);
    change = new bn(change.balance) - new bn(change.oldBalance);
    await expect(change.toString(), "Transferred Token balance mismatch").to.equal(amount);
}

describe.skip('Tests for updated token-init flow', async function() {
    before(setup());
    describe('init token', async function() {
        const startAmount = 808080;
        it('should create new token & see balance update', initToken(startAmount));
        it('should send some new token to the same shard', transferToken(80));
        it('should send some new token to another shard', crossTransferToken(100));
    });
})