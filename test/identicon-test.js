// import {genImageFromStr} from "../lib/wallet/utils";
// import {hashSha3BytesToBytes} from "privacy-js-lib/lib/privacy_utils";
// import { convertHashToStr } from "../lib/common";


// let bytes = [1,2,3];
// let hash = hashSha3BytesToBytes(bytes);
// let str = convertHashToStr(hash);
// let res = genImageFromStr(str);
// console.log("Result identicon: ", res);

import {Wallet} from "../lib/wallet/wallet"
import {RpcClient} from "../lib/rpcclient/rpcclient"

async function test () {
    Wallet.RpcClient = new RpcClient("http://test-node-constant-chain.constant.money:9334")
    let resp = await Wallet.RpcClient.hashToIdenticon(["ba62745dea932f8121064d72347ef25a326067643f21c520942dcc642fec6632"])
    console.log(resp.data.Result)
}

test()
