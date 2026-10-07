import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'favicon3.png', 'masked-icon.svg'], // Updated here
      manifest: {
        name: "Rory's World",
        short_name: 'RorysWorld',
        description: 'Your personal sanctuary for focused study and intellectual growth.',
        theme_color: '#132A44',
        background_color: '#F3EAD8',
        display: 'standalone',
        scope: '/',
        start_url: '/',
        icons: [
          {
            src: '/favicon1.png', // Updated to your name
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: '/favicon2.png', // Updated to your name
            sizes: '512x512',
            type: 'image/png'
          },
          {
            src: '/favicon2.png', // Updated to your name (used for maskable)
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ]
      }
    })
  ]
})