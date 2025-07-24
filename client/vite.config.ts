import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
// https://vite.dev/config/
export default defineConfig({
  plugins: [
      react(),
    tailwindcss()
  ],
  server:{
    allowedHosts:["07dd314f12d9.ngrok-free.app"],
    proxy:{
      "/api":{
        target: 'http://localhost:3001',
        changeOrigin: true,
        secure: false,
      }
    }
  }
})
