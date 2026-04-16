import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

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
    alias: {
      // Как в старой рабочей версии: используем готовый dist внутри форка,
      // чтобы избежать подтягивания dev-зависимостей из исходников монорепы.
      '@livekit/components-react': path.resolve(
        __dirname,
        'node_modules/@livekit/components-react/packages/react/dist',
      ),
    },
  },
});