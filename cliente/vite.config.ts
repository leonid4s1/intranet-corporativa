// cliente/vite.config.ts
import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueJsx from '@vitejs/plugin-vue-jsx'
import vueDevTools from 'vite-plugin-vue-devtools'

export default defineConfig(({ mode }) => {
  const isDev = mode === 'development'

  return {
    plugins: [
      vue(),
      vueJsx(),
      ...(isDev ? [vueDevTools()] : []), // solo en dev
    ],
    server: {
      host: '0.0.0.0',
      port: 5173,
      strictPort: true,
      // el túnel de Cloudflare cambia; permite cualquier host en dev
      allowedHosts: true,
      proxy: {
        '/api': {
          target: 'http://localhost:3000', // tu backend
          changeOrigin: true,
          ws: true,
        }
      },
      // Si el HMR no conecta por el túnel, descomenta:
      // hmr: { protocol: 'wss', clientPort: 443 }
    },
    resolve: {
      alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) }
    }
  }
})
