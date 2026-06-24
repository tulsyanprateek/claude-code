// PSA Dispatch Logger — Google Apps Script Backend
// Deploy as Web App: Execute as Me | Access: Anyone
// Sheet name: "dispatches"
// Columns: id | timestamp | date | recipientType | recipientName | channel | suppliersJson | remarks | waMessage

const SHEET_NAME = 'dispatches';
const HEADERS = ['id','timestamp','date','recipientType','recipientName','channel','suppliersJson','remarks','waMessage'];

function doGet(e) {
  const action = e.parameter.action || '';
  try {
    if (action === 'ping')   return json({ ok: true, time: new Date().toISOString() });
    if (action === 'list')   return json(listRecords(e.parameter));
    if (action === 'get')    return json(getRecord(e.parameter.id));
    if (action === 'delete') return json(deleteRecord(e.parameter.id));
    return json({ error: 'Unknown action' });
  } catch(err) {
    return json({ error: err.message });
  }
}

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const action = data.action || '';
    if (action === 'save') return json(saveRecord(data));
    return json({ error: 'Unknown action' });
  } catch(err) {
    return json({ error: err.message });
  }
}

// ── SAVE ──────────────────────────────────────────────────────
function saveRecord(data) {
  const sheet = getSheet();
  const row = HEADERS.map(h => data[h] || '');
  sheet.appendRow(row);
  return { ok: true, id: data.id };
}

// ── LIST ──────────────────────────────────────────────────────
function listRecords(params) {
  const sheet = getSheet();
  const limit  = parseInt(params.limit  || '50');
  const offset = parseInt(params.offset || '0');
  const search = (params.search || '').toLowerCase().trim();

  const all = sheet.getDataRange().getValues();
  if (all.length <= 1) return { records: [], total: 0 };

  // rows newest-first (skip header row)
  let rows = all.slice(1).reverse();

  if (search) {
    rows = rows.filter(r => {
      const text = r.join(' ').toLowerCase();
      return text.includes(search);
    });
  }

  const total = rows.length;
  const page  = rows.slice(offset, offset + limit);

  const records = page.map(r => {
    const obj = {};
    HEADERS.forEach((h, i) => obj[h] = r[i]);
    return obj;
  });

  return { records, total };
}

// ── GET ───────────────────────────────────────────────────────
function getRecord(id) {
  const sheet = getSheet();
  const all = sheet.getDataRange().getValues();
  for (let i = 1; i < all.length; i++) {
    if (all[i][0] == id) {
      const obj = {};
      HEADERS.forEach((h, j) => obj[h] = all[i][j]);
      return { record: obj };
    }
  }
  return { error: 'Not found' };
}

// ── DELETE ────────────────────────────────────────────────────
function deleteRecord(id) {
  const sheet = getSheet();
  const all = sheet.getDataRange().getValues();
  for (let i = 1; i < all.length; i++) {
    if (all[i][0] == id) {
      sheet.deleteRow(i + 1);
      return { ok: true };
    }
  }
  return { error: 'Not found' };
}

// ── HELPERS ───────────────────────────────────────────────────
function getSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    sheet.appendRow(HEADERS);
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, HEADERS.length).setFontWeight('bold');
  }
  return sheet;
}

function json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

// ── TEST FUNCTIONS ────────────────────────────────────────────
function testPing() {
  Logger.log(JSON.stringify({ ok: true, time: new Date().toISOString() }));
}

function testSave() {
  const result = saveRecord({
    id: `${Date.now()}_test`,
    timestamp: new Date().toISOString(),
    date: '2026-06-24',
    recipientType: 'Customer',
    recipientName: 'Amit Enterprises, Muzaffarpur',
    suppliersJson: JSON.stringify([{ supName: 'Bhagwati Prints, Surat', docs: [{ type: 'Bill', num: '1001', lr: true }] }]),
    remarks: 'Test entry — delete me',
    waMessage: 'TEST WA MESSAGE',
  });
  Logger.log(JSON.stringify(result));
}

function testList() {
  const result = listRecords({ limit: '10', offset: '0' });
  Logger.log(JSON.stringify(result));
}
