"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
const g = global || window || self;
if (!g.__gobridge__) {
    g.__gobridge__ = {};
}
const bridge = g.__gobridge__;
bridge.ready = false;

function load(fileName) {
    try {
        if (!bridge.ready) {
            require("./wasm_exec_node");
            var fs = require('fs');
            const go = new Go();
            let inst;
            let data;
            try {
                data = fs.readFileSync(fileName)
            } catch (e) {
                console.log("Error when reading wasm file: ", e);
            }

            return WebAssembly.instantiate(data, go.importObject).then((result) => {
                inst = result.instance;
                go.run(inst);
                bridge.ready = true;
            });
        }
    } catch (e) {
        console.log("Error Running on mobile app: ", e);
    }
}

module.exports = {
	load
};
//# sourceMappingURL=gobridge.js.map