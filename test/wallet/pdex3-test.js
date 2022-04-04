const {
    PRV_ID,
    ACCESS_ID,
    PRIVACY_VERSION,
    setupWallet
} = require("./constants")

let wallet;
let accountSender;
let pDexV3Instance;

async function setup() {
    const data = await setupWallet();
    wallet = data.wallet;
    accountSender = data.accountSender;
    pDexV3Instance = data.pDexV3Instance;
}

async function TestGetBalance() {
    try {
        const keyInfo = await accountSender.getKeyInfo({
            version: PRIVACY_VERSION,
        });
        const tokenIDs = [
            PRV_ID,
        ];
        // console.log("KEY INFO", { keyInfo, tokenIDs });
        let task = tokenIDs.map((tokenID) =>
            accountSender.getBalance({
                tokenID,
                version: PRIVACY_VERSION,
            })
        );
        console.log("BALANCE", await Promise.all(task));
    } catch (e) {
        console.log("TestGetBalance error: ", e);
    }
}

async function TestGetBalanceAccessOTA() {
    try {
        const keyInfo = await accountSender.getKeyInfo({
            version: PRIVACY_VERSION,
        });
        console.log("KEY INFO", keyInfo, ACCESS_ID);
        const balance = await accountSender.getBalance({
            tokenID: ACCESS_ID,
            version: PRIVACY_VERSION,
            isNFT: true,
        })
        console.log("BALANCE ACCESS_OTA", balance);
    } catch (e) {
        console.log("TestGetBalance error: ", e);
    }
}

async function TestGetListShare() {
    try {
        const share = await pDexV3Instance.getListShare();
        console.log('TestGetListShare: ', share)
    } catch (error) {
        console.log('TestGetListShare error: ', error)
    }
}

async function TestGetNFTData() {
    try {
        const start = new Date().getTime()
        const data = await pDexV3Instance.getNFTTokenData({ version: PRIVACY_VERSION });
        const end = new Date().getTime()
        console.log('NFT DATA: ', data);
        console.log('NFT LOAD TIME: ', end - start);
    } catch (error) {
        console.log('TestGetNFTData error: ', error);
    }
}

async function TestGetLPHistory() {
    try {
        const start = new Date().getTime()
        const data = await pDexV3Instance.getRemoveLPHistoriesApi({ version: PRIVACY_VERSION });
        const end = new Date().getTime()
        console.log('TestGetLPHistory: ', data);
        console.log('TestGetLPHistory TIME: ', end - start);
    } catch (error) {
        console.log('TestGetLPHistory error: ', error);
    }
}

async function RunTest() {
    console.log("BEGIN WEB PDEX3 TEST");
    await setup();
    // await TestGetBalance();
    // await TestGetBalanceAccessOTA();
    // await TestGetListShare();
    // await TestGetTxsHistory()
    // await TestGetNFTData();
    await TestGetLPHistory();
}

RunTest()