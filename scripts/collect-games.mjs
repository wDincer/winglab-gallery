import { cp, mkdir, copyFile, access, readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { homedir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { projects } from '../src/projects.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const sourceRoot = process.env.WINGLAB_SOURCE_ROOT || path.join(homedir(), 'OneDrive', 'Belgeler', 'ChatGPT');
const docs = path.join(homedir(), 'Documents', 'Codex');
const oct = path.join(docs, '2026-10-31');
const nov = path.join(docs, '2026-11-01');
const sources = {
  'amazon-tukan': [path.join(homedir(), 'OneDrive', 'Masaüstü', 'Amazon-Tukan'), path.join(oct, 'new-chat/outputs/amazon-tukan-onizleme.png')],
  'kaan-durum': [path.join(sourceRoot, 'şampiyonlar/kaan-durum'), 'preview.jpg'],
  'sarma-ucusu': [path.join(sourceRoot, 'yaprak sarma/sarma-ucusu'), 'output/oyun-onizleme.png'],
  'ucan-inek': [path.join(sourceRoot, 'insancıl varlıklar/ucan-inek'), 'onizleme.jpg'],
  'kizilelma-col': [path.join(sourceRoot, 'ekmekspor/kizilelma-col'), 'qa/preview.jpg'],
  'ocean-flight': [path.join(sourceRoot, 'azerem/ocean-flight'), 'qa/flight.jpg'],
  'aurora-operasyonu': [path.join(oct, 'new-chat-3/outputs/winglab-aurora'), path.join(oct, 'new-chat-3/outputs/aurora-preview.jpg')],
  'nebula-wing': [path.join(nov, 'new-chat/outputs/nebula-wing'), path.join(nov, 'new-chat/outputs/nebula-wing-preview.jpg')],
  'nyan-duello': [path.join(sourceRoot, 'miyavlayan keçiler/nyan-duello'), 'onizleme.jpg'],
  'gokbey-teknofest': [path.join(nov, 'new-chat-2/outputs/gokbey-teknofest'), path.join(nov, 'new-chat-2/outputs/gokbey-preview.jpg')],
  'duckrooms': [path.join(sourceRoot, 'youngmaster/duckrooms'), 'duckrooms-infinite-preview.png'],
  'uranus-gorevi': [path.join(sourceRoot, 'tatlipatatesler/uranus-gorevi'), 'preview.jpg'],
  'hurkus-liberty': [path.join(sourceRoot, 'enderuntech/hurkus-liberty'), 'preview.png'],
  'bermuda-f35': [path.join(sourceRoot, 'minyonlar/bermuda-f35'), 'qa/bermuda-preview.jpg']
};

// Check every source before copying anything. This command never writes to the original games.
for (const p of projects) {
  const [source, cover] = sources[p.slug];
  await access(path.join(source, 'dist', 'index.html'));
  await access(path.isAbsolute(cover) ? cover : path.join(source, cover));
}
await mkdir(path.join(root, 'public/gorseller'), { recursive: true });
const manifest = [];
for (const p of projects) {
  const [source, cover] = sources[p.slug];
  const destination = path.join(root, 'public/oyunlar', p.slug);
  await cp(path.join(source, 'dist'), destination, { recursive: true });
  await copyFile(path.isAbsolute(cover) ? cover : path.join(source, cover), path.join(root, 'public/gorseller', p.image));
  const files = [];
  async function walk(directory) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const filename = path.join(directory, entry.name);
      if (entry.isDirectory()) await walk(filename);
      else {
        const bytes = await readFile(filename);
        files.push({ path: path.relative(destination, filename).split(path.sep).join('/'), size: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') });
      }
    }
  }
  await walk(destination);
  manifest.push({ slug: p.slug, files });
  console.log(`Hazır: ${p.title} (${files.length} dosya)`);
}
await mkdir(path.join(root, 'data'), { recursive: true });
await writeFile(path.join(root, 'data/game-manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
console.log('14 oyun, görselleri ve yerel kütüphaneleriyle kopyalandı.');
