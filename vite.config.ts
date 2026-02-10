import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// GitHub Pages: https://github.com/Jeon-HS401/logistics-sim 기준
const base = process.env.GITHUB_PAGES === 'true' ? '/logistics-sim/' : '/'

export default defineConfig({
  base,
  plugins: [react()],
  server: {
    port: 5173,
  },
})
