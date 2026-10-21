import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ command }) => ({
  plugins: [react()],
  base: command === 'build' ? '/app/' : '/',
  build: {
    outDir: '../client/dist',
    emptyOutDir: true,
  },
  server: {
    proxy: {
      '/data': 'http://127.0.0.1:8000',
      '/client': 'http://127.0.0.1:8000',
      '/api': 'http://127.0.0.1:8000',
      '/serve': 'http://127.0.0.1:8000'
    }
  }
}))