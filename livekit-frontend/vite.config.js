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
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (!id.includes('node_modules')) return undefined;
            if (id.includes('emoji-picker-react')) return 'emoji-picker';
            if (id.includes('qrcode.react')) return 'qr';
            if (id.includes('mediasoup-client') || id.includes('socket.io-client')) return 'realtime';
            if (id.includes('react') || id.includes('scheduler')) return 'react-vendor';
            return 'vendor';
          },
        },
      },
    },
  };
});
