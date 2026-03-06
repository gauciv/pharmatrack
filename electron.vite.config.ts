import { resolve } from 'path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()]
  },
  preload: {
    plugins: [externalizeDepsPlugin()]
  },
  renderer: {
    resolve: {
      alias: {
        '@renderer': resolve('src/renderer/src'),
        '@': resolve('src/renderer/src'),
        // Point directly to CJS entry — bypasses the broken .mjs wrappers entirely.
        // esbuild processes the CJS files during optimizeDeps and emits proper
        // ESM named exports via static exports.xxx analysis.
        'tailwind-merge': resolve('node_modules/tailwind-merge/dist/bundle-cjs.js'),
        '@tanstack/react-table': resolve('node_modules/@tanstack/react-table/build/lib/index.js')
      }
    },
    optimizeDeps: {
      include: [
        'tailwind-merge',
        '@tanstack/react-table',
        'clsx',
        'class-variance-authority',
        'lucide-react',
        'react-router-dom',
        'firebase/app',
        'firebase/auth',
        'firebase/firestore'
      ]
    },
    plugins: [react()]
  }
})
