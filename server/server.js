// Self-hosted server: serves the built app from ./dist plus the API.
// (On Vercel the API runs as functions in ./api instead.)
// Run `npm run build` first, then `npm start`.
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { STORAGE_FILE, ROOT } from './storageApi.js';
import { readEnvFile } from './auth.js';
import { createLocalApi } from './backend.js';

// Real environment variables win over .env.
const env = { ...readEnvFile(ROOT), ...process.env };
const { api, backend } = createLocalApi(env);

const DIST = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'dist');
const PORT = Number(process.env.PORT) || 4173;

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.json': 'application/json',
};

async function serveStatic(req, res) {
  const urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
  let file = path.join(DIST, urlPath);
  if (!file.startsWith(DIST)) {
    res.statusCode = 403;
    return res.end('Forbidden');
  }
  try {
    const stat = await fs.stat(file);
    if (stat.isDirectory()) file = path.join(file, 'index.html');
  } catch {
    file = path.join(DIST, 'index.html'); // SPA fallback
  }
  try {
    const content = await fs.readFile(file);
    res.setHeader('Content-Type', TYPES[path.extname(file)] || 'application/octet-stream');
    res.end(content);
  } catch {
    res.statusCode = 404;
    res.end('Not found - did you run `npm run build`?');
  }
}

http
  .createServer((req, res) => api(req, res, () => serveStatic(req, res)))
  .listen(PORT, () => {
    console.log(`Habitech running at http://localhost:${PORT}`);
    console.log(`Data: ${backend === 'storage.json' ? STORAGE_FILE : backend}`);
  });
