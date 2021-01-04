// Set options as a parameter, environment variable, or rc file.
require = require("esm")(module/*, options*/)
let w = require("./wallet.js");
const {load} = require("./wasm/loader-node.js")

module.exports = {
	Wallet: w,
	init: (fileName = 'privacy.wasm') => {
		return load(fileName)
	}
}