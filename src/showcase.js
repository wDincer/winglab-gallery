(() => {
  const stage = document.querySelector('[data-showcase]');
  if (!stage) return;
  const window = stage.querySelector('[data-orbit-window]');
  const cards = [...stage.querySelectorAll('[data-orbit-card]')];
  const title = document.querySelector('#selected-project-title');
  const summary = document.querySelector('#selected-project-summary');
  const meta = document.querySelector('#selected-project-meta');
  const launch = document.querySelector('#showcase-launch');
  const detail = document.querySelector('#showcase-detail');
  const current = document.querySelector('#orbit-current');
  const previous = document.querySelector('#orbit-previous');
  const next = document.querySelector('#orbit-next');
  const pause = document.querySelector('#orbit-pause');
  const announcement = document.querySelector('#orbit-announcement');
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  let index = 0;
  let paused = motion.matches;
  let keyboardFocus = false;
  let timer;
  let pointer = null;
  let suppressClickUntil = 0;
  const duration = 4200;
  const wrap = value => ((value % cards.length) + cards.length) % cards.length;

  function schedule() {
    clearTimeout(timer);
    if (paused || keyboardFocus || document.hidden) return;
    timer = setTimeout(() => select(index + 1), duration);
  }

  function layout() {
    const width = window.clientWidth;
    const compact = width < 600;
    const step = Math.max(compact ? 147 : 205, Math.min(270, width * (compact ? .42 : .225)));
    cards.forEach((card, cardIndex) => {
      let offset = wrap(cardIndex - index);
      if (offset > cards.length / 2) offset -= cards.length;
      const distance = Math.abs(offset);
      const direction = Math.sign(offset);
      const slot = Math.min(distance, 3);
      const x = [0, step, step * 1.8, step * 2.55][slot] * direction;
      const y = (compact ? [0, 42, 112, 195] : [0, 55, 142, 240])[slot];
      const scale = [1, .82, .67, .5][slot];
      const visible = distance <= 2;
      card.style.setProperty('--x', `${x}px`);
      card.style.setProperty('--y', `${y}px`);
      card.style.setProperty('--turn', `${direction * Math.min(distance * 14, 36)}deg`);
      card.style.setProperty('--scale', scale);
      card.style.setProperty('--depth', 100 - distance);
      card.style.setProperty('--opacity', visible ? 1 : 0);
      card.dataset.visible = String(visible);
      card.classList.toggle('is-selected', distance === 0);
      card.setAttribute('aria-hidden', String(!visible));
      card.tabIndex = visible ? 0 : -1;
      card.setAttribute('aria-label', `${card.dataset.title}${distance === 0 ? ' detaylarını incele' : ' projesini ortaya getir'}`);
      if (distance === 0) card.setAttribute('aria-current', 'true');
      else card.removeAttribute('aria-current');
      if (visible) card.querySelector('img').loading = 'eager';
    });
  }

  function select(value, manual = false) {
    index = wrap(value);
    const card = cards[index];
    title.textContent = card.dataset.title;
    title.classList.toggle('is-long', card.dataset.title.length > 23);
    summary.textContent = card.dataset.summary;
    meta.textContent = `${card.dataset.team} · ${card.dataset.modeLabel}`;
    launch.href = card.dataset.gameUrl;
    detail.href = card.getAttribute('href');
    current.textContent = String(index + 1).padStart(2, '0');
    stage.dataset.selected = card.dataset.title;
    if (manual) announcement.textContent = `${index + 1} / ${cards.length}: ${card.dataset.title}`;
    layout();
    schedule();
  }

  function updatePause() {
    pause.setAttribute('aria-pressed', String(paused));
    pause.setAttribute('aria-label', paused ? 'Otomatik dönüşü başlat' : 'Otomatik dönüşü duraklat');
    pause.querySelector('[data-pause-icon]').textContent = paused ? '▷' : 'Ⅱ';
    pause.querySelector('[data-pause-label]').textContent = paused ? 'Döndür' : 'Duraklat';
    schedule();
  }

  cards.forEach((card, cardIndex) => card.addEventListener('click', event => {
    if (Date.now() < suppressClickUntil) { event.preventDefault(); return; }
    if (cardIndex !== index) { event.preventDefault(); select(cardIndex, true); }
  }));
  previous.addEventListener('click', () => select(index - 1, true));
  next.addEventListener('click', () => select(index + 1, true));
  pause.addEventListener('click', () => {
    paused = !paused;
    if (!paused) keyboardFocus = false;
    updatePause();
  });
  stage.addEventListener('keydown', event => {
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault();
      select(index + (event.key === 'ArrowLeft' ? -1 : 1), true);
    }
  });
  stage.addEventListener('focusin', event => {
    keyboardFocus = event.target.matches(':focus-visible');
    schedule();
  });
  stage.addEventListener('focusout', event => {
    if (!stage.contains(event.relatedTarget)) { keyboardFocus = false; schedule(); }
  });

  window.addEventListener('pointerdown', event => {
    if (event.button !== 0 && event.pointerType === 'mouse') return;
    pointer = { id: event.pointerId, x: event.clientX, y: event.clientY, dragging: false };
    clearTimeout(timer);
  });
  window.addEventListener('pointermove', event => {
    if (!pointer || pointer.id !== event.pointerId) return;
    const dx = event.clientX - pointer.x, dy = event.clientY - pointer.y;
    if (!pointer.dragging && Math.abs(dx) > 14 && Math.abs(dx) > Math.abs(dy) * 1.25) {
      pointer.dragging = true;
      window.classList.add('is-dragging');
      window.setPointerCapture(event.pointerId);
    }
  });
  window.addEventListener('pointerup', event => {
    if (!pointer || pointer.id !== event.pointerId) return;
    const dx = event.clientX - pointer.x;
    const wasDragging = pointer.dragging;
    pointer = null;
    window.classList.remove('is-dragging');
    if (wasDragging) {
      suppressClickUntil = Date.now() + 400;
      if (Math.abs(dx) > 40) select(index + (dx < 0 ? 1 : -1), true);
      else schedule();
    } else schedule();
  });
  window.addEventListener('pointercancel', () => {
    pointer = null;
    window.classList.remove('is-dragging');
    schedule();
  });
  document.addEventListener('visibilitychange', schedule);
  motion.addEventListener('change', () => { paused = motion.matches; updatePause(); });
  new ResizeObserver(layout).observe(window);
  select(0);
  updatePause();
})();
