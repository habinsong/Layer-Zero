import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const devProxyTarget = env.VITE_DEV_PROXY_TARGET || 'http://127.0.0.1:7125'

  return {
    plugins: [
      react(),
      VitePWA({
        registerType: 'prompt',
        manifest: {
          name: 'Layer Zero - 3D Printer Control',
          short_name: 'Layer Zero',
          description: 'Klipper 3D Printer Control Dashboard',
          theme_color: '#0f172a',
          background_color: '#0f172a',
          display: 'standalone',
          start_url: '/',
          icons: [
            {
              src: '/pwa-192x192.png',
              sizes: '192x192',
              type: 'image/png',
              purpose: 'any maskable'
            },
            {
              src: '/pwa-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any maskable'
            }
          ]
        },
        workbox: {
          runtimeCaching: [
            {
              urlPattern: /^https:\/\/api\.openweathermap\.org\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'weather-cache',
                expiration: {
                  maxEntries: 10,
                  maxAgeSeconds: 60 * 10 // 10분
                }
              }
            }
          ]
        }
      })
    ],
    server: {
      proxy: {
        '/api': {
          target: devProxyTarget,
          changeOrigin: true,
          ws: true,
          rewrite: (path) => path.replace(/^\/api/, '')
        }
      },
      host: true // 외부 접속 허용 (0.0.0.0)
    }
  }
})
