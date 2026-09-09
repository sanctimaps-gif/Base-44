import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // GitHub Pages sert le site depuis un sous-chemin (/<depot>/) : les assets
  // doivent etre references relativement a celui-ci.
  base: process.env.BASE_PATH || '/',
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
