import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // Load .env from monorepo root (relative to this file's dir = apps/web)
  envDir: '../../',
  server: {
    port: 5173,
    proxy: {
      // Proxy /api calls to the NestJS server during development
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
});
