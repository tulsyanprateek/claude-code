# Attendance App

Google Apps Script web app (bound to a Google Sheet) for logging staff attendance.
Two files, no build step: `Code.gs` (backend) and `Index.html` (front-end).

## Moving this into Claude Code with clasp (recommended)

`clasp` is Google's CLI for Apps Script. It lets Claude Code edit these files locally and
push them straight to your script — no copy-pasting into the browser editor.

### One-time setup
1. Install Node.js (v18+), then clasp:
   ```
   npm install -g @google/clasp
   ```
2. Log in (opens a browser):
   ```
   clasp login
   ```
3. Get your **Script ID**: open the Sheet → Extensions → Apps Script →
   ⚙ Project Settings → copy "Script ID".
4. Copy the template and paste your ID:
   ```
   cp .clasp.json.example .clasp.json
   ```
   then edit `.clasp.json` and replace `PASTE_YOUR_SCRIPT_ID_HERE`.
5. Pull the live project once to confirm the link works (optional, will overwrite local
   with what's on Apps Script — skip if you want to push these files as the source of truth):
   ```
   clasp pull
   ```

### Daily loop
- Edit `Code.gs` / `Index.html` (let Claude Code do it).
- Push:
  ```
  clasp push
  ```
- Update the existing web-app deployment so the team's URL stays the same:
  ```
  clasp deployments
  clasp deploy --deploymentId <THE_ID_FROM_ABOVE> --description "what changed"
  ```

### If clasp push complains about file types
Apps Script expects a server file named `Code` and an HTML file named `Index`. clasp maps
`Code.gs` ↔ Code and `Index.html` ↔ Index automatically. If it errors, rename `Code.gs`
to `Code.js` (clasp converts `.js` → `.gs` on push).

## Manual fallback (no clasp)
Edit locally in Claude Code, then paste `Code.gs` and `Index.html` into the Apps Script
editor and: Deploy → Manage deployments → edit (pencil) → Version: New version → Deploy.

## Notes
- See `CLAUDE.md` for the full architecture, data model, and business rules.
- Default PIN is `1234` — change it in the app under Settings → Security.
