// import {
//     KeyWallet as keyWallet
// } from "../../lib/core/hdwallet";
import {
    Wallet,
    KeyWallet
} from "../../lib/wallet";
import {
    RpcClient
} from "../../lib/rpcclient/rpcclient";
import {
    CustomTokenInit,
    CustomTokenTransfer
} from "../../lib/tx/constants";
import {
    PaymentAddressType,
    PRVIDSTR
} from "../../lib/core";
import {
    ENCODE_VERSION
} from "../../lib/constants";
import {
    checkEncode
} from "../../lib/base58";

// const rpcClient = new RpcClient("https://mainnet.incognito.org/fullnode");
// const rpcClient = new RpcClient("https://testnet.incognito.org/fullnode");
// const rpcClient = new RpcClient("http://localhost:9334");
// const rpcClient = new RpcClient("https://dev-test-node.incognito.org");
// const rpcClient = new RpcClient("http://54.39.158.106:9334");

let senderPrivateKeyStr;
let senderKeyWallet;
let accountSender;
let senderPaymentAddressStr;
let receiverPaymentAddrStr;

async function setup(){
	// await sleep(10000);
	await Wallet.setProvider("http://localhost:9334");
	senderPrivateKeyStr = "112t8rnXoBXrThDTACHx2rbEq7nBgrzcZhVZV4fvNEcGJetQ13spZRMuW5ncvsKA1KvtkauZuK2jV8pxEZLpiuHtKX3FkKv2uC5ZeRC8L6we";
	senderKeyWallet = KeyWallet.base58CheckDeserialize(senderPrivateKeyStr);

	await senderKeyWallet.KeySet.importFromPrivateKey(senderKeyWallet.KeySet.PrivateKey);
	accountSender = Wallet.NewTransactor();
	accountSender.key = senderKeyWallet;
	senderPaymentAddressStr = senderKeyWallet.base58CheckSerialize(PaymentAddressType);
	receiverPaymentAddrStr = "12si2KgWLGuhXACeqHGquGpyQy7JZiA5qRTCWW7YTYrEzZBuZC2eGBfckc2NRXkQXiw7XwK2WVfKxC8AcwKGCsyRVr9SR8bN9vTcnk2PPbymztCWadgr9JMP1UY6oSk9XZb56EAKunejzNnmo9Ln";
}
async function TestGetBalance() {

    await setup();
    // create and send PRV
    try {
        let balance = await accountSender.getBalance(null);
        console.log("balance: ", balance);
    } catch (e) {
        console.log("Error when get balance: ", e);
    }
}
async function TestGetAllPrivacyTokenBalance() {

    await setup();
    // create and send PRV
    try {
        let result = await accountSender.getAllPrivacyTokenBalance();
        console.log("result: ", result);
    } catch (e) {
        console.log("Error when get balance: ", e);
    }
}
async function TestGetRewardAmount() {

    await setup();
    // get reward amount
    let response0;
    try {
        response0 = await accountSender.getRewardAmount(false, "");
    } catch (e) {
        console.log(e);
    }
    console.log("REsponse getRewardAmount: ", response0);
}
async function TestCreateAndSendRewardAmountTx() {

    await setup();

    let fee = 10;
    let response;
    try {
        response = await accountSender.createAndSendWithdrawRewardTx(fee, null);
    } catch (e) {
        console.log(e);
        throw e;
    }

    console.log("Response createAndSendWithdrawRewardTx: ", response);
}
async function TestBurningRequestTx() {

    await setup();

    let fee = 20;
    // create and send burning request tx
    let response0;
    try {
        response0 = await accountSender.createAndSendBurningRequestTx([], fee, tokenID, "d5808Ba261c91d640a2D4149E8cdb3fD4512efe4", 100);
    } catch (e) {
        console.error(e);
        // throw e;
    }

    console.log("Response createAndSendBurningRequestTx: ", response0);
}
async function TestStakerStatus() {

    // sender key
    await setup();

    // get staker status
    let response0;
    try {
        response0 = await accountSender.stakerStatus();
    } catch (e) {
        console.log(e);
    }

    console.log("REsponse status staker: ", response0);
}
async function TestCreateAndSendNativeToken() {

    await setup();
    let fee = 10;
    let isPrivacy = false;
    let info = "";
    let amountTransfer = 400; // in nano PRV
    console.log("Will Transfer: ", amountTransfer);

    let paymentInfosParam = [];
    paymentInfosParam[0] = {
        "PaymentAddress": receiverPaymentAddrStr,
        "Amount": amountTransfer,
        // "message": "A mouse is so cute A mouse is so cute A mouse is so cute A mouse is so cute A mouse is so cute A mouse is so cute A mouse is so cute"
    };

    // create and send PRV
    try {
        let res = await accountSender.createAndSendNativeToken(paymentInfosParam, fee, isPrivacy, info, false);
        console.log('Send tx succesfully with TxID: ', res.txId);
    } catch (e) {
        console.log("Error when send PRV: ", e);
        throw e;
    }
    console.log("Send tx 1 done");
}
async function TestSendMultiple() {
    await setup();

    let info = "Fragment";

    const receivers = [
        '12smKh2tQ8CSqfXYKYXePDAxok9fb9xxxA6bszbtKGzd2ierpgz93kFfxiRxaSs4dFtUwghEoFW79YTJUyF6mXefiqtjWH2cBuNUSq5oGgG4aEeJj2UmeL9WhvikdsHr16KYpRxsKNkskUR53xyS',
        '12sxXoS2bfRwbC3awyzdjCmUSdGPbU5mqrWM5GchPfxTPVnvHBFiti9ZfyGPxQefj6CSqdAb1JdgXYEisXZCx5rKQkTkiLEpoaDttS7t4H4C3uygrRyLZEgxJyc3ZgnK5vimtjxeFSNpZniga9Av',
        '12sebYMiUvwF3EkmjPPG8bHWgjueKZS1A7QZKxvsaSydbHoJv18m8Dz9EsRK1gTVTKQVz4zpBKFwW9cxdUuTDbJpAkRHHTAXeMimzyw7yhXHkmKVcXg4CU8wZVSTNUfg7Sfe2AFdvjzsyy6pF9PK',
        '12ssf4RwD6Pqy9q4uM7M3mfchdoYJ3QG3pG5rfKe7PZ49w8BttR3VjuFsAQDu4amMCEkBW1qidtwhrHcodNtJ26BAmtM81piW2Ntmyztk2FC4x9EPifXbKibnz6PkvwTVUhNuNAdBZvj8zYvmSBR',
    ];
    const amount = 1400;
    const paymentInfos = receivers.map(item => ({
        "PaymentAddress": item,
        "Amount": amount,
    }));
    try{
	    const res = await accountSender.createAndSendNativeToken(paymentInfos, 100, true, info, false);
	    console.log('Send tx succesfully with TxID: ', res.txId);
	}catch(e){
		console.log("error:",e);
		throw e;
	}
}
async function TestCreateAndSendConversion() {

    await setup();
    let fee = 100;
    let isPrivacy = false;
    let info = "";
    console.log("Will convert all PRV");

    let paymentInfosParam = [];

    // create and send PRV
    try {
        let res = await accountSender.createAndSendConvertTx(paymentInfosParam, fee, info, false);
        console.log('Send tx succesfully with TxID: ', res.txId);
    } catch (e) {
        console.log("Error when send PRV: ", e);
        throw e;
    }
    console.log("Send tx 1 done");
}
async function TestCreateAndSendTokenConversion() {

    await setup();
    let fee = 100;
    let isPrivacy = false;
    let info = "";
    // use the global var tokenID instead
    // let tokenID = "89eddbfac0e6c4827f378c4c453c9011c2b78e50cc54479d70914c505946d526";
    console.log("Will convert all coins of token", tokenID);

    // PRV for fee, token for convert. So no payment info needed
    let paymentInfo = [];
    let tokenPaymentInfo = [];

    // create and send PRV
    try {
        let res = await accountSender.createAndSendTokenConvertTx(tokenID, paymentInfo, tokenPaymentInfo, fee, info, false);
        console.log('Send tx succesfully with TxID: ', res.txId);
    } catch (e) {
        console.log("Error when send PRV: ", e);
        throw e;
    }
    console.log("Send tx 1 done");
}
async function TestCreateAndSendPrivacyTokenInit() {

    await setup();
    // payment info for PRV
    let paymentInfos = [];
    // prepare token param for tx privacy token init
    let amountInit = 10000;
    let tokenParams = {
        TokenID: "",
        TokenName: "Rose",
        TokenSymbol: "RSE",
        TokenTxType: CustomTokenInit,
        Amount: amountInit
    }
    let tokenPaymentInfo = [{
            PaymentAddress: senderPaymentAddressStr,
            Amount: amountInit
    }]

    let feePRV = 50;
    let hasPrivacy = false;

    try {
        let res = await accountSender.createAndSendPrivacyToken("", paymentInfos, tokenPaymentInfo, feePRV, hasPrivacy, "", false, false, tokenParams);
        console.log('Send tx succesfully with TxID: ', res.txId);
        return res.TokenID;
    } catch (e) {
        console.log("Error when initing ptoken: ", e);
        throw e;
    }
}
async function TestCreateAndSendPrivacyTokenTransfer() {

    await setup();

    let paymentInfos = [];
    let amountTransfer = 44;

    // prepare token param for tx custom token init
    let tokenPaymentInfo = [{
            PaymentAddress: receiverPaymentAddrStr,
            Amount: amountTransfer,
            // Message: "ABC"
    }]

    let feePRV = 10;
    let hasPrivacy = true;

    try{
    	let res = await accountSender.createAndSendPrivacyToken(tokenID, paymentInfos, tokenPaymentInfo, feePRV, hasPrivacy, "");
    	console.log('Send tx succesfully with TxID: ', res.txId);
    }catch (e) {
        console.log("Error when transferring ptoken: ", e);
        throw e;
    }
}
async function TestCreateAndSendStakingTx() {

    await setup();

    let param = {
        type: 0
    };
    let fee = 30;
    let candidatePaymentAddress = senderPaymentAddressStr;
    // let candidateMiningSeedKey = "12VH5z8JCn9B8SyHvB3aYP4ZGr1Wf9Rywx2ZSBe3eQneADzJ3bL";
    let rewardReceiverPaymentAddress = senderPaymentAddressStr;
    let autoReStaking = true;

    let candidateMiningSeedKey = checkEncode(accountSender.key.getMiningSeedKey(), ENCODE_VERSION);

    // create and send staking tx
    try {
        await accountSender.createAndSendStakingTx(param, fee, candidatePaymentAddress, candidateMiningSeedKey, rewardReceiverPaymentAddress, autoReStaking);
    } catch (e) {
        console.log("Error when staking: ", e);
        throw e;
    }
}
async function TestCreateAndSendStopAutoStakingTx() {

    await setup();
    let fee = 5;
    let candidatePaymentAddress = senderPaymentAddressStr;
    let candidateMiningSeedKey = checkEncode(accountSender.key.getMiningSeedKey(), ENCODE_VERSION);

    // create and send staking tx
    try {
        await accountSender.createAndSendStopAutoStakingTx(fee, candidatePaymentAddress, candidateMiningSeedKey);
    } catch (e) {
        console.log("Error when staking: ", e);
        throw e;
    }
}
async function TestDefragment() {
    await setup();
    // create and send defragment tx
    let response;
    try {
        response = await accountSender.defragmentNativeCoin(100, true, 30);
    } catch (e) {
        console.log(e);
        throw e;
    }

    console.log("REsponse defragment: ", response);
}
async function TestMakeFragments() {
    await setup();
    const senders = [
        '112t8rnXoBXrThDTACHx2rbEq7nBgrzcZhVZV4fvNEcGJetQ13spZRMuW5ncvsKA1KvtkauZuK2jV8pxEZLpiuHtKX3FkKv2uC5ZeRC8L6we',
        '112t8rnZDRztVgPjbYQiXS7mJgaTzn66NvHD7Vus2SrhSAY611AzADsPFzKjKQCKWTgbkgYrCPo9atvSMoCf9KT23Sc7Js9RKhzbNJkxpJU6',
    ];

    const fragmentAccountKey = '113FavVjd4dEFCqkkdA5TP1HQMWVjczzRx7yprpMPmFuBMJ3gq17ouA6azaj4Hp5aHwNBBq1KpFnaRPoVHET6gPshyJxykgkdHBDKeffNFwt';
    const fragmentSenderKeyWallet = KeyWallet.base58CheckDeserialize(fragmentAccountKey);
    fragmentSenderKeyWallet.KeySet.importFromPrivateKey(fragmentSenderKeyWallet.KeySet.PrivateKey);
    const fragmentAccount = Wallet.NewTransactor();
    fragmentAccount.key = fragmentSenderKeyWallet;

    let utxos = 0;
    const receivers = [
        '12si2KgWLGuhXACeqHGquGpyQy7JZiA5qRTCWW7YTYrEzZBuZC2eGBfckc2NRXkQXiw7XwK2WVfKxC8AcwKGCsyRVr9SR8bN9vTcnk2PPbymztCWadgr9JMP1UY6oSk9XZb56EAKunejzNnmo9Ln',
        '12sxXUjkMJZHz6diDB6yYnSjyYcDYiT5QygUYFsUbGUqK8PH8uhxf4LePiAE8UYoDcNkHAdJJtT1J6T8hcvpZoWLHAp8g6h1BQEfp4h5LQgEPuhMpnVMquvr1xXZZueLhTNCXc8fkVXseeVAGCt8',
    ];

    const amountTransfer = 1000;
    const paymentInfos = receivers.map(item => ({
        "PaymentAddress": item,
        "Amount": amountTransfer,
    }));

    while (utxos < 50) {
        for (const sender of senders) {
            let senderKeyWallet = KeyWallet.base58CheckDeserialize(sender);
            await senderKeyWallet.KeySet.importFromPrivateKey(senderKeyWallet.KeySet.PrivateKey);
            let accountSender = Wallet.NewTransactor();
            accountSender.key = senderKeyWallet;

            // create and send PRV
            let res = await accountSender.createAndSendNativeToken(paymentInfos, 100, false, "Fragment", false);
            console.log('Send tx succesfully with TxID: ', res.txId);
        }

        await Wallet.sleep(20000);
        utxos += 2;
        console.log('NEW UTXOs', utxos);
    }
}
/************************* DEX **************************/
// 1:10 ratio
async function TestCreateAndSendPTokenContributionTx() {

    await setup();
    let fee = 15;
    let pdeContributionPairID = "123";
    let contributedAmount = 100;

    try {
        await accountSender.createAndSendTxWithContribution(
            fee, pdeContributionPairID, contributedAmount, "", tokenID
        );
    } catch (e) {
        console.log("Error when staking: ", e);
        throw e;
    }
}
async function TestCreateAndSendPRVContributionTx() {

    await setup();
    let fee = 15;
    let pdeContributionPairID = "123";
    let contributedAmount = 1000;

    try {
        await accountSender.createAndSendTxWithContribution(
            fee, pdeContributionPairID, contributedAmount
        );
    } catch (e) {
        console.log("Error when staking: ", e);
        throw e;
    }
}
async function TestCreateAndSendNativeTokenTradeRequestTx() {

    await setup();

    let fee = 100;
    let sellAmount = 2000;
    let tokenIDToSellStr = null;
    let tokenIDToBuyStr = tokenID;
    let minAcceptableAmount = 100;
    let tradingFee = 25;

    // create and send staking tx
    try {
        let res = await accountSender.createAndSendNativeTokenTradeRequestTx(
            fee, tokenIDToBuyStr, sellAmount, minAcceptableAmount, tradingFee, "", tokenIDToSellStr
        );

        console.log("RESPONSE: ", res);
    } catch (e) {
        console.log("Error when trading native token: ", e);
        throw e;
    }
}
async function TestCreateAndSendPTokenTradeRequestTx() {

    await setup();

    let feePRV = 10;
    let sellAmount = 300;
    let tokenIDToSellStr = tokenID;
    let tokenIDToBuyStr = null;
    let minAcceptableAmount = 600;
    let tradingFee = 10;


    // create and send staking tx
    try {
        let res = await accountSender.createAndSendNativeTokenTradeRequestTx(
            feePRV, tokenIDToBuyStr, sellAmount, minAcceptableAmount, tradingFee
        );
        console.log("RESPONSE: ", res);
    } catch (e) {
        console.log("Error when trading native token: ", e);
        throw e;
    }
}
async function TestGetOutputCoins() {
    await setup();
    // accountSender.setIsRevealViewKeyToGetCoins(true);
    let allCoins = await accountSender.fetchOutputCoins(null, Wallet.RpcClient, -1);
    console.log("allCoins: ", allCoins);
}

async function GetListReceivedTx() {
    await setup();
    try{
        let receivedTxs = await accountSender.getReceivedTransaction();
        console.log(receivedTxs);
    }catch(e){
        throw e;
    }
}

// to run this test flow, make sure the account has enough PRV to stake & some 10000 of this token; both are version 1
var tokenID = "699a3006d1865ebdc437053b33df6a62c6c7c2f554f2fd0adf99a60f5117f945";
async function MainRoutine(){
	console.log("BEGIN WEB WALLET TEST");
	// sequential execution of tests; the wait might still be too short
	try{
		await TestGetBalance();
		await TestGetAllPrivacyTokenBalance();
		await Wallet.sleep(20000);
		await TestCreateAndSendConversion();
		await Wallet.sleep(20000);
		await TestCreateAndSendNativeToken();
		await Wallet.sleep(20000);
		await TestCreateAndSendStakingTx();
		await Wallet.sleep(20000);
        await GetListReceivedTx();
        await Wallet.sleep(20000);
		await TestStakerStatus();
        await Wallet.sleep(20000);
		await TestCreateAndSendTokenConversion();
		await Wallet.sleep(20000);
        // init token may err when a token of that name already exists
		let newTokenID = await TestCreateAndSendPrivacyTokenInit();
		await Wallet.sleep(20000);
		await TestSendMultiple();
		await Wallet.sleep(30000);
  //    // burning will return an error since this is not a bridge token
		await TestBurningRequestTx();
		await Wallet.sleep(30000);
		await TestCreateAndSendPrivacyTokenTransfer();
		tokenID = newTokenID;
		console.log("New token", tokenID);
		await Wallet.sleep(30000);
		await TestCreateAndSendPrivacyTokenTransfer();
		await Wallet.sleep(20000);
		await TestGetOutputCoins();
		await Wallet.sleep(20000);
		await TestCreateAndSendStopAutoStakingTx();
	}catch(e){
		console.log("Test failed");
		console.error(e);
		throw e;
	}
	console.log("END WEB WALLET TEST");
}
MainRoutine();

async function PDERoutine(){
    console.log("BEGIN PDE TEST");
    try{
        await TestCreateAndSendPRVContributionTx();
        await Wallet.sleep(10000);
        await TestCreateAndSendPTokenContributionTx();
        await Wallet.sleep(30000);
        console.log("TRADE");
        await TestCreateAndSendNativeTokenTradeRequestTx();
        await Wallet.sleep(20000);
        await TestCreateAndSendPTokenTradeRequestTx();
        await Wallet.sleep(100000);
        console.log("Remember to check the balance of these accounts")
    }catch(e){
        console.log("Test failed");
        console.error(e);
        throw e;
    }
    console.log("END PDE TEST");
}
// PDERoutine();

// to use this test flow, make sure acc1 has some 10000s in PRV in version 2 coins
async function DefragmentRoutine(){
    console.log("BEGIN DEFRAG TEST");
    try{
        await TestMakeFragments();
        await Wallet.sleep(40000);
        await TestDefragment();
    }catch(e){
        console.log("Test failed");
        console.error(e);
        throw e;
    }
    console.log("END DEFRAG TEST");
}
// DefragmentRoutine();