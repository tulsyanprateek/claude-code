/**
 * Attendance Logger — Google Apps Script backend (v3)
 * - Attendance data: "Attendance" tab (unchanged, your data is safe)
 * - Roster: "Team" tab (ID, Name, Role, Active, DOJ)
 * The original five keep IDs P/S/M/C/K so existing attendance rows still match.
 * New people get IDs E06, E07, ... DOJ (date of joining) is optional.
 */

const ATT_SHEET = 'Attendance';
const TEAM_SHEET = 'Team';
const ATT_HEADERS = ['Date', 'Code', 'Name', 'Entry', 'Exit', 'Status', 'Remarks', 'UpdatedAt'];
const TEAM_HEADERS = ['ID', 'Name', 'Role', 'Active', 'DOJ'];
const DEFAULT_TEAM = [
  ['P', 'Prateek', 'Owner', 'TRUE', ''],
  ['S', 'Suresh', 'Partner', 'TRUE', ''],
  ['M', 'Manish', 'Office boy', 'TRUE', ''],
  ['C', 'Chanchal', 'Staff', 'TRUE', ''],
  ['K', 'Sakshi', 'Staff', 'TRUE', '']
];

function doGet() {
  return HtmlService.createHtmlOutputFromFile('Index')
    .setTitle('Attendance')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no')
    .addMetaTag('apple-mobile-web-app-capable', 'yes')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/* ---------- PIN lock ---------- */
function pinProp_() { return PropertiesService.getScriptProperties(); }
function checkPin(entered) {
  var p = pinProp_().getProperty('PIN') || '1234';
  return String(entered) === String(p);
}
function changePin(current, next) {
  var props = pinProp_();
  var p = props.getProperty('PIN') || '1234';
  if (String(current) !== String(p)) return { ok: false };
  if (!/^\d{4}$/.test(String(next))) return { ok: false, err: 'PIN must be 4 digits' };
  props.setProperty('PIN', String(next));
  return { ok: true };
}

function attSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(ATT_SHEET);
  if (!sh) {
    sh = ss.insertSheet(ATT_SHEET);
    sh.getRange(1, 1, 1, ATT_HEADERS.length).setValues([ATT_HEADERS]).setFontWeight('bold');
    sh.setFrozenRows(1);
    sh.getRange('A:H').setNumberFormat('@');
  }
  return sh;
}

function teamSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(TEAM_SHEET);
  if (!sh) {
    sh = ss.insertSheet(TEAM_SHEET);
    sh.getRange(1, 1, 1, TEAM_HEADERS.length).setValues([TEAM_HEADERS]).setFontWeight('bold');
    sh.setFrozenRows(1);
    sh.getRange('A:E').setNumberFormat('@');
  }
  if (sh.getLastRow() < 2) {
    sh.getRange(2, 1, DEFAULT_TEAM.length, TEAM_HEADERS.length).setValues(DEFAULT_TEAM);
  }
  // Ensure DOJ column exists for sheets created by an older version
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

function getTeam() {
  const sh = teamSheet_();
  const data = sh.getDataRange().getValues();
  if (data.length < 2) return [];
  return data.slice(1).filter(function (r) { return r[0]; }).map(function (r) {
    return {
      id: String(r[0]).trim(),
      name: String(r[1]),
      role: String(r[2] || ''),
      active: String(r[3]).toUpperCase() !== 'FALSE',
      doj: r[4] ? fmtDate_(r[4]) : ''
    };
  });
}

function nextId_(team) {
  var max = 5;
  team.forEach(function (m) {
    var mm = /^E(\d+)$/.exec(m.id);
    if (mm) max = Math.max(max, parseInt(mm[1], 10));
  });
  return 'E' + String(max + 1).padStart(2, '0');
}

function addMember(name, role, doj) {
  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    const sh = teamSheet_();
    const team = getTeam();
    const id = nextId_(team);
    sh.appendRow([id, name, role || 'Staff', 'TRUE', doj || '']);
    return { id: id, name: name, role: role || 'Staff', active: true, doj: doj || '' };
  } finally { lock.releaseLock(); }
}

function updateMember(id, name, role, doj) {
  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    const sh = teamSheet_();
    const data = sh.getDataRange().getValues();
    for (var i = 1; i < data.length; i++) {
      if (String(data[i][0]).trim() === id) {
        sh.getRange(i + 1, 2).setValue(name);
        sh.getRange(i + 1, 3).setValue(role || '');
        sh.getRange(i + 1, 5).setValue(doj || '');
        return true;
      }
    }
    return false;
  } finally { lock.releaseLock(); }
}

function setMemberActive(id, active) {
  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    const sh = teamSheet_();
    const data = sh.getDataRange().getValues();
    for (var i = 1; i < data.length; i++) {
      if (String(data[i][0]).trim() === id) {
        sh.getRange(i + 1, 4).setValue(active ? 'TRUE' : 'FALSE');
        return true;
      }
    }
    return false;
  } finally { lock.releaseLock(); }
}

function getAllRecords() {
  const sh = attSheet_();
  const data = sh.getDataRange().getValues();
  if (data.length < 2) return [];
  return data.slice(1).filter(function (r) { return r[0]; }).map(function (r) {
    return {
      date: fmtDate_(r[0]),
      staff: String(r[1]).trim(),
      name: String(r[2]),
      entryTime: String(r[3] || ''),
      exitTime: String(r[4] || ''),
      status: String(r[5] || 'present'),
      remarks: String(r[6] || '')
    };
  });
}

function upsertRecord(rec) {
  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    const sh = attSheet_();
    const data = sh.getDataRange().getValues();
    const now = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm');
    const row = [rec.date, rec.staff, rec.name, rec.entryTime, rec.exitTime, rec.status, rec.remarks, now];
    for (var i = 1; i < data.length; i++) {
      if (fmtDate_(data[i][0]) === rec.date && String(data[i][1]).trim() === rec.staff) {
        sh.getRange(i + 1, 1, 1, ATT_HEADERS.length).setValues([row]);
        return rec;
      }
    }
    sh.appendRow(row);
    return rec;
  } finally { lock.releaseLock(); }
}

function deleteRecord(date, code) {
  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    const sh = attSheet_();
    const data = sh.getDataRange().getValues();
    for (var i = data.length - 1; i >= 1; i--) {
      if (fmtDate_(data[i][0]) === date && String(data[i][1]).trim() === code) {
        sh.deleteRow(i + 1);
      }
    }
    return true;
  } finally { lock.releaseLock(); }
}
