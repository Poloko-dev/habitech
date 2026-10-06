import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { createLocalApi } from './server/backend.js';

export default defineConfig(({ mode }) => {
  // '' prefix loads non-VITE_ vars too. PASS_TOKEN stays on the server: only
  // VITE_-prefixed variables are ever exposed to browser code.
  const env = loadEnv(mode, process.cwd(), '');
  const { api } = createLocalApi(env);

  // Serves /api/auth and /api/storage in dev and preview (storage.json, or MongoDB if MONGODB_URI is set).
  const storageApi = () => ({
    name: 'habitech-storage-api',
    configureServer(server) {
      server.middlewares.use(api);
    },
    configurePreviewServer(server) {
      server.middlewares.use(api);
    },
  });

  return {
    plugins: [react(), storageApi()],
    server: {
      // Saving storage.json must not trigger a page reload.
      watch: { ignored: ['**/storage.json', '**/storage.json.tmp'] },
    },
  };
});
