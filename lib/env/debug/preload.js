const Inc = require('../../..');

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
const snippets = [
    'let tx0 = await senders[0].convert()',
    'await senders[0].waitTx(tx1.Response.txId)',
    'let tx1 = await senders[0].prv({ transfer: { prvPayments: [new Inc.types.PaymentInfo(addresses[1], 8000)] , fee: 10 }})',
    'senders[1].offlineMode = true',
    'let lst = await inc.rpc.listTokens()',
    'let coinList = await senders[0].coin(null, 2)',
    'let balToken = await senders[0].balance(lst.listPrivacyToken[0].ID)'
];
let m = () => {
    let inc = new Inc.SimpleWallet();
    inc.setProvider('http://139.162.55.124:8334');
    return Inc.init()
    .then(_ => {
        // make a transactor for each private key
        return Promise.all(privateKeys.map(_k => inc.NewTransactor(_k)))
        // aggregate relevant variables and unfold them onto global
        .then(_senders => {
            const res = {
                privateKeys,
                addresses: _senders.map(_t => _t.key.base58CheckSerialize(Inc.constants.PaymentAddressType)),
                Inc,
                inc,
                senders: _senders,
                rpc: inc.rpc,
                snippets
            }
            Object.assign(global, res);
            return res;
        })
    })
}
console.log('\nType "await preload()" to load Incognito debugging environment');

module.exports = m