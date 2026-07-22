import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'favicon-32x32.png', 'favicon-16x16.png', 'apple-touch-icon.png'],
      manifest: {
        name: 'Pelada OPED FC',
        short_name: 'OPED FC',
        description: 'Ranking, times e presença da pelada semanal do OPED FC.',
        lang: 'pt-BR',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        background_color: '#0b1f3a',
        theme_color: '#0b1f3a',
        icons: [
          { src: '/pwa-192x192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/pwa-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: '/maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      // Precacha apenas os assets estáticos do build (JS/CSS/imagens/ícones).
      // Chamadas para /api nunca são cacheadas — o ranking e as peladas sempre
      // vêm direto do backend, mesmo com o app instalado.
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico}'],
      },
      devOptions: {
        enabled: false,
      },
    }),
  ],
  server: {
    host: true, // escuta em 0.0.0.0 (acessível pela rede local, não só localhost)
    port: 5180,
    strictPort: true,
    proxy: {
      // Encaminha chamadas /api para o backend Node (evita CORS no dev)
      '/api': 'http://localhost:4000',
    },
  },
});
