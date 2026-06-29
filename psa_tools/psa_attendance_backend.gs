/**
 * PSA Attendance Logger — Apps Script REST backend
 * Deploy as Web App: Execute as Me, Access: Anyone.
 * doGet  → read actions (ping, getTeam, getAllRecords, checkPin, changePin)
 * doPost → write actions (upsertRecord, deleteRecord, addMember, updateMember, setMemberActive)
 */

const ATT_SHEET   = 'Attendance';
const TEAM_SHEET  = 'Team';
const ATT_HEADERS = ['Date', 'Code', 'Name', 'Entry', 'Exit', 'Status', 'Remarks', 'UpdatedAt'];
const TEAM_HEADERS = ['ID', 'Name', 'Role', 'Active', 'DOJ'];
const DEFAULT_TEAM = [
  ['P', 'Prateek',  'Owner',      'TRUE', ''],
  ['S', 'Suresh',   'Partner',    'TRUE', ''],
  ['M', 'Manish',   'Office boy', 'TRUE', ''],
  ['C', 'Chanchal', 'Staff',      'TRUE', ''],
  ['K', 'Sakshi',   'Staff',      'TRUE', '']
];

/* ── routing ── */

function doGet(e) {
  var action = (e && e.parameter && e.parameter.action) || 'ping';
  var p = e ? e.parameter : {};
  var result;
  try {
    if      (action === 'ping')          result = { ok: true };
    else if (action === 'getTeam')       result = getTeam();
    else if (action === 'getAllRecords')  result = getAllRecords();
    else if (action === 'checkPin')      result = { ok: checkPin_(p.pin) };
    else if (action === 'changePin')     result = changePin_(p.current, p.next);
    else                                 result = { error: 'unknown action' };
  } catch (err) {
    result = { error: String(err) };
  }
  return ContentService.createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  var body = {};
  try { body = JSON.parse(e.postData.contents); } catch (_) {}
  var action = body.action || '';
  var result;
  try {
    if      (action === 'upsertRecord')    result = upsertRecord(body);
    else if (action === 'deleteRecord')    result = deleteRecord(body.date, body.staff);
    else if (action === 'addMember')       result = addMember(body.id, body.name, body.role, body.doj);
    else if (action === 'updateMember')    result = updateMember(body.id, body.name, body.role, body.doj);
    else if (action === 'setMemberActive') result = setMemberActive(body.id, body.active);
    else                                   result = { error: 'unknown action' };
  } catch (err) {
    result = { error: String(err) };
  }
  return ContentService.createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}

/* ── PIN ── */

function pinProp_() { return PropertiesService.getScriptProperties(); }

function checkPin_(entered) {
  var p = pinProp_().getProperty('PIN') || '1234';
  return String(entered) === String(p);
}

function changePin_(current, next) {
  var props = pinProp_();
  var p = props.getProperty('PIN') || '1234';
  if (String(current) !== String(p)) return { ok: false };
  if (!/^\d{4}$/.test(String(next)))  return { ok: false, err: 'PIN must be 4 digits' };
  props.setProperty('PIN', String(next));
  return { ok: true };
}

/* ── sheet helpers ── */

function attSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(ATT_SHEET);
  if (!sh) {
    sh = ss.insertSheet(ATT_SHEET);
    sh.getRange(1, 1, 1, ATT_HEADERS.length).setValues([ATT_HEADERS]).setFontWeight('bold');
    sh.setFrozenRows(1);
    sh.getRange('A:H').setNumberFormat('@');
  }
  return sh;
}

function teamSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(TEAM_SHEET);
  if (!sh) {
    sh = ss.insertSheet(TEAM_SHEET);
    sh.getRange(1, 1, 1, TEAM_HEADERS.length).setValues([TEAM_HEADERS]).setFontWeight('bold');
    sh.setFrozenRows(1);
    sh.getRange('A:E').setNumberFormat('@');
  }
  if (sh.getLastRow() < 2) {
    sh.getRange(2, 1, DEFAULT_TEAM.length, TEAM_HEADERS.length).setValues(DEFAULT_TEAM);
  }
  // ensure DOJ column exists for older sheets
  var hdr = sh.getRange(1, 1, 1, 5).getValues()[0];
  if (String(hdr[4]).trim() !== 'DOJ') {
    sh.getRange(1, 5).setValue('DOJ').setFontWeight('bold');
    sh.getRange('E:E').setNumberFormat('@');
  }
  return sh;
}

function fmtDate_(v) {
  if (v instanceof Date) return Utilities.formatDate(v, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  return String(v).trim();
}

/* ── team ── */

function getTeam() {
  var sh   = teamSheet_();
  var data = sh.getDataRange().getValues();
  if (data.length < 2) return [];
  return data.slice(1).filter(function (r) { return r[0]; }).map(function (r) {
    return {
      id:     String(r[0]).trim(),
      name:   String(r[1]),
      role:   String(r[2] || ''),
      active: String(r[3]).toUpperCase() !== 'FALSE',
      doj:    r[4] ? fmtDate_(r[4]) : ''
    };
  });
}

function addMember(id, name, role, doj) {
  var lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    var sh = teamSheet_();
    sh.appendRow([id, name, role || 'Staff', 'TRUE', doj || '']);
    return { ok: true };
  } finally { lock.releaseLock(); }
}

function updateMember(id, name, role, doj) {
  var lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    var sh   = teamSheet_();
    var data = sh.getDataRange().getValues();
    for (var i = 1; i < data.length; i++) {
      if (String(data[i][0]).trim() === id) {
        sh.getRange(i + 1, 2).setValue(name);
        sh.getRange(i + 1, 3).setValue(role || '');
        sh.getRange(i + 1, 5).setValue(doj  || '');
        return { ok: true };
      }
    }
    return { ok: false };
  } finally { lock.releaseLock(); }
}

function setMemberActive(id, active) {
  var lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    var sh   = teamSheet_();
    var data = sh.getDataRange().getValues();
    for (var i = 1; i < data.length; i++) {
      if (String(data[i][0]).trim() === id) {
        sh.getRange(i + 1, 4).setValue(active ? 'TRUE' : 'FALSE');
        return { ok: true };
      }
    }
    return { ok: false };
  } finally { lock.releaseLock(); }
}

/* ── attendance records ── */

function getAllRecords() {
  var sh   = attSheet_();
  var data = sh.getDataRange().getValues();
  if (data.length < 2) return [];
  return data.slice(1).filter(function (r) { return r[0]; }).map(function (r) {
    return {
      date:      fmtDate_(r[0]),
      staff:     String(r[1]).trim(),
      name:      String(r[2]),
      entryTime: String(r[3] || ''),
      exitTime:  String(r[4] || ''),
      status:    String(r[5] || 'present'),
      remarks:   String(r[6] || '')
    };
  });
}

function upsertRecord(rec) {
  var lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    var sh   = attSheet_();
    var data = sh.getDataRange().getValues();
    var now  = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm');
    var row  = [rec.date, rec.staff, rec.name, rec.entryTime, rec.exitTime, rec.status, rec.remarks, now];
    for (var i = 1; i < data.length; i++) {
      if (fmtDate_(data[i][0]) === rec.date && String(data[i][1]).trim() === rec.staff) {
        sh.getRange(i + 1, 1, 1, ATT_HEADERS.length).setValues([row]);
        return { ok: true };
      }
    }
    sh.appendRow(row);
    return { ok: true };
  } finally { lock.releaseLock(); }
}

function deleteRecord(date, code) {
  var lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    var sh   = attSheet_();
    var data = sh.getDataRange().getValues();
    for (var i = data.length - 1; i >= 1; i--) {
      if (fmtDate_(data[i][0]) === date && String(data[i][1]).trim() === code) {
        sh.deleteRow(i + 1);
      }
    }
    return { ok: true };
  } finally { lock.releaseLock(); }
}

/* ── test helpers (run manually in Apps Script editor) ── */

function testPing()       { Logger.log(doGet({ parameter: { action: 'ping' } }));         }
function testGetTeam()    { Logger.log(JSON.stringify(getTeam()));                         }
function testGetRecords() { Logger.log(JSON.stringify(getAllRecords()));                   }
