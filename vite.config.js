import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // MediaPipe ships its own WASM loader; pre-bundling it breaks the fileset path.
  optimizeDeps: { exclude: ['@mediapipe/tasks-vision'] },
  server: { port: 5180 },
  // Changes on every build: the Ask ChatGPT link carries it as llms.txt?v=…,
  // because ChatGPT keeps a copy of a URL it has read and would answer from
  // the llms.txt of an earlier deploy.
  define: { __BUILD__: JSON.stringify(new Date().toISOString().slice(0, 16).replace(/\D/g, '')) },
  // Publicado bajo una subcarpeta (GitHub Pages): BASE_PATH=/Gabriel-Arias-Portfolio/.
  base: process.env.BASE_PATH || '/',
})
