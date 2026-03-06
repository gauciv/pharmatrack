#!/usr/bin/env node
// Applies compatibility patches for packages that ship package.json "exports"
// entries pointing to .mjs files that were never included in the npm tarball,
// and for the native rollup binary which crashes (SIGBUS) on kernel 6.17+.
'use strict'
const { existsSync, writeFileSync, mkdirSync } = require('fs')
const { resolve, dirname } = require('path')

function createMjsWrapper(targetPath, cjsRelPath, namedExports) {
  if (existsSync(targetPath)) return
  mkdirSync(dirname(targetPath), { recursive: true })
  const named = namedExports.map(n => `export const ${n} = _m.${n}`).join('\n')
  writeFileSync(
    targetPath,
    `import { createRequire } from 'module'
const _req = createRequire(import.meta.url)
const _m = _req('${cjsRelPath}')
export default _m
${named}
`
  )
  console.log('[postinstall] Created missing ESM wrapper:', targetPath)
}

// --- Patch 1: cac@6.7.14 missing dist/index.mjs ---
createMjsWrapper(
  resolve(__dirname, '../node_modules/cac/dist/index.mjs'),
  './index.js',
  ['CAC', 'Command', 'cac']
)

// --- Patch 2: tailwind-merge missing dist/bundle-mjs.mjs ---
createMjsWrapper(
  resolve(__dirname, '../node_modules/tailwind-merge/dist/bundle-mjs.mjs'),
  './bundle-cjs.js',
  ['twMerge', 'twJoin', 'createTailwindMerge', 'extendTailwindMerge',
   'fromTheme', 'getDefaultConfig', 'mergeConfigs', 'validators']
)

// --- Patch 3: @tanstack/react-table missing build/lib/index.mjs ---
createMjsWrapper(
  resolve(__dirname, '../node_modules/@tanstack/react-table/build/lib/index.mjs'),
  './index.js',
  ['flexRender', 'useReactTable', 'getCoreRowModel', 'getSortedRowModel',
   'getFilteredRowModel', 'getPaginationRowModel', 'getGroupedRowModel',
   'getExpandedRowModel', 'createColumnHelper', 'functionalUpdate',
   'makeStateUpdater', 'memo', 'noop']
)

// --- Patch 4: @rollup/rollup-linux-x64-gnu native addon crashes (SIGBUS) ---
// On kernel 6.17 both the GNU and MUSL native rollup binaries crash.
// @rollup/wasm-node provides the identical API via WebAssembly.
const rollupNative = resolve(__dirname, '../node_modules/rollup/dist/native.js')
const wasmNative   = resolve(__dirname, '../node_modules/@rollup/wasm-node/dist/native.js')
if (existsSync(wasmNative)) {
  const current = require('fs').readFileSync(rollupNative, 'utf8')
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
  }
}
