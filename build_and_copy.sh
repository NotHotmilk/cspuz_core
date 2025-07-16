#!/bin/bash
set -e

echo "Building Rust Wasm module..."
cargo build --release -p cspuz_solver_backend --target wasm32-unknown-emscripten

PZPRJS_PATH="/mnt/c/Users/the_h/WebstormProjects/pzprxrs/pzprxrs/"

DEST_DIR="${PZPRJS_PATH}/dist/js"
echo "Copying artifacts to ${DEST_DIR}"

cp target/wasm32-unknown-emscripten/release/deps/cspuz_solver_backend.js "$DEST_DIR/"
cp target/wasm32-unknown-emscripten/release/deps/cspuz_solver_backend.wasm "$DEST_DIR/"