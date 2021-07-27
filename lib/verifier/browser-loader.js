import './wasm_exec.js';
// privacy.wasm is handled by wasm-loader, which outputs a WebAssembly.Instance
const wasmModule = import('./privacy');

const g = window;
if (!g.__gobridge__) {
    g.__gobridge__ = {};
}
const bridge = g.__gobridge__;

export async function loadAndInitGoWasm() {
    try {
        if (!bridge.ready) {
            const go = new Go();
            const { default: createInstance } = await wasmModule;
            const { instance } = await createInstance(go.importObject);
            go.run(instance);
            bridge.ready = true;
        }
    } catch (e) {
        console.log("Error running in browser:", e);
    }
}