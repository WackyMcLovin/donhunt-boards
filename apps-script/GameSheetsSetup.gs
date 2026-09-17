/**
 * Game sheet builder. Run createGameSheets() once from the Apps Script editor.
 * It makes four new Google Sheets in your Drive (RTYH, Pick Your Type, Case Break, Wall of Hits),
 * each already laid out for its board, every cell Plain text, shared "Anyone with the link: Viewer",
 * and logs the sheet IDs (also saved in Script Properties as SHEET_RTYH, SHEET_TYPES, SHEET_CASE, SHEET_HITS).
 * Running it again does NOT make duplicates: it skips any game whose sheet already exists.
 */
var GOLD = '#ffcc33', BLACK = '#111111', YELLOW = '#fff4c2', GREY = '#eeeeee';

function createGameSheets() {
  var props = PropertiesService.getScriptProperties();
  var games = [
    { key: 'RTYH', title: 'Board - Rip Till You Hit', build: buildRTYH_ },
    { key: 'TYPES', title: 'Board - Pick Your Type', build: buildTypes_ },
    { key: 'CASE', title: 'Board - Case Break', build: buildCase_ },
    { key: 'HITS', title: 'Board - Wall of Hits', build: buildHits_ }
  ];
  var folder = getFolder_('Stream Boards');
  games.forEach(function (g) {
    var existing = props.getProperty('SHEET_' + g.key);
    if (existing) {
      try { SpreadsheetApp.openById(existing); Logger.log(g.key + ' already exists: ' + existing); return; } catch (e) {}
    }
    var ss = SpreadsheetApp.create(g.title);
    var sh = ss.getSheets()[0].setName(g.key);
    sh.getRange(1, 1, sh.getMaxRows(), sh.getMaxColumns()).setNumberFormat('@');   // plain text everywhere
    g.build(sh);
    var file = DriveApp.getFileById(ss.getId());
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    file.moveTo(folder);
    props.setProperty('SHEET_' + g.key, ss.getId());
    Logger.log(g.key + ' created: ' + ss.getId() + '  ' + ss.getUrl());
  });
  Logger.log('IDS ' + JSON.stringify({
    rtyh: props.getProperty('SHEET_RTYH'), types: props.getProperty('SHEET_TYPES'),
    case: props.getProperty('SHEET_CASE'), hits: props.getProperty('SHEET_HITS')
  }));
}

function getFolder_(name) {
  var it = DriveApp.getFoldersByName(name);
  return it.hasNext() ? it.next() : DriveApp.createFolder(name);
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

// ---------- RTYH ----------
function buildRTYH_(sh) {
  var row = top_(sh, 'RIP TILL YOU HIT', 'Each buyer rips until they hit. Add a row at the bottom for each new ripper, update PACKS as you open, and type the HIT CARD when it lands (the board plays the HIT animation).');
  row = settings_(sh, row, [
    ['Title', 'RIP TILL YOU HIT', 'Big title'],
    ['Game', 'RTYH', 'Red tag'],
    ['Price Per Pack', '$6 / PACK', 'Gold price tag'],
    ['Hit Rule', 'Illustration Rare or better', 'What counts as a hit (shown on the board)'],
    ['Product', 'Booster packs', 'What is being ripped'],
    ['Status', 'LIVE', 'Small tag (blank hides it)'],
    ['Show Spend', 'NO', 'YES shows packs x price for the current ripper'],
    ['Celebrate Seconds', '10', 'How long the HIT animation stays up']
  ]);
  row = table_(sh, row, ['WHAT COUNTS AS A HIT', 'PICTURE'], [['Illustration Rare', ''], ['Special Illustration Rare', ''], ['Hyper Rare', '']], 2,
    '(Optional pictures show next to the hit rule. Use the Picture Link Maker for links.)');
  table_(sh, row, ['RIPPER', 'PACKS', 'HIT CARD', 'HIT PICTURE'], [['sample_buyer', '4', 'Sample Illustration Rare', ''], ['next_buyer', '2', '', '']], 60,
    '(Newest ripper at the bottom. The last row with no HIT CARD is the one ripping now.)');
}

// ---------- Pick Your Type ----------
function buildTypes_(sh) {
  var row = top_(sh, 'PICK YOUR TYPE', 'Buyers pick a type or color and get every card of that type from the break. Type the buyer next to their type. COLOR can be a name (red, blue...) or a hex code like #ff8800.');
  row = settings_(sh, row, [
    ['Title', 'COLOR HUNT', 'Big title'],
    ['Game', 'PICK YOUR TYPE', 'Red tag'],
    ['Price', '$15 A TYPE', 'Gold price tag'],
    ['Product', '', 'What is being opened'],
    ['Status', '', 'Blank = shows how many are taken'],
    ['Banner', 'Every card of your type is yours', 'Yellow banner (blank hides it)']
  ]);
  var t = [['Grass', '', 'green', ''], ['Fire', 'sample_buyer', 'fire', ''], ['Water', '', 'water', ''], ['Lightning', '', 'lightning', ''],
    ['Psychic', '', 'psychic', ''], ['Fighting', '', 'fighting', ''], ['Darkness', '', 'darkness', ''], ['Metal', '', 'metal', ''],
    ['Dragon', '', 'dragon', ''], ['Colorless', '', 'colorless', ''], ['Trainer', '', 'trainer', '']];
  row = table_(sh, row, ['TYPE', 'OWNER', 'COLOR', 'HITS'], t, 13, '(Up to 24 types. HITS is optional, e.g. "2 SIR".)');
  sh.getRange(row, 1).setValue('(One Piece colors example: Red, Green, Blue, Purple, Black, Yellow, Multicolor. Replace the TYPE column to switch.)').setFontColor('#777777');
}

// ---------- Case Break ----------
function buildCase_(sh) {
  var row = top_(sh, 'CASE BREAK', 'Track a full case: boxes (sealed / ripping / done), up to 24 spots, and a live hit feed. Add hits at the bottom of the HIT list and the board celebrates them.');
  row = settings_(sh, row, [
    ['Title', 'CASE BREAK', 'Big title'],
    ['Game', 'CASE BREAK', 'Red tag'],
    ['Product', 'Booster Box Case', 'Shown above the boxes'],
    ['Price', '$25 A SPOT', 'Gold price tag'],
    ['Status', 'LIVE', 'Small tag'],
    ['Banner', '', 'Yellow banner (blank hides it)'],
    ['Celebrate Seconds', '8', 'How long the HIT animation stays up']
  ]);
  var boxes = [];
  for (var b = 1; b <= 12; b++) boxes.push(['Box ' + b, b === 1 ? 'done' : (b === 2 ? 'ripping' : 'sealed'), b === 1 ? '2' : '']);
  row = table_(sh, row, ['BOX', 'STATUS', 'HITS'], boxes, 0, '(STATUS: sealed, ripping or done.)');
  var spots = [];
  for (var s = 1; s <= 24; s++) spots.push([String(s), s === 1 ? 'sample_buyer' : '']);
  row = table_(sh, row, ['SPOT', 'OWNER'], spots, 0, '(Up to 24 spots.)');
  table_(sh, row, ['HIT CARD', 'OWNER', 'PICTURE'], [['Sample Hit Card', 'sample_buyer', '']], 60, '(Newest hit at the bottom.)');
}

// ---------- Wall of Hits ----------
function buildHits_(sh) {
  var row = top_(sh, 'WALL OF HITS', 'Every big pull, newest at the bottom. The board spotlights the newest hit with an animation and shows the rest as a wall.');
  row = settings_(sh, row, [
    ['Title', 'HIT WALL', 'Big title'],
    ['Game', 'TONIGHT\'S HITS', 'Red tag'],
    ['Status', '', 'Small tag'],
    ['Rotate Seconds', '8', 'Cycle the spotlight through recent hits (0 = off)'],
    ['Celebrate Seconds', '10', 'How long the HIT animation stays up']
  ]);
  table_(sh, row, ['HIT CARD', 'BUYER', 'PICTURE', 'GAME', 'NOTE'],
    [['Sample Hit Card', 'sample_buyer', '', 'RTYH', 'in 4 packs']], 100, '(Newest hit at the bottom. PICTURE: any image link, Drive link, or use the Picture Link Maker.)');
}
