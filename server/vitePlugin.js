import { handleApiRequest } from './api.js';
import { DB_PATH } from './db.js';

export function archiveBackendPlugin() {
  return {
    name: 'archive-sqlite-backend',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.url && req.url.startsWith('/api')) {
          handleApiRequest(req, res, next);
        } else {
          next();
        }
      });
      console.log(`\n⚡ [Archive Engine] SQLite WAL backend mounted at /api`);
      console.log(`📦 [Archive Database] File: ${DB_PATH}\n`);
    }
  };
}
