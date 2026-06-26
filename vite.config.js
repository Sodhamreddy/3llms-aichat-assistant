import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/n8n-proxy': {
        target: 'https://n8n.kleza.io',
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/n8n-proxy/, ''),
      },
    },
  },
})
