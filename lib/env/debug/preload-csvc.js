const { default: Axios } = require("axios");
const Inc = require('../../..');
const {
    Wallet,
    Account,
    StorageServices
} = Inc;

const privateKeys = ['112t8roafGgHL1rhAP9632Yef3sx5k8xgp8cwK4MCJsCL1UWcxXvpzg97N4dwvcD735iKf31Q2ZgrAvKfVjeSUEvnzKJyyJD3GqqSZdxN4or',
    '112t8rnZDRztVgPjbYQiXS7mJgaTzn66NvHD7Vus2SrhSAY611AzADsPFzKjKQCKWTgbkgYrCPo9atvSMoCf9KT23Sc7Js9RKhzbNJkxpJU6',
    '112t8rne7fpTVvSgZcSgyFV23FYEv3sbRRJZzPscRcTo8DsdZwstgn6UyHbnKHmyLJrSkvF13fzkZ4e8YD5A2wg8jzUZx6Yscdr4NuUUQDAt',
    '112t8rnXoBXrThDTACHx2rbEq7nBgrzcZhVZV4fvNEcGJetQ13spZRMuW5ncvsKA1KvtkauZuK2jV8pxEZLpiuHtKX3FkKv2uC5ZeRC8L6we',
    '112t8rnbcZ92v5omVfbXf1gu7j7S1xxr2eppxitbHfjAMHWdLLBjBcQSv1X1cKjarJLffrPGwBhqZzBvEeA9PhtKeM8ALWiWjhUzN5Fi6WVC',
    '112t8rnZUQXxcbayAZvyyZyKDhwVJBLkHuTKMhrS51nQZcXKYXGopUTj22JtZ8KxYQcak54KUQLhimv1GLLPFk1cc8JCHZ2JwxCRXGsg4gXU',
    '112t8rnXDS4cAjFVgCDEw4sWGdaqQSbKLRH1Hu4nUPBFPJdn29YgUei2KXNEtC8mhi1sEZb1V3gnXdAXjmCuxPa49rbHcH9uNaf85cnF3tMw',
    '112t8rnYoioTRNsM8gnUYt54ThWWrRnG4e1nRX147MWGbEazYP7RWrEUB58JLnBjKhh49FMS5o5ttypZucfw5dFYMAsgDUsHPa9BAasY8U1i',
    '112t8rnXtw6pWwowv88Ry4XxukFNLfbbY2PLh2ph38ixbCbZKwf9ZxVjd4s7jU3RSdKctC7gGZp9piy8nZoLqHwqDBWcsMHWsQg27S5WCdm4',
]

const rpcClient = "http://139.162.55.124:8334";
const rpcCoinService = "http://51.161.119.66:9009"; //dev-test-coin-service
const rpcTxService = "http://51.161.119.66:8001"; //dev-test-coin-service
const rpcRequestService = "http://51.161.119.66:5000"; //dev-test-coin-service
const privacyVersion = 2;
const rpcApiService = "https://privacyv2-api-service.incognito.org";
const deviceID = "9AE4B404-3E61-495D-835A-05CEE34BE251";

async function newAccount(privateKey) {
    let account = new Account(Wallet);
    account.setRPCCoinServices(rpcCoinService);
    account.setRPCClient(rpcClient);
    account.setRPCTxServices(rpcTxService);
    account.setRPCRequestServices(rpcRequestService);
    const data = {
        DeviceID: deviceID,
    };
    const authTokenDt = await Axios.post(`${rpcApiService}/auth/new-token`, data);
    const authToken = authTokenDt.data.Result.Token;
    account.setAuthToken(authToken);
    account.setRPCApiServices(rpcApiService, authToken);
    await account.setKey(privateKey);
    return account;
}

let m = () => {
    let inc = new Wallet();
    inc.init("pass", new StorageServices(), "Master", "Anon");
    return Inc.init()
        .then(_ => {
            // make a transactor for each private key
            return Promise.all(privateKeys.map(_k => newAccount(_k)))
                // aggregate relevant variables and unfold them onto global
                .then(_senders => {
                    const res = {
                        privateKeys,
                        addresses: _senders.map(_t => _t.key.base58CheckSerialize(Inc.constants.PaymentAddressType)),
                        Inc,
                        inc,
                        senders: _senders,
                    }
                    Object.assign(global, res);
                    console.log(Object.getPrototypeOf(_senders[0]));
                    console.log('Accounts Ready');
                    return res;
                })

        })
}

m();