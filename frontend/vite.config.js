import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const backendTarget = process.env.DOCKER_ENV ? 'http://backend:8000' : 'http://localhost:8000'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': backendTarget,
      '/ws': {
        target: backendTarget.replace(/^http/, 'ws'),
        ws: true
      }
    }
  },
  test: {
    environment: 'jsdom',
    setupFiles: './src/test/setup.js'
  }
})
