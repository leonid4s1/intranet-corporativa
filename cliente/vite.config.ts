import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueJsx from '@vitejs/plugin-vue-jsx'
import vueDevTools from 'vite-plugin-vue-devtools'

export default defineConfig({
  plugins: [vue(), vueJsx(), vueDevTools()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: true, // evita que Vite cambie de puerto sin que te enteres
    allowedHosts: ['shortcuts-trained-jun-bone.trycloudflare.com'], // ⬅️ tu host del túnel
    proxy: {
      '/api': {
        target: 'http://localhost:3000', // ⬅️ backend escuchando en 3000
        changeOrigin: true,
        // secure: false, // innecesario: el target es http
        ws: true // por si usas websockets ahora o en el futuro
      }
    },
    // 🔧 Si el HMR no conecta a través del túnel, descomenta este bloque:
    // hmr: {
    //   protocol: 'wss',
    //   clientPort: 443
    // }
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    }
  }
})
