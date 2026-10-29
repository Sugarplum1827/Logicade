import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const BACKEND = 'http://127.0.0.1:8000'

export default defineConfig(({ command }) => ({
  plugins: [react()],
  base: command === 'build' ? '/app/' : '/',
  build: {
    outDir: '../client/dist',
    emptyOutDir: true,
  },
  server: {
    fs: {
      deny: ['.env', '.env.*', '*.{crt,pem}', '**/.git/**', '**/.[sS][tT][aA][tT][eE]/**'],
    },
    proxy: {
      // Data + assets served by FastAPI
      '/data':        BACKEND,
      '/client':      BACKEND,
      '/vendor':      BACKEND,
      '/game-builds': BACKEND,
      '/game-runtime': BACKEND,
      '/canvas-runtime': BACKEND,
      '/static':      BACKEND,
      '/admin':       BACKEND,
      // API endpoints
      '/api':         BACKEND,
      '/serve':       BACKEND,
      '/generate':    BACKEND,
      '/warm_pool':   BACKEND,
      '/reset_pools': BACKEND,
      '/health':      BACKEND,
      '/admin-info':  BACKEND,
      '/log':         BACKEND,
    },
  },
}))
