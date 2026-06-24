# PSA Order Generator — Knowledge File
**Project:** Priyam Sales Agency Order Generator  
**Current file:** `priyam_order_generator_v3.html`  
**Status:** Stable, production-ready. This is v1 of the new edition. All future changes build from here.  
**File size:** ~209KB, 3866 lines  
**Last updated:** June 2026

---

## 1. Business Context

**Priyam Sales Agency (PSA)** — B2B textile commission agency, Muzaffarpur, Bihar.  
- Sends orders to suppliers (Surat, Jetpur, Pali-Marwar, Burhanpur, Mathura, Balotra)
- Customers are stockists across North Bihar
- No capital deployed — orders dispatched on credit, PSA earns commission at year end
- Daily tool usage by Prateek (owner, mobile-first), Chanchal (data entry), Manish (field)

**Two order types:**
- **WA (WhatsApp):** Text-based order → copy and forward via WhatsApp
- **WB (Image):** Generates a printable A4 PNG → share/download image

---

## 2. File Architecture

Single self-contained HTML file. No build step. No dependencies except CDN scripts.

```
priyam_order_generator_v3.html
├── <head>
│   ├── CDN: html2canvas 1.4.1
│   ├── Fonts: Inter (body), JetBrains Mono (numbers/codes), Manrope (legacy A4)
│   └── CSS (~1100 lines)
│       ├── Theme variables (:root + [data-theme="light"])
│       ├── Layout / topbar / form / preview
│       ├── Item cards, subitems
│       ├── Action buttons, modal, history
│       ├── Validation banner
│       ├── Print stylesheet (@media print)
│       └── Mobile RWD breakpoints (780px, 480px)
├── <body>
│   ├── .topbar (hamburger menu + FY badge)
│   ├── .settings-menu (dropdown: theme, past orders, install, about)
│   ├── .fb-banner (sticky feedback banner, full-width)
│   ├── .layout (CSS grid: 460px form | 1fr preview)
│   │   ├── .form-side
│   │   │   ├── .edit-banner (orange, shown in edit mode)
│   │   │   ├── Order Info (series toggle WA/WB, OFR number, date)
│   │   │   ├── Party & Supplier (autocomplete dropdowns)
│   │   │   ├── Transport + Send Documents Through
│   │   │   ├── Items (item cards with MIX toggle)
│   │   │   ├── + Add Item button
│   │   │   ├── Validation banner
│   │   │   └── Action buttons (Save & Share + Print | New Order)
│   │   └── .preview-side
│   │       ├── #panel-wa (WhatsApp preview, shown in WA mode)
│   │       └── #panel-a4 (A4 image preview, shown in WB mode)
│   └── #historyModal (past orders modal)
└── <script> (~2700 lines)
    ├── Constants: FY, PSA_LOGO, BACKEND_URL
    ├── LS helper (localStorage wrapper)
    ├── Data: SUPPLIERS (103), PARTIES (268), TRANSPORTS (71), DOCS_OPTIONS (7)
    ├── State: currentSeries, editingRowId, nextId, itemIds, mixState, subCounters
    ├── Autocomplete system (acOpen/acClose/acFilter/acSelect/acKey)
    ├── Item management (addItem, removeItem, toggleMix, addSub, removeSub)
    ├── Preview builders (buildMessage, buildPreviewHTML, buildA4HTML)
    ├── Form reader (readForm)
    ├── Save actions (copyMsg, downloadImage → both do save + share)
    ├── Backend (backendSave, backendList, backendGetOne, backendDelete, backendGetCounters)
    ├── History CRUD (openHistory, loadHistory, renderHistory, loadOrderForEdit, deleteHistoryOrder)
    ├── Edit mode (enterEditMode, exitEditMode, populateFormFromOrder)
    ├── Theme & Settings (setTheme, toggleSettings, closeSettings)
    ├── Validation (validateOrder, showValidationBanner, cancelValidation, proceedAnyway)
    ├── Share (copyMsg does copy+WA share; downloadImage does image+native share)
    ├── Print (printOrder)
    ├── PWA (initPWA, generatePWAIcons, triggerInstall)
    └── Init block (line 3845)
```

---

## 3. Design System

### Typography
| Usage | Font | Weight |
|---|---|---|
| Body / labels / buttons | Inter | 400–700 |
| OFR number, rates, counters | JetBrains Mono | 400–600 |
| A4 form content | Manrope | 400–800 |

### Colors (CSS Variables)

**Brand accents (same in both themes):**
```
--orange:    #E16E35   (primary data emphasis, CTAs)
--gold:      #C8940A   (secondary accent)
--gold-dim:  #FDAF1B   (softer gold for badges)
--green:     #1E9152   (WA save button)
--red:       #D04040   (errors, delete)
```

**Dark theme (default):**
```
--bg:      #0A0A0B    (page background)
--bg2:     #111114    (topbar, form side)
--bg3:     #18181C    (inputs, cards)
--surface: #15151A    (modals, dropdowns)
--ink:     #E8E8EB    (primary text)
--ink2:    #B0B0B8    (secondary text)
--ink3:    #7A7A84    (labels, hints)
--ink4:    #4A4A52    (disabled, placeholders)
```

**Light theme ([data-theme="light"]):**
```
--bg:      #FAF8F4    (warm off-white)
--bg2:     #FFFFFF    (white)
--bg3:     #F4F1EB    (light warm grey)
--surface: #FFFFFF
--ink:     #1A1D24
--ink2:    #4A4F58
--ink3:    #767A84
```

Theme stored in `localStorage` key `psa_theme`. Toggled via hamburger → Theme section.

### Layout Breakpoints
- `≥780px`: Two-column grid (460px form | 1fr preview)
- `<780px`: Single column, form above, preview below
- `<480px`: Modal full-screen, no border-radius

### A4 Form Palette (light always — it's a printed document)
```
White:          base canvas
Cream #FAF7F2:  column header strip, total strip
Slate #2B2B33:  body text
Orange #E16E35: Order No., bale counts, total
Yellow #FDAF1B: header underline, items title bar, total strip tab
```

---

## 4. Key Constants & Configuration

### Line Numbers (approximate, may drift after edits)
| Thing | Line |
|---|---|
| `const BACKEND_URL` | 1793 |
| `const PSA_LOGO` (base64) | 1781 |
| `const SUPPLIERS` | 1893 |
| `const PARTIES` | 2002 |
| `const TRANSPORTS` | 2274 |
| `DOCS_OPTIONS` | 2300 |
| `const LS` (localStorage helper) | 1884 |
| `function readForm` | 2612 |
| `function buildMessage` (WA output) | 2693 |
| `function buildA4HTML` (A4 output) | 2809 |
| `function copyMsg` | 2999 |
| `function downloadImage` | 3068 |
| `function initPWA` | 3684 |
| Init block | 3845 |

### BACKEND_URL
```javascript
const BACKEND_URL = '';  // empty = offline mode
// Paste your Apps Script /exec URL here to enable cloud sync
```
When empty, the tool works fully offline. Counters stay in localStorage.

### FY Logic
```javascript
const NOW = new Date();
const FY = NOW.getMonth() >= 3
  ? `${NOW.getFullYear()}-${String(NOW.getFullYear()+1).slice(2)}`
  : `${NOW.getFullYear()-1}-${String(NOW.getFullYear()).slice(2)}`;
```

### localStorage Keys
| Key | Value |
|---|---|
| `psa_last_wa` | Last used WA order number |
| `psa_last_wb` | Last used WB order number |
| `psa_last_series` | `'WA'` or `'WB'` |
| `psa_theme` | `'dark'` or `'light'` |

Counter semantic: "last USED number". On page load: show `stored + 1`. After save: store current number (not +1).

---

## 5. Data

### Suppliers (103 total)
- 37 active in FY26-27, sorted by billing volume at top
- 66 inactive (historical, in master list)
- Format: `{ name: "Supplier Name", code: "CODE", city: "City", active: true/false }`
- Top active: BP (Bhagwati Prints, Surat), MF (Maruti Fashion, Surat), KSS (Khushboo Synthetics, Surat), ASC (Anupam Saree Centre, Mathura), NGP (Nand Gopal Print, Jetpur), ATA (Anand Textile Agency, Burhanpur), GSB (Ganpati Sales, Balotra)
- Sub-supplier mapping (e.g. CSS1→MF) handled in `buildMessage` / `buildA4HTML`

### Parties (268)
Format: `{ name: "Full Party Name, City", city: "City" }`
Full names always — no abbreviations in output.

### Transports (71)
Plain strings. Auto-appends " to [party city]" on selection via `getPartyCity()`.

### Send Documents Through (7 options)
Bank, By Hand, Courier, VPP, With Transport, Speed Post, WhatsApp/Email

---

## 6. Features (Current State)

### Order Form
- **WA / WB series toggle** — switches output type, preview panel, button label/color, auto-saves series preference
- **OFR auto-number** — shows next number on load (last used + 1). Syncs from backend if configured.
- **Date** — auto-fills today
- **Party autocomplete** — 268 parties, fuzzy search, city shown as hint, auto-appends city to transport
- **Supplier autocomplete** — 103 suppliers (37 active shown first)
- **Transport autocomplete** — 71 options
- **Send Documents Through** — dropdown, 7 options
- **Items** — add multiple items, each with: bales (qty), name, rate (₹), MIX toggle
- **MIX toggle** — expands sub-item rows (name + price). Sub-items appear in both WA and A4 outputs
- **Auto bale count** — total shown in orange bar above items, updates live
- **OFR prefix** shown as non-editable label beside the number input

### Output — WhatsApp (WA mode)
Live preview in a chat bubble style.
```
PRIYAM SALES AGENCY
Quick Order · FY 2026-27
OFR 1234
2026 May 13

📦 ITEMS
  1 bale  Mulmul Cotton Plain    ₹365
  2 bales Khamoshi Georgette     ₹420
    · Subitem One  ₹300
    · Subitem Two  ₹350
🧮 TOTAL BALES  3
```

### Output — A4 Image (WB mode)
Scaled preview of a print-ready A4 form. Captured via html2canvas at 2x scale.

**A4 form layout:**
- Header: PSA logo (left), "ORDER FORM / FY 2026-27" (right), orange underline
- Meta grid: Order No. (orange large), Date | Party, Supplier | Transport, Send Docs Through
- Items table: BALES | ITEM NAME | RATE columns, cream header strip
- Sub-items: bulleted under parent item, wrapping correctly
- Total strip: cream background, big orange bale count (left), IN WORDS italic (right)
- Footer: "PRIYAM SALES AGENCY" | "MUZAFFARPUR, BIHAR"

**Mobile rendering fixes applied:**
- `document.fonts.ready` awaited before capture
- Clone rendered in offscreen 794px container (no parent transforms)
- Footer converted from `position: absolute` to `position: relative` on clone
- `scrollX/scrollY: 0, x: 0, y: 0` passed to html2canvas
- `allowTaint: false, useCORS: true`

### Save & Share (primary button)
**WA mode:**  
One tap → copies message to clipboard silently + opens native share sheet (Android/iOS) or `wa.me/?text=` on desktop.

**WB mode:**  
One tap → generates A4 PNG + tries `navigator.share({ files: [pngFile], text: caption })` on mobile (prefilled caption: `OFR 1234 Party Name`). Falls back to download if share not supported.

### Print
"🖨 Print / Save as PDF" button below primary.  
`@media print` CSS:
- Hides form, topbar, banners, modals
- Forces layout to single column
- Strips dark frame from A4 container
- Resets scaler transform to `none`
- `print-color-adjust: exact` for accurate colors  
Triggers `window.print()` after `document.fonts.ready` + `requestAnimationFrame`.

### Validation (soft)
Before save: checks for missing party, supplier, empty item names, zero bales.  
Shows a yellow warning banner with issues listed.  
Two actions: **Fix First** (dismisses) / **Save Anyway** (proceeds).  
Banner auto-dismisses when user starts editing the flagged fields.

### Past Orders (History / CRUD)
Accessed via hamburger menu → "Past Orders".  
Requires `BACKEND_URL` to be set (Google Sheets backend).  
- Search by OFR / party / supplier / transport
- Filter by series (All / WA / WB)
- Tap any order → loads into form for editing
- Edit mode: orange banner at top "✏ Editing OFR XXXX", button changes to "Update & Share"
- Delete with confirmation
- Counters don't change during edits

### Settings / Hamburger Menu
☰ top-right opens dropdown with:
1. **Theme** — Dark / Light toggle (persisted)
2. **Past Orders** — opens history modal
3. **Install App** — "Add to Home Screen" button (shown when browser supports it)
4. **Install on iPhone** — shown on iOS Safari (manual share → Add to Home Screen instructions)
5. **About** — version info

### PWA (Progressive Web App)
Installable from browser without a server, using Blob URLs:
- Web app manifest injected as `blob:` URL at runtime
- Service worker registered via `blob:` URL (caches the page for offline use)
- Icons generated at runtime via Canvas: dark background, orange dot, "PSA" text, "Orders" subtext — 192×192 and 512×512
- Apple meta tags for iOS
- Safe area insets for notched iPhones (`env(safe-area-inset-top)`)
- `theme-color` meta tag updates with theme switch

**Install flow (Android Chrome):** Hamburger → Install App → "⊕ Add to Home Screen" → Chrome prompts  
**Install flow (iPhone Safari):** Hamburger → Install instructions → Share → "Add to Home Screen"  
**Already installed:** Menu shows "✓ Running as installed app"

---

## 7. Backend (Google Sheets + Apps Script)

### File: `priyam_backend.gs`
Deploy as Apps Script Web App: Execute as Me, Access: Anyone.

**Endpoints (GET or POST):**
| action | Description |
|---|---|
| `ping` | Health check |
| `getCounters` | Returns `{ wa: N, wb: N }` |
| `save` | Save/update an order |
| `list` | List orders (supports search, series filter, limit, offset) |
| `get` | Fetch one order by ID |
| `delete` | Delete one order by ID |

**Google Sheet structure:**

`orders` tab columns:
```
id | timestamp | series | orderNo | date | party | supplier | transport | docsThrough | totalBales | itemsJson | imageFilename | updatedAt
```

`counters` tab:
```
key      | value
last_wa  | 1289
last_wb  | 47
```

**Counter conflict resolution:** Backend only updates counter if new value > current stored value (prevents rollback from stale devices).

**Order ID format:** `1748234567890_abc12` (timestamp_random — stable, used for edit/delete)

**Save payload:**
```javascript
{
  series: 'WA' | 'WB',
  orderNo: '1289',
  date: '2026-05-13',
  party: 'Full Party Name, City',
  supplier: 'Supplier Name, CODE, City',
  transport: 'Transport Name to City',
  docsThrough: 'Bank',
  totalBales: 5,
  items: [...],       // array of item objects
  imageFilename: '',  // populated for WB orders
  editingRowId: ''    // non-empty = update existing row
}
```

**Setup guide:** `BACKEND_SETUP.md` (in outputs folder)

**Offline behavior:** If `BACKEND_URL` is empty or backend is unreachable, tool works fully offline. Feedback shows "⚠ Cloud offline". localStorage is always the primary counter cache; backend syncs on load.

---

## 8. Item Data Structure

```javascript
// As stored in readForm() output and backend itemsJson
{
  bales: 3,               // number
  name: "Khamoshi Print", // string — alias name (what customer sees)
  rate: "365",            // string (keeps formatting)
  isMix: true,            // boolean — whether MIX is expanded
  subs: [                 // array of sub-items (when isMix = true)
    { name: "Subitem One", price: "300" },
    { name: "Subitem Two", price: "350" }
  ]
}
```

**Important:** `ITNM` (alias name) is what's used in orders — not the supplier's internal name. This prevents cross-supplier price comparison. The same product may have different canonical names, pricelist names, and multiple aliases.

---

## 9. Key JS Patterns

### LS (localStorage helper)
```javascript
LS.get(key, default)    // safe get with fallback
LS.set(key, value)      // safe set (ignores errors)
LS.num(key, default)    // get as integer
```

### Autocomplete
Each autocomplete field uses: `acOpen(fieldId, dataArray)`, `acFilter()`, `acSelect()`, `acKey()`, `acClose()`.  
Min 1 char to open. Renders top 40 matches. Handles keyboard nav (↑↓ Enter Escape).

### Preview refresh
`refreshPreview()` calls both `buildPreviewHTML()` → `#waMsg` and (if WB mode) `buildA4HTML()` → `#a4Msg` on every input change. Debounced effectively by browser paint cycle.

### Series-driven UI
`applySeriesTabVisibility()` — called on load, series switch, and after populateFormFromOrder. Switches the active preview panel and updates the primary button label/color.

### Validation wrapping
`copyMsg` and `downloadImage` are wrapped by the validation system:
```javascript
const _copyMsgOriginal = copyMsg;
copyMsg = function() {
  const issues = validateOrder(readForm());
  if (issues.length > 0) { pendingAction = 'copy'; showValidationBanner(issues); return; }
  _copyMsgOriginal();
};
```

---

## 10. Files in `/mnt/user-data/outputs/`

| File | Purpose |
|---|---|
| `priyam_order_generator_v3.html` | **Primary tool — current version** |
| `priyam_backend.gs` | Apps Script backend (v2 with full CRUD) |
| `BACKEND_SETUP.md` | Step-by-step backend setup guide |
| `priyam_color_generator.html` | Standalone color/qty string generator (legacy, still useful) |
| `priyam_order_generator_v2.x.html` | Old versions (keep for rollback reference) |

---

## 11. Known Behaviors & Edge Cases

- **OFR prefix is display-only.** The input is a plain number. "OFR" is a static label beside it.
- **Party field focuses on load.** Cursor lands on Party (first empty field) since OFR is auto-filled.
- **MIX doesn't open by default on first item.** User must click MIX to expand. Additional items added via "+ Add Item" also don't auto-open MIX.
- **Transport auto-appends city.** When a party is selected, `getPartyCity()` appends "to [city]" to the transport field.
- **Sub-item text can be very long** (color strings like `21/8__63/6__...`). CSS uses `overflow-wrap: anywhere` on `.a4-sub-name` and `.a4-iname` to handle this.
- **A4 preview uses CSS scale().** `fitA4Scale()` runs on resize to fit the 794px sheet inside the preview panel. The transform is reset to `none` for actual capture/print.
- **Backend save uses `mode: 'no-cors'`** for POST — response is unreadable, but request goes through. GET requests (list, get, counters) use normal fetch.
- **`psa_last_series`** defaults to `'WA'` if not set or invalid.
- **Editing an order does NOT increment counters.** Counter only advances on new orders.
- **Image filename format:** `OFR 1234 Party Name.png` (sanitised, no special chars, max 50 chars for party part).
- **WhatsApp share caption (WB):** Pre-filled as `OFR 1234 Party Name` (first part of party field before comma).

---

## 12. Future Roadmap (deferred items)

### Planned for next session
- **Item autosuggest per supplier** — FY25-26 data already extracted and saved in analytics sessions. When supplier is selected, item name field suggests items that supplier commonly sends, with typical rates. Data is in `priyam_6yr_remapped.json` and related files in `/home/claude/dbf_data/`.
- **Release 4** — More fields and functionalities in the order form (details TBD by Prateek)

### Discussed but deprioritised
- **DETAILS feature** (was going to rename MIX → DETAILS, add Colors row and Note row per item) — cancelled, sticking with current MIX + sub-items
- **Quick-fill from last order** — loads last order for a given party in one tap. Deferred.
- **Voice input** — for dictating orders from phone calls. Long-term.
- **Customer order tracking** — full status tracking (placed → dispatched → delivered → paid). Larger project.
- **Madhubani expansion** — identified as highest-ROI market (few customers, high revenue density). Business decision, not a tool feature.

### PWA hosting (pending)
The tool is currently used as a local HTML file. To enable full PWA install + cloud sync from any device:
- Host on GitHub Pages, Netlify, or Cloudflare Pages (all free)
- Update `BACKEND_URL` in the hosted file
- Share one URL with the team instead of sending the HTML file around

---

## 13. Development Guidelines

**When making changes:**
1. Always view the relevant section before editing — line numbers drift after every change
2. Use `str_replace` with unique strings. If not unique, view and narrow the context first
3. Run the validation Python check after significant changes
4. Render a headless screenshot to verify visually before presenting
5. Present the file after every session's changes

**CSS specificity rules used:**
- `.action-row .primary-btn` overrides `.primary-btn` (higher specificity)
- `!important` used sparingly — only in `@media print` where overrides are intentional
- Mobile overrides in `@media (max-width: 780px)` at the bottom of the `<style>` block

**Critical things NOT to break:**
- The A4 capture pipeline (html2canvas clone → offscreen 794px → fonts.ready → render)
- The counter increment logic (last USED = stored, next = stored + 1)
- `applySeriesTabVisibility()` must be called after any series change or form load
- `updatePrimaryButtonLabel()` must match current series AND editingRowId state
- The validation wrapper pattern (both `copyMsg` and `downloadImage` are reassigned)

**Prateek's preferences (always apply):**
- Full names everywhere — no codes, abbreviations, or short forms in any output
- Supplier reports must never mention other suppliers
- Mobile-first — minimum 44px tap targets, 16px font on inputs (prevents iOS zoom)
- No corporate jargon in labels
- Plain text plan review before code for significant changes
- Direct, no-fluff communication

---

## 14. Context for Resuming Development

When starting a fresh chat, paste this file and say:

> "I'm continuing development of the PSA Order Generator. The knowledge file above has the full context. The current file is `priyam_order_generator_v3.html` in the outputs folder. [Describe what you want to do next]."

The assistant should:
1. Read this file to understand the architecture
2. View the relevant section of the HTML before any edit
3. Validate after changes
4. Present the updated file

---

*Knowledge file generated: June 2026. Base version for all future development.*
