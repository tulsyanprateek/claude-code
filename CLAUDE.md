# Workspace Root — CLAUDE.md

This is a monorepo workspace for tools built for **Priyam Sales Agency (PSA)**, a B2B textile commission agency in Muzaffarpur, Bihar. Each subdirectory is a standalone project with its own `CLAUDE.md`.

---

## Repository Structure

```
claude-code/
├── psa_tools/                    ← active project (see psa_tools/CLAUDE.md)
│   ├── priyam_order_generator_v3.html   (~4999 lines) — primary order tool
│   ├── priyam_backend.gs                (349 lines)   — Apps Script backend for orders
│   ├── psa_dispatch_logger.html         (1057 lines)  — document dispatch logger
│   ├── psa_dispatch_backend.gs          (140 lines)   — Apps Script backend for dispatch
│   ├── color_generator.html             (936 lines)   — standalone color/qty string generator
│   ├── priyam-brand/                    ← shared brand package (CSS + fonts)
│   │   ├── priyam-brand.css             — tokens, @font-face, helper classes
│   │   ├── priyam-tokens.json           — same tokens as machine-readable JSON
│   │   ├── fonts/                       — self-hosted woff2 files (offline-capable)
│   │   │   ├── outfit.woff2
│   │   │   ├── hanken-grotesk.woff2
│   │   │   ├── ibm-plex-mono.woff2
│   │   │   └── noto-sans-devanagari.woff2
│   │   ├── starter.html                 — brand showcase / dev reference
│   │   └── README.txt
│   ├── CLAUDE.md                        — detailed project-level guidance
│   ├── PSA_ORDER_GENERATOR_KNOWLEDGE.md — deep architecture knowledge file
│   ├── BACKEND_SETUP.md                 — Google Sheets + Apps Script setup guide
│   └── .claude/
│       ├── launch.json                  — dev server configs (port 3456/3457)
│       └── settings.local.json
├── backup.ps1                    ← auto-backup PowerShell script (Windows)
└── CLAUDE.md                     ← this file
```

---

## Users

| Name | Role |
|---|---|
| **Prateek** | Owner — primary user, mobile-first |
| **Chanchal** | Data entry |
| **Manish** | Field |

---

## Projects

### `psa_tools/` — PSA Operations Toolbox

Mobile-first single-HTML-file tools opened directly in phone browsers. No build step, no npm, no framework. Each tool is fully self-contained and works offline.

| Tool | Purpose | Lines |
|---|---|---|
| `priyam_order_generator_v3.html` | WA/WB order generator | ~5000 |
| `psa_dispatch_logger.html` | Document dispatch logger | ~1057 |
| `color_generator.html` | Color/quantity string generator | ~936 |

**Read `psa_tools/CLAUDE.md` before making any changes to this project.**  
For deep architecture context on the order generator, also read `psa_tools/PSA_ORDER_GENERATOR_KNOWLEDGE.md`.

---

## Development Workflow

### Running Tools Locally

No build step. Two options:

```bash
# Option 1: Open HTML file directly in browser (simplest)
# Option 2: Serve with npx (needed for relative paths / PWA testing)
npx serve -p 3456 -s psa_tools/
```

The `.claude/launch.json` in `psa_tools/` defines two server configs:
- Port `3456` — order generator
- Port `3457` — dispatch logger

### Testing Backends (Google Apps Script)

Run these test functions in the Apps Script editor:

**Order generator backend (`priyam_backend.gs`):**
- `testGetCounters()` — verify counter sync
- `testSaveOrder()` — write test row (delete manually after)
- `testListOrders()` — verify list response

**Dispatch logger backend (`psa_dispatch_backend.gs`):**
- `testPing()` — health check
- `testSave()` — write test row (delete manually after)
- `testList()` — verify list response

Deploy backend: Apps Script → Deploy → New deployment → Web app → Execute as Me → Access: Anyone.

### Backup / Git Workflow

`backup.ps1` is a Windows PowerShell script that runs from `D:\claude_code` and auto-commits + pushes all changes with a timestamp message. It runs on a schedule (or manually) to keep the repo synced.

```powershell
# backup.ps1 does:
git add -A
git commit -m "Auto-backup: YYYY-MM-DD HH:mm"
git push origin master
```

When making deliberate changes via Claude Code, use descriptive commit messages rather than relying on the auto-backup script.

---

## PSA Brand Package

All tools must use the shared brand package at `psa_tools/priyam-brand/`.

**Link in every HTML tool:**
```html
<link rel="stylesheet" href="./priyam-brand/priyam-brand.css">
```

**Key CSS tokens:**
```css
--ps-gold: #FBAE1A              /* primary brand accent */
--ps-terracotta: #DF6D35        /* secondary accent */
--ps-gradient: linear-gradient(140deg, #FBAE1A, #DF6D35)
--ps-ink: #2B2B33               /* primary text */
--ps-font-display: 'Outfit'     /* headings, buttons */
--ps-font-body: 'Hanken Grotesk'/* body copy */
--ps-font-mono: 'IBM Plex Mono' /* labels, refs, numbers */
```

Fonts are self-hosted — all four woff2 files in `priyam-brand/fonts/` — so tools work fully offline on phone browsers. Never reference Google Fonts or any CDN for brand fonts.

---

## Cross-Project Conventions

These apply to every tool in this workspace:

1. **Mobile-first always** — 44px minimum tap targets, 16px font on `<input>` (prevents iOS zoom).
2. **Single-file HTML** — each tool is one `.html` file. No build pipeline, no bundler, no node_modules.
3. **PSA brand tokens** — use `--ps-*` CSS variables; never hardcode hex colors or font names.
4. **Full names only** — no codes, abbreviations, or short forms in any user-facing output (orders, dispatch logs, etc.).
5. **Supplier privacy** — supplier reports must never mention other suppliers (cross-supplier price visibility is a business risk).
6. **Offline-capable** — tools must function without internet. Backend features degrade gracefully when `BACKEND_URL` is empty or unreachable.
7. **`mode: 'no-cors'` for POST** — Apps Script backends receive POST saves via `no-cors` (response is unreadable by design). Only GET requests return readable responses.
8. **Present a plain-text plan before coding** significant changes.

---

## Adding a New Project

1. Create `<project-name>/` at the repo root.
2. Add a `CLAUDE.md` inside it with project-specific context.
3. Update this root `CLAUDE.md` to list the new project under **Projects**.
4. If the project uses the PSA brand, copy (or symlink) `priyam-brand/` into the project folder.
