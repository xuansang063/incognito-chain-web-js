//load WASM
let isWASMRunned = false;
let fileName = "./privacy_without_info.wasm";
try{
  if (!isWASMRunned){
    require('isomorphic-fetch');
    require("./wasm_exec")
    var fs = require('fs');
    const go = new Go();
    let inst;
    if (fs.readFileSync) {
      let data;
      try{
        data = fs.readFileSync(fileName)
        console.log("Reading wasm file");
      } catch(e){
        console.log("Error when reading wasm file: ", e);
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
          return await WebAssembly.instantiate(source, importObject);
        };
      }
      WebAssembly.instantiateStreaming(fetch(fileName), go.importObject).then(async (result) => {
        inst = result.instance;
        go.run(inst);
        isWASMRunned = true;
      });
    }
  }
} catch(e){
  console.log("Error Running on mobile app: ", e);
}