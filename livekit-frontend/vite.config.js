import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    allowedHosts: ['vzvonke.ru'],
    hmr: {
      protocol: 'wss',
      host: 'vzvonke.ru',
      clientPort: 8443,
    },
  },
  resolve: {
    dedupe: ['react', 'react-dom'],
  },
});