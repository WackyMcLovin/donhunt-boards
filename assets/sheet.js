/* DON HUNT - Google Sheet reader (shared by every page).
   - Finds tabs by exact name (reads the sheet's public tab list).
   - Pulls raw CSV for a tab, so no cell ever gets dropped.
   - Never throws at the page: callers get {ok:false, reason} instead. */
(function () {
  const CFG = window.DONHUNT_CONFIG || {};
  const params = new URLSearchParams(location.search);

  function sheetIdFrom(v) {
    v = String(v || '').trim();
    const m = v.match(/\/d\/([a-zA-Z0-9_-]{20,})/);
    if (m) return m[1];
    return /^[a-zA-Z0-9_-]{20,}$/.test(v) ? v : '';
  }

  const SHEET_ID = sheetIdFrom(params.get('sheet')) || sheetIdFrom(CFG.sheetId);
  const BASE = 'https://docs.google.com/spreadsheets/d/' + SHEET_ID;

  function withTimeout(ms) {
    const c = new AbortController();
    const t = setTimeout(() => c.abort(), ms);
    return { signal: c.signal, done: () => clearTimeout(t) };
  }

  async function getText(url, ms) {
    const t = withTimeout(ms || 12000);
    try {
      const r = await fetch(url, { signal: t.signal, cache: 'no-store', credentials: 'omit' });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return await r.text();
    } finally { t.done(); }
  }

  // ---------- CSV ----------
  function parseCSV(text) {
    const rows = []; let row = []; let cell = ''; let q = false;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (q) {
        if (ch === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; }
        else cell += ch;
      } else if (ch === '"') q = true;
      else if (ch === ',') { row.push(cell); cell = ''; }
      else if (ch === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; }
      else if (ch !== '\r') cell += ch;
    }
    if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
    return rows.map(r => r.map(c => c.trim()));
  }

  // ---------- tab list (name -> gid) ----------
  let tabMap = null, tabMapAt = 0, tabMapPromise = null;
  function unesc(s) {
    return s.replace(/\\x([0-9a-fA-F]{2})/g, (_, h) => String.fromCharCode(parseInt(h, 16)))
            .replace(/\\u([0-9a-fA-F]{4})/g, (_, h) => String.fromCharCode(parseInt(h, 16)))
            .replace(/\\(.)/g, '$1');
  }
  async function loadTabs(force) {
    if (tabMap && !force && Date.now() - tabMapAt < 60000) return tabMap;
    if (tabMapPromise) return tabMapPromise;
    tabMapPromise = (async () => {
      const html = await getText(BASE + '/htmlview?_=' + Date.now(), 15000);
      const map = {};
      const re = /items\.push\(\{name:\s*"((?:[^"\\]|\\.)*)",\s*pageUrl:\s*"(?:[^"\\]|\\.)*",\s*gid:\s*"(\d+)"/g;
      let m, order = [];
      while ((m = re.exec(html))) { const n = unesc(m[1]); map[norm(n)] = { name: n, gid: m[2] }; order.push(n); }
      if (!order.length) throw new Error('private');
      map.__order = order;
      tabMap = map; tabMapAt = Date.now();
      return map;
    })();
    try { return await tabMapPromise; } finally { tabMapPromise = null; }
  }
  function norm(n) { return String(n || '').trim().replace(/\s+/g, ' ').toLowerCase(); }

  // Last time we forced a tab-list refresh because a name was missing (so we don't hammer Google).
  let lastMissRefresh = 0;
  async function findTab(name) {
    let map = await loadTabs(false);
    let hit = map[norm(name)];
    if (!hit && Date.now() - lastMissRefresh > 8000) {
      lastMissRefresh = Date.now();
      map = await loadTabs(true);
      hit = map[norm(name)];
    }
    return hit || null;
  }

  async function readTab(name) {
    if (!SHEET_ID) return { ok: false, reason: 'nosheet' };
    let tab;
    try { tab = await findTab(name); }
    catch (e) { return { ok: false, reason: e.message === 'private' ? 'private' : 'offline' }; }
    if (!tab) return { ok: false, reason: 'notab', tab: name };
    try {
      const csv = await getText(BASE + '/export?format=csv&gid=' + tab.gid + '&_=' + Date.now());
      if (/^\s*<!doctype html|<html/i.test(csv)) return { ok: false, reason: 'private' };
      return { ok: true, rows: parseCSV(csv), tab: tab.name };
    } catch (e) {
      return { ok: false, reason: 'offline' };
    }
  }

  // ---------- BOARDS tab ----------
  async function readBoards() {
    const r = await readTab('BOARDS');
    if (!r.ok) return r;
    const out = {};
    r.rows.forEach(row => {
      const k = norm(row[0]);
      if (!k || k === 'board' || k.length > 40 || /\s/.test(k)) return;
      out[k] = { key: row[0].trim(), tab: (row[1] || '').trim(), about: (row[2] || '').trim() };
    });
    return { ok: true, boards: out };
  }

  window.DonHuntSheet = { SHEET_ID, BASE, readTab, readBoards, loadTabs, parseCSV, norm, sheetIdFrom };
})();
