import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const devProxyTarget = env.VITE_DEV_PROXY_TARGET || 'http://127.0.0.1:7125'
  const appApiTarget = env.VITE_APP_API_TARGET || 'http://127.0.0.1:8787'
  const devHost = env.VITE_DEV_HOST || '127.0.0.1'

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
          maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
          globIgnores: ['**/plotly-vendor-*.js'],
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
    build: {
      chunkSizeWarningLimit: 5500,
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (!id.includes('node_modules')) return
            if (id.includes('/react/') || id.includes('/react-dom/') || id.includes('/scheduler/')) {
              return 'react-vendor'
            }
            if (id.includes('plotly')) {
              return 'plotly-vendor'
            }
            if (id.includes('recharts')) {
              return 'chart-vendor'
            }
            if (id.includes('react-markdown') || id.includes('remark-gfm')) {
              return 'markdown-vendor'
            }
            if (id.includes('@google/generative-ai')) {
              return 'ai-vendor'
            }
            if (id.includes('lucide-react')) {
              return 'icon-vendor'
            }
            return 'vendor'
          }
        }
      }
    },
    server: {
      proxy: {
        '/lzapi': {
          target: appApiTarget,
          changeOrigin: true
        },
        '/api': {
          target: devProxyTarget,
          changeOrigin: true,
          ws: true,
          rewrite: (path) => path.replace(/^\/api/, '')
        }
      },
      host: devHost
    }
  }
})
