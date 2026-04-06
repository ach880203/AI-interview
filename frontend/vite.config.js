import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    tailwindcss(), // Tailwind CSS v4 — CSS 파일의 @import "tailwindcss" 와 함께 동작
    react(),
  ],
})
