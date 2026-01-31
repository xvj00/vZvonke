import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@livekit/components-react': path.resolve(__dirname, 
        'node_modules/@livekit/components-react/packages/dist')
    }
  },
});