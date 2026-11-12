/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt',
      injectRegister: false,
      includeAssets: ['apple-touch-icon.png', 'favicon.svg'],
      manifest: {
        name: 'Becoming',
        short_name: 'Becoming',
        description: 'Four daily disciplines. One future self.',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        scope: '/',
        theme_color: '#FFFFFF',
        background_color: '#FFFFFF',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'icon-maskable-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
          { src: 'icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
        shortcuts: [
          { name: 'Log meal', short_name: 'Meal', url: '/?log=food', icons: [{ src: 'icon-192.png', sizes: '192x192' }] },
          { name: 'Log workout', short_name: 'Workout', url: '/?log=workout', icons: [{ src: 'icon-192.png', sizes: '192x192' }] },
          { name: 'Log learning', short_name: 'Learning', url: '/?log=learning', icons: [{ src: 'icon-192.png', sizes: '192x192' }] },
          { name: 'Log expense', short_name: 'Expense', url: '/?log=finance', icons: [{ src: 'icon-192.png', sizes: '192x192' }] },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2,ico}'],
        navigateFallback: '/index.html',
      },
    }),
  ],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          react: ['react', 'react-dom', 'react-router-dom'],
          motion: ['framer-motion'],
          data: ['dexie', 'dexie-react-hooks', 'zustand'],
        },
      },
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    coverage: { provider: 'v8', include: ['src/domain/**'], reporter: ['text-summary', 'text'] },
  },
});
