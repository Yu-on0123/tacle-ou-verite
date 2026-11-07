import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const serverPort = process.env.PORT || '3001';

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist/web',
    emptyOutDir: true,
  },
  server: {
    host: true,
    port: 5173,
    proxy: {
      '/socket.io': {
        target: `http://localhost:${serverPort}`,
        ws: true,
      },
      '/health': `http://localhost:${serverPort}`,
    },
  },
});
