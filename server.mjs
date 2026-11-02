import http from 'node:http';
import { createReadStream, readFileSync } from 'node:fs';
import { stat, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const defaultRoot = fileURLToPath(new URL('./public/', import.meta.url));
const types = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp',
  '.ico': 'image/x-icon', '.wasm': 'application/wasm', '.task': 'application/octet-stream',
  '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.ogg': 'audio/ogg',
  '.woff2': 'font/woff2', '.txt': 'text/plain; charset=utf-8'
};

export function createServer({ root = defaultRoot } = {}) {
  const base = path.resolve(root);
  const catalog = JSON.parse(readFileSync(path.join(base, 'projects.json'), 'utf8'));
  const entries = new Map(catalog.filter(p => p.entry).map(p => [`/oyunlar/${p.slug}/`, p.entry]));
  return http.createServer(async (req, res) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'camera=(self), microphone=()');
    if (!['GET', 'HEAD'].includes(req.method)) {
      res.writeHead(405, { Allow: 'GET, HEAD' }); res.end('Method not allowed'); return;
    }
    let pathname;
    try { pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname); }
    catch { res.writeHead(400); res.end('Bad request'); return; }
    if (pathname === '/api/health') {
      res.writeHead(200, { 'Content-Type': types['.json'], 'Cache-Control': 'no-store' });
      res.end(req.method === 'HEAD' ? undefined : JSON.stringify({ status: 'ok', projects: 14 })); return;
    }
    if (pathname.includes('\0') || pathname.includes('\\') || pathname.split('/').includes('..')) {
      res.writeHead(403); res.end('Forbidden'); return;
    }
    let filename = path.resolve(base, '.' + pathname);
    if (filename !== base && !filename.startsWith(base + path.sep)) {
      res.writeHead(403); res.end('Forbidden'); return;
    }
    try {
      if (entries.has(pathname)) filename = path.join(filename, entries.get(pathname));
      let info = await stat(filename);
      if (info.isDirectory()) {
        if (!pathname.endsWith('/')) {
          const search = new URL(req.url, 'http://localhost').search;
          res.writeHead(308, { Location: encodeURI(pathname) + '/' + search }); res.end(); return;
        }
        filename = path.join(filename, 'index.html'); info = await stat(filename);
      }
      if (!info.isFile()) throw new Error('Not a file');
      const mime = types[path.extname(filename).toLowerCase()] || 'application/octet-stream';
      const etag = `W/"${info.size}-${Math.floor(info.mtimeMs)}"`;
      res.setHeader('Content-Type', mime);
      res.setHeader('Cache-Control', filename.endsWith('.html') ? 'no-cache' : 'public, max-age=3600');
      res.setHeader('ETag', etag);
      res.setHeader('Accept-Ranges', 'bytes');
      if (req.headers['if-none-match'] === etag && !req.headers.range) { res.writeHead(304); res.end(); return; }
      let start = 0, end = info.size - 1, status = 200;
      if (req.headers.range) {
        const match = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range);
        let invalid = !match || (!match[1] && !match[2]);
        if (!invalid) {
          if (!match[1]) { const suffix = Number(match[2]); start = Math.max(0, info.size - suffix); invalid = suffix === 0; }
          else { start = Number(match[1]); end = match[2] ? Math.min(Number(match[2]), end) : end; }
          invalid ||= !Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start > end || start >= info.size;
        }
        if (invalid) { res.writeHead(416, { 'Content-Range': `bytes */${info.size}` }); res.end(); return; }
        status = 206; res.setHeader('Content-Range', `bytes ${start}-${end}/${info.size}`);
      }
      res.writeHead(status, { 'Content-Length': info.size === 0 ? 0 : end - start + 1 });
      if (req.method === 'HEAD' || info.size === 0) { res.end(); return; }
      const stream = createReadStream(filename, { start, end });
      stream.on('error', () => res.destroy());
      res.on('close', () => stream.destroy());
      stream.pipe(res);
    } catch {
      res.writeHead(404, { 'Content-Type': types['.html'], 'Cache-Control': 'no-store' });
      if (req.method === 'HEAD') { res.end(); return; }
      try { res.end(await readFile(path.join(base, '404.html'))); }
      catch { res.end('<h1>Sayfa bulunamadı</h1><a href="/">Projelere dön</a>'); }
    }
  });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT || 8080);
  const host = process.env.HOST || '127.0.0.1';
  const server = createServer();
  server.listen(port, host, () => console.log(`WINGLAB hazır: http://localhost:${server.address().port}/`));
  for (const signal of ['SIGTERM', 'SIGINT']) process.on(signal, () => server.close(() => process.exit(0)));
}
