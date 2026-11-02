(() => {
  const cards = [...document.querySelectorAll('[data-project]')];
  if (!cards.length) return;
  const search = document.querySelector('#project-search');
  const day = document.querySelector('#day-filter');
  const tabs = [...document.querySelectorAll('[data-filter]')];
  const count = document.querySelector('#result-count');
  const empty = document.querySelector('#empty-state');
  const reset = document.querySelector('#reset-filters');
  let mode = 'all';
  const normalize = value => value.toLocaleLowerCase('tr-TR').replaceAll('ı', 'i').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  function update({ persist = true } = {}) {
    const terms = normalize(search.value.trim()).split(/\s+/).filter(Boolean);
    let visible = 0;
    for (const card of cards) {
      const matches = (mode === 'all' || card.dataset.mode === mode)
        && (day.value === 'all' || card.dataset.day === day.value)
        && terms.every(term => normalize(card.dataset.search).includes(term));
      card.hidden = !matches;
      if (matches) visible++;
    }
    for (const tab of tabs) tab.setAttribute('aria-pressed', String(tab.dataset.filter === mode));
    count.textContent = visible === cards.length ? '14 proje seni bekliyor' : `${visible} proje gösteriliyor`;
    empty.hidden = visible !== 0;
    if (persist) {
      const url = new URL(location.href);
      for (const [key, value] of [['tur', mode], ['gun', day.value], ['ara', search.value.trim()]]) {
        if (value && value !== 'all') url.searchParams.set(key, value); else url.searchParams.delete(key);
      }
      history.replaceState(null, '', url);
    }
  }
  const params = new URLSearchParams(location.search);
  if (tabs.some(tab => tab.dataset.filter === params.get('tur'))) mode = params.get('tur');
  if ([...day.options].some(option => option.value === params.get('gun'))) day.value = params.get('gun');
  search.value = params.get('ara') || '';
  for (const tab of tabs) tab.addEventListener('click', () => { mode = tab.dataset.filter; update(); });
  search.addEventListener('input', () => update());
  day.addEventListener('change', () => update());
  reset.addEventListener('click', () => { mode = 'all'; day.value = 'all'; search.value = ''; update(); search.focus(); });
  update({ persist: false });
})();
