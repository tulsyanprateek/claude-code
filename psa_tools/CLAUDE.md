# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**PSA Tools** — the operational toolbox for Priyam Sales Agency. Mobile-first single-HTML-file tools, opened directly in phone browsers. No build step, no npm. Tools share the PSA brand package (`priyam-brand/`) and each has an optional Google Apps Script backend.

## Users
- **Prateek** (owner) — primary user
- **Chanchal** (data entry)
- **Manish** (field)

## Files

| File | Purpose |
|---|---|
| `psa_order_generator.html` | WA/WB order generator (~3870 lines). Two order types: WhatsApp text (WA) and A4 PNG image (WB). |
| `psa_order_backend.gs` | Apps Script backend for order generator. |
| `psa_dispatch_logger.html` | Document dispatch logger — logs docs sent by post, generates WA message. |
| `psa_dispatch_backend.gs` | Apps Script backend for dispatch logger. |
| `psa_attendance_logger.html` | Staff attendance logger — calendar grid, reports, PIN lock. |
| `psa_attendance_backend.gs` | Apps Script backend for attendance logger. |
| `psa_color_generator.html` | Standalone color utility tool. |
| `customer-dashboard/` | Offline customer/supplier dashboard (own project — see its README). Reads DBFs from `data-shadow/`. |
| `data-dump/` | Master-data extraction pipeline — reads `data-shadow/`, outputs customer/supplier/item/transport/station CSV+JSON masters. |
| `data-shadow/<FY>/` | Raw FoxPro DBF backups, synced nightly, one folder per fiscal year (e.g. `2627/`). Source for both `customer-dashboard/` and `data-dump/`. Not a tool. |
| `priyam-brand/priyam-brand.css` | PSA brand stylesheet — tokens, fonts, base styles. Link in every tool. |
| `priyam-brand/fonts/` | Self-hosted font files (Outfit, Hanken Grotesk, IBM Plex Mono, Noto Sans Devanagari). |
| `BACKEND_SETUP.md` | Step-by-step Google Sheets + Apps Script setup guide. |
| `PSA_ORDER_GENERATOR_KNOWLEDGE.md` | Deep knowledge file for the order generator — read before significant changes. |

## PSA Brand Package

All tools must link `./priyam-brand/priyam-brand.css` and use `--ps-*` CSS variables. Key tokens:

```css
--ps-gold: #FBAE1A          /* primary brand accent */
--ps-terracotta: #DF6D35    /* secondary accent */
--ps-gradient: linear-gradient(140deg, #FBAE1A, #DF6D35)
--ps-ink: #2B2B33           /* primary text */
--ps-font-display: 'Outfit'            /* headings, buttons */
--ps-font-body: 'Hanken Grotesk'       /* body copy */
--ps-font-mono: 'IBM Plex Mono'        /* labels, refs, numbers */
```

Fonts are self-hosted — work fully offline on phone browsers.

## Running / Testing

No build step. Open any HTML file directly in a browser or serve with `npx serve`.

**Order generator backend** (`psa_order_backend.gs`) test functions:
- `testGetCounters()` — verify counter sync
- `testSaveOrder()` — write a test row (delete manually afterwards)
- `testListOrders()` — verify list response

**Dispatch logger backend** (`psa_dispatch_backend.gs`) test functions:
- `testPing()` — health check
- `testSave()` — write a test row (delete manually afterwards)
- `testList()` — verify list response

Deploy any backend: Deploy > New deployment > Web app > Execute as Me > Access: Anyone.

## Order Generator Architecture (`psa_order_generator.html`)

Single file — `<style>` (~1100 lines) + `<body>` (markup) + `<script>` (~2700 lines).

**Script sections (approximate — drift after edits):**
- ~1781: `PSA_LOGO` base64, `BACKEND_URL`, `FY` constant
- ~1884: `LS` localStorage helper (`get/set/num`)
- ~1893: `SUPPLIERS` array (103 entries), `PARTIES` (268), `TRANSPORTS` (71)
- ~2612: `readForm()` — reads all form fields into a structured object
- ~2693: `buildMessage()` — generates WA text output
- ~2809: `buildA4HTML()` — generates the printable A4 form HTML (captured by html2canvas)
- ~2999: `copyMsg()` — WA flow: copy + share
- ~3068: `downloadImage()` — WB flow: html2canvas capture + native share / download
- ~3684: `initPWA()` — blob-URL manifest + service worker + canvas-generated icons
- ~3845: init block

**State variables:** `currentSeries` ('WA'|'WB'), `editingRowId` (non-empty = edit mode), `nextId`, `itemIds[]`, `mixState{}`, `subCounters{}`

**localStorage keys:** `psa_last_wa`, `psa_last_wb`, `psa_last_series`, `psa_theme`

**Counter semantic:** "last USED number". Display = stored + 1. After save: store current (not +1). Backend only advances counter if new value > current (prevents stale-device rollback).

### Order Generator Backend (`psa_order_backend.gs`)

Apps Script Web App. Both `doGet` and `doPost` route on an `action` parameter.

| action | Description |
|---|---|
| `ping` | Health check |
| `getCounters` | Returns `{ wa: N, wb: N }` from `counters` tab |
| `save` | Insert or update an order row. Non-empty `editingRowId` = update. |
| `list` | Returns orders newest-first. Supports `search`, `series`, `limit`, `offset`. |
| `get` | Single order by `id` |
| `delete` | Delete row by `id` |

Google Sheet: two tabs — `orders` (13 columns: `id | timestamp | series | orderNo | date | party | supplier | transport | docsThrough | totalBales | itemsJson | imageFilename | updatedAt`) and `counters` (`key | value` rows for `last_wa`, `last_wb`).

Order IDs: `timestamp_random` format (e.g. `1748234567890_abc12`).

## Dispatch Logger Architecture (`psa_dispatch_logger.html`)

Single file — CSS design system + HTML markup + JavaScript (~900 lines).

**Key config (top of `<script>`):**
```javascript
const BACKEND_URL = ''; // paste Apps Script Web App URL here
const DOC_TYPES = ['Bill','CN','DN','JV','Outstanding','Cheque','Other'];
const DEFAULT_CHANNELS = ['Speed Post','Courier','By Hand', ...];
```

**localStorage keys:** `psa_dispatch_channels` (custom channels list), `psa_dispatch_theme`, `psa_dispatch_records` (offline record cache), `psa_dispatch_master` (cached customers/suppliers from master sheet)

**Master data:** customers/suppliers autocomplete is fed from the shared PSA Master Data sheet via the backend's `getMasterData` action (localStorage-cached; hardcoded `SUPPLIERS`/`PARTIES` arrays are the offline fallback).

### Dispatch Logger Backend (`psa_dispatch_backend.gs`)

Google Sheet columns: `id | timestamp | date | recipientType | recipientName | channel | suppliersJson | remarks | waMessage`

Actions: `ping`, `save` (POST, `mode: 'no-cors'`), `list` (GET), `get` (GET), `delete` (GET), `getMasterData` (GET — customers/suppliers from the shared PSA Master Data sheet's `parties` tab, sorted by Bills FY).

## Critical Invariants — Order Generator (Do Not Break)

1. **A4 capture pipeline:** html2canvas clone rendered in an offscreen 794px container (no parent transforms), `document.fonts.ready` awaited before capture, `scrollX/scrollY: 0, x: 0, y: 0` passed, footer uses `position: relative` on the clone (not `absolute`).
2. **Counter logic:** `stored` = last used; display = `stored + 1`; after save, store current. Edits do NOT increment counters.
3. **`applySeriesTabVisibility()`** must be called after any series change or after `populateFormFromOrder()`.
4. **`updatePrimaryButtonLabel()`** must match both current series AND `editingRowId` state.
5. **Validation wrapper pattern:** `copyMsg` and `downloadImage` are reassigned at init to intercept and show the validation banner before proceeding. Do not bypass this.
6. **Backend POST uses `mode: 'no-cors'`** — response is unreadable by design; only GET calls can be read. Don't switch save/delete to expect a readable POST response.

## Item Data Structure (Order Generator)

```javascript
{
  bales: 3,
  name: "Chai Wala",        // PARTY / MERCHANT NUMBER (main, typed/searched) —
                             //   item master "Item Name" (ITNM)
  tradeNo: "Dhan Varsha",    // TRADE NUMBER (shared/canonical) — item master
                             //   "Barcode/Print Name" (B_CODE). One trade number
                             //   can have many party-number aliases. '' when it
                             //   equals the party number (single-name item).
  rate: "365",               // string
  isMix: true,
  subs: [{ name: "Subitem One", price: "300" }]
}
```

**Two-number rule:** the item-name field the user types/searches (`name`) is the
**party/merchant number** — e.g. "Chai Wala", "Riddhi Siddhi". `tradeNo` is the
**trade number** — the shared/canonical name (e.g. "Dhan Varsha") that many party
numbers can alias to. Outputs (WA text + A4 image) render `itemLabel()`/`itemLabelHTML()`:
`"<party> on <trade>"` when both exist and differ (e.g. `Riddhi Siddhi on Dhan Varsha`),
otherwise just the party number. Autocomplete suggestions always show `"<party> on <trade>"`,
falling back to the party number itself when no trade number is registered (e.g.
`Chai Wala on Chai Wala`) — this signals at a glance whether one exists yet.
In the item row, `tradeNo` auto-fills from the master when a matching item is picked
(shown as a small editable line under the name); `+ trade no.` reveals it for manual
entry — this is how you link a brand-new party name to an existing trade number.
Stored raw/uppercase; `displayCase` applied only at output.
Backend `getMasterData` serves both `item_name` (= Item Name, party number) and
`trade_no` (= Print Name, trade number; blanked when equal to item_name).
`PARTYNO` in `bill.dbf` is a denormalized copy of Item Name — NOT a real per-party
value — so no transaction mining is needed.

## Design Constraints (Always Apply)

- **PSA brand:** always link `./priyam-brand/priyam-brand.css`; use `--ps-*` tokens; Outfit for headings/buttons, Hanken Grotesk for body, IBM Plex Mono for labels and numbers.
- **Supplier display format:** Brand name + city only as the primary label. Parent company name shown as small secondary text. Never show internal codes in any UI or output.
- **Mobile-first** — minimum 44px tap targets, 16px font on inputs (prevents iOS zoom).
- **Supplier reports must never mention other suppliers** (cross-supplier price visibility is a business risk).
- Present a plain-text plan before coding significant changes.

## Before Editing

Always read the relevant section of the HTML before making changes — line numbers drift after every edit. Use uniquely-anchored strings for `str_replace`. After significant changes, open the file in a browser to verify layout and (for the order generator) the A4 preview and WA preview.
