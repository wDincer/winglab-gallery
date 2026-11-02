import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { createServer } from '../server.mjs';
import { projects } from '../src/projects.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
let server, origin;
before(async () => {
  server = createServer();
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  origin = `http://127.0.0.1:${server.address().port}`;
});
after(() => new Promise(resolve => server.close(resolve)));

test('collection includes exactly the fourteen games from the two requested days', () => {
  assert.equal(projects.length, 14);
  assert.equal(new Set(projects.map(p => p.slug)).size, 14);
  assert.equal(projects.filter(p => p.date === '2026-10-31').length, 7);
  assert.equal(projects.filter(p => p.date === '2026-11-01').length, 7);
  assert.equal(projects.filter(p => p.mode === 'airplane').length, 10);
  assert.equal(projects.filter(p => p.mode === 'eagle').length, 4);
  assert.ok(!projects.some(p => /nitrojen|hidrojen/.test(p.slug + p.team)));
});

test('catalog, detail pages and game launches work from a single server', async () => {
  const homepage = await fetch(origin);
  assert.equal(homepage.status, 200);
  const html = await homepage.text();
  assert.equal((html.match(/data-project data-mode=/g) || []).length, 14);
  assert.ok(html.includes('lang="tr"'));
  for (const p of projects) {
    const detail = await fetch(`${origin}/projeler/${p.slug}/`);
    assert.equal(detail.status, 200, p.slug);
    const body = await detail.text();
    assert.ok(body.includes(`href="/oyunlar/${p.slug}/" target="_blank" rel="noopener noreferrer"`), p.slug);
    assert.ok(body.includes(p.title));
    const game = await fetch(`${origin}/oyunlar/${p.slug}/`);
    assert.equal(game.status, 200, p.slug);
    assert.match(game.headers.get('content-type'), /text\/html/);
    const gameBody = await game.text();
    const entryBody = await readFile(path.join(root, 'public/oyunlar', p.slug, p.entry || 'index.html'), 'utf8');
    assert.equal(gameBody, entryBody, p.slug + ' must serve its actual mission entrypoint');
    const cover = await fetch(`${origin}/gorseller/${p.image}`, { method: 'HEAD' });
    assert.equal(cover.status, 200, p.image);
    assert.match(cover.headers.get('content-type'), /^image\//);
  }
});

test('all bundled game files match the collected originals, including models, audio and licenses', async () => {
  const manifest = JSON.parse(await readFile(path.join(root, 'data/game-manifest.json'), 'utf8'));
  assert.equal(manifest.length, 14);
  for (const game of manifest) {
    assert.ok(game.files.some(f => f.path.endsWith('.task')), game.slug + ' pose model');
    assert.ok(game.files.some(f => f.path.endsWith('.wasm')), game.slug + ' WASM runtime');
    assert.ok(game.files.some(f => /NOTICE|LICENSE/i.test(f.path)), game.slug + ' license');
    for (const file of game.files) {
      const bytes = await readFile(path.join(root, 'public/oyunlar', game.slug, file.path));
      assert.equal(bytes.length, file.size, game.slug + '/' + file.path);
      assert.equal(createHash('sha256').update(bytes).digest('hex'), file.sha256, game.slug + '/' + file.path);
    }
  }
});

test('every game resource is reachable under its own URL with proper MIME types', async () => {
  const manifest = JSON.parse(await readFile(path.join(root, 'data/game-manifest.json'), 'utf8'));
  for (const game of manifest) {
    const results = await Promise.all(game.files.map(async file => {
      const response = await fetch(`${origin}/oyunlar/${game.slug}/${file.path}`, { method: 'HEAD' });
      assert.equal(response.status, 200, game.slug + '/' + file.path);
      assert.equal(Number(response.headers.get('content-length')), file.size);
      if (file.path.endsWith('.wasm')) assert.equal(response.headers.get('content-type'), 'application/wasm');
      if (file.path.endsWith('.js')) assert.match(response.headers.get('content-type'), /javascript/);
      return response;
    }));
    assert.equal(results.length, game.files.length);
  }
});

test('browser module imports and HTML assets resolve correctly inside nested game paths', async () => {
  const manifest = JSON.parse(await readFile(path.join(root, 'data/game-manifest.json'), 'utf8'));
  for (const game of manifest) {
    for (const file of game.files.filter(f => /\.(html|js|css)$/.test(f.path) && !f.path.startsWith('vendor/'))) {
      const source = await readFile(path.join(root, 'public/oyunlar', game.slug, file.path), 'utf8');
      const references = [];
      if (file.path.endsWith('.html')) references.push(...[...source.matchAll(/(?:src|href)=["']([^"']+)["']/g)].map(m => m[1]));
      if (file.path.endsWith('.js')) references.push(...[...source.matchAll(/(?:from\s*|import\s*\(|new URL\s*\()\s*["'](\.\.?\/[^"']+)["']/g)].map(m => m[1]));
      if (file.path.endsWith('.css')) references.push(...[...source.matchAll(/url\(\s*(?:"([^"]*)"|'([^']*)'|([^\s)]+))\s*\)/g)].map(m => m[1] ?? m[2] ?? m[3]));
      for (const reference of references) {
        if (/^(?:data:|https?:|#|javascript:)/.test(reference) || !reference || reference.includes('${')) continue;
        const url = new URL(reference, `${origin}/oyunlar/${game.slug}/${file.path}`);
        assert.ok(url.pathname.startsWith(`/oyunlar/${game.slug}/`), `${game.slug}: resource escaped its game: ${reference}`);
        // MediaPipe receives a directory URL and appends its own WASM filename.
        const local = path.join(root, 'public', decodeURIComponent(url.pathname));
        const info = await stat(local);
        if (info.isDirectory() && !file.path.endsWith('.html')) continue;
        const response = await fetch(url, { method: 'HEAD' });
        assert.equal(response.status, 200, `${game.slug}/${file.path} -> ${reference}`);
      }
    }
  }
});

test('static server supports redirects, media seeking, caching and unknown routes', async () => {
  const redirect = await fetch(`${origin}/oyunlar/duckrooms?mode=keyboard`, { redirect: 'manual' });
  assert.equal(redirect.status, 308);
  assert.equal(redirect.headers.get('location'), '/oyunlar/duckrooms/?mode=keyboard');
  const head = await fetch(`${origin}/oyunlar/duckrooms/pose.js`, { method: 'HEAD' });
  const partial = await fetch(`${origin}/oyunlar/duckrooms/pose.js`, { headers: { Range: 'bytes=0-31' } });
  assert.equal(partial.status, 206);
  assert.equal((await partial.arrayBuffer()).byteLength, 32);
  assert.match(partial.headers.get('content-range'), /^bytes 0-31\//);
  const cached = await fetch(`${origin}/oyunlar/duckrooms/pose.js`, { headers: { 'If-None-Match': head.headers.get('etag') } });
  assert.equal(cached.status, 304);
  const invalid = await fetch(`${origin}/oyunlar/duckrooms/pose.js`, { headers: { Range: 'bytes=99999999999-' } });
  assert.equal(invalid.status, 416);
  const badPath = await fetch(`${origin}/%2e%2e%5cpackage.json`);
  assert.equal(badPath.status, 403);
  const missing = await fetch(`${origin}/projeler/olmayan-proje/`);
  assert.equal(missing.status, 404);
  assert.match(await missing.text(), /Bu koordinatlarda/);
  const health = await fetch(`${origin}/api/health`);
  assert.deepEqual(await health.json(), { status: 'ok', projects: 14 });
  const post = await fetch(origin, { method: 'POST' });
  assert.equal(post.status, 405);
});
