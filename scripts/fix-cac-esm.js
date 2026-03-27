#!/usr/bin/env node

const { existsSync, readFileSync, writeFileSync } = require('node:fs')
const { resolve } = require('node:path')

const packageJsonPath = resolve(process.cwd(), 'node_modules', 'cac', 'package.json')

if (!existsSync(packageJsonPath)) {
  process.exit(0)
}

try {
  const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'))
  let changed = false

  if (packageJson.main !== 'index-compat.js') {
    packageJson.main = 'index-compat.js'
    changed = true
  }

  if (packageJson.exports?.['.']?.require !== './index-compat.js') {
    packageJson.exports = packageJson.exports || {}
    packageJson.exports['.'] = packageJson.exports['.'] || {}
    packageJson.exports['.'].require = './index-compat.js'
    changed = true
  }

  if (changed) {
    writeFileSync(packageJsonPath, `${JSON.stringify(packageJson, null, 2)}\n`)
    console.log('[fix-cac-esm] Patched node_modules/cac/package.json')
  }
} catch (error) {
  console.warn('[fix-cac-esm] Skipped patch:', error instanceof Error ? error.message : String(error))
}
