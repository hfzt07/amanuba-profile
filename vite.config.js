import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  base: '/amanuba-profile/', // ganti dengan nama repo kamu
  plugins: [react()],
})
