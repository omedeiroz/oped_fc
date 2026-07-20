import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
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
