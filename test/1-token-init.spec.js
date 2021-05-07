const chai = require('chai');
const expect = chai.expect;
const chaiAsPromised = require('chai-as-promised');
chai.use(chaiAsPromised);
const bn = require('bn.js');
const Inc = require('..');
const { setup } = require('./setup');

let initToken = (amount) => async function() {
    global.testingTokens = [];
    amount = new bn(amount).toString();
    let res = await this.transactors[0].newToken({ transfer: { tokenPayments: new Inc.types.PaymentInfo(this.incAddresses[0], amount), fee: 40 }, extra: { tokenName: "My New Token", tokenSymbol: "MNT" }});
    console.log(`after creation, wait balance change for token ${res.TokenID}, address ${this.incAddresses[0]}`);
    let change = await this.transactors[0].waitBalanceChange(res.TokenID);
    change = new bn(change.balance) - new bn(change.oldBalance);
    this.newTokenID = res.TokenID;
    global.testingTokens[0] = res.TokenID;
    await expect(change.toString(), "Created Token balance mismatch").to.equal(amount);

    res = await this.transactors[0].newToken({ transfer: { tokenPayments: new Inc.types.PaymentInfo(this.incAddresses[1], amount), fee: 40 }, extra: { tokenName: "My New Token 2", tokenSymbol: "MN2" }});
    console.log(`after creation, wait balance change for token ${res.TokenID}, address ${this.incAddresses[1]}`);
    change = await this.transactors[1].waitBalanceChange(res.TokenID);
    change = new bn(change.balance) - new bn(change.oldBalance);
    global.testingTokens[1] = res.TokenID;
    await expect(change.toString(), "Created Token balance mismatch").to.equal(amount);
}

let transferToken = (amount) => async function() {
    amount = new bn(amount).toString();
    let res = await this.transactors[0].token({ transfer: { tokenID: this.newTokenID, tokenPayments: [new Inc.types.PaymentInfo(this.incAddresses[1], amount)], fee: 40, info: "TOKEN TRANSFER" }});
    console.log(`after same-shard transfer, wait balance change for token ${this.newTokenID}, address ${this.incAddresses[1]}`);
    let change = await this.transactors[1].waitBalanceChange(this.newTokenID);
    change = new bn(change.balance) - new bn(change.oldBalance);
    await expect(change.toString(), "Transferred Token balance mismatch").to.equal(amount);
}

let crossTransferToken = (amount) => async function() {
    amount = new bn(amount).toString();
    let res = await this.transactors[0].token({ transfer: { tokenID: this.newTokenID, tokenPayments: [new Inc.types.PaymentInfo(this.incAddresses[2], amount)], fee: 40, info: "CROSS-SHARD TOKEN TRANSFER" }});
    console.log(`after cross-shard transfer, wait balance change for token ${this.newTokenID}, address ${this.incAddresses[2]}`);
    let change = await this.transactors[2].waitBalanceChange(this.newTokenID);
    change = new bn(change.balance) - new bn(change.oldBalance);
    await expect(change.toString(), "Transferred Token balance mismatch").to.equal(amount);
}

describe('Tests for updated token-init flow', async function() {
    before(setup());
    describe('init token', async function() {
        const startAmount = 400000;
        it('should create new token & see balance update', initToken(startAmount));
        it('should send some new token to the same shard', transferToken(200000));
        it('should send some new token to another shard', crossTransferToken(100));
    });
})