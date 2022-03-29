const { default: Axios } = require("axios");
const {
    Wallet,
    Account: AccountWallet,
    init,
    StorageServices,
} = require("../../");

const TEST_NET = {
    fullNode: 'https://testnet.incognito.org/fullnode',
    coinService: 'http://51.89.21.38:8096',
    pubsubService: 'http://51.89.21.38:9096',
    requestService: 'http://51.89.21.38:8096',
    apiService: 'https://staging-api-service.incognito.org',
    portalService: 'http://51.161.119.66:8020'
}

const MAIN_NET = {
    fullNode: 'https://lb-fullnode.incognito.org/fullnode',
    coinService: 'https://api-coinservice.incognito.org',
    pubsubService: 'https://api-coinservice.incognito.org/txservice',
    requestService: 'https://api-coinservice.incognito.org',
    apiService: 'https://api-service.incognito.org',
    portalService: 'https://api-portalv4.incognito.org'
}

const SERVICE = MAIN_NET;

const PRV_ID            = "0000000000000000000000000000000000000000000000000000000000000004";
const PRIVATE_KEY_STR   = "112t8rne4kpmGQe6KCjTe4JqqsvjTPxHQsw9FWaxY65XqHxUueJuLGxJvoH872vxGmbkz1gkcYgtQ1VnrCjw2wSDgtJzCVyt8nRGFHjcEfpV"
const DEVICE_ID         = "9AE4B404-3E61-495D-835A-05CEE34BE251";
const PRIVACY_VERSION   = 2;

async function setupWallet() {
    let wallet;
    let accountSender;

    /**---> Init wallet <---*/
    await init();
    wallet = new Wallet();
    wallet = await wallet.init(
        "password",
        new StorageServices(),
        "Master",
        "Anon"
    );

    /**---> Get accessToken <---*/
    const data = { DeviceID: DEVICE_ID };
    const authTokenDt = await Axios.post(`${SERVICE.apiService}/auth/new-token`, data);
    const authToken = authTokenDt.data.Result.Token;
    console.log("AccessToken: ", authToken);

    /**---> Config account <---*/
    accountSender = new AccountWallet(Wallet);
    accountSender.setRPCCoinServices(SERVICE.coinService);
    accountSender.setRPCClient(SERVICE.fullNode);
    accountSender.setRPCTxServices(SERVICE.pubsubService);
    accountSender.setRPCRequestServices(SERVICE.requestService);
    accountSender.setAuthToken(authToken);
    accountSender.setRPCApiServices(SERVICE.apiService, authToken);
    await accountSender.setKey(PRIVATE_KEY_STR);
    return {
        wallet,
        accountSender,
    }
}

module.exports = {
    PRV_ID,
    SERVICE,
    PRIVATE_KEY_STR,
    DEVICE_ID,
    PRIVACY_VERSION,
    setupWallet
};