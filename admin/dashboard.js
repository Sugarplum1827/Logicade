(() => {
  const status = document.getElementById('status');
  const weekFilter = document.getElementById('week-filter');
  const metrics = document.getElementById('metrics');
  const weeklyChart = document.getElementById('weekly-chart');
  const activityChart = document.getElementById('activity-chart');
  const mechanicsTable = document.getElementById('mechanics-table');
  let analytics = null;
  let refreshTimer = null;

  const number = (value, digits = 0) => {
    const n = Number(value || 0);
    return new Intl.NumberFormat(undefined, { maximumFractionDigits: digits }).format(n);
  };
  const percent = (a, b) => b ? `${number(100 * a / b, 1)}%` : '0%';
  const element = (tag, text, className) => {
    const node = document.createElement(tag);
    if (text !== undefined) node.textContent = text;
    if (className) node.className = className;
    return node;
  };

  async function getKey() {
    let key = sessionStorage.getItem('logicade_admin_key');
    while (!key) {
      key = window.prompt('Enter LOGICADE_ADMIN_KEY from the project .env file to open private analytics:');
      if (key === null) return null;
      key = key.trim();
    }
    sessionStorage.setItem('logicade_admin_key', key);
    return key;
  }

  async function load() {
    const key = await getKey();
    if (!key) {
      status.textContent = 'Analytics access cancelled.';
      return;
    }
    status.textContent = 'Refreshing player activity…';
    try {
      const response = await fetch('/api/admin/analytics', {
        headers: { 'X-Admin-Key': key, 'Accept': 'application/json' },
        cache: 'no-store',
      });
      if (response.status === 401) {
        sessionStorage.removeItem('logicade_admin_key');
        throw new Error('Admin key was rejected. Refresh and enter the configured key.');
      }
      if (!response.ok) throw new Error((await response.json()).detail || `Request failed (${response.status})`);
      analytics = await response.json();
      render();
      status.style.color = '#a7b7ab';
      status.textContent = `Live analytics · updated ${new Date().toLocaleTimeString()}`;
    } catch (error) {
      status.textContent = error.message;
      status.style.color = '#ff9b8f';
    }
  }

  function render() {
    const overview = analytics?.overview?.[0] || {};
    const cards = [
      ['Players', number(overview.total_students)],
      ['Levels started', number(overview.levels_started)],
      ['Attempts', number(overview.total_attempts)],
      ['Completion rate', percent(overview.completed_attempts, overview.total_attempts)],
      ['Mean score', number(overview.mean_score, 2)],
      ['Errors / hints', `${number(overview.total_errors)} / ${number(overview.total_hints)}`],
      ['Play time', `${number(Number(overview.total_play_time_sec || 0) / 3600, 1)} h`],
      ['Game events', number(overview.total_events)],
    ];
    metrics.replaceChildren(...cards.map(([label, value]) => {
      const card = element('div', undefined, 'card');
      card.append(element('span', label), element('strong', value));
      return card;
    }));

    const weeks = [...(analytics.weekly || [])].sort((a, b) => a.week - b.week);
    const selectedWeek = weekFilter.value;
    const options = ['<option value="all">All weeks</option>', ...weeks.map((row) =>
      `<option value="${Number(row.week)}">Week ${Number(row.week)}</option>`)];
    if (weekFilter.options.length !== options.length) weekFilter.innerHTML = options.join('');
    const shownWeeks = selectedWeek === 'all' ? weeks : weeks.filter((row) => String(row.week) === selectedWeek);
    const maxLevels = Math.max(1, ...shownWeeks.map((row) => Number(row.levels_played || 0)));
    weeklyChart.replaceChildren(...shownWeeks.map((row) => {
      const line = element('div', undefined, 'bar-row');
      line.append(element('span', `Week ${row.week}`));
      const track = element('div', undefined, 'track');
      const fill = element('div', undefined, 'fill');
      fill.style.width = `${100 * Number(row.levels_played || 0) / maxLevels}%`;
      track.append(fill);
      line.append(track, element('span', number(row.levels_played)));
      return line;
    }));

    const activities = [...(analytics.activity || [])].sort((a, b) => b.event_count - a.event_count).slice(0, 8);
    const maxEvents = Math.max(1, ...activities.map((row) => Number(row.event_count || 0)));
    activityChart.replaceChildren(...activities.map((row) => {
      const line = element('div', undefined, 'bar-row');
      line.append(element('span', row.event_type));
      const track = element('div', undefined, 'track');
      const fill = element('div', undefined, 'fill');
      fill.style.width = `${100 * Number(row.event_count || 0) / maxEvents}%`;
      track.append(fill);
      line.append(track, element('span', number(row.event_count)));
      return line;
    }));
    if (!activities.length) activityChart.append(element('p', 'No game events have synced yet.', 'empty'));

    const mechanics = [...(analytics.mechanics || [])]
      .filter((row) => selectedWeek === 'all' || row.week === Number(selectedWeek))
      .sort((a, b) => b.total_attempts - a.total_attempts)
      .slice(0, 100);
    mechanicsTable.replaceChildren(...mechanics.map((row) => {
      const tr = document.createElement('tr');
      for (const value of [row.mechanic, row.learning_topic || '—', number(row.active_students), number(row.levels_played), number(row.total_attempts), number(row.mean_first_score, 2), number(row.total_errors), number(row.total_hints)]) {
        tr.append(element('td', value));
      }
      return tr;
    }));
    if (!mechanics.length) {
      const tr = document.createElement('tr');
      tr.append(element('td', 'No player activity has synced yet.', undefined));
      mechanicsTable.append(tr);
    }
  }

  document.getElementById('refresh').addEventListener('click', load);
  weekFilter.addEventListener('change', () => analytics && render());
  load().then(() => { refreshTimer = window.setInterval(load, 20_000); });
  window.addEventListener('beforeunload', () => window.clearInterval(refreshTimer));
})();
