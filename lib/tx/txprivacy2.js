import {base64Decode} from "privacy-js-lib/lib/privacy_utils";

let isWASMRunned = false;
try{
    if (!isWASMRunned){
        require('isomorphic-fetch');
        require("../../wasm_exec")
        var fs = require('fs');
        const go = new Go();
        let inst;
        if (fs.readFileSync) {
            let data;
            try{
                data = fs.readFileSync("./privacy.wasm")
                console.log("REadinggggggggggg ");
                console.log("data: ", data);
            } catch(e){
                console.log(e);
            }

            WebAssembly.instantiate(data, go.importObject).then((result) => {
                inst = result.instance;
                go.run(inst);
                isWASMRunned = true;
            });


        } else {
            if (!WebAssembly.instantiateStreaming) { // polyfill
                WebAssembly.instantiateStreaming = async (resp, importObject) => {
                    const source = await (await resp).arrayBuffer();
                    console.log("WebAssembly source", source);
                    return await WebAssembly.instantiate(source, importObject);
                };
            }
            WebAssembly.instantiateStreaming(fetch("./privacy.wasm"), go.importObject).then(async (result) => {
                inst = result.instance;
                go.run(inst);
                isWASMRunned = true;
            });
        }
    }
} catch(e){
    console.log("Running on mobile app: ", e);
}

class Tx2 {
    constructor(){

    }

    /**
     *
     * @param {string} senderSK
     * @param {[{paymentAddressStr: string, amount: number}]} paramPaymentInfos
     * @param {number} fee      // in nano PRV
     * @param {bool} hasPrivacy
     * @param {string} tokenID
     * @param {string} metaData
     * @param {string} info
     */
    static async init(senderSK, paramPaymentInfos, fee, hasPrivacy, tokenID, metaData, info = ""){

        let params = {
            "senderSK" : senderSK,
            "paramPaymentInfos" : paramPaymentInfos,
            "fee": fee,
            "hasPrivacy": hasPrivacy,
            "tokenID": tokenID,
            "metaData": metaData,
            "info": info,
        };

        let result;
        if (typeof initTx  === "function"){
            console.log("initTx: ", initTx);

            let data = JSON.stringify(params);
            console.log("Data: ", data);

            let base64EncodedResult = await initTx(data);
            let resultBytes = base64Decode(base64EncodedResult);
            console.log("resultBytes: ", resultBytes.join(", "));
        } else {
            console.log("initTx is not a function");
        }
        console.log("result: ", result);
    }

    static async DeriveSerialNumber(privateKeyStr, snds){
        let params = {
            "privateKey" : privateKeyStr,
            "snds": snds
        }

        let paramJson = JSON.stringify(params);
        console.log("paramJson: ", paramJson);
    }
}


export {Tx2}