(() => {
  const $ = (id) => document.getElementById(id);
  if (window.location.protocol === 'file:') {
    document.body.innerHTML = '<main style="max-width:720px;margin:12vh auto;padding:28px;font:16px system-ui;color:#edf5ef;background:#14221a;border:1px solid #294333;border-radius:14px"><h1>Open the admin panel through LogiCade</h1><p>This page needs the LogiCade server to load its data. Do not open <code>admin/index.html</code> directly from File Explorer.</p><p>Start the server, then open <a style="color:#b8f2c8" href="http://127.0.0.1:8000/admin/">http://127.0.0.1:8000/admin/</a>.</p></main>';
    return;
  }
  const status = $('status');
  let key = sessionStorage.getItem('logicade_admin_session') || '';
  let loginPromise = null;
  let loggedOut = !key;
  let analytics = null;
  let researchSummary = null;
  let studyMetrics = null;
  const pageState = { participants: 0, content: 0, events: 0, pageSize: 50 };
  const pageNames = { overview: 'Overview', participants: 'Participants', content: 'Content library', ai: 'AI generator & verifier', learning: 'Learning analytics', gameplay: 'Gameplay & sync', reports: 'Reports', audit: 'Activity records', settings: 'Settings' };
  const fmt = (v, digits = 0) => v == null || v === '' || !Number.isFinite(Number(v)) ? '—' : new Intl.NumberFormat(undefined, { maximumFractionDigits: digits }).format(Number(v));
  const pct = (a, b) => b ? `${fmt(Number(a || 0) * 100 / Number(b), 1)}%` : '—';
  const node = (tag, text, cls) => { const n = document.createElement(tag); if (text !== undefined && text !== null) n.textContent = String(text); if (cls) n.className = cls; return n; };
  const clear = (el, message = 'No records available.') => { el.replaceChildren(); const tr = document.createElement('tr'); const td = node('td', message); td.colSpan = 12; tr.append(td); el.append(tr); };
  const safeDate = (v) => v ? new Date(v).toLocaleString() : '—';

  async function getKey() {
    if (key) return key;
    throw new Error('Sign in to access administrator data.');
  }
  function showLogin(message = '') {
    $('admin-shell').hidden = true; $('admin-login').hidden = false;
    $('login-error').textContent = message;
    $('admin-password').value = '';
    loggedOut = true;
  }
  function showAdmin() { $('admin-login').hidden = true; $('admin-shell').hidden = false; loggedOut = false; }
  async function api(path, options = {}) {
    const adminKey = await getKey();
    const response = await fetch(path, { ...options, headers: { ...(options.headers || {}), 'X-Admin-Key': `Bearer ${adminKey}`, Accept: 'application/json' }, cache: 'no-store' });
    if (response.status === 401) { key = ''; loggedOut = true; sessionStorage.removeItem('logicade_admin_session'); showLogin('Your session expired. Please sign in again.'); throw new Error('Admin session expired.'); }
    if (!response.ok) {
      let detail = `Request failed (${response.status})`;
      try { detail = (await response.json()).detail || detail; } catch (_) { /* keep status */ }
      throw new Error(detail);
    }
    return response;
  }
  async function json(path) { return (await api(path)).json(); }
  function setStatus(text, isError = false) { status.textContent = text; status.className = isError ? 'error' : ''; }
  function card(label, value) { const c = node('div', undefined, 'card'); c.append(node('span', label), node('strong', value)); const route = /participant|enrolled|completed/i.test(label) ? 'participants' : /level|attempt|error|hint|event|activity/i.test(label) ? 'gameplay' : /score|gain|assessment/i.test(label) ? 'learning' : null; if (route) { c.tabIndex = 0; c.setAttribute('role','link'); c.setAttribute('aria-label', `${label}: open ${pageNames[route]}`); c.addEventListener('click', () => document.querySelector(`[data-page="${route}"]`).click()); c.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); c.click(); } }); } return c; }
  function tableRows(tbody, rows, cells, empty = 'No records available.') {
    tbody.replaceChildren();
    if (!rows?.length) return clear(tbody, empty);
    for (const row of rows) { const tr = document.createElement('tr'); for (const get of cells) tr.append(node('td', get(row))); tbody.append(tr); }
  }
  function bars(el, rows, labelFn, valueFn) {
    el.replaceChildren();
    if (!rows?.length) { el.append(node('p', 'No synchronized activity has been recorded yet.', 'empty')); return; }
    const max = Math.max(1, ...rows.map(valueFn));
    for (const row of rows) {
      const line = node('div', undefined, 'bar-row'); line.append(node('span', labelFn(row)));
      const track = node('div', undefined, 'track'), fill = node('div', undefined, 'fill');
      fill.style.width = `${Math.max(0, Math.min(100, 100 * valueFn(row) / max))}%`; track.append(fill);
      line.append(track, node('span', fmt(valueFn(row)))); el.append(line);
    }
  }
  function fillWeekSelect(select, rows, allText = 'All weeks') {
    const previous = select.value; const weeks = [...new Set((rows || []).map((r) => Number(r.week)).filter(Number.isFinite))].sort((a, b) => a - b);
    select.replaceChildren(new Option(allText, ''));
    for (const week of weeks) select.add(new Option(`Week ${week}`, String(week)));
    if ([...select.options].some((o) => o.value === previous)) select.value = previous;
  }
  function renderOverview() {
    const o = analytics?.overview?.[0] || {};
    const summaryCards = researchSummary ? [
      card('Registered participants', fmt(researchSummary.registered_participants)),
      card('Enrolled', fmt(researchSummary.enrolled_participants)),
      card('Study completed', fmt(researchSummary.study_completed_participants)),
      card('Pre / post complete', `${fmt(researchSummary.pretest_completed)} / ${fmt(researchSummary.posttest_completed)}`),
    ] : [];
    $('overview-cards').replaceChildren(
      card('Participants', fmt(o.total_students)), card('Levels started', fmt(o.levels_started)),
      card('Attempts', fmt(o.total_attempts)), card('Completion rate', pct(o.completed_attempts, o.total_attempts)),
      card('Mean game score', fmt(o.mean_score, 2)), card('Errors / hints', `${fmt(o.total_errors)} / ${fmt(o.total_hints)}`),
      card('Play time', `${fmt(Number(o.total_play_time_sec || 0) / 3600, 1)} h`), card('Game events', fmt(o.total_events)),
      ...(studyMetrics ? [card('Active participants (30 days)', studyMetrics.active_participants_30d), card('Attempts completed / started', `${fmt(studyMetrics.attempts_completed)} / ${fmt(studyMetrics.attempts_started)}`), card('Failed / incomplete attempts', `${fmt(studyMetrics.failed_attempts)} / ${fmt(studyMetrics.incomplete_attempts)}`), card('Recorded coins earned / spent', `${fmt(studyMetrics.coins_earned)} / ${fmt(studyMetrics.coins_spent)}`), card('Recorded coin balance', studyMetrics.recorded_coin_balance), card('Question retries / level restarts', `${fmt(studyMetrics.recorded_question_retries)} / ${fmt(studyMetrics.recorded_level_restarts)}`), card('Full-level replays', studyMetrics.recorded_full_level_replays)] : []),
      ...summaryCards,
    );
    $('overview-note').textContent = `Overview uses synchronized database records only; local outbox values are not included. Active = at least one attempt in the last 30 days. Coin figures are ledger totals, not authoritative wallet balances. ${studyMetrics ? '' : 'Complete metric view unavailable; apply migration 009.'} Formal assessment and gameplay scores are separate.`;
    const weeks = [...(analytics?.weekly || [])].sort((a, b) => Number(a.week) - Number(b.week));
    bars($('weekly-chart'), weeks, (r) => `Week ${r.week}`, (r) => Number(r.levels_played || 0));
    const activity = [...(analytics?.activity || [])].sort((a, b) => Number(b.event_count) - Number(a.event_count)).slice(0, 10);
    bars($('activity-chart'), activity, (r) => r.event_type, (r) => Number(r.event_count || 0));
    const mechanics = [...(analytics?.mechanics || [])].sort((a, b) => Number(b.total_attempts) - Number(a.total_attempts)).slice(0, 100);
    tableRows($('mechanics-table'), mechanics, [(r) => r.mechanic, (r) => r.learning_topic || '—', (r) => fmt(r.active_students), (r) => fmt(r.levels_played), (r) => fmt(r.total_attempts), (r) => fmt(r.mean_first_score, 2), (r) => fmt(r.total_errors), (r) => fmt(r.total_hints)]);
  }
  async function loadAnalytics() {
    analytics = await json('/api/admin/analytics');
    try { researchSummary = (await json('/api/admin/research-summary')).summary || null; }
    catch (e) { researchSummary = null; $('overview-note').textContent = `Research enrollment/assessment summary unavailable: ${e.message}`; }
    try { const metrics = await json('/api/admin/study-metrics'); studyMetrics = metrics.available ? metrics.metrics : null; } catch (_) { studyMetrics = null; }
    renderOverview(); fillWeekSelect($('learning-week'), analytics.weekly, 'All weeks');
  }
  async function loadParticipants() {
    const q = new URLSearchParams(); const search = $('participant-search').value.trim(); const week = $('participant-week').value; const stratum = $('participant-stratum').value;
    if (search) q.set('search', search); if (week) q.set('week', week); if (stratum) q.set('stratum', stratum);
    q.set('offset', String(pageState.participants)); q.set('limit', String(pageState.pageSize));
    const data = await json(`/api/admin/participants?${q}`);
    const body = $('participants-table'); body.replaceChildren();
    if (!data.items?.length) return clear(body, 'No participants found in synchronized database records.');
    for (const r of data.items) {
      const tr = document.createElement('tr'); tr.dataset.id = r.student_id;
      for (const value of [r.student_id, r.enrollment_status || 'unknown', r.stratum || '—', `W${fmt(r.current_week)} · L${fmt(r.current_level_index)}`, fmt(r.total_attempts), fmt(r.total_level_repeats), fmt(r.total_hints), `${fmt(r.recorded_coins_earned)} / ${fmt(r.recorded_coins_spent)}`, safeDate(r.last_activity_at)]) tr.append(node('td', value));
      tr.addEventListener('click', () => loadParticipantDetail(r.student_id)); body.append(tr);
    }
    $('participant-week').replaceChildren(new Option('All weeks', ''));
    for (let w = 1; w <= 9; w++) $('participant-week').add(new Option(`Week ${w}`, String(w)));
    $('participant-week').value = week; $('participant-stratum').value = stratum;
    $('participants-page').textContent = `${pageState.participants + 1}–${Math.min(pageState.participants + data.items.length, data.total)} of ${fmt(data.total)}`;
    $('participants-prev').disabled = pageState.participants <= 0;
    $('participants-next').disabled = pageState.participants + data.items.length >= data.total;
    setStatus(`${fmt(data.total)} participant records · page refreshed ${new Date().toLocaleTimeString()}`);
  }
  async function loadParticipantDetail(id) {
    try {
      const d = await json(`/api/admin/participants/${encodeURIComponent(id)}`); const p = d.participant;
      $('participant-detail').classList.remove('hidden'); $('participant-heading').textContent = `Participant ${p.student_id}`;
      const fields = [['Enrollment', p.enrollment_status], ['Stratum', p.stratum], ['Progress', `Week ${p.current_week}, level ${p.current_level_index}`], ['Levels played', p.levels_played], ['Attempts', d.attempts.length], ['Full-level repeats', p.total_level_repeats], ['Hints', p.total_hints], ['Errors', p.total_errors], ['Recorded coins earned', p.recorded_coins_earned], ['Recorded coins spent', p.recorded_coins_spent], ['Last activity', safeDate(p.last_activity_at)], ['Pretest', p.pretest_score ?? 'Not recorded'], ['Posttest', p.posttest_score ?? 'Not recorded'], ['Learning gain', p.learning_gain ?? 'Not recorded']];
      $('participant-summary').replaceChildren(...fields.map(([k, v]) => { const div = document.createElement('div'); div.append(node('b', k), node('span', v ?? '—')); return div; }));
      const profiles = {
        'Overview': { rows: d.attempts, cols: ['Started','Level','Status','Score','Hints','Replay'], get: r => [safeDate(r.started_at),r.level_id,r.status || (r.completed?'completed':'failed'),pct(r.score,1),fmt(r.hint_count),r.is_replay?'Yes':'No'] },
        'Coins and Rewards': { rows: d.coins, cols: ['Earned','Spent','Balance'], get: r => [r.coins_earned,r.coins_spent,r.coin_balance] },
        'Levels and Progression': { rows: d.levels, cols: ['Week','Stage','Record index','Assigned','Served','Template','Variation','Started / generated'], get: r => [r.week,r.stage_number ?? '—',r.level_index,r.difficulty_assigned,r.difficulty_served,r.template_id || '—',r.variation_id || '—',safeDate(r.generated_at)] },
        'Hints and Attempts': { rows: d.attempts, cols: ['Started','Status','Score','Hints','Activity retries','Restarts'], get: r => [safeDate(r.started_at),r.status, r.score, r.hint_count,r.question_retry_count,r.restart_count] },
        'Difficulty History': { rows: d.decisions, cols: ['Decided','Previous','Selected','Served','Rule','Reason'], get: r => [safeDate(r.decided_at),r.difficulty_before,r.difficulty_selected,r.difficulty_served,r.rule_version,r.reason] },
        'Assessments': { rows: d.assessments, cols: ['Phase','Instrument','Score','Maximum','Completed'], get: r => [r.phase,r.instrument,r.score,r.maximum_score,safeDate(r.completed_at)] },
        'Gameplay Timeline': { rows: d.events, cols: ['Event time','Event','Level','Attempt','Details'], get: r => [safeDate(r.created_at),r.event_type,r.level_id,r.attempt_id,JSON.stringify(r.payload||{})] },
        'Synchronization Status': { rows: [], cols: ['Status'], get: () => ['Not reported by this device'] },
      };
      const tabs = $('profile-tabs'); tabs.replaceChildren(); const renderProfile = (name, button) => { for (const b of tabs.children) { b.setAttribute('aria-selected', String(b===button)); } const view=profiles[name]; $('profile-head').replaceChildren(); const head=document.createElement('tr'); view.cols.forEach(c=>head.append(node('th',c))); $('profile-head').append(head); const body=$('participant-attempts'); body.replaceChildren(); if (!view.rows?.length) return clear(body, name==='Synchronization Status'?'Device outbox status has not been reported.':'No records available for this section.'); view.rows.forEach(r=>{const tr=document.createElement('tr'); view.get(r).forEach(v=>tr.append(node('td',v??'—'))); body.append(tr);}); };
      Object.keys(profiles).forEach((name,i)=>{const b=node('button',name);b.setAttribute('role','tab');b.setAttribute('aria-selected',String(i===0));b.addEventListener('click',()=>renderProfile(name,b));tabs.append(b);if(!i)renderProfile(name,b);});
      $('participant-detail').scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch (e) { setStatus(e.message, true); }
  }
  async function loadContent() {
    const q = new URLSearchParams(); for (const [id, keyName] of [['content-week','week'],['content-level','level'],['content-difficulty','difficulty'],['content-search','search']]) { const v = $(id).value.trim(); if (v) q.set(keyName, v); }
    q.set('offset', String(pageState.content)); q.set('limit', String(pageState.pageSize));
    const data = await json(`/api/admin/content?${q}`); const body = $('content-table'); body.replaceChildren();
    if (!data.items?.length) clear(body, 'No games match these filters.');
    for (const r of data.items || []) {
      const tr = document.createElement('tr'); tr.dataset.gameId = r.id || '';
      for (const value of [`${r.title || 'Untitled'} · ${r.id || ''}`, `W${r.week} / L${r.level}`, r.difficulty, r.mechanic || '—', r.mission_type || '—', r.topic || '—', r.source_path || '—']) tr.append(node('td', value));
      body.append(tr);
    }
    $('content-page').textContent = `${data.total ? pageState.content + 1 : 0}–${Math.min(pageState.content + data.items.length, data.total)} of ${fmt(data.total)}`;
    $('content-prev').disabled = pageState.content <= 0; $('content-next').disabled = pageState.content + data.items.length >= data.total;
    $('content-count').textContent = `${fmt(data.total)} catalogue entries · ${fmt(data.manifest?.missing)} missing · ${fmt(data.manifest?.invalid)} invalid · ${fmt(data.manifest?.dups)} duplicate keys.`;
    fillWeekSelect($('content-week'), data.items); const lvl = $('content-level'), old = lvl.value; lvl.replaceChildren(new Option('All levels', '')); for (let i=1;i<=10;i++) lvl.add(new Option(`Level ${i}`, String(i))); lvl.value=old;
  }
  async function loadOperations() {
    const d = await json('/api/admin/operations');
    $('ai-cards').replaceChildren(card('LLM model', d.llm.model || 'Not configured'), card('Model tag', d.llm.tag || '—'), card('Ollama reachable', d.llm.reachable ? 'Yes' : 'No / unknown'));
    const replacements=d.canvas_replacements || {enabled:false}; const counts=replacements.counts || {};
    $('ai-cards').append(card('Waiting replacements',fmt((counts.queued||0)+(counts.retry||0))),card('Generating / checking',fmt((counts.generating||0)+(counts.verifying||0)+(counts.publishing||0))),card('Retained published jobs',fmt(counts.published||0)));
    $('replacement-note').textContent=`Worker: ${replacements.enabled ? replacements.running ? 'running' : 'not running' : 'disabled'}. Latest 100 retained jobs; published-job counts are retained history, not all-time study totals. Failed generations retry after five minutes.`;
    tableRows($('replacement-table'),replacements.jobs || [],[(r)=>r.file_id,(r)=>`W${r.week} / L${r.level}`,(r)=>r.difficulty,(r)=>r.status,(r)=>fmt(r.attempts),(r)=>r.status==='retry'?safeDate(r.next_retry_at*1000):'—',(r)=>safeDate(r.updated_at*1000),(r)=>r.error || r.verification?.verifier || '—'],'No background replacements recorded.');
    const m = d.catalog || {}; $('catalog-health').replaceChildren(...[['Loaded games', `${fmt(m.total)} / ${fmt(m.attempted)}`], ['Missing', m.missing], ['Invalid', m.invalid], ['Duplicate keys', m.dups], ['Mechanics', m.unique_mechanics]].map(([k,v]) => {const x=document.createElement('div'); x.append(node('b',k),node('span',v ?? '—')); return x;}));
    try {
      const history = await json('/api/admin/generation');
      tableRows($('generation-table'), history.items || [], [(r) => r.outcome, (r) => r.verifier_result, (r) => fmt(r.request_count), (r) => fmt(r.attempts), (r) => `${fmt(r.mean_duration_ms, 1)} ms`, (r) => safeDate(r.latest_at)], 'No generation attempts recorded yet.');
      $('generation-note').textContent = history.note || `${d.generation_logs} ${d.notes.join(' ')}`;
    } catch (e) { $('generation-note').textContent = `Generation history unavailable: ${e.message}`; }
  }
  async function loadLearning() {
    if (!analytics) await loadAnalytics(); const filter = $('learning-week').value;
    if (researchSummary) $('outcome-cards').replaceChildren(
      card('Paired pre/post assessments', fmt(researchSummary.paired_assessments)),
      card('Mean pretest', researchSummary.mean_pretest == null ? '—' : fmt(researchSummary.mean_pretest, 2)),
      card('Mean posttest', researchSummary.mean_posttest == null ? '—' : fmt(researchSummary.mean_posttest, 2)),
      card('Mean learning gain', researchSummary.mean_learning_gain == null ? '—' : fmt(researchSummary.mean_learning_gain, 2)),
      card('Median gain', researchSummary.median_learning_gain == null ? '—' : fmt(researchSummary.median_learning_gain, 2)),
      card('Gain SD', researchSummary.sd_learning_gain == null ? '—' : fmt(researchSummary.sd_learning_gain, 2)),
    );
    const weekly = (analytics.weekly || []).filter((r) => !filter || String(r.week) === filter); bars($('learning-weekly'), weekly, (r) => `Week ${r.week}`, (r) => Number(r.levels_played || 0));
    const mechanics = (analytics.mechanics || []).filter((r) => !filter || String(r.week) === filter);
    tableRows($('learning-mechanics'), mechanics, [(r) => r.mechanic, (r) => r.learning_topic || '—', (r) => r.week, (r) => fmt(r.active_students), (r) => fmt(r.levels_played), (r) => fmt(r.total_attempts), (r) => fmt(r.mean_first_score, 2), (r) => fmt(r.total_errors), (r) => fmt(r.total_hints)]);
    try { const d = await json('/api/admin/difficulty'); bars($('difficulty-chart'), d.items || [], (r) => `Week ${r.week} · ${r.difficulty}`, (r) => Number(r.levels_served || 0)); } catch (e) { $('difficulty-chart').replaceChildren(node('p', `Difficulty analytics unavailable: ${e.message}`, 'empty')); }
  }
  async function loadSync() {
    const d = await json('/api/admin/sync'); const s = d.summary || {};
    $('sync-cards').replaceChildren(card('Devices seen', d.reported ? fmt(s.devices_seen) : 'Not reported'), card('Devices with pending', d.reported ? fmt(s.devices_with_pending) : 'Not reported'), card('Pending records', d.reported ? fmt(s.pending_records) : 'Not reported'), card('Failed records', d.reported ? fmt(s.failed_records) : 'Not reported'));
    $('sync-note').textContent = d.note;
  }
  async function loadEvents(target = 'events-table') {
    const q = new URLSearchParams(); const student = $('event-student').value.trim(), type = $('event-type').value.trim(); if (student) q.set('student_id', student); if (type) q.set('event_type', type);
    q.set('offset', String(pageState.events)); q.set('limit', String(pageState.pageSize));
    const d = await json(`/api/admin/events?${q}`); tableRows($(target), d.items || [], [(r) => safeDate(r.created_at), (r) => r.student_id, (r) => r.event_type, (r) => r.level_id || '—', (r) => r.attempt_id || '—', (r) => JSON.stringify(r.payload || {})]);
    if (target === 'events-table') {
      $('events-page').textContent = `${d.total ? pageState.events + 1 : 0}–${Math.min(pageState.events + d.items.length, d.total)} of ${fmt(d.total)}`;
      $('events-prev').disabled = pageState.events <= 0; $('events-next').disabled = pageState.events + d.items.length >= d.total;
    }
  }
  async function loadPage(page) {
    try {
      setStatus(`Loading ${pageNames[page]}…`);
      if (page === 'overview' || page === 'learning') await loadAnalytics();
      if (page === 'participants') await loadParticipants();
      if (page === 'content') await loadContent();
      if (page === 'ai') {
        try { await loadOperations(); } catch (error) { $('generation-note').textContent = `AI operations unavailable: ${error.message}`; }
      }
      if (page === 'learning') await loadLearning();
      if (page === 'gameplay') { await loadSync(); await loadEvents(); }
      if (page === 'audit') {
        await loadEvents('audit-table');
        const audit = await json('/api/admin/audit');
        tableRows($('admin-audit-table'), audit.items || [], [(r) => safeDate(r.created_at), (r) => r.actor_id, (r) => r.action, (r) => `${r.target_type || '—'} · ${r.target_id || '—'}`, (r) => r.outcome, (r) => JSON.stringify(r.details || {})]);
      }
      if (page === 'settings') {
        const bank=await json('/api/admin/course/midterm-bank'); $('midterm-bank-status').textContent=bank.configured?`${bank.id}, version ${bank.version}: ${bank.approved?'approved and available':'draft'}, ${bank.item_count} items.`:'No private instructor-approved midterm bank configured.';
        const d = await json('/api/admin/operations'); const fields = [['Model', d.llm.model || 'Not configured'], ['Ollama reachable', d.llm.reachable ? 'Yes' : 'No / unknown'], ['Catalogue entries', d.catalog?.total ?? 'Unavailable'], ['Admin identity', 'Shared key'], ['Database', 'Supabase service role (server only)']];
        $('settings-summary').replaceChildren(...fields.map(([k,v]) => {const x=document.createElement('div');x.append(node('b',k),node('span',v));return x;}));
      }
      if (page !== 'participants') setStatus(`${pageNames[page]} · updated ${new Date().toLocaleTimeString()}`);
    } catch (e) { setStatus(e.message, true); }
  }
  document.querySelectorAll('.nav button').forEach((button) => button.addEventListener('click', () => {
    document.querySelectorAll('.nav button').forEach((b) => b.classList.toggle('active', b === button));
    document.querySelectorAll('.page').forEach((p) => p.classList.toggle('active', p.id === `page-${button.dataset.page}`));
    $('page-title').textContent = pageNames[button.dataset.page]; loadPage(button.dataset.page);
  }));
  $('refresh').addEventListener('click', () => loadPage(document.querySelector('.nav button.active').dataset.page));
  $('admin-session').addEventListener('click', async () => {
    if (key) {
      key = ''; loggedOut = true; sessionStorage.removeItem('logicade_admin_session');
      showLogin('You have been signed out.');
      return;
    }
    showLogin();
  });
  $('admin-login-form').addEventListener('submit', async (event) => {
    event.preventDefault(); $('login-submit').disabled = true; $('login-error').textContent = '';
    try {
      const response = await fetch('/api/admin/login', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: $('admin-email').value, password: $('admin-password').value }), cache: 'no-store' });
      const result = await response.json();
      if (!response.ok) throw new Error(result.detail || 'Sign in failed');
      key = result.token; sessionStorage.setItem('logicade_admin_session', key); $('admin-password').value = '';
      showAdmin(); await loadPage(document.querySelector('.nav button.active').dataset.page);
    } catch (error) { showLogin(error.message); }
    finally { $('login-submit').disabled = false; }
  });
  $('participant-search-btn').addEventListener('click', () => { pageState.participants = 0; loadParticipants(); }); $('participant-search').addEventListener('keydown', (e) => { if (e.key === 'Enter') { pageState.participants = 0; loadParticipants(); } }); $('participant-week').addEventListener('change', () => { pageState.participants = 0; loadParticipants(); }); $('participant-stratum').addEventListener('change', () => { pageState.participants = 0; loadParticipants(); });
  $('participants-prev').addEventListener('click', () => { pageState.participants = Math.max(0, pageState.participants - pageState.pageSize); loadParticipants(); }); $('participants-next').addEventListener('click', () => { pageState.participants += pageState.pageSize; loadParticipants(); });
  $('content-load').addEventListener('click', () => { pageState.content = 0; loadContent(); }); $('content-prev').addEventListener('click', () => { pageState.content = Math.max(0, pageState.content - pageState.pageSize); loadContent(); }); $('content-next').addEventListener('click', () => { pageState.content += pageState.pageSize; loadContent(); }); $('learning-load').addEventListener('click', loadLearning); $('learning-week').addEventListener('change', loadLearning);
  $('content-table').addEventListener('click', async (event) => {
    const row = event.target.closest('tr[data-game-id]'); if (!row?.dataset.gameId) return;
    try { const d = await json(`/api/games/${encodeURIComponent(row.dataset.gameId)}`); $('game-preview-title').textContent = `Game specification · ${row.dataset.gameId}`; $('game-preview-json').textContent = JSON.stringify(d.game, null, 2); $('game-preview').showModal(); }
    catch (e) { setStatus(`Could not load game JSON: ${e.message}`, true); }
  });
  $('events-load').addEventListener('click', () => { pageState.events = 0; loadEvents(); }); $('events-prev').addEventListener('click', () => { pageState.events = Math.max(0, pageState.events - pageState.pageSize); loadEvents(); }); $('events-next').addEventListener('click', () => { pageState.events += pageState.pageSize; loadEvents(); }); $('audit-load').addEventListener('click', () => loadEvents('audit-table'));
  $('export-download').addEventListener('click', async () => {
    try { const dataset = $('export-dataset').value, format = $('export-format').value; const params = new URLSearchParams({ dataset, include_incomplete: String($('export-incomplete').checked) }); for (const [id,keyName] of [['export-from','date_from'],['export-to','date_to'],['export-week','week'],['export-difficulty','difficulty'],['export-stratum','stratum']]) { const value = $(id).value; if (value) params.set(keyName,value); } const response = await api(`/api/admin/report.${format}?${params}`); const blob = await response.blob(); const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = `logicade_${dataset}.${format}`; link.click(); setTimeout(() => URL.revokeObjectURL(link.href), 1000); $('export-status').textContent = `${format.toUpperCase()} report downloaded with pseudonymous participant IDs.`; }
    catch (e) { $('export-status').textContent = e.message; }
  });
  $('midterm-bank-save').addEventListener('click', async () => {
    const button=$('midterm-bank-save'), feedback=$('midterm-bank-status');
    try {
      const file=$('midterm-bank-file').files[0];if(!file)throw new Error('Choose a JSON bank first.');
      if(file.size>200000)throw new Error('The question bank is too large.');
      const bank=JSON.parse(await file.text());
      if(bank.approved===true&&!window.confirm(`Activate instructor-approved midterm ${bank.id}, version ${bank.version}?`))return;
      button.disabled=true;
      const response=await api('/api/admin/course/midterm-bank',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(bank)});
      const saved=await response.json();feedback.textContent=`Saved ${saved.id}, version ${saved.version}. ${saved.approved?'Available to signed-in participants.':'Draft; unavailable to participants.'}`;
    } catch(error) { feedback.textContent=error.message; }
    finally {button.disabled=false;}
  });
  $('print-report').addEventListener('click', () => window.print());
  if (key) { showAdmin(); loadPage('overview'); }
  else showLogin();
})();
