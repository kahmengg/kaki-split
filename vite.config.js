import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt',
      injectRegister: null,
      includeAssets: ['icons/*.png'],
      manifest: {
        id: '/',
        name: 'Kaki Split',
        short_name: 'Kaki Split',
        description: 'Split expenses with friends and track shared costs.',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        theme_color: '#10b981',
        background_color: '#f9fafb',
        icons: [
          { src: '/icons/pwa-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/icons/pwa-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: '/icons/pwa-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Precache only the app shell; personal data and API responses stay online.
        globPatterns: ['**/*.{js,css,html,png,svg,woff2}'],
        navigateFallbackDenylist: [/^\/api(?:\/|$)/, /^\/auth(?:\/|$)/],
        runtimeCaching: [],
        cleanupOutdatedCaches: true,
        // Take control after activation so the user's Update now click can reload.
        clientsClaim: true,
      },
    }),
  ],
  server: {
    host: true,
    port: 5173
  }
})
