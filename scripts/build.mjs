import { mkdir, writeFile, copyFile, access, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { projects, modeLabel, dayLabel } from '../src/projects.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const output = path.join(root, 'public');
const assets = {};
for (const file of ['styles.css', 'app.js', 'showcase.css', 'showcase.js']) {
  const hash = createHash('sha256').update(await readFile(path.join(root, 'src', file))).digest('hex').slice(0, 10);
  assets[file] = `/${file}?v=${hash}`;
}
const esc = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const icons = {
  arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  external: '<path d="M14 4h6v6M20 4l-9 9"/><path d="M10 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4"/>',
  plane: '<path d="m22 2-7 20-4-9-9-4 20-7ZM22 2 11 13"/>',
  bird: '<path d="M3 7c5 0 7 3 9 7 2-4 4-7 9-7M5 17c3-2 5-2 7 0 2-2 4-2 7 0M12 14v5"/>',
  search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 4 4"/>',
  camera: '<rect x="3" y="6" width="13" height="12" rx="3"/><path d="m16 10 5-3v10l-5-3"/>',
  keyboard: '<rect x="2" y="5" width="20" height="14" rx="3"/><path d="M6 9h.01M10 9h.01M14 9h.01M18 9h.01M6 12h.01M10 12h.01M14 12h.01M18 12h.01M7 16h10"/>',
  back: '<path d="M19 12H5m6-6-6 6 6 6"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c5 5 5 13 0 18-5-5-5-13 0-18Z"/>'
};
const icon = (name, cls = '') => `<svg class="icon ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name]}</svg>`;
const brand = '<span class="brand-mark" aria-hidden="true"><svg viewBox="0 0 32 32" fill="none"><path d="m5 11 7 13 4-8 4 8 7-13M12 8l4 8 4-8" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg></span><span>WINGLAB<span class="brand-divider">/</span><span class="brand-sub">Projeler</span></span>';
const hasTeamName = p => p.team && p.team !== 'WINGLAB';
const projectName = p => hasTeamName(p) ? `${p.team} · ${p.title}` : p.title;
const orbitCaption = p => `${hasTeamName(p) ? `<span class="orbit-team">${esc(p.team)}</span>` : ''}<span>${esc(p.vehicle)}</span>`;
const tags = p => `<span class="tag mode-tag">${icon(p.mode === 'eagle' ? 'bird' : 'plane')}${modeLabel(p.mode)}</span><span class="tag">${esc(p.genre)}</span>`;
const card = (p, index, filter = false) => `<a class="project-card" href="/projeler/${p.slug}/" ${filter ? `data-project data-mode="${p.mode}" data-day="${p.date}" data-search="${esc([p.title, p.team, p.summary, p.vehicle, p.setting, p.genre, modeLabel(p.mode)].join(' '))}"` : ''} style="--project-accent:${p.accent}">
  <div class="card-visual"><img src="/gorseller/${p.image}" alt="${esc(projectName(p))} oyunundan bir görünüm" width="1280" height="800" loading="lazy" decoding="async"><span class="card-number">${String(index + 1).padStart(2, '0')}</span><span class="card-open">${icon('arrow')}</span></div>
  <div class="card-body"><div class="card-meta"><span>${esc(p.team)}</span><span>${p.date === '2026-10-31' ? '31 Ekim' : '1 Kasım'}</span></div><h3>${esc(projectName(p))}</h3><p>${esc(p.summary)}</p><div class="card-tags">${tags(p)}</div></div>
</a>`;

const orbitCard = (p, index) => {
  const offset = index > projects.length / 2 ? index - projects.length : index;
  const distance = Math.abs(offset);
  const slot = Math.min(distance, 3);
  const direction = Math.sign(offset);
  const visible = distance <= 2;
  const image = p.slug === 'bermuda-f35' ? 'bermuda-flight.png' : p.image;
  return `<a class="orbit-card${index === 0 ? ' is-selected' : ''}" href="/projeler/${p.slug}/" data-orbit-card data-title="${esc(projectName(p))}" data-summary="${esc(p.summary)}" data-team="${esc(p.team)}" data-mode-label="${modeLabel(p.mode)}" data-game-url="/oyunlar/${p.slug}/" data-visible="${visible}" ${index === 0 ? 'aria-current="true"' : ''} ${visible ? '' : 'aria-hidden="true" tabindex="-1"'} aria-label="${esc(projectName(p))} ${index === 0 ? 'detaylarını incele' : 'projesini ortaya getir'}" style="--x:${[0, 250, 450, 637.5][slot] * direction}px;--y:${[0, 55, 142, 240][slot]}px;--turn:${direction * Math.min(distance * 14, 36)}deg;--scale:${[1, .82, .67, .5][slot]};--depth:${100 - distance};--opacity:${visible ? 1 : 0}"><span class="orbit-picture"><img src="/gorseller/${image}" alt="${esc(projectName(p))} oyunundan bir görünüm" width="1280" height="800" loading="${visible ? 'eager' : 'lazy'}" decoding="async" draggable="false"><span class="orbit-card-number">${String(index + 1).padStart(2, '0')}</span></span><span class="orbit-card-caption"><span>${orbitCaption(p)}</span>${icon(p.mode === 'eagle' ? 'bird' : 'plane')}</span></a>`;
};

function shell({ title, description, body, page = 'home', image }) {
  return `<!doctype html>
<html lang="tr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="theme-color" content="#f8f9fb"><title>${esc(title)}</title><meta name="description" content="${esc(description)}"><meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(description)}"><meta property="og:type" content="website">${image ? `<meta property="og:image" content="/gorseller/${image}">` : ''}<link rel="icon" href="/favicon.svg" type="image/svg+xml"><link rel="stylesheet" href="${assets['styles.css']}">${page === 'home' ? `<link rel="stylesheet" href="${assets['showcase.css']}"><script src="${assets['showcase.js']}" defer></script>` : ''}<script src="${assets['app.js']}" defer></script></head>
<body data-page="${page}"><a class="skip-link" href="#icerik">İçeriğe geç</a>
${body}
<footer class="site-footer"><div class="container footer-inner"><a class="brand footer-brand" href="/">${brand}</a><p>Öğrencilerin hayal gücü. Hareketle hayat bulan dünyalar.</p><span>2026 · Uçmaya devam.</span></div></footer></body></html>`;
}

const featured = projects.find(p => p.slug === 'bermuda-f35');
const firstProject = projects[0];
const home = shell({
  title: 'WINGLAB — Öğrenci Projeleri',
  description: 'Öğrencilerin tasarladığı 14 uçuş oyununu keşfet. Bir dünya seç, kontrolü öğren ve vücudunla uçuşa geç.',
  image: featured.image,
  body: `<main id="icerik"><section class="showcase-shell" aria-label="Uçuş dünyalarını keşfet"><div class="showcase-stage" data-showcase><div class="showcase-topline"><span class="showcase-edition">${icon('plane')} HAYALDEN UÇUŞA</span><span class="showcase-invitation">Bir dünya seç. Kollarını aç.</span><a href="#projeler" class="showcase-all">14 PROJE ${icon('arrow')}</a></div>
  <div class="orbit-window" role="region" aria-roledescription="dönen proje galerisi" aria-label="Projeler arasında gezinmek için sağ ve sol ok tuşlarını kullan" tabindex="0" data-orbit-window>${projects.map(orbitCard).join('\n')}</div>
  <div class="showcase-selection"><p class="selected-meta" id="selected-project-meta">${esc(firstProject.team)} <span>·</span> ${modeLabel(firstProject.mode)}</p><h1 id="selected-project-title">${esc(projectName(firstProject))}</h1><p class="selected-summary" id="selected-project-summary">${esc(firstProject.summary)}</p><div class="selected-actions"><a class="showcase-launch" id="showcase-launch" href="/oyunlar/${firstProject.slug}/" target="_blank" rel="noopener noreferrer">Projeye git ${icon('external')}<span class="sr-only"> — yeni sekmede açılır</span></a><a class="showcase-detail" id="showcase-detail" href="/projeler/${firstProject.slug}/">Detayları incele ${icon('arrow')}</a></div></div>
  <div class="showcase-bottom"><p class="orbit-hint"><span>↔</span> Kartları sürükle veya birini seç.</p><div class="orbit-controls"><button type="button" class="orbit-arrow" id="orbit-previous" aria-label="Önceki proje">${icon('back')}</button><span class="orbit-counter"><strong id="orbit-current">01</strong><span>/</span>14</span><button type="button" class="orbit-arrow" id="orbit-next" aria-label="Sonraki proje">${icon('arrow')}</button></div><button type="button" class="orbit-pause" id="orbit-pause" aria-label="Otomatik dönüşü duraklat" aria-pressed="false"><span data-pause-icon aria-hidden="true">Ⅱ</span><span data-pause-label>Duraklat</span></button></div><p id="orbit-announcement" class="sr-only" role="status" aria-live="polite"></p></div></section>
  <section class="catalog-section" id="projeler"><div class="container"><div class="section-intro"><div><div class="eyebrow">PROJE KOLEKSİYONU</div><h2>Bir sonraki uçuşunu seç.</h2></div><p>31 Ekim — 1 Kasım 2026<br>İki günde, birbirinden farklı 14 hikâye.</p></div>
  <form class="catalog-toolbar" role="search" onsubmit="return false"><div class="filter-tabs" role="group" aria-label="Uçuş mekaniğine göre filtrele"><button type="button" data-filter="all" aria-pressed="true">Tümü <span>14</span></button><button type="button" data-filter="airplane" aria-pressed="false">${icon('plane')} Uçak <span>10</span></button><button type="button" data-filter="eagle" aria-pressed="false">${icon('bird')} Kuş <span>4</span></button></div><div class="search-controls"><label class="search-field">${icon('search')}<input id="project-search" type="search" placeholder="Proje veya takım ara" aria-label="Proje veya takım ara" autocomplete="off"></label><label class="day-select"><span class="sr-only">Üretim gününe göre filtrele</span><select id="day-filter"><option value="all">Her iki gün</option><option value="2026-10-31">31 Ekim · Cumartesi</option><option value="2026-11-01">1 Kasım · Pazar</option></select></label></div></form>
  <div class="results-line"><p id="result-count" role="status" aria-live="polite">14 proje seni bekliyor</p><span>Hayal et · Tasarla · Uç</span></div><div class="project-grid" id="project-grid">${projects.map((p, i) => card(p, i, true)).join('\n')}</div><div class="empty-state" id="empty-state" hidden>${icon('search')}<h3>Bu aramada henüz bir uçuş yok.</h3><p>Başka bir kelime dene veya filtreleri temizle.</p><button type="button" class="button button-outline" id="reset-filters">Filtreleri temizle ${icon('arrow')}</button></div>
  </div></section>
  <section class="how-section container" id="nasil-oynanir"><div class="how-heading"><div class="eyebrow">BAŞLAMAK İÇİN</div><h2>Uçuşa üç adım.</h2><p>İstersen bedeninle, istersen klavyenle.</p></div><div class="how-steps"><article><span class="step-number">01</span><h3>Dünyanı seç.</h3><p>Projeleri keşfet; detay sayfasında görevini ve kontrollerini öğren.</p></article><article><span class="step-number">02</span><h3>Kontrolü eline al.</h3><p>“Projeye git” ile oyunu yeni sekmede aç. Kamera veya klavye modunu seç.</p></article><article><span class="step-number">03</span><h3>Kollarını aç, uç.</h3><p>Uçakta öne eğilerek gaz ver. Kuşta kanat çırp. Geriye biraz hayal gücü kalıyor.</p></article></div><div class="camera-note">${icon('camera')}<p>Kamera görüntün yalnızca kendi cihazında işlenir. Kamerasız denemek için klavye modunu seçebilirsin.</p></div></section></main>`
});

await mkdir(output, { recursive: true });
await writeFile(path.join(output, 'index.html'), home);
for (const p of projects) {
  const related = projects.filter(other => other.slug !== p.slug && other.mode === p.mode).slice(0, 3);
  const content = `<main id="icerik" class="detail-page container" style="--project-accent:${p.accent}"><nav class="breadcrumbs" aria-label="Sayfa yolu"><a href="/">${icon('back')} Tüm projeler</a><span>/</span><span>${esc(projectName(p))}</span></nav>
  <div class="detail-layout"><article class="detail-story"><div class="detail-heading"><div class="detail-tags">${tags(p)}</div><h1>${esc(projectName(p))}</h1><p class="detail-summary">${esc(p.summary)}</p><div class="detail-byline"><span class="team-avatar">${esc(p.team === 'WINGLAB' ? 'W' : p.team.slice(0, 1))}</span><span>${esc(p.team)}</span><i></i><span>${dayLabel(p.date)}</span></div></div>
  <figure class="detail-cover"><img src="/gorseller/${p.image}" alt="${esc(projectName(p))} oyun ekranı" width="1280" height="800" fetchpriority="high"><figcaption>${icon('globe')} Oyun içinden bir görünüm</figcaption></figure>
  <section class="detail-copy"><div class="eyebrow">HİKÂYENİN İÇİNE GİR</div><h2>Uçuş görevin.</h2><p>${esc(p.description)}</p><div class="objective"><span>${icon('check')}</span><div><strong>Hedefin</strong><p>${esc(p.objective)}</p></div></div><h2>Bu dünyada neler var?</h2><ul class="feature-list">${p.features.map(f => `<li>${icon('check')}<span>${esc(f)}</span></li>`).join('')}</ul><h2>Bedeninle nasıl oynarsın?</h2><p>${esc(p.gesture)}</p><p class="body-hint">Kamera modunda omuzların, dirseklerin ve kalçan kadrajda olsun. Başlangıçta kısa süre dik durarak konumunu ayarla.</p></section></article>
  <aside class="launch-panel" aria-label="Oyunu başlat ve kontroller"><div class="launch-top"><span class="eyebrow">SIRA SENDE</span><h2>Uçuşa hazır mısın?</h2><p>Bu dünyanın bir sonraki pilotu ol.</p><a class="button button-dark launch-button" href="/oyunlar/${p.slug}/" target="_blank" rel="noopener noreferrer">Projeye git ${icon('external')}<span class="sr-only"> — yeni sekmede açılır</span></a><span class="new-tab-note">Yeni sekmede açılır. İyi uçuşlar.</span></div><dl class="project-facts"><div><dt>Uçuş aracı</dt><dd>${esc(p.vehicle)}</dd></div><div><dt>Dünya</dt><dd>${esc(p.setting)}</dd></div><div><dt>Kontrol</dt><dd>${modeLabel(p.mode)}</dd></div><div><dt>Takım</dt><dd>${esc(p.team)}</dd></div></dl><div class="keyboard-guide"><h3>${icon('keyboard')} Klavyeyle dene</h3><dl>${p.keys.map(([key, action]) => `<div><dt><kbd>${esc(key)}</kbd></dt><dd>${esc(action)}</dd></div>`).join('')}</dl></div><div class="panel-note">${icon('camera')}<p>Kamera isteğe bağlı.<br>Görüntün kendi cihazında kalır.</p></div></aside></div>
  <section class="related-section"><div class="section-intro"><div><div class="eyebrow">KEŞFETMEYE DEVAM</div><h2>Başka dünyalar da var.</h2></div><a class="text-link" href="/#projeler">Tüm projeler ${icon('arrow')}</a></div><div class="project-grid related-grid">${related.map(other => card(other, projects.indexOf(other))).join('')}</div></section></main>`;
  const directory = path.join(output, 'projeler', p.slug);
  await mkdir(directory, { recursive: true });
  await writeFile(path.join(directory, 'index.html'), shell({ title: `${projectName(p)} — WINGLAB`, description: p.summary, body: content, page: 'detail', image: p.image }));
}
await writeFile(path.join(output, '404.html'), shell({ title: 'Sayfa bulunamadı — WINGLAB', description: 'WINGLAB proje galerisine dön.', page: '404', body: `<main id="icerik" class="not-found container"><span class="eyebrow">404 · ROTADAN ÇIKTIK</span><h1>Bu koordinatlarda<br>bir dünya yok.</h1><p>Yeni bir uçuş seçmek için proje galerisine dön.</p><a class="button button-dark" href="/">Projelere dön ${icon('arrow')}</a></main>` }));
await writeFile(path.join(output, 'favicon.svg'), '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"><rect width="40" height="40" rx="11" fill="#192630"/><path d="m7 13 8 15 5-9 5 9 8-15M15 10l5 9 5-9" fill="none" stroke="#fff" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"/></svg>');
for (const file of ['styles.css', 'app.js', 'showcase.css', 'showcase.js']) await copyFile(path.join(root, 'src', file), path.join(output, file));
await writeFile(path.join(output, 'projects.json'), JSON.stringify(projects, null, 2) + '\n');
for (const p of projects) {
  await access(path.join(output, 'gorseller', p.image));
  await access(path.join(output, 'oyunlar', p.slug, 'index.html'));
}
console.log('Galeri, 14 detay sayfası ve 14 oyun bağlantısı hazır.');
