import { defineConfig, type Plugin } from 'vite';
import path from 'path';
import fs from 'fs';

/** Serves /mods/* from the repo mods/ folder in dev and preview. */
function serveMods(): Plugin {
  const modsRoot = path.resolve(__dirname, 'mods');
  const handler = (
    req: { url?: string; headers?: Record<string, string | string[] | undefined> },
    res: {
      statusCode: number;
      setHeader: (k: string, v: string) => void;
      end: (b?: string | Buffer) => void;
    },
    next: () => void,
  ) => {
    const raw = req.url ?? '';
    // Vite JSON/TS module imports use ?import — must NOT short-circuit those
    if (raw.includes('?import') || raw.includes('&import')) return next();

    const url = raw.split('?')[0] ?? '';
    if (!url.startsWith('/mods/')) return next();
    const filePath = path.join(modsRoot, url.slice('/mods/'.length));
    if (
      !filePath.startsWith(modsRoot) ||
      !fs.existsSync(filePath) ||
      fs.statSync(filePath).isDirectory()
    ) {
      res.statusCode = 404;
      res.end('Not found');
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    // Binary/runtime assets only — JSON defs are imported via Vite (?import)
    const types: Record<string, string> = {
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.webp': 'image/webp',
      '.gif': 'image/gif',
      '.mp3': 'audio/mpeg',
      '.wav': 'audio/wav',
      '.ogg': 'audio/ogg',
      '.mp4': 'video/mp4',
      '.glb': 'model/gltf-binary',
      '.gltf': 'model/gltf+json',
    };
    if (!(ext in types)) return next();
    const stat = fs.statSync(filePath);
    const etag = `"${Math.trunc(stat.mtimeMs)}-${stat.size}"`;
    const inm = req.headers?.['if-none-match'];
    const clientEtag = Array.isArray(inm) ? inm[0] : inm;
    res.setHeader('Content-Type', types[ext]);
    res.setHeader('ETag', etag);
    // AssetCache revalidates via ETag; allow browsers to keep a local copy too.
    res.setHeader('Cache-Control', 'public, max-age=0, must-revalidate');
    if (clientEtag === etag) {
      res.statusCode = 304;
      res.end();
      return;
    }
    res.end(fs.readFileSync(filePath));
  };

  return {
    name: 'serve-mods',
    configureServer(server) {
      server.middlewares.use(handler);
    },
    configurePreviewServer(server) {
      server.middlewares.use(handler);
    },
  };
}

export default defineConfig({
  plugins: [serveMods()],
  resolve: {
    alias: {
      '@engine': path.resolve(__dirname, 'src/engine'),
      '@ui': path.resolve(__dirname, 'src/ui'),
      '@mods': path.resolve(__dirname, 'mods'),
    },
  },
  optimizeDeps: {
    include: ['@babylonjs/core', '@babylonjs/loaders', '@babylonjs/gui'],
    holdUntilCrawlEnd: true,
  },
  server: {
    port: 3000,
  },
  build: {
    target: 'ES2022',
  },
});
