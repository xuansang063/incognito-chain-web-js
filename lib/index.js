// Set options as a parameter, environment variable, or rc file.
const path = require('path');
require = require("esm")(module/*, options*/)

let w = require("./wallet.js");

const {load} = require("./wasm/loader-node.js");
const wasmDefaultPath = path.join(__dirname, '..', 'privacy.wasm');
w.Wallet.prototype.init = function(fileName = wasmDefaultPath, incNodeUrl){
    this.setProvider(incNodeUrl);
    return load(fileName);
}

module.exports = w;