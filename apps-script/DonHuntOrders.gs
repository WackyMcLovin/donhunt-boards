/**
 * DON HUNT - shop orders to board spots + spot labels (Google Apps Script).
 *
 * What it does: every minute it looks at paid Shopify orders (TikTok Shop orders included, as long as
 * the TikTok sales channel is connected to the shop). If an order matches a product listed in the SHOP
 * tab, the buyer gets the next open spot on that board tab and a line lands in the LABELS tab. The
 * Print Station page at donhunt.breaksgpt.com/print/ turns those lines into spot labels.
 *
 * ONE TIME:
 *   1. Run setupOrderTabs()   -> adds the SHOP and LABELS tabs (and a LIVE tab if there isn't one)
 *                                to the DON_HUNT sheet. It never touches the game tabs.
 *   2. Project Settings > Script Properties: add SHOP (xxxx.myshopify.com), CLIENT_ID and CLIENT_SECRET
 *      from the shop's Shopify app. (An admin API token works too: put it in SHOPIFY_TOKEN instead.)
 *   3. Run checkShopConnection() -> should log the newest orders.
 *   4. Run turnOnAutoOrders()    -> checks the shop every minute.
 * EVERY NIGHT: nothing. Fill the SHOP tab once and it runs itself.
 */
var GOLD = '#ffcc33', BLACK = '#111111', YELLOW = '#fff4c2', GREY = '#eeeeee';
var API_VERSION = '2026-07';
var MAIN_SHEET_ID = '1YWSfMr9ftFPeGsUXoclpPvsU_0MdxABGt61lfP-ndqU';   // the team's DON_HUNT sheet
var GAME_SHEETS = {                                                   // the extra game boards
  RTYH: '1Xv3wviYmsqL17gR0oSnAAQxm6Qps31Xkn7BAJ1nDe7w',
  TYPES: '1dFFYzZORz9bLl2-x-l3ODNmpbvH35fFo5lNgtYkm4-I',
  CASE: '1cjvGCX4eOXIGtl8QAtk7Kxc2lThXciktKBg0TT46tGM'
};

/** Adds the tabs the robot needs. Safe to run again: it skips anything that already exists. */
function setupOrderTabs() {
  var ss = SpreadsheetApp.openById(MAIN_SHEET_ID);
  if (!ss.getSheetByName('SHOP')) {
    var shop = ss.insertSheet('SHOP');
    shop.getRange(1, 1, 80, 6).setNumberFormat('@');
    shop.getRange(1, 1).setValue('SHOP ORDERS').setBackground(BLACK).setFontColor('#ffffff').setFontWeight('bold').setFontSize(14);
    shop.getRange(1, 2, 1, 4).merge().setValue('When someone buys a product listed below (TikTok Shop, website, anywhere Shopify gets the order), they get the next open spot on that board and a spot label prints at the Print Station.').setFontStyle('italic').setWrap(true);
    shop.setRowHeight(1, 48);
    var r = settings_(shop, 3, [
      ['Auto Orders', 'YES', 'YES = fill spots from shop orders. NO = pause.'],
      ['Test Order', '', 'Type YES to make a pretend order (checks your label printer). It clears itself.'],
      ['Buyer Name', 'FIRST L', 'FIRST L = Jonah M.   FIRST = Jonah   ORDER = #1790'],
      ['Last Checked', '', 'Filled in by the robot']
    ]);
    table_(shop, r, ['PRODUCT NAME HAS', 'BOARD', 'SPOTS PER ITEM', 'ON'],
      [['$10 Spot', '$10', '1', 'YES'], ['$30 Pack', '$30', '1', 'NO'], ['Auction Spot', 'AUCTION', '1', 'NO']], 15,
      '(BOARD can be AUCTION, $10, $30, any tab name in this sheet, or TYPES / CASE / RTYH for the extra game boards. Case does not matter.)');
    shop.setColumnWidth(1, 230); shop.setColumnWidth(2, 200); shop.setColumnWidth(3, 330); shop.setColumnWidth(4, 90);
  }
  if (!ss.getSheetByName('LABELS')) {
    var lab = ss.insertSheet('LABELS');
    lab.getRange(1, 1, 500, 9).setNumberFormat('@');
    lab.getRange(1, 1, 1, 9).setValues([['TIME', 'ORDER', 'BUYER', 'BOARD', 'SPOT', 'ITEM', 'CHANNEL', 'STATUS', 'ORDER ID']]);
    style_(lab.getRange(1, 1, 1, 9), 'head');
    lab.setFrozenRows(1); lab.setColumnWidth(6, 300); lab.setColumnWidth(9, 60);
  }
  if (!ss.getSheetByName('LIVE')) {
    var live = ss.insertSheet('LIVE');
    live.getRange(1, 1, 20, 4).setNumberFormat('@');
    live.getRange(1, 1, 6, 3).setValues([['BOARD', 'SHOW THIS TAB', 'CHASE TAB'], ['AUCTION', 'AUCTION', 'AUCTION_CHASE'], ['$10', '$10', '$10_CHASE'], ['$30', '$30', '$30_CHASE'], ['', '', ''],
      ['HOW TO: copy a tab, give it a new name, type that name in column B. The board switches in a few seconds. Shop orders follow it too.', '', '']]);
    style_(live.getRange(1, 1, 1, 3), 'head');
    live.getRange(2, 2, 3, 2).setBackground(YELLOW);
    live.setColumnWidth(1, 160); live.setColumnWidth(2, 220); live.setColumnWidth(3, 220);
  }
  Logger.log('Tabs ready: SHOP, LABELS, LIVE');
}

// ---------- shared layout helpers ----------
function put_(sh, row, values) {
  sh.getRange(row, 1, 1, values.length).setValues([values.map(String)]);
  return row + 1;
}
function settings_(sh, row, list) {
  row = put_(sh, row, ['SETTINGS', 'VALUE', 'NOTES']);
  style_(sh.getRange(row - 1, 1, 1, 3), 'head');
  list.forEach(function (s) {
    row = put_(sh, row, s);
    sh.getRange(row - 1, 1).setFontWeight('bold');
    sh.getRange(row - 1, 2).setBackground(YELLOW);
    sh.getRange(row - 1, 3).setFontColor('#777777').setFontStyle('italic');
  });
  return row + 1;
}
function table_(sh, row, headers, rows, blankRows, note) {
  if (note) { sh.getRange(row, 1).setValue(note).setFontColor('#777777').setFontStyle('italic'); row++; }
  row = put_(sh, row, headers);
  style_(sh.getRange(row - 1, 1, 1, headers.length), 'head');
  var all = rows.slice();
  for (var i = 0; i < (blankRows || 0); i++) all.push(headers.map(function () { return ''; }));
  if (all.length) {
    var r = sh.getRange(row, 1, all.length, headers.length);
    r.setValues(all.map(function (x) { return headers.map(function (_, j) { return String(x[j] == null ? '' : x[j]); }); }));
    r.setBorder(true, true, true, true, true, true, '#bbbbbb', SpreadsheetApp.BorderStyle.SOLID);
    row += all.length;
  }
  return row + 1;
}
function style_(range, kind) {
  if (kind === 'head') range.setBackground(GOLD).setFontWeight('bold').setFontColor('#000000');
}
function top_(sh, name, how) {
  sh.getRange(1, 1).setValue(name).setBackground(BLACK).setFontColor('#ffffff').setFontWeight('bold').setFontSize(14);
  sh.getRange(1, 2, 1, 4).merge().setValue(how).setFontStyle('italic').setWrap(true);
  sh.setRowHeight(1, 48);
  sh.setColumnWidth(1, 230); sh.setColumnWidth(2, 230); sh.setColumnWidth(3, 230); sh.setColumnWidth(4, 260); sh.setColumnWidth(5, 200);
  sh.setFrozenRows(1);
  return 3;
}


// =====================================================================
//  SHOP ORDERS -> BOARD SPOTS -> LABELS
// =====================================================================
/** Run this after adding SHOP, CLIENT_ID and CLIENT_SECRET. It checks the shop connection and logs the newest orders it can see. */
function checkShopConnection() {
  var orders = fetchOrders_();
  Logger.log('Connected. Orders in the last 36 hours: ' + orders.length);
  orders.slice(-5).forEach(function (o) {
    Logger.log(o.name + ' | ' + (o.channelInformation && o.channelInformation.channelDefinition ? o.channelInformation.channelDefinition.channelName : o.sourceName) + ' | ' + o.lineItems.nodes.map(function (l) { return l.title; }).join(', ').slice(0, 80));
  });
}

function turnOnAutoOrders() {
  ScriptApp.getProjectTriggers().forEach(function (t) { if (t.getHandlerFunction() === 'checkOrders') ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('checkOrders').timeBased().everyMinutes(1).create();
  checkOrders();
  Logger.log('Auto orders are ON. The shop gets checked every minute.');
}
function turnOffAutoOrders() {
  ScriptApp.getProjectTriggers().forEach(function (t) { if (t.getHandlerFunction() === 'checkOrders') ScriptApp.deleteTrigger(t); });
  Logger.log('Auto orders are OFF.');
}
/** Pretend order, so you can check the board and the label printer without buying anything. */
function testOrder() { runTest_(); }

function mainSheet_() { return SpreadsheetApp.openById(MAIN_SHEET_ID); }
function shopSettings_(sh) {
  var v = sh.getDataRange().getValues(), set = {}, rules = [], inTable = false;
  for (var i = 0; i < v.length; i++) {
    var a = String(v[i][0]).trim(), b = String(v[i][1]).trim();
    if (/^product name has$/i.test(a)) { inTable = true; continue; }
    if (!inTable) { if (a) set[a.toLowerCase()] = { value: b, row: i + 1 }; continue; }
    if (!a || a.charAt(0) === '(') continue;
    rules.push({ match: a.toLowerCase(), board: b, per: Math.max(1, parseInt(v[i][2], 10) || 1), on: !/^no$/i.test(String(v[i][3]).trim()) });
  }
  return { set: set, rules: rules };
}

function checkOrders() {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(20000)) return;
  try {
    var ss = mainSheet_();
    var shop = ss.getSheetByName('SHOP'), labels = ss.getSheetByName('LABELS');
    var cfg = shopSettings_(shop);
    var stamp = function (txt) { if (cfg.set['last checked']) shop.getRange(cfg.set['last checked'].row, 2).setValue(txt); };
    if (cfg.set['test order'] && /^yes$/i.test(cfg.set['test order'].value)) {
      shop.getRange(cfg.set['test order'].row, 2).setValue('');
      runTest_();
    }
    if (cfg.set['auto orders'] && /^no$/i.test(cfg.set['auto orders'].value)) { stamp('Paused ' + now_()); return; }
    var orders;
    try { orders = fetchOrders_(); }
    catch (e) { stamp('PROBLEM: ' + e.message + ' (' + now_() + ')'); return; }
    var done = {};
    labels.getRange(1, 9, Math.max(1, labels.getLastRow()), 1).getValues().forEach(function (r) { if (r[0]) done[String(r[0])] = true; });
    var added = 0;
    orders.forEach(function (o) {
      if (done[o.id] || o.cancelledAt || !/paid/i.test(o.displayFinancialStatus || '')) return;
      var lines = [];
      o.lineItems.nodes.forEach(function (li) {
        var hay = ((li.title || '') + ' ' + (li.variantTitle || '') + ' ' + (li.sku || '')).toLowerCase();
        var rule = null;
        cfg.rules.forEach(function (r) { if (!rule && r.on && hay.indexOf(r.match) >= 0) rule = r; });
        if (rule) lines.push({ li: li, rule: rule });
      });
      if (!lines.length) return;
      var buyer = buyerName_(o, (cfg.set['buyer name'] || {}).value);
      var channel = o.channelInformation && o.channelInformation.channelDefinition ? o.channelInformation.channelDefinition.channelName : (o.sourceName || '');
      lines.forEach(function (x) {
        var count = (x.li.quantity || 1) * x.rule.per;
        for (var k = 0; k < count; k++) {
          var spot = assign_(ss, x.rule.board, buyer, o.name, x.li.variantTitle || '');
          labels.appendRow([now_(), o.name, buyer, spot.board, spot.spot, x.li.title + (x.li.variantTitle ? ' - ' + x.li.variantTitle : ''), channel, spot.ok ? 'READY' : 'NO OPEN SPOT - CHECK', o.id]);
          added++;
        }
      });
      done[o.id] = true;
    });
    stamp((added ? added + ' new spot(s) ' : 'OK ') + now_());
  } finally { lock.releaseLock(); }
}

function runTest_() {
  var ss = mainSheet_();
  var cfg = shopSettings_(ss.getSheetByName('SHOP'));
  var rule = cfg.rules.filter(function (r) { return r.on; })[0] || { board: '$10' };
  var spot = assign_(ss, rule.board, 'TEST BUYER', '#TEST', '');
  ss.getSheetByName('LABELS').appendRow([now_(), '#TEST', 'TEST BUYER', spot.board, spot.spot, 'Pretend order (safe to delete)', 'Test', spot.ok ? 'READY' : 'NO OPEN SPOT - CHECK', 'test-' + Date.now()]);
}

function now_() { return Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'M/d h:mm:ss a'); }

function buyerName_(o, style) {
  style = String(style || 'FIRST L').toUpperCase();
  var attrs = (o.customAttributes || []).slice();
  o.lineItems.nodes.forEach(function (li) { (li.customAttributes || []).forEach(function (a) { attrs.push(a); }); });
  for (var i = 0; i < attrs.length; i++) {
    if (/tiktok|username|user name|handle|whatnot/i.test(attrs[i].key) && String(attrs[i].value || '').trim()) return String(attrs[i].value).trim().replace(/^@/, '');
  }
  var c = o.customer || {};
  var first = (c.firstName || '').trim(), last = (c.lastName || '').trim();
  if (style === 'ORDER' || (!first && !last)) return o.name;
  if (style === 'FIRST') return first || last;
  return (first + (last ? ' ' + last.charAt(0).toUpperCase() + '.' : '')).trim();
}

/** Put a buyer on a board. Returns {ok, board, spot}. */
function assign_(ss, boardName, buyer, orderName, variant) {
  var key = String(boardName || '').trim();
  var up = key.toUpperCase();
  if (up === 'TYPES' || up === 'CASE' || up === 'RTYH') {
    var gid = GAME_SHEETS[up];
    if (!gid) return { ok: false, board: up, spot: '?' };
    var gs = SpreadsheetApp.openById(gid);
    var sh = gs.getSheetByName(up) || gs.getSheets()[0];
    if (up === 'RTYH') return assignRipper_(sh, buyer);
    return assignOwner_(sh, up === 'TYPES' ? 'type' : 'spot', buyer, up === 'TYPES' ? variant : '', up === 'TYPES' ? 'Pick Your Type' : 'Case Break', null);
  }
  var tab = ss.getSheetByName(key) || ss.getSheetByName(up);
  var live = ss.getSheetByName('LIVE');
  if (live) {   // follow the LIVE tab so orders land on the tab that is on stream right now
    live.getDataRange().getValues().forEach(function (r) {
      if (String(r[0]).trim().toUpperCase() === up && String(r[1]).trim() && ss.getSheetByName(String(r[1]).trim())) tab = ss.getSheetByName(String(r[1]).trim());
    });
  }
  if (!tab) return { ok: false, board: key, spot: '?' };
  return assignOwner_(tab, 'spot', buyer, '', tab.getName(), orderName);
}

function assignOwner_(sh, mode, buyer, wanted, boardLabel, orderName) {
  var v = sh.getDataRange().getValues();
  var headerRow = -1, orderCol = -1;
  for (var i = 0; i < v.length; i++) {
    var a = String(v[i][0]).trim().toLowerCase(), b = String(v[i][1]).trim().toLowerCase();
    if (b !== 'owner') continue;
    if (mode === 'type' ? a === 'type' : true) {
      if (headerRow < 0) headerRow = i;
      for (var c = 2; c < v[i].length; c++) if (String(v[i][c]).trim().toLowerCase() === 'order') orderCol = c;
      if (mode === 'type') break;
    }
  }
  if (headerRow < 0) return { ok: false, board: boardLabel, spot: '?' };
  var open = [];
  for (var j = headerRow + 1; j < v.length; j++) {
    var A = String(v[j][0]).trim();
    if (mode === 'type') { if (!A) break; }
    else if (!/^\d+$/.test(A) || +A < 1 || +A > 24) continue;
    if (String(v[j][1]).trim()) continue;
    open.push(j);
  }
  if (!open.length) return { ok: false, board: boardLabel, spot: 'FULL' };
  var pick = open[0];
  if (wanted) open.forEach(function (j) { if (String(v[j][0]).trim().toLowerCase() === String(wanted).trim().toLowerCase()) pick = j; });
  sh.getRange(pick + 1, 2).setValue(buyer);
  if (orderName && orderCol >= 0) sh.getRange(pick + 1, orderCol + 1).setValue(orderName);
  return { ok: true, board: boardLabel, spot: String(v[pick][0]).trim() };
}

function assignRipper_(sh, buyer) {
  var v = sh.getDataRange().getValues();
  for (var i = 0; i < v.length; i++) {
    if (String(v[i][0]).trim().toLowerCase() === 'ripper' && String(v[i][1]).trim().toLowerCase() === 'packs') {
      var n = 0;
      for (var j = i + 1; j < sh.getMaxRows(); j++) {
        var row = j < v.length ? v[j] : ['', '', ''];
        if (String(row[0]).trim()) { n++; continue; }
        sh.getRange(j + 1, 1, 1, 2).setValues([[buyer, '0']]);
        return { ok: true, board: 'Rip Till You Hit', spot: 'Ripper ' + (n + 1) };
      }
    }
  }
  return { ok: false, board: 'Rip Till You Hit', spot: '?' };
}

// ---------- Shopify ----------
function shopToken_() {
  var p = PropertiesService.getScriptProperties();
  var shop = String(p.getProperty('SHOP') || '').replace(/^https?:\/\//, '').replace(/\/.*$/, '').trim();
  if (!shop) throw new Error('Add SHOP in Script Properties');
  var fixed = p.getProperty('SHOPIFY_TOKEN');
  if (fixed) return { shop: shop, token: fixed.trim() };
  var cache = CacheService.getScriptCache();
  var hit = cache.get('shop_token');
  if (hit) return { shop: shop, token: hit };
  var id = p.getProperty('CLIENT_ID'), secret = p.getProperty('CLIENT_SECRET');
  if (!id || !secret) throw new Error('Add CLIENT_ID and CLIENT_SECRET in Script Properties');
  var r = UrlFetchApp.fetch('https://' + shop + '/admin/oauth/access_token', {
    method: 'post', muteHttpExceptions: true,
    payload: { grant_type: 'client_credentials', client_id: id.trim(), client_secret: secret.trim() }
  });
  if (r.getResponseCode() !== 200) throw new Error('Shopify said no to the app keys (' + r.getResponseCode() + ')');
  var j = JSON.parse(r.getContentText());
  cache.put('shop_token', j.access_token, Math.min(21600, Math.max(60, (j.expires_in || 3600) - 300)));
  return { shop: shop, token: j.access_token };
}

var ORDERS_QUERY = 'query Orders($q: String) { orders(first: 50, sortKey: CREATED_AT, reverse: true, query: $q) { nodes { id name createdAt sourceName displayFinancialStatus cancelledAt customAttributes { key value } customer { firstName lastName } channelInformation { channelDefinition { channelName } } lineItems(first: 50) { nodes { title variantTitle sku quantity customAttributes { key value } } } } } }';

function fetchOrders_() {
  var t = shopToken_();
  var since = new Date(Date.now() - 36 * 3600 * 1000).toISOString();
  var r = UrlFetchApp.fetch('https://' + t.shop + '/admin/api/' + API_VERSION + '/graphql.json', {
    method: 'post', contentType: 'application/json', muteHttpExceptions: true,
    headers: { 'X-Shopify-Access-Token': t.token },
    payload: JSON.stringify({ query: ORDERS_QUERY, variables: { q: 'created_at:>' + since } })
  });
  if (r.getResponseCode() === 401) { CacheService.getScriptCache().remove('shop_token'); throw new Error('Shopify key expired or wrong'); }
  if (r.getResponseCode() !== 200) throw new Error('Shopify error ' + r.getResponseCode());
  var j = JSON.parse(r.getContentText());
  if (j.errors) {
    // Some fields need extra permission (customer names, sales channel). Try again without them.
    var q2 = ORDERS_QUERY.replace(' customer { firstName lastName }', '').replace(' channelInformation { channelDefinition { channelName } }', '');
    r = UrlFetchApp.fetch('https://' + t.shop + '/admin/api/' + API_VERSION + '/graphql.json', {
      method: 'post', contentType: 'application/json', muteHttpExceptions: true,
      headers: { 'X-Shopify-Access-Token': t.token },
      payload: JSON.stringify({ query: q2, variables: { q: 'created_at:>' + since } })
    });
    j = JSON.parse(r.getContentText());
    if (j.errors) throw new Error(String(j.errors[0] && j.errors[0].message || 'Shopify error').slice(0, 120));
  }
  return (j.data.orders.nodes || []).reverse();   // oldest first, so spots go in buying order
}
