/**
 * PSA Master Data Backend
 *
 * Shared reference data (parties, items, transports, stations) used by ALL
 * psa_tools apps (order generator, dispatch logger, ...). This is a separate
 * spreadsheet from any tool's own transactional sheet (orders, dispatch log,
 * attendance log) — those stay exactly as they are.
 *
 * Data flow:
 *   FoxPro ERP (Kpbkup) -> extract_master_data.py -> data-dump/*.json
 *     -> push_to_sheets.py -> this backend's `importMaster` action
 *     -> each tool's own backend calls `getMasterData` on this same sheet
 *
 * SETUP (first-time):
 *   1. Create a new Google Sheet named "PSA Master Data" (tabs are created
 *      automatically by importMaster — no need to pre-create them).
 *   2. Extensions > Apps Script > paste this file's contents.
 *   3. Deploy > New deployment > Web app > Execute as Me > Access: Anyone > Deploy.
 *   4. Copy the /exec URL, set it as PSA_MASTERDATA_URL when running push_to_sheets.py.
 */

const SHEET_ID = ''; // leave blank to use the spreadsheet this script is bound to

const DATASETS = {
  parties:    'parties',
  items:      'items',
  transports: 'transports',
  stations:   'stations'
};

function jsonResponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function getSpreadsheet() {
  return SHEET_ID ? SpreadsheetApp.openById(SHEET_ID) : SpreadsheetApp.getActiveSpreadsheet();
}

function getOrCreateSheet(tabName) {
  const ss = getSpreadsheet();
  let sheet = ss.getSheetByName(tabName);
  if (!sheet) sheet = ss.insertSheet(tabName);
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
        result = { ok: true, message: 'PSA Master Data backend is alive', time: new Date().toISOString() };
        break;
      case 'getmasterdata':
        result = getMasterData();
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
      case 'importmaster':
        result = importMaster(body.dataset, body.rows);
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
// IMPORT — overwrite one dataset's tab from freshly-extracted rows
// ─────────────────────────────────────────────

function importMaster(dataset, rows) {
  const tabName = DATASETS[dataset];
  if (!tabName) return { ok: false, error: 'Unknown dataset: ' + dataset };
  if (!Array.isArray(rows)) return { ok: false, error: 'rows must be an array' };

  const sheet = getOrCreateSheet(tabName);
  sheet.clearContents();

  if (rows.length === 0) {
    return { ok: true, dataset: dataset, rowsWritten: 0 };
  }

  const headers = Object.keys(rows[0]);
  const values = [headers].concat(rows.map(function(r) {
    return headers.map(function(h) {
      const v = r[h];
      return (v === undefined || v === null) ? '' : v;
    });
  }));

  sheet.getRange(1, 1, values.length, headers.length).setValues(values);
  PropertiesService.getScriptProperties().setProperty('lastImport_' + dataset, new Date().toISOString());

  return { ok: true, dataset: dataset, rowsWritten: rows.length };
}

// ─────────────────────────────────────────────
// READ — return all datasets as JSON, keyed by their sheet headers
// ─────────────────────────────────────────────

function readTabAsObjects(tabName) {
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName(tabName);
  if (!sheet) return [];
  const values = sheet.getDataRange().getValues();
  if (values.length < 2) return [];
  const headers = values[0];
  return values.slice(1).map(function(row) {
    const obj = {};
    headers.forEach(function(h, i) { obj[h] = row[i]; });
    return obj;
  });
}

function getMasterData() {
  const props = PropertiesService.getScriptProperties();
  return {
    ok: true,
    parties:    readTabAsObjects(DATASETS.parties),
    items:      readTabAsObjects(DATASETS.items),
    transports: readTabAsObjects(DATASETS.transports),
    stations:   readTabAsObjects(DATASETS.stations),
    lastImportedAt: {
      parties:    props.getProperty('lastImport_parties')    || '',
      items:      props.getProperty('lastImport_items')      || '',
      transports: props.getProperty('lastImport_transports') || '',
      stations:   props.getProperty('lastImport_stations')   || ''
    },
    generatedAt: new Date().toISOString()
  };
}

// ─────────────────────────────────────────────
// TESTS
// ─────────────────────────────────────────────

function testPing() { Logger.log(JSON.stringify({ ok: true, message: 'pong' })); }

function testImportSmall() {
  const result = importMaster('stations', [
    { 'Station/City': 'TEST STATION', 'Status Code': 'C' }
  ]);
  Logger.log(JSON.stringify(result));
}

function testGetMasterData() {
  const result = getMasterData();
  Logger.log('parties: ' + result.parties.length);
  Logger.log('items: ' + result.items.length);
  Logger.log('transports: ' + result.transports.length);
  Logger.log('stations: ' + result.stations.length);
}
