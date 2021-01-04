"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
const g = global || window || self;
if (!g.__gobridge__) {
    g.__gobridge__ = {};
}
const bridge = g.__gobridge__;
// bridge.ready = false;

async function load(fileName) {
    try {
        if (!bridge.ready) {
            require("./wasm_exec")
            // var fs = require('fs');
            const go = new Go();
            let inst;
            
            if (!WebAssembly.instantiateStreaming) { // polyfill
                WebAssembly.instantiateStreaming = async (resp, importObject) => {
                    const source = await (await resp).arrayBuffer();
                    return await WebAssembly.instantiate(source, importObject);
                };
            }
            let result = await WebAssembly.instantiateStreaming(fetch(fileName), go.importObject);
            inst = result.instance;
            go.run(inst);
            bridge.ready = true;
        }
    } catch (e) {
        console.log("Error Running on mobile app: ", e);
    }
}

async function sleep(sleepTime) {
    return new Promise(resolve => setTimeout(resolve, sleepTime));
}

let getProxy = () => {
	let temp = new Proxy({}, {
        get: (_, key) => {
            return (...args) => {
                return new Promise(async(resolve, reject) => {
                    let run = () => {
                        let cb = (err, ...msg) => (err ? reject(err) : resolve(...msg));
                        bridge[key].apply(undefined, [...args, cb]);
                    };
                    while (!bridge.ready) {
                        await sleep(250);
                    }
                    if (!(key in bridge)) {
                        reject(`There is nothing defined with the name "${key.toString()}"`);
                        return;
                    }
                    if (typeof bridge[key] !== 'function') {
                        resolve(bridge[key]);
                        return;
                    }
                    run();
                });
            };
        }
    });
    return temp;
}

let wasm = getProxy();
module.exports = {
	wasm: wasm,
	load: load
};
//# sourceMappingURL=gobridge.js.map