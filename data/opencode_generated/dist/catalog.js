// Root catalog interactions: search, track and classic-mode filters, URL sync,
// and a random variation from the current result set. No network calls and no
// dependencies.
(() => {
  const search = document.getElementById('catalog-search');
  const cards = [...document.querySelectorAll('.concept-card')];
  const trackFilters = [...document.querySelectorAll('.filter[data-track]')];
  const modeFilters = [...document.querySelectorAll('.filter[data-mode]')];
  const trackSections = [...document.querySelectorAll('.track-section')];
  const resultLine = document.getElementById('result-line');
  const emptyState = document.getElementById('empty-state');
  const resetButton = document.getElementById('reset-filters');
  const randomButton = document.getElementById('random-variation');

  if (!search || !cards.length) return;

  const normalize = (value) =>
    String(value)
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '');

  const formatCount = (value) => Number(value).toLocaleString('en-US');

  const totalVariations = cards.reduce(
    (total, card) => total + (Number(card.dataset.variations) || 0),
    0,
  );

  let track = 'all';
  let mode = 'all';
  let query = '';

  const updateControlState = () => {
    const cp1Active = track === 'cp1';
    for (const filter of trackFilters) {
      const active = filter.dataset.track === track;
      filter.classList.toggle('is-active', active);
      filter.setAttribute('aria-pressed', String(active));
    }
    for (const filter of modeFilters) {
      const active = !cp1Active && filter.dataset.mode === mode;
      filter.classList.toggle('is-active', active);
      filter.classList.toggle('is-muted', cp1Active);
      filter.setAttribute('aria-pressed', String(active));
      filter.disabled = cp1Active;
    }
  };

  const syncUrl = () => {
    const url = new URL(window.location.href);
    if (query.trim()) url.searchParams.set('q', query.trim());
    else url.searchParams.delete('q');
    if (track !== 'all') url.searchParams.set('track', track);
    else url.searchParams.delete('track');
    if (mode !== 'all') url.searchParams.set('mode', mode);
    else url.searchParams.delete('mode');
    window.history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`);
  };

  const apply = () => {
    const needle = normalize(query.trim());
    let visibleConcepts = 0;
    let visibleVariations = 0;
    const visibleSections = new Map(trackSections.map((section) => [section, false]));

    for (const card of cards) {
      const trackMatches = track === 'all' || card.dataset.track === track;
      const modeMatches =
        mode === 'all' || (card.dataset.track === 'classic' && card.dataset.mode === mode);
      const conceptMatches = !needle || normalize(card.dataset.search || '').includes(needle);
      const show = trackMatches && modeMatches && conceptMatches;
      card.hidden = !show;

      for (const chip of card.querySelectorAll('.variation-chip')) {
        const titleMatches =
          Boolean(needle) && normalize(chip.dataset.title || '').includes(needle);
        chip.classList.toggle('is-match', titleMatches);
      }

      if (show) {
        visibleConcepts += 1;
        visibleVariations += Number(card.dataset.variations) || 0;
        const section = card.closest('.track-section');
        if (section && visibleSections.has(section)) visibleSections.set(section, true);
      }
    }

    for (const [section, visible] of visibleSections) {
      section.hidden = !visible;
    }

    if (resultLine) {
      resultLine.textContent = `Showing ${formatCount(visibleConcepts)} of ${formatCount(cards.length)} concepts · ${formatCount(visibleVariations)} of ${formatCount(totalVariations)} variations`;
    }
    if (emptyState) emptyState.hidden = visibleConcepts !== 0;
    syncUrl();
  };

  const setTrack = (nextTrack) => {
    track = nextTrack;
    if (track !== 'classic') mode = 'all';
    updateControlState();
    apply();
  };

  const setMode = (nextMode) => {
    if (nextMode !== 'all' && track !== 'classic') track = 'classic';
    mode = nextMode;
    updateControlState();
    apply();
  };

  const reset = () => {
    query = '';
    search.value = '';
    track = 'all';
    mode = 'all';
    updateControlState();
    apply();
    search.focus();
  };

  const randomVisible = () => {
    const chips = [...document.querySelectorAll('.concept-card:not([hidden]) .variation-chip')];
    if (!chips.length) return;
    const pick = chips[Math.floor(Math.random() * chips.length)];
    window.location.href = pick.getAttribute('href');
  };

  search.addEventListener('input', () => {
    query = search.value;
    apply();
  });

  search.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      reset();
    }
  });

  for (const filter of trackFilters) {
    filter.addEventListener('click', () => {
      setTrack(filter.dataset.track || 'all');
    });
  }

  for (const filter of modeFilters) {
    filter.addEventListener('click', () => {
      setMode(filter.dataset.mode || 'all');
    });
  }

  resetButton?.addEventListener('click', reset);
  randomButton?.addEventListener('click', randomVisible);

  window.addEventListener('keydown', (event) => {
    const target = event.target;
    const typing =
      target instanceof HTMLElement &&
      (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable);

    if (event.key === '/' && !typing) {
      event.preventDefault();
      search.focus();
      search.select();
    }
    if (event.key === 'Escape' && !typing && (query || track !== 'all' || mode !== 'all')) {
      reset();
    }
  });

  const loadFromUrl = () => {
    const params = new URLSearchParams(window.location.search);
    query = params.get('q') || '';
    search.value = query;

    const requestedTrack = params.get('track') || 'all';
    track = trackFilters.some((filter) => filter.dataset.track === requestedTrack)
      ? requestedTrack
      : 'all';

    const requestedMode = params.get('mode') || 'all';
    mode = modeFilters.some((filter) => filter.dataset.mode === requestedMode)
      ? requestedMode
      : 'all';

    if (mode !== 'all') track = 'classic';
    if (track === 'cp1') mode = 'all';

    updateControlState();
    apply();
  };

  window.addEventListener('popstate', loadFromUrl);
  loadFromUrl();
})();
