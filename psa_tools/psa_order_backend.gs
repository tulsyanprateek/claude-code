/**
 * Priyam Sales Agency - Order Backend (v2 with CRUD)
 *
 * SETUP (first-time):
 *   1. Create Google Sheet with two tabs: "orders" and "counters"
 *   2. orders tab row 1 headers:
 *      id | timestamp | series | orderNo | date | party | supplier | transport | docsThrough | totalBales | itemsJson | imageFilename | updatedAt
 *   3. counters tab:
 *      A1: key       B1: value
 *      A2: last_wa   B2: 1000
 *      A3: last_wb   B3: 1000
 *   4. Extensions > Apps Script > paste this code
 *   5. Deploy > New deployment > Web app > Execute as Me > Access Anyone > Deploy
 *   6. Copy the /exec URL and paste into priyam_order_generator_v3.html
 *
 * IF UPGRADING from v1 (old single-action backend):
 *   - Add two new columns to orders tab: "id" (as column A, leftmost) and "updatedAt" (as last column)
 *   - For existing rows, fill id column with: =ROW()&"_"&TEXT(RAND(),"00000") in A2, drag down. Then copy and Paste Special > Values only.
 *   - Replace this code, save, then:
 *     Deploy > Manage deployments > pencil icon > Version: New version > Deploy
 *     (Keeps your existing /exec URL — no HTML change needed.)
 */

const SHEET_ID = '';
const ORDERS_TAB = 'orders';
const COUNTERS_TAB = 'counters';

// Shared "PSA Master Data" backend — suppliers/parties/transports live there,
// not in this spreadsheet. See psa_masterdata_backend.gs.
const MASTERDATA_URL = 'https://script.google.com/macros/s/AKfycbx9VpJNCEE6N9voWTusBvbEM100kyJH3yQNVLkI-RucjhhBnPZbFNpux9LTXTNLzZ5TIg/exec';

function jsonResponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function getSheet(tabName) {
  const ss = SHEET_ID ? SpreadsheetApp.openById(SHEET_ID) : SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(tabName);
  if (!sheet) throw new Error('Tab not found: ' + tabName);
  return sheet;
}

// ─────────────────────────────────────────────
// ROUTING
// ─────────────────────────────────────────────

function doGet(e) {
  try {
    const action = (e.parameter.action || 'ping').toLowerCase();
    let result;

    switch (action) {
      case 'ping':
        result = { ok: true, message: 'Priyam Sales backend is alive', time: new Date().toISOString() };
        break;
      case 'getcounters':
        result = getCounters();
        break;
      case 'getmasterdata':
        result = getMasterData();
        break;
      case 'list':
        result = listOrders({
          limit: parseInt(e.parameter.limit) || 50,
          offset: parseInt(e.parameter.offset) || 0,
          search: e.parameter.search || '',
          series: e.parameter.series || ''
        });
        break;
      case 'get':
        result = getOrder(e.parameter.id);
        break;
      case 'save':
        result = saveOrder(JSON.parse(e.parameter.data || '{}'));
        break;
      case 'delete':
        result = deleteOrder(e.parameter.id);
        break;
      default:
        result = { ok: false, error: 'Unknown action: ' + action };
    }

    return jsonResponse(result);
  } catch (err) {
    return jsonResponse({ ok: false, error: err.toString() });
  }
}

function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents || '{}');
    const action = (body.action || '').toLowerCase();
    let result;

    switch (action) {
      case 'save':
        result = saveOrder(body.data || {});
        break;
      case 'delete':
        result = deleteOrder(body.id);
        break;
      case 'list':
        result = listOrders(body);
        break;
      case 'get':
        result = getOrder(body.id);
        break;
      case 'getcounters':
        result = getCounters();
        break;
      default:
        result = { ok: false, error: 'Unknown action: ' + action };
    }

    return jsonResponse(result);
  } catch (err) {
    return jsonResponse({ ok: false, error: err.toString() });
  }
}

// ─────────────────────────────────────────────
// COUNTERS
// ─────────────────────────────────────────────

function getCounters() {
  const sheet = getSheet(COUNTERS_TAB);
  const rows = sheet.getDataRange().getValues();
  const counters = {};
  for (let i = 1; i < rows.length; i++) {
    const key = String(rows[i][0] || '').trim();
    const val = rows[i][1];
    if (key) counters[key] = val;
  }
  return {
    ok: true,
    wa: parseInt(counters.last_wa) || 1000,
    wb: parseInt(counters.last_wb) || 1000
  };
}

function updateCounter(key, value) {
  if (!value || isNaN(value)) return;
  const sheet = getSheet(COUNTERS_TAB);
  const rows = sheet.getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][0] || '').trim() === key) {
      const current = parseInt(rows[i][1]) || 0;
      if (value > current) {
        sheet.getRange(i + 1, 2).setValue(value);
      }
      return;
    }
  }
  sheet.appendRow([key, value]);
}

// ─────────────────────────────────────────────
// MASTER DATA — suppliers/parties/transports, sourced from the shared
// PSA Master Data sheet (ERP export), reshaped into what the order
// generator's front-end (MasterData object) expects.
// ─────────────────────────────────────────────

function getMasterData() {
  if (!MASTERDATA_URL) return { ok: false, error: 'MASTERDATA_URL not configured' };

  let raw;
  try {
    const resp = UrlFetchApp.fetch(MASTERDATA_URL + '?action=getMasterData', { muteHttpExceptions: true });
    raw = JSON.parse(resp.getContentText());
  } catch (err) {
    return { ok: false, error: 'Master data fetch failed: ' + err.toString() };
  }
  if (!raw || !raw.ok) return { ok: false, error: 'Master data backend returned an error' };

  const allParties = raw.parties || [];

  const suppliers = allParties
    .filter(function(p) { return p['Party Type'] === 'Supplier'; })
    .map(function(p) {
      return {
        firm_code:  p['Party Code'] || '',
        firm_name:  p['Party Name'] || '',
        brand_name: p['Party Name'] || '', // ERP has no separate brand alias yet — same as firm_name
        brand_code: p['Party Code'] || '',
        city:       p['City'] || '',
        active:     true
      };
    });

  const parties = allParties
    .filter(function(p) { return p['Party Type'] === 'Customer'; })
    .map(function(p) {
      return {
        name:    p['Party Name'] || '',
        city:    p['City'] || '',
        station: p['City'] || '',
        gstin:   p['GST No'] || '',
        active:  true
      };
    });

  const transports = (raw.transports || []).map(function(t) {
    return { name: t['Transport Name'] || '', destination_station: '' };
  });

  return {
    ok: true,
    masterGroups: [],
    suppliers: suppliers,
    parties: parties,
    transports: transports,
    items: [], // ERP item catalog not wired in yet (different shape — needs its own mapping)
    docOptions: [],
    generatedAt: raw.generatedAt || new Date().toISOString()
  };
}

// ─────────────────────────────────────────────
// ORDERS — CRUD
// ─────────────────────────────────────────────

function generateId() {
  return String(Date.now()) + '_' + Math.random().toString(36).substring(2, 7);
}

// Column indexes (1-based)
const COL_ID = 1;
const COL_TIMESTAMP = 2;
const COL_SERIES = 3;
const COL_ORDERNO = 4;
const COL_DATE = 5;
const COL_PARTY = 6;
const COL_SUPPLIER = 7;
const COL_TRANSPORT = 8;
const COL_DOCS = 9;
const COL_TOTAL = 10;
const COL_ITEMS_JSON = 11;
const COL_IMAGE_FILENAME = 12;
const COL_UPDATED_AT = 13;
const NUM_COLS = 13;

function findRowById(id) {
  if (!id) return -1;
  const sheet = getSheet(ORDERS_TAB);
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return -1;
  const ids = sheet.getRange(2, COL_ID, lastRow - 1, 1).getValues();
  for (let i = 0; i < ids.length; i++) {
    if (String(ids[i][0]) === String(id)) return i + 2;
  }
  return -1;
}

function rowToObject(rowValues) {
  let items = [];
  try { items = JSON.parse(rowValues[COL_ITEMS_JSON - 1] || '[]'); } catch (e) { items = []; }
  return {
    id: String(rowValues[COL_ID - 1] || ''),
    timestamp: rowValues[COL_TIMESTAMP - 1],
    series: rowValues[COL_SERIES - 1] || '',
    orderNo: String(rowValues[COL_ORDERNO - 1] || ''),
    date: rowValues[COL_DATE - 1] || '',
    party: rowValues[COL_PARTY - 1] || '',
    supplier: rowValues[COL_SUPPLIER - 1] || '',
    transport: rowValues[COL_TRANSPORT - 1] || '',
    docsThrough: rowValues[COL_DOCS - 1] || '',
    totalBales: parseFloat(rowValues[COL_TOTAL - 1]) || 0,
    items: items,
    imageFilename: rowValues[COL_IMAGE_FILENAME - 1] || '',
    updatedAt: rowValues[COL_UPDATED_AT - 1] || ''
  };
}

function saveOrder(data) {
  if (!data.orderNo) {
    return { ok: false, error: 'orderNo is required' };
  }

  const sheet = getSheet(ORDERS_TAB);
  const now = new Date();
  const editingRowId = data.editingRowId || '';

  let rowIdx = -1;
  let id = '';
  let originalTimestamp = now;

  if (editingRowId) {
    rowIdx = findRowById(editingRowId);
    if (rowIdx > 0) {
      id = editingRowId;
      originalTimestamp = sheet.getRange(rowIdx, COL_TIMESTAMP).getValue() || now;
    }
  }

  if (rowIdx < 0) {
    id = generateId();
    rowIdx = sheet.getLastRow() + 1;
  }

  const row = [
    id,
    originalTimestamp,
    data.series || '',
    data.orderNo || '',
    data.date || '',
    data.party || '',
    data.supplier || '',
    data.transport || '',
    data.docsThrough || '',
    parseFloat(data.totalBales) || 0,
    JSON.stringify(data.items || []),
    data.imageFilename || '',
    editingRowId ? now : ''
  ];

  sheet.getRange(rowIdx, 1, 1, NUM_COLS).setValues([row]);

  if (!editingRowId && (data.series === 'WA' || data.series === 'WB')) {
    updateCounter('last_' + data.series.toLowerCase(), parseInt(data.orderNo));
  }

  return {
    ok: true,
    id: id,
    orderNo: data.orderNo,
    series: data.series,
    wasUpdate: !!editingRowId,
    savedAt: now.toISOString()
  };
}

function getOrder(id) {
  if (!id) return { ok: false, error: 'id required' };
  const sheet = getSheet(ORDERS_TAB);
  const rowIdx = findRowById(id);
  if (rowIdx < 0) return { ok: false, error: 'Order not found' };
  const row = sheet.getRange(rowIdx, 1, 1, NUM_COLS).getValues()[0];
  return { ok: true, order: rowToObject(row) };
}

function deleteOrder(id) {
  if (!id) return { ok: false, error: 'id required' };
  const sheet = getSheet(ORDERS_TAB);
  const rowIdx = findRowById(id);
  if (rowIdx < 0) return { ok: false, error: 'Order not found' };
  sheet.deleteRow(rowIdx);
  return { ok: true, deletedId: id };
}

function listOrders(opts) {
  opts = opts || {};
  const limit = Math.min(parseInt(opts.limit) || 50, 200);
  const offset = parseInt(opts.offset) || 0;
  const search = (opts.search || '').toString().toLowerCase().trim();
  const seriesFilter = (opts.series || '').toString().toUpperCase().trim();

  const sheet = getSheet(ORDERS_TAB);
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return { ok: true, orders: [], total: 0 };

  const allRows = sheet.getRange(2, 1, lastRow - 1, NUM_COLS).getValues();

  // Newest first
  let orders = allRows.map(rowToObject).reverse();

  if (seriesFilter) {
    orders = orders.filter(function(o) { return String(o.series).toUpperCase() === seriesFilter; });
  }
  if (search) {
    orders = orders.filter(function(o) {
      return (
        String(o.orderNo).toLowerCase().indexOf(search) >= 0 ||
        String(o.party).toLowerCase().indexOf(search) >= 0 ||
        String(o.supplier).toLowerCase().indexOf(search) >= 0 ||
        String(o.transport).toLowerCase().indexOf(search) >= 0
      );
    });
  }

  const total = orders.length;
  orders = orders.slice(offset, offset + limit);

  // Format date/timestamp for client
  orders.forEach(function(o) {
    if (o.timestamp instanceof Date) o.timestamp = o.timestamp.toISOString();
    if (o.date instanceof Date) o.date = Utilities.formatDate(o.date, 'GMT', 'yyyy-MM-dd');
    if (o.updatedAt instanceof Date) o.updatedAt = o.updatedAt.toISOString();
  });

  return { ok: true, orders: orders, total: total, offset: offset, limit: limit };
}

// ─────────────────────────────────────────────
// TESTS
// ─────────────────────────────────────────────

function testGetCounters() { Logger.log(JSON.stringify(getCounters())); }

function testGetMasterData() {
  const result = getMasterData();
  Logger.log('ok: ' + result.ok);
  Logger.log('suppliers: ' + (result.suppliers || []).length);
  Logger.log('parties: ' + (result.parties || []).length);
  Logger.log('transports: ' + (result.transports || []).length);
  Logger.log('sample supplier: ' + JSON.stringify(result.suppliers && result.suppliers[0]));
}

function testSaveOrder() {
  const result = saveOrder({
    series: 'WA',
    orderNo: '9999',
    date: '2026-05-13',
    party: 'Test Party, Muzaffarpur',
    supplier: 'Test Supplier, TS, Surat',
    transport: 'Test Transport to Muzaffarpur',
    docsThrough: 'Bank',
    totalBales: 5,
    items: [{ bales: 5, name: 'Test Item', rate: '100', isMix: false, subs: [] }],
    imageFilename: '9999 Test Party.png'
  });
  Logger.log(JSON.stringify(result));
}

function testListOrders() { Logger.log(JSON.stringify(listOrders({ limit: 10 }))); }
