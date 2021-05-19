#!/usr/bin/env bash
# must be run from top folder
echo "GOOS=js GOARCH=wasm go build -o ../privacy.wasm *.go"
mkdir -p ./lib/verifier/build/
cd wasm && GOOS=js GOARCH=wasm go build -o ../lib/verifier/build/privacy.wasm *.go && cd ..
pushd ./lib/verifier/build/
echo "Compressing WebAssembly binary"
zopfli privacy.wasm
rm -rfv privacy.wasm
popd
echo "Done"