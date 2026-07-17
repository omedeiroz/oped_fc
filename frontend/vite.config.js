import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5180,
    strictPort: true,
    proxy: {
      // Encaminha chamadas /api para o backend Node (evita CORS no dev)
      '/api': 'http://localhost:4000',
    },
  },
});
