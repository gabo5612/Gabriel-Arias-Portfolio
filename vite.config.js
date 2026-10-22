import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // MediaPipe ships its own WASM loader; pre-bundling it breaks the fileset path.
  optimizeDeps: { exclude: ['@mediapipe/tasks-vision'] },
  server: { port: 5180 },
  // Publicado bajo una subcarpeta (GitHub Pages): BASE_PATH=/Gabriel-Arias-Portfolio/.
  base: process.env.BASE_PATH || '/',
})
