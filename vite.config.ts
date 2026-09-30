import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { archiveBackendPlugin } from './server/vitePlugin.js';

export default defineConfig({
  plugins: [react(), archiveBackendPlugin()],
  server: {
    port: 3000,
    open: false,
  }
});

