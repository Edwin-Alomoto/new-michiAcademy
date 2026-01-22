import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      'server/types': path.resolve(__dirname, '../server/dist/types')
    }
  },
  server: {
    port: 5173,
    host: '0.0.0.0',
    proxy: {
      '/auth': 'http://localhost:3000',
      '/game': 'http://localhost:3000',
      '/events': 'http://localhost:3000',
      '/certificate': 'http://localhost:3000',
      '/api': 'http://localhost:3000',
      '/transactions': 'http://localhost:3000'
    }
  }
})
