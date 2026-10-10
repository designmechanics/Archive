import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { archiveBackendPlugin } from './server/vitePlugin.js';

export default defineConfig({
  plugins: [react(), archiveBackendPlugin()],
  server: {
    port: Number(process.env.PORT) || 6080,
    open: false,
    // Test scratch files (browser profiles, builds) are locked by other programs and crash the watcher;
    // so did the viewer test harness, which is copied in and deleted again while the server runs (EBUSY)
    watch: {
      ignored: ['**/scratch/**', '**/backups/**', '**/.thumbnails/**', '**/archive.db*', '**/harness.html', '**/src/harness.tsx']
    }
  }
});


