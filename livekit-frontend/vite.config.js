import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      // Принудительно направляем Vite в папку с твоим русским билдом
      '@livekit/components-react': path.resolve(__dirname, 'node_modules/@livekit/components-react/packages/react')
    }
  },
  build: {
    // Помогает Vite не спотыкаться на путях внутри OneDrive
    commonjsOptions: {
      include: [/@livekit\/components-react/, /node_modules/]
    }
  }
});