import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { archiveBackendPlugin } from './server/vitePlugin.js';

export default defineConfig({
  plugins: [react(), archiveBackendPlugin()],
  server: {
    port: Number(process.env.PORT) || 6080,
    open: false,
  }
});


