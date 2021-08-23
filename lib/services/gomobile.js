const g = typeof window !== "undefined" ? window : {};
if (!g.__gobridge__) {
  g.__gobridge__ = {};
}
const bridge = g.__gobridge__;

export async function loadWasm(fileName) {
  try {
    if (!bridge.ready) {
      const go = new Go();
      let inst;
      if (!WebAssembly.instantiateStreaming) {
        // polyfill
        WebAssembly.instantiateStreaming = async (resp, importObject) => {
          const source = await (await resp).arrayBuffer();
          return await WebAssembly.instantiate(source, importObject);
        };
      }
      let result = await WebAssembly.instantiateStreaming(
        fetch(fileName),
        go.importObject
      );
      inst = result.instance;
      go.run(inst);
      bridge.ready = true;
    }
  } catch (e) {
    console.log("Error running in browser:", e);
  }
}
