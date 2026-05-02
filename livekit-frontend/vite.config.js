import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const isProduction = mode === 'production';

  return {
    plugins: [react()],
    server: {
      host: true,
      allowedHosts: isProduction ? ['vzvonke.ru'] : ['localhost', '127.0.0.1'],
      ...(isProduction
        ? {
            hmr: {
              protocol: 'wss',
              host: 'vzvonke.ru',
              clientPort: 8443,
            },
          }
        : {}),
    },
    resolve: {
      dedupe: ['react', 'react-dom'],
    },
  };
});