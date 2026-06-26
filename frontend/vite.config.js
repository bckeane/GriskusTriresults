import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: process.env.VITE_BASE_PATH ?? '/',
  resolve: {
    dedupe: ['react', 'react-dom'],
  },
  server: {
    port: parseInt(process.env.PORT ?? '0'),
    strictPort: false,
    proxy: {
      '/api': {
        target: `http://localhost:${process.env.BACKEND_PORT ?? '3001'}`,
        changeOrigin: true,
      },
    },
  },
});
