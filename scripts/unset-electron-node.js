#!/usr/bin/env node

const { spawnSync } = require('node:child_process')

const [, , command, ...args] = process.argv

if (!command) {
  console.error('[unset-electron-node] Missing command to execute.')
  process.exit(1)
}

const env = { ...process.env }
delete env.ELECTRON_RUN_AS_NODE

const result = spawnSync(command, args, {
  stdio: 'inherit',
  env,
  shell: process.platform === 'win32',
})

if (result.error) {
  console.error('[unset-electron-node] Failed to execute command:', result.error.message)
  process.exit(1)
}

process.exit(result.status ?? 0)
