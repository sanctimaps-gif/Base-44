import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // L'API est appelee en chemin relatif : le proxy evite toute config CORS.
    proxy: {
      '/api': {
        target: process.env.API_URL || 'http://localhost:844',
        changeOrigin: true,
      },
    },
  },
});
