#!/usr/bin/env node
// Applies compatibility patches for packages that ship package.json "exports"
// entries pointing to .mjs files that were never included in the npm tarball,
// and for the native rollup binary which crashes (SIGBUS) on kernel 6.17+.
'use strict'
const { writeFileSync, mkdirSync } = require('fs')
const { resolve, dirname } = require('path')

// Wrapper for Node.js / CLI packages (cac, electron-vite internals).
// createRequire works because these run inside a real Node.js process.
function createNodeMjsWrapper(targetPath, cjsRelPath, namedExports) {
  mkdirSync(dirname(targetPath), { recursive: true })
  const named = namedExports.map(n => `export const ${n} = _m.${n}`).join('\n')
  writeFileSync(
    targetPath,
    `// ESM wrapper — pharma-tracker postinstall (Node.js/CLI context)
import { createRequire } from 'module'
const _req = createRequire(import.meta.url)
const _m = _req('${cjsRelPath}')
export default _m
${named}
`
  )
  console.log('[postinstall] Wrote Node.js ESM wrapper:', targetPath)
}

// Wrapper for browser / renderer packages (tailwind-merge, @tanstack/react-table).
// Must NOT use createRequire — Vite externalises the "module" package for browser
// targets and the call fails at runtime. Instead, use a plain re-export that
// Vite/esbuild's CJS-to-ESM interop handles automatically during pre-bundling.
function createBrowserMjsWrapper(targetPath, cjsRelPath) {
  mkdirSync(dirname(targetPath), { recursive: true })
  writeFileSync(
    targetPath,
    `// ESM wrapper — pharma-tracker postinstall (browser/renderer context)
// Vite/esbuild rewrites this CJS re-export into pure ESM during optimizeDeps.
export * from '${cjsRelPath}'
`
  )
  console.log('[postinstall] Wrote browser ESM wrapper:', targetPath)
}

// --- Patch 1: cac@6.7.14 missing dist/index.mjs (used by electron-vite CLI — Node.js) ---
createNodeMjsWrapper(
  resolve(__dirname, '../node_modules/cac/dist/index.mjs'),
  './index.js',
  ['CAC', 'Command', 'cac']
)

// --- Patch 2: tailwind-merge missing dist/bundle-mjs.mjs (renderer — browser) ---
createBrowserMjsWrapper(
  resolve(__dirname, '../node_modules/tailwind-merge/dist/bundle-mjs.mjs'),
  './bundle-cjs.js'
)

// --- Patch 3: @tanstack/react-table missing build/lib/index.mjs (renderer — browser) ---
createBrowserMjsWrapper(
  resolve(__dirname, '../node_modules/@tanstack/react-table/build/lib/index.mjs'),
  './index.js'
)

// --- Patch 4: @rollup/rollup-linux-x64-gnu native addon crashes (SIGBUS) ---
// On kernel 6.17 both the GNU and MUSL native rollup binaries crash.
// @rollup/wasm-node provides the identical API via WebAssembly.
const rollupNative = resolve(__dirname, '../node_modules/rollup/dist/native.js')
const wasmNative   = resolve(__dirname, '../node_modules/@rollup/wasm-node/dist/native.js')
const { existsSync, readFileSync } = require('fs')
if (existsSync(wasmNative)) {
  const current = readFileSync(rollupNative, 'utf8')
  if (!current.includes('wasm-node')) {
    writeFileSync(
      rollupNative,
      `// Patched by pharma-tracker postinstall: native rollup binaries crash on
// kernel 6.17+ (SIGBUS/BUS_ADRERR). Uses @rollup/wasm-node instead.
'use strict'
const wasm = require('@rollup/wasm-node/dist/native.js')
module.exports.parse           = wasm.parse
module.exports.parseAsync      = wasm.parseAsync
module.exports.xxhashBase64Url = wasm.xxhashBase64Url
module.exports.xxhashBase36    = wasm.xxhashBase36
module.exports.xxhashBase16    = wasm.xxhashBase16
`
    )
    console.log('[postinstall] Patched rollup/dist/native.js → @rollup/wasm-node.')
  } else {
    console.log('[postinstall] rollup/dist/native.js already patched, skipping.')
  }
} else {
  console.warn('[postinstall] WARNING: @rollup/wasm-node/dist/native.js not found at', wasmNative)
  console.warn('[postinstall] Rollup WASM patch NOT applied — Linux builds may fail.')
}
