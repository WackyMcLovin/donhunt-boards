/* DON HUNT live board engine.
   Page sets <body data-type="auction|prefill|pack|custom">.
   URL options:
     ?board=auction-2   follow a different row of the BOARDS tab
     ?tab=Auction 3     ignore BOARDS and show this tab
     ?sheet=ID_or_link  use a different Google Sheet
     ?clean=1           hide every host control (use this in OBS)
     ?layout=wide|tall  force a layout (default picks from the screen shape)
     ?transparent=1     no background (OBS overlays)                        */
(function () {
  const S = window.DonHuntSheet;
  const CFG = window.DONHUNT_CONFIG || {};
  const P = new URLSearchParams(location.search);
  const TYPE = document.body.dataset.type || 'auction';
  const AUCTION_TYPE = TYPE === 'auction' || TYPE === 'custom';
  const KEY = (P.get('board') || TYPE).trim();
  const URL_TAB = (P.get('tab') || '').trim();
  const CLEAN = P.has('clean') && P.get('clean') !== '0';
  const POLL = Math.max(3, Number(CFG.pollSeconds) || 4) * 1000;
  const LS = 'donhunt:' + TYPE + ':' + KEY + ':';
  const ROOT = new URL('..', document.currentScript.src).href;

  const DEFAULTS = {
    auction: { subtitle: '$1 START AUCTION', price: '$1 START', showLeader: true, showBids: true, label: 'SPOT' },
    prefill: { subtitle: 'PRE-FILL', price: '$10 A SPOT', showLeader: false, showBids: false, label: 'SPOT' },
    pack:    { subtitle: 'PACK RIP', price: '$30 A PACK', showLeader: false, showBids: false, label: 'PACK' },
    custom:  { subtitle: 'CUSTOM AUCTION', price: '', showLeader: true, showBids: true, label: 'SPOT' },
  }[TYPE];

  // ---------- small helpers ----------
  const $ = (sel, el) => (el || document).querySelector(sel);
  const store = {
    get(k, d) { try { const v = localStorage.getItem(LS + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(LS + k, JSON.stringify(v)); } catch (e) {} },
    del(k) { try { localStorage.removeItem(LS + k); } catch (e) {} },
  };
  const yes = v => /^(y|yes|true|on|1|show)$/i.test(String(v).trim());
  const no = v => /^(n|no|false|off|0|hide)$/i.test(String(v).trim());
  function money(v) {
    const n = parseFloat(String(v == null ? '' : v).replace(/[^0-9.\-]/g, ''));
    return isFinite(n) ? n : null;
  }
  function fmtMoney(n) {
    if (n == null) return '';
    return '$' + (Math.round(n * 100) % 100 === 0 ? n.toFixed(0) : n.toFixed(2));
  }
  function el(tag, cls, text) { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  const COLORS = ['gold', 'red', 'blue', 'purple', 'green', 'orange', 'pink', 'teal'];

  function imgUrl(v) {
    v = String(v || '').trim();
    if (!v) return '';
    const d = v.match(/drive\.google\.com\/(?:file\/d\/|open\?id=|uc\?(?:export=\w+&)?id=|thumbnail\?id=)([\w-]{10,})/);
    if (d) return 'https://drive.google.com/thumbnail?id=' + d[1] + '&sz=w600';
    if (/^(https?:|data:)/i.test(v)) return v;
    try { return new URL(v.replace(/^\/+/, ''), ROOT).href; } catch (e) { return ''; }
  }

  // ---------- parse a game tab ----------
  function parseGame(rows, tabName) {
    if (!rows.length || S.norm(rows[0][0]) !== 'don hunt game') return { ok: false, reason: 'notgame' };
    const g = { tab: tabName, settings: {}, hits: [], spots: {}, label: DEFAULTS.label };
    let mode = 'top';
    for (const r of rows) {
      const a = (r[0] || '').trim();
      const A = a.toUpperCase(), B = (r[1] || '').trim().toUpperCase();
      // Section headers are the gold rows: the word in column A AND its partner in column B.
      if (A === 'SETTINGS' && B === 'VALUE') { mode = 'set'; continue; }
      if (A === 'HITS' && B === 'PRIZE') { mode = 'hits'; continue; }
      if ((A === 'SPOTS' || A === 'PACKS') && B === 'OWNER') { mode = 'spots'; g.label = A === 'PACKS' ? 'PACK' : 'SPOT'; continue; }
      if (mode === 'set') {
        if (a) g.settings[S.norm(a)] = (r[1] || '').trim();
      } else if (mode === 'hits') {
        if (a.startsWith('(')) continue;
        const h = { pull: a, prize: (r[1] || '').trim(), odds: (r[2] || '').trim(), color: S.norm(r[3]), image: (r[4] || '').trim() };
        if (h.pull || h.prize) g.hits.push(h);
      } else if (mode === 'spots') {
        const n = parseInt(a, 10);
        if (n >= 1 && n <= 200) g.spots[n] = { owner: (r[1] || '').trim(), bid: (r[2] || '').trim(), hit: (r[3] || '').trim() };
      }
    }
    return { ok: true, game: g };
  }

  // Sheet values + defaults + this screen's overrides (custom board) => what we draw.
  function resolve(g, ovr, manual) {
    const s = g ? g.settings : {};
    const pick = (k, d) => (ovr[k] != null && ovr[k] !== '') ? ovr[k] : (s[k] != null && s[k] !== '' ? s[k] : d);
    const flag = (k, d) => {
      if (ovr[k] === true || ovr[k] === false) return ovr[k];
      if (yes(s[k] || '')) return true;
      if (no(s[k] || '')) return false;
      return d;
    };
    let count = parseInt(pick('spots', 24), 10);
    if (!(count >= 1)) count = 24;
    count = Math.min(count, 60);
    const v = {
      title: pick('title', CFG.brand || 'DON HUNT'),
      subtitle: pick('subtitle', DEFAULTS.subtitle),
      box: pick('box', ''),
      price: pick('price', DEFAULTS.price),
      banner: pick('banner', ''),
      prizeLine: pick('prize line', ''),
      status: pick('status', ''),
      accent: S.norm(pick('accent', 'gold')),
      count,
      label: g ? g.label : DEFAULTS.label,
      hits: (g ? g.hits : []).slice(0, 8),
      showLeader: AUCTION_TYPE && flag('show leader', DEFAULTS.showLeader),
      showAverage: AUCTION_TYPE && flag('show average', false),
      showBids: AUCTION_TYPE && flag('show bids', DEFAULTS.showBids),
      spots: {},
    };
    const src = manual ? (store.get('manualSpots', {})) : (g ? g.spots : {});
    for (let n = 1; n <= count; n++) v.spots[n] = src[n] || { owner: '', bid: '', hit: '' };
    return v;
  }

  // ---------- build the page once ----------
  document.body.classList.toggle('clean', CLEAN);
  document.body.classList.toggle('transparent', P.has('transparent'));
  const app = el('div', 'app');
  app.innerHTML = `
    <div class="stage">
      <header class="top">
        <div class="titles"><h1 class="title gold"></h1><span class="tag sub shadow"></span></div>
        <div class="meta"><span class="price"></span><span class="status"></span></div>
      </header>
      <div class="boxline">Pulling from <b></b></div>
      <div class="banner"></div>
      <main class="grid">
        <section class="col spots left"></section>
        <section class="col center">
          <div class="card hits"><h2 class="gold">Hits</h2><div class="hitlist"></div><div class="prizeline gold"></div></div>
          <div class="card leader" hidden>
            <div class="lbl">High Bid</div>
            <div class="bigmoney gold">$0</div>
            <div class="lbl">Leader</div>
            <div class="leadname shadow none">No bids yet</div>
            <div class="tiles"><span class="tile sold">Sold<b>0/0</b></span><span class="tile avg" hidden>Avg<b>$0</b></span></div>
          </div>
          <div class="card fill" hidden>
            <div class="lbl filllbl">Spots Filled</div>
            <div class="fillnum gold">0 / 0</div>
            <div class="bar"><i></i></div>
            <div class="openlbl shadow"></div>
          </div>
        </section>
        <section class="col spots right"></section>
      </main>
    </div>
    <div class="splash"><div><div class="big gold"></div><div class="small">Next game starting soon</div></div></div>
    <div class="notice" hidden></div>
    <div class="toolbar">
      <span class="dot">Connecting</span>
      <button class="btn" data-act="smaller" title="Smaller text">A-</button>
      <button class="btn" data-act="bigger" title="Bigger text">A+</button>
      <button class="btn" data-act="layout" title="Switch wide / tall layout">Layout</button>
      <button class="btn" data-act="full">Fullscreen</button>
      <button class="btn" data-act="panel">Settings</button>
    </div>
    <aside class="panel"></aside>`;
  document.body.appendChild(app);
  $('.splash .big').textContent = CFG.brand || 'DON HUNT';

  // ---------- state ----------
  let game = store.get('lastGame', null);     // last good game from the sheet (survives refresh)
  let ovr = TYPE === 'custom' ? store.get('ovr', {}) : {};
  let manual = TYPE === 'custom' ? store.get('manual', !S.SHEET_ID) : false;
  let pinned = store.get('pin', '');
  let liveTab = '';
  let drawn = null;           // what is currently on screen
  let lastLeader = null;
  let scale = store.get('scale', 1);
  let layoutPref = P.get('layout') || store.get('layout', 'auto');

  // ---------- drawing ----------
  function setText(node, t) { if (node.textContent !== t) node.textContent = t; }

  function buildSpots(v) {
    const half = Math.ceil(v.count / 2);
    [['.spots.left', 1, half], ['.spots.right', half + 1, v.count]].forEach(([sel, a, b]) => {
      const col = $(sel, app);
      col.innerHTML = '';
      const head = el('div', 'srow head');
      head.append(el('span', '', '#'), el('span', '', v.label === 'PACK' ? 'Pack Owner' : 'Spot Owner'), el('span', 'bid', 'Bid'));
      col.appendChild(head);
      for (let n = a; n <= b; n++) {
        const row = el('div', 'srow'); row.dataset.n = n;
        const name = el('span', 'owner');
        if (manual) {
          const i = el('input'); i.placeholder = 'Open'; i.dataset.f = 'owner'; name.appendChild(i);
        }
        const bid = el('span', 'bid');
        if (manual && v.showBids) {
          const i = el('input', 'bidin'); i.placeholder = '$'; i.dataset.f = 'bid'; bid.appendChild(i);
        }
        row.append(el('span', 'num', String(n)), name, bid);
        col.appendChild(row);
      }
      // empty filler rows keep both columns the same height
      for (let k = b - a + 1; k < half; k++) { const f = el('div', 'srow'); f.style.visibility = 'hidden'; col.appendChild(f); }
    });
    sizeRows(v.count);
  }

  function sizeRows(count) {
    const col = $('.spots.left', app);
    const rows = Math.ceil(count / 2) + 1;
    const h = col.clientHeight || window.innerHeight * .7;
    const w = col.clientWidth || window.innerWidth / 3;
    const fs = Math.max(10, Math.min(h / rows * (manual ? 0.4 : 0.52), w / 11, 40 * scale));
    app.style.setProperty('--rowfs', fs.toFixed(1) + 'px');
    const hl = $('.hitlist', app);
    const n = Math.max(1, (drawn && drawn.hits.length) || 1);
    const hh = hl.clientHeight || 300;
    const hw = hl.clientWidth || 400;
    const tall = app.classList.contains('tall');
    const hfs = tall ? Math.min(hw / 16, 30 * scale) : Math.max(10, Math.min(hh / n / 4.4, hw / 15, 34 * scale));
    app.style.setProperty('--hitfs', hfs.toFixed(1) + 'px');
  }

  function drawHits(v) {
    const key = JSON.stringify(v.hits);
    const list = $('.hitlist', app);
    if (list.dataset.key === key) return;
    list.dataset.key = key;
    list.innerHTML = '';
    if (!v.hits.length) { list.appendChild(el('div', 'nohits', 'Hits coming soon')); return; }
    v.hits.forEach((h, i) => {
      const c = COLORS.includes(h.color) ? h.color : COLORS[[4, 1, 2, 3, 0, 5, 6, 7][i % 8]] || 'gold';
      const row = el('div', 'hit ' + c);
      const pic = el('div', 'pic');
      const src = imgUrl(h.image);
      const star = el('span', 'star', '★');
      if (src) {
        const im = new Image(); im.alt = ''; im.referrerPolicy = 'no-referrer';
        im.onerror = () => { im.remove(); pic.appendChild(star); };
        im.src = src; pic.appendChild(im);
      } else pic.appendChild(star);
      const t = el('div', 'htext');
      if (h.pull) t.appendChild(el('div', 'pull shadow', h.pull));
      if (h.prize) t.appendChild(el('div', 'prize gold', h.prize));
      const odds = el('div', 'odds'); if (h.odds) odds.appendChild(el('span', '', h.odds));
      row.append(pic, t, odds);
      list.appendChild(row);
    });
  }

  function draw(v, animate) {
    const structKey = [v.count, v.label, v.showBids, manual].join('|');
    const rebuild = !drawn || drawn.structKey !== structKey;
    app.classList.toggle('no-bid', !v.showBids);
    document.documentElement.style.setProperty('--accent', 'var(--' + (COLORS.includes(v.accent) ? v.accent : 'gold') + ')');
    setText($('.title', app), v.title);
    setText($('.sub', app), v.subtitle);
    setText($('.price', app), v.price);
    const st = $('.status', app);
    setText(st, v.status);
    st.classList.toggle('hot', /rip|live|now|sold|last/i.test(v.status));
    setText($('.boxline b', app), v.box);
    $('.boxline', app).classList.toggle('empty', !v.box);
    setText($('.banner', app), v.banner);
    setText($('.prizeline', app), v.prizeLine);
    document.title = [v.title, v.subtitle].filter(Boolean).join(' - ');
    if (rebuild) buildSpots(v);
    drawn = Object.assign({}, v, { structKey });
    drawHits(v);

    // spots
    let filled = 0, bids = [], lead = null;
    for (let n = 1; n <= v.count; n++) {
      const s = v.spots[n];
      if (s.owner) filled++;
      const b = v.showBids ? money(s.bid) : null;
      if (b != null && b > 0) { bids.push(b); if (!lead || b > lead.bid) lead = { n, bid: b, owner: s.owner || ('Spot ' + n) }; }
    }
    app.querySelectorAll('.srow[data-n]').forEach(row => {
      const n = +row.dataset.n, s = v.spots[n];
      const name = $('.owner', row), bid = $('.bid', row);
      const prev = row.dataset.sig || '';
      const sig = s.owner + '|' + s.bid + '|' + s.hit;
      if (manual) {
        const oi = $('input[data-f=owner]', row), bi = $('input[data-f=bid]', row);
        if (oi && document.activeElement !== oi) oi.value = s.owner;
        if (bi && document.activeElement !== bi) bi.value = s.bid;
      } else {
        if (prev !== sig) {
          name.textContent = s.owner || 'Open';
          name.classList.toggle('open', !s.owner);
          if (s.hit) { const m = el('span', 'hitmark on', s.hit); name.appendChild(m); }
          const bm = money(s.bid);
          bid.textContent = s.bid ? (bm != null ? fmtMoney(bm) : s.bid) : '';
        }
      }
      if (prev && prev !== sig && animate) { row.classList.remove('pop'); void row.offsetWidth; row.classList.add('pop'); }
      row.dataset.sig = sig;
      row.classList.toggle('filled', !!s.owner);
      row.classList.toggle('lead', !!(v.showLeader && lead && lead.n === n));
    });

    // leader card (auction boards only)
    const lc = $('.leader', app);
    lc.hidden = !v.showLeader;
    if (v.showLeader) {
      setText($('.bigmoney', lc), lead ? fmtMoney(lead.bid) : '$0');
      const ln = $('.leadname', lc);
      setText(ln, lead ? lead.owner : 'No bids yet');
      ln.classList.toggle('none', !lead);
      setText($('.sold b', lc), filled + '/' + v.count);
      const avgT = $('.avg', lc);
      avgT.hidden = !v.showAverage;
      setText($('.avg b', lc), bids.length ? fmtMoney(bids.reduce((a, b) => a + b, 0) / bids.length) : '$0');
      const lk = lead ? lead.n + ':' + lead.bid : '';
      if (animate && lk && lk !== lastLeader) { lc.classList.remove('bump'); void lc.offsetWidth; lc.classList.add('bump'); }
      lastLeader = lk;
    }

    // fill card (pre-fill boards, or an auction board with the leader turned off)
    const fc = $('.fill', app);
    fc.hidden = v.showLeader;
    if (!v.showLeader) {
      setText($('.filllbl', fc), v.label === 'PACK' ? 'Packs Sold' : 'Spots Filled');
      setText($('.fillnum', fc), filled + ' / ' + v.count);
      $('.bar > i', fc).style.width = (v.count ? filled / v.count * 100 : 0) + '%';
      const open = v.count - filled;
      const ol = $('.openlbl', fc);
      setText(ol, open <= 0 ? 'Sold out!' : open + (open === 1 ? ' left' : ' left') + ' at ' + (v.price || 'the same price'));
      if (!v.price && open > 0) setText(ol, open + ' still open');
      ol.classList.toggle('sold', open <= 0);
    }
    sizeRows(v.count);
  }

  function render(animate, swap) {
    const v = resolve(game, ovr, manual);
    if (swap && drawn) {
      app.classList.add('swapping');
      setTimeout(() => { draw(v, false); app.classList.remove('swapping'); }, 360);
    } else draw(v, animate);
    if (game || manual) $('.splash', app).classList.add('gone');
  }

  // ---------- layout ----------
  function applyLayout() {
    const tall = layoutPref === 'tall' || (layoutPref === 'auto' && window.innerHeight > window.innerWidth * 1.05);
    app.classList.toggle('tall', tall);
    document.documentElement.style.setProperty('--scale', scale);
    if (drawn) sizeRows(drawn.count);
  }
  window.addEventListener('resize', applyLayout);

  // ---------- host messages (never shown to viewers with ?clean=1) ----------
  const dot = $('.dot', app), notice = $('.notice', app);
  function status(kind, text, msg) {
    dot.className = 'dot ' + kind; dot.textContent = text;
    notice.hidden = !msg; if (msg) notice.innerHTML = msg;
  }
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  function explain(reason, tab) {
    const keep = game ? ' The board is still showing the last good game.' : '';
    switch (reason) {
      case 'nosheet': return 'No Google Sheet connected yet. Add the sheet ID in <b>assets/config.js</b>, or add <b>?sheet=</b> plus the sheet link to this page\'s address.' + (TYPE === 'custom' ? ' You can also open <b>Settings</b> and turn on <b>Type on the board</b>.' : '');
      case 'private': return 'Can\'t read the Google Sheet. In the sheet, click <b>Share</b> and set General access to <b>Anyone with the link: Viewer</b>.' + keep;
      case 'offline': return 'Can\'t reach Google right now. Retrying on its own.' + keep;
      case 'notab': return 'There\'s no tab named <b>' + esc(tab) + '</b> in the sheet. Check the spelling in the BOARDS tab (spaces count).' + keep;
      case 'notgame': return 'The tab <b>' + esc(tab) + '</b> isn\'t a game tab (cell A1 should say DON HUNT GAME). Duplicate a TEMPLATE tab to make new games.' + keep;
      case 'noboard': return 'The BOARDS tab has no row for <b>' + esc(KEY) + '</b>. Add a row with <b>' + esc(KEY) + '</b> in column A and the tab to show in column B.' + keep;
      case 'nolive': return 'The <b>' + esc(KEY) + '</b> row in the BOARDS tab has no LIVE TAB yet. Type a tab name in column B.' + keep;
      default: return 'Something went wrong reading the sheet. Retrying.' + keep;
    }
  }

  // ---------- sync loop ----------
  let fails = 0, timer = null, busy = false;
  async function tick() {
    if (busy) return; busy = true;
    try {
      if (manual) { status('ok', 'Typing on the board (sheet not used)', ''); return; }
      if (!S.SHEET_ID) { status('err', 'No sheet', explain('nosheet')); return fail(); }
      let tab = URL_TAB || pinned;
      if (!tab) {
        const b = await S.readBoards();
        if (!b.ok) { status('err', 'Sheet problem', explain(b.reason)); return fail(); }
        const row = b.boards[S.norm(KEY)];
        if (!row) { status('warn', 'No BOARDS row', explain('noboard')); return fail(); }
        if (!row.tab) { status('warn', 'No live tab', explain('nolive')); return fail(); }
        tab = row.tab;
      }
      const r = await S.readTab(tab);
      if (!r.ok) { status(r.reason === 'offline' ? 'warn' : 'err', r.reason === 'offline' ? 'Reconnecting' : 'Check the sheet', explain(r.reason, tab)); return fail(); }
      const p = parseGame(r.rows, r.tab);
      if (!p.ok) { status('err', 'Not a game tab', explain('notgame', r.tab)); return fail(); }
      const swapped = !!(game && S.norm(game.tab) !== S.norm(p.game.tab));
      const changed = !game || JSON.stringify(game) !== JSON.stringify(p.game);
      game = p.game; liveTab = p.game.tab; fails = 0;
      if (changed) { store.set('lastGame', game); render(true, swapped); }
      status('ok', (URL_TAB || pinned ? 'Pinned: ' : 'Live: ') + liveTab, '');
      if (panel.classList.contains('open')) refreshPanelInfo();
    } catch (e) {
      status('warn', 'Reconnecting', explain('offline'));
      fail();
    } finally {
      busy = false;
      clearTimeout(timer);
      timer = setTimeout(tick, fails ? Math.min(20000, POLL * (1 + fails)) : POLL);
    }
  }
  function fail() { fails++; }

  // ---------- settings panel ----------
  const panel = $('.panel', app);
  function panelHTML() {
    const custom = TYPE === 'custom';
    const f = (k, label, ph) => `<label>${label}</label><input type="text" data-o="${k}" placeholder="${esc(ph || 'from sheet')}" value="${esc(ovr[k] || '')}">`;
    const tri = (k, label) => {
      const v = ovr[k] === true ? 'yes' : ovr[k] === false ? 'no' : '';
      return `<label>${label}</label><select data-t="${k}"><option value="">Use sheet</option><option value="yes"${v === 'yes' ? ' selected' : ''}>Show</option><option value="no"${v === 'no' ? ' selected' : ''}>Hide</option></select>`;
    };
    return `
      <button class="btn close" data-act="panel">Close</button>
      <h3>Board settings</h3>
      <div class="hint">Board <b>${esc(KEY)}</b> &middot; <span class="pi-live"></span></div>
      <h4>Which game</h4>
      <label>Tab to show</label>
      <select class="pinsel"><option value="">Follow the BOARDS tab (recommended)</option></select>
      <div class="hint">Changing games is normally done in the sheet's BOARDS tab. Pinning only affects this screen.</div>
      ${custom ? `
      <h4>Adjust this auction</h4>
      <div class="hint">Anything you type here beats the sheet. Leave a box empty to use the sheet.</div>
      ${f('title', 'Title')}${f('subtitle', 'Subtitle tag')}${f('box', 'Box / pulling from')}${f('price', 'Price tag')}
      <label>Number of spots (1 to 60)</label><input type="number" min="1" max="60" data-o="spots" placeholder="from sheet" value="${esc(ovr.spots || '')}">
      ${f('banner', 'Yellow banner')}${f('prize line', 'Prize line')}${f('status', 'Status tag', 'OPEN, RIPPING NOW...')}
      ${tri('show leader', 'High bid leader')}${tri('show bids', 'Bid column')}${tri('show average', 'Average bid tile')}
      <label>Accent color</label><select data-o="accent"><option value="">from sheet</option>${COLORS.map(c => `<option${ovr.accent === c ? ' selected' : ''}>${c}</option>`).join('')}</select>
      <div class="chk"><input type="checkbox" class="manual" ${manual ? 'checked' : ''}><span>Type on the board (don't use the sheet for spots)</span></div>
      <div class="row2"><button class="btn" data-act="reset">Reset to sheet</button><button class="btn" data-act="clearmanual">Clear typed spots</button></div>` : ''}
      <h4>Screen</h4>
      <div class="row2"><button class="btn" data-act="smaller">Text -</button><button class="btn" data-act="bigger">Text +</button><button class="btn" data-act="layout">Layout: <span class="pi-layout"></span></button></div>
      <h4>OBS / stream link</h4>
      <div class="hint">Use this address as a Browser Source. It hides every button and message.</div>
      <input type="text" class="obs" readonly>
      <div class="row2"><button class="btn" data-act="copy">Copy link</button></div>`;
  }
  function refreshPanelInfo() {
    const li = $('.pi-live', panel); if (li) li.textContent = manual ? 'typing on board' : (liveTab ? 'showing ' + liveTab : 'not connected');
    const lo = $('.pi-layout', panel); if (lo) lo.textContent = layoutPref;
    const u = new URL(location.href); u.searchParams.set('clean', '1'); const o = $('.obs', panel); if (o) o.value = u.href;
  }
  async function openPanel() {
    panel.innerHTML = panelHTML();
    panel.classList.add('open');
    refreshPanelInfo();
    const sel = $('.pinsel', panel);
    if (URL_TAB) { sel.innerHTML = `<option>${esc(URL_TAB)} (set in the page address)</option>`; sel.disabled = true; }
    else if (S.SHEET_ID) {
      try {
        const map = await S.loadTabs(true);
        map.__order.filter(n => n !== 'BOARDS' && !/^template/i.test(n) && !/^how to/i.test(n)).forEach(n => {
          const o = el('option', '', n); o.value = n; if (n === pinned) o.selected = true; sel.appendChild(o);
        });
      } catch (e) {}
    }
  }
  panel.addEventListener('change', e => {
    const t = e.target;
    if (t.classList.contains('pinsel')) { pinned = t.value; pinned ? store.set('pin', pinned) : store.del('pin'); tick(); return; }
    if (t.classList.contains('manual')) {
      manual = t.checked; store.set('manual', manual); drawn = null; render(false); tick(); return;
    }
    if (t.dataset.t) { ovr[t.dataset.t] = t.value === 'yes' ? true : t.value === 'no' ? false : undefined; }
    if (t.dataset.o) { ovr[t.dataset.o] = t.value.trim(); }
    store.set('ovr', ovr); render(false);
  });
  panel.addEventListener('input', e => { if (e.target.dataset.o && e.target.type === 'text') { ovr[e.target.dataset.o] = e.target.value.trim(); store.set('ovr', ovr); render(false); } });

  // typing straight onto the board (custom board, manual mode)
  app.addEventListener('input', e => {
    const f = e.target.dataset && e.target.dataset.f;
    const row = e.target.closest && e.target.closest('.srow[data-n]');
    if (!f || !row) return;
    const spots = store.get('manualSpots', {});
    const n = row.dataset.n;
    spots[n] = Object.assign({ owner: '', bid: '', hit: '' }, spots[n], { [f]: e.target.value });
    store.set('manualSpots', spots);
    render(false);
  });

  // ---------- buttons ----------
  app.addEventListener('click', e => {
    const b = e.target.closest('[data-act]'); if (!b) return;
    const act = b.dataset.act;
    if (act === 'smaller' || act === 'bigger') { scale = Math.min(1.6, Math.max(.6, Math.round((scale + (act === 'bigger' ? .1 : -.1)) * 10) / 10)); store.set('scale', scale); applyLayout(); }
    if (act === 'layout') { layoutPref = { auto: 'wide', wide: 'tall', tall: 'auto' }[layoutPref] || 'auto'; store.set('layout', layoutPref); applyLayout(); refreshPanelInfo(); }
    if (act === 'full') { if (!document.fullscreenElement) document.documentElement.requestFullscreen && document.documentElement.requestFullscreen(); else document.exitFullscreen(); }
    if (act === 'panel') { panel.classList.contains('open') ? panel.classList.remove('open') : openPanel(); }
    if (act === 'reset') { ovr = {}; store.del('ovr'); openPanel(); render(false); }
    if (act === 'clearmanual') { if (confirm('Clear every name and bid typed on this board?')) { store.del('manualSpots'); drawn = null; render(false); } }
    if (act === 'copy') { const o = $('.obs', panel); o.select(); (navigator.clipboard ? navigator.clipboard.writeText(o.value) : Promise.reject()).catch(() => document.execCommand('copy')); b.textContent = 'Copied'; }
  });

  // toolbar wakes up when the mouse moves, fades when idle
  const tb = $('.toolbar', app); let idle;
  document.addEventListener('mousemove', () => { tb.classList.add('awake'); clearTimeout(idle); idle = setTimeout(() => tb.classList.remove('awake'), 2500); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') panel.classList.remove('open'); });

  // ---------- go ----------
  applyLayout();
  if (game || manual) render(false);
  tick();
})();
