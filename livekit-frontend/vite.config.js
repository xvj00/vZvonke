import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      // Русифицированный форк ставится как монорепа, без exports для @livekit/components-react.
      // Поэтому направляем импорт прямо на исходники пакета react внутри форка.
      '@livekit/components-react': path.resolve(
        __dirname,
        'node_modules/@livekit/components-react/packages/react/src/index.ts',
      ),
      '@livekit/components-core': path.resolve(
        __dirname,
        'node_modules/@livekit/components-react/packages/core/src/index.ts',
      ),
    },
  },
});