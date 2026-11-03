import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { createApp } from './server/app';

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'flipping-search-api-middleware',
      configureServer(server) {
        const apiApp = createApp({ enableDiskPersistence: true });
        server.middlewares.use(apiApp);
      },
      configurePreviewServer(server) {
        const apiApp = createApp({ enableDiskPersistence: true });
        server.middlewares.use(apiApp);
      },
    },
  ],
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
});
