/**
 * DON HUNT - PSA photo helper (Google Apps Script web app).
 * The live boards ask this script for a PSA cert's photo. The PSA token stays hidden here
 * (Project Settings > Script Properties > PSA_TOKEN), never in the public sheet or website.
 * - Only answers for cert numbers that appear in one of the sheet's CHASE tabs.
 * - Each cert is looked up at PSA once and remembered forever (saves the 100/day PSA limit).
 */
var SHEET_ID = '1YWSfMr9ftFPeGsUXoclpPvsU_0MdxABGt61lfP-ndqU';
var PSA = 'https://api.psacard.com/publicapi/cert/';

function doGet(e) {
  var cert = String((e && e.parameter && e.parameter.cert) || '').replace(/\D/g, '');
  if (!/^\d{6,10}$/.test(cert)) return out_({ ok: false, error: 'Not a PSA cert number.' });

  var props = PropertiesService.getScriptProperties();
  var saved = props.getProperty('c_' + cert);
  if (saved) return out_(JSON.parse(saved));

  var cache = CacheService.getScriptCache();
  var recentFail = cache.get('n_' + cert);
  if (recentFail) return out_(JSON.parse(recentFail));

  if (!certInSheet_(cert)) return out_({ ok: false, error: 'Cert ' + cert + ' is not in a CHASE tab of the DON HUNT sheet.' });

  var token = props.getProperty('PSA_TOKEN');
  if (!token) return out_({ ok: false, error: 'The PSA token has not been added to the PSA helper script yet.' });

  var lock = LockService.getScriptLock();
  lock.tryLock(15000);
  try {
    saved = props.getProperty('c_' + cert);
    if (saved) return out_(JSON.parse(saved));

    var imgs = psa_('GetImagesByCertNumber/' + cert, token);
    if (!imgs.ok) {
      cache.put('n_' + cert, JSON.stringify(imgs), imgs.code === 429 ? 3600 : 600);
      return out_(imgs);
    }
    var list = Array.isArray(imgs.data) ? imgs.data : ((imgs.data && (imgs.data.Images || imgs.data.images)) || []);
    var front = '', back = '';
    list.forEach(function (i) {
      var url = i.ImageURL || i.ImageUrl || i.imageURL || i.imageUrl || i.url || '';
      var isFront = (i.IsFrontImage !== undefined) ? i.IsFrontImage : i.isFrontImage;
      if (isFront === true && !front) front = url;
      else if (isFront === false && !back) back = url;
    });
    if (!front && list.length) front = list[0].ImageURL || list[0].ImageUrl || '';
    if (!front) {
      var none = { ok: false, error: 'PSA has no photos for cert ' + cert + ' yet.' };
      cache.put('n_' + cert, JSON.stringify(none), 3600);
      return out_(none);
    }

    var label = '';
    var info = psa_('GetByCertNumber/' + cert, token);
    if (info.ok && info.data) {
      var c = info.data.PSACert || info.data.psaCert || {};
      var grade = String(c.CardGrade || c.GradeDescription || '').replace(/^PSA\s*/i, '');
      label = [c.Subject, grade ? 'PSA ' + grade : ''].filter(String).join(' ');
    }

    var val = { ok: true, cert: cert, front: front, back: back, label: label };
    props.setProperty('c_' + cert, JSON.stringify(val));
    return out_(val);
  } finally {
    lock.releaseLock();
  }
}

function psa_(path, token) {
  var r = UrlFetchApp.fetch(PSA + path, { headers: { Authorization: 'bearer ' + token }, muteHttpExceptions: true });
  var code = r.getResponseCode();
  if (code !== 200) {
    var msg = code === 429 ? 'PSA daily limit reached (100 lookups). It resets tomorrow.'
      : code === 401 ? 'PSA rejected the token. Update PSA_TOKEN in the helper script.'
      : code === 403 ? 'PSA has not approved this account for API access yet (collectors-apis@collectors.com).'
      : 'PSA lookup failed (' + code + ').';
    return { ok: false, code: code, error: msg };
  }
  try { return { ok: true, data: JSON.parse(r.getContentText()) }; }
  catch (err) { return { ok: false, code: code, error: 'PSA sent something unexpected.' }; }
}

// Is this cert typed anywhere in a tab whose name contains "CHASE"? (stops strangers burning the PSA limit)
function certInSheet_(cert) {
  var cache = CacheService.getScriptCache();
  var text = cache.get('chasetext');
  if (text && text.indexOf(cert) >= 0) return true;
  if (cache.get('chasetext_fresh')) return false;   // just re-read the sheet, don't hammer it
  text = readChaseTabs_();
  cache.put('chasetext', text.slice(0, 95000), 300);
  cache.put('chasetext_fresh', '1', 10);
  return text.indexOf(cert) >= 0;
}

function readChaseTabs_() {
  var base = 'https://docs.google.com/spreadsheets/d/' + SHEET_ID;
  var html = UrlFetchApp.fetch(base + '/htmlview', { muteHttpExceptions: true }).getContentText();
  var re = /items\.push\(\{name:\s*"((?:[^"\\]|\\.)*)",\s*pageUrl:\s*"(?:[^"\\]|\\.)*",\s*gid:\s*"(\d+)"/g;
  var m, parts = [];
  while ((m = re.exec(html))) {
    if (!/chase/i.test(m[1])) continue;
    var csv = UrlFetchApp.fetch(base + '/export?format=csv&gid=' + m[2], { muteHttpExceptions: true }).getContentText();
    parts.push(csv.slice(0, 15000));
  }
  return parts.join('\n');
}

function out_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

// Run this once from the editor after adding PSA_TOKEN to check everything works.
function testSetup() {
  var token = PropertiesService.getScriptProperties().getProperty('PSA_TOKEN');
  Logger.log(token ? 'PSA_TOKEN is set.' : 'PSA_TOKEN is missing: Project Settings > Script Properties > Add property.');
  Logger.log('Chase tabs text length: ' + readChaseTabs_().length);
}
