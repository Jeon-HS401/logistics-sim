import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// GitHub Pages: 저장소 이름이 'play_sim'이면 그대로 사용.
// 다른 이름으로 올리면 여기를 변경하세요 (예: base: '/my-repo/')
const base = process.env.GITHUB_PAGES === 'true' ? '/play_sim/' : '/'

export default defineConfig({
  base,
  plugins: [react()],
  server: {
    port: 5173,
  },
})
