/**
 * DON HUNT - optional helper menu for the Google Sheet.
 * Install once: in the sheet, Extensions > Apps Script, delete what's there,
 * paste this whole file, click Save, then reload the sheet.
 * A "DON HUNT" menu shows up with one-click buttons for new games.
 */

var TEMPLATES = {
  auction: 'TEMPLATE Auction',
  prefill: 'TEMPLATE Prefill',
  pack: 'TEMPLATE Pack',
  custom: 'TEMPLATE Custom'
};

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('DON HUNT')
    .addItem('New $1 auction game', 'newAuction')
    .addItem('New $10 pre-fill game', 'newPrefill')
    .addItem('New $30 pack game', 'newPack')
    .addItem('New custom auction game', 'newCustom')
    .addSeparator()
    .addItem('Put THIS tab live on a board', 'makeCurrentLive')
    .addItem('Clear owners + bids on THIS tab', 'clearCurrent')
    .addToUi();
}

function newAuction() { newGame_('auction'); }
function newPrefill() { newGame_('prefill'); }
function newPack() { newGame_('pack'); }
function newCustom() { newGame_('custom'); }

function newGame_(type) {
  var ss = SpreadsheetApp.getActive();
  var ui = SpreadsheetApp.getUi();
  var tpl = ss.getSheetByName(TEMPLATES[type]);
  if (!tpl) { ui.alert('Can\'t find the tab "' + TEMPLATES[type] + '".'); return; }
  var today = Utilities.formatDate(new Date(), ss.getSpreadsheetTimeZone(), 'M-d');
  var label = { auction: 'Auction', prefill: 'Prefill', pack: 'Pack', custom: 'Custom' }[type];
  var n = 1;
  while (ss.getSheetByName(today + ' ' + label + ' ' + n)) n++;
  var suggested = today + ' ' + label + ' ' + n;
  var res = ui.prompt('New ' + label + ' game', 'Name for the new tab (leave blank for "' + suggested + '"):', ui.ButtonSet.OK_CANCEL);
  if (res.getSelectedButton() !== ui.Button.OK) return;
  var name = res.getResponseText().trim() || suggested;
  if (ss.getSheetByName(name)) { ui.alert('A tab named "' + name + '" already exists.'); return; }
  var sh = tpl.copyTo(ss).setName(name);
  ss.setActiveSheet(sh);
  ss.moveActiveSheet(2);
  var live = ui.alert('Go live now?', 'Make "' + name + '" the live game on the ' + label + ' board right away?\n(Pick No to fill it in first.)', ui.ButtonSet.YES_NO);
  if (live === ui.Button.YES) setLive_(type, name);
}

function makeCurrentLive() {
  var ss = SpreadsheetApp.getActive();
  var ui = SpreadsheetApp.getUi();
  var sh = ss.getActiveSheet();
  if (String(sh.getRange('A1').getValue()).trim().toUpperCase() !== 'DON HUNT GAME') {
    ui.alert('This tab isn\'t a game tab (A1 should say DON HUNT GAME).'); return;
  }
  var res = ui.prompt('Put "' + sh.getName() + '" live', 'Which board? Type: auction, prefill, pack, custom (or a row name like auction-2)', ui.ButtonSet.OK_CANCEL);
  if (res.getSelectedButton() !== ui.Button.OK) return;
  setLive_(res.getResponseText().trim().toLowerCase(), sh.getName());
}

function setLive_(board, tabName) {
  var ss = SpreadsheetApp.getActive();
  var b = ss.getSheetByName('BOARDS');
  if (!b) { SpreadsheetApp.getUi().alert('Missing the BOARDS tab.'); return; }
  var vals = b.getRange(1, 1, Math.max(b.getLastRow(), 1), 1).getValues();
  for (var i = 1; i < vals.length; i++) {
    if (String(vals[i][0]).trim().toLowerCase() === board) {
      b.getRange(i + 1, 2).setNumberFormat('@').setValue(tabName);
      ss.toast('"' + tabName + '" is now live on the ' + board + ' board.', 'DON HUNT', 5);
      return;
    }
  }
  // no row yet: add one under the last board row
  var row = 2;
  while (String(b.getRange(row, 1).getValue()).trim() !== '') row++;
  b.insertRowBefore(row);
  b.getRange(row, 1, 1, 2).setNumberFormat('@').setValues([[board, tabName]]);
  ss.toast('Added a "' + board + '" row to BOARDS and put "' + tabName + '" live.', 'DON HUNT', 5);
}

function clearCurrent() {
  var ss = SpreadsheetApp.getActive();
  var ui = SpreadsheetApp.getUi();
  var sh = ss.getActiveSheet();
  if (String(sh.getRange('A1').getValue()).trim().toUpperCase() !== 'DON HUNT GAME') { ui.alert('This tab isn\'t a game tab.'); return; }
  if (ui.alert('Clear every owner, bid and hit on "' + sh.getName() + '"?', ui.ButtonSet.YES_NO) !== ui.Button.YES) return;
  var vals = sh.getRange(1, 1, sh.getLastRow(), 2).getValues();
  for (var i = 0; i < vals.length; i++) {
    var a = String(vals[i][0]).trim().toUpperCase(), bb = String(vals[i][1]).trim().toUpperCase();
    if ((a === 'SPOTS' || a === 'PACKS') && bb === 'OWNER') {
      sh.getRange(i + 2, 2, sh.getLastRow() - i - 1, 3).clearContent();
      ss.toast('Cleared.', 'DON HUNT', 3);
      return;
    }
  }
}
