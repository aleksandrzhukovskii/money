import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import path from 'path'

// GitHub Pages can't set response headers, so the CSP ships as a meta tag.
// `frame-ancestors` is unavailable that way (browsers ignore it in meta).
// Injected on build only — the dev server needs inline scripts and a websocket.
const CSP = [
  "default-src 'self'",
  // wasm-unsafe-eval: sql.js compiles sql-wasm.wasm
  "script-src 'self' 'wasm-unsafe-eval'",
  // unsafe-inline: Radix (react-remove-scroll) injects <style> elements at runtime
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "connect-src 'self' https://api.github.com https://cdn.jsdelivr.net https://*.currency-api.pages.dev",
  "worker-src 'self'",
  "manifest-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'none'",
].join('; ')

function cspMeta(): Plugin {
  return {
    name: 'csp-meta',
    apply: 'build',
    transformIndexHtml() {
      return [
        {
          tag: 'meta',
          attrs: { 'http-equiv': 'Content-Security-Policy', content: CSP },
          injectTo: 'head-prepend',
        },
      ]
    },
  }
}

export default defineConfig({
  base: '/money/',
  plugins: [
    cspMeta(),
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.png', 'apple-touch-icon.png', 'sql-wasm.wasm'],
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,wasm}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/cdn\.jsdelivr\.net\/npm\/@fawazahmed0\/currency-api.*/i,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'exchange-rates',
              expiration: { maxEntries: 100, maxAgeSeconds: 86400 },
            },
          },
          {
            urlPattern: /^https:\/\/.*\.currency-api\.pages\.dev\/.*/i,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'exchange-rates-fallback',
              expiration: { maxEntries: 100, maxAgeSeconds: 86400 },
            },
          },
        ],
      },
      manifest: {
        name: 'Money Tracker',
        short_name: 'Money',
        description: 'Personal finance tracker with offline support',
        theme_color: '#10b981',
        background_color: '#ffffff',
        display: 'standalone',
        scope: '/money/',
        start_url: '/money/',
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  optimizeDeps: {
    include: ['sql.js'],
  },
})
