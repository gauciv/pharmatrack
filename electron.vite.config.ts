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
        '@': resolve('src/renderer/src')
      },
      conditions: ['module', 'import', 'default']
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
      ],
      esbuildOptions: {
        conditions: ['module', 'import', 'default']
      }
    },
    plugins: [react()]
  }
})
