import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { createApi } from './server/storageApi.js';
import { createAuth } from './server/auth.js';

export default defineConfig(({ mode }) => {
  // '' prefix loads non-VITE_ vars too. PASS_TOKEN stays on the server: only
  // VITE_-prefixed variables are ever exposed to browser code.
  const env = loadEnv(mode, process.cwd(), '');
  const api = createApi(createAuth(env.PASS_TOKEN));

  // Serves /api/auth and /api/storage (backed by ./storage.json) in dev and preview.
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
