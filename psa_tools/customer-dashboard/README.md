# PSA Customer Dashboard

Offline customer/supplier dashboard for Priyam Sales Agency. Opens in any phone
browser, no internet needed — built for looking up a customer while visiting them
in person.

## Files

| File | Purpose |
|---|---|
| `psa_dashboard.html` | The dashboard. Open this in a browser. |
| `generate_data.py` | Pipeline — reads DBF backups, writes `dashboard_data.js`. |
| `generate_data.bat` | Double-click to run the pipeline. |
| `dashboard_data.js` | Generated data (~3MB). Do not edit by hand. |

## Daily refresh

1. Nightly backups land in `../data-shadow/<FY>/` (e.g. `2627/`).
2. Double-click `generate_data.bat` (or run `python generate_data.py`).
3. Open `psa_dashboard.html`.

The pipeline auto-detects the highest fiscal-year folder in `../data-shadow/`, so
no edits are needed when a new FY starts. Override the source with the `KP_SHADOW`
env var if ever required.

## Data source

Reads FoxPro DBF tables from `../data-shadow/<FY>/`:
`ptm`, `itm`, `billmain`, `bill`, `vouch`, `hisbmain`, `hisablst`, `draft1`,
`indtmain`, `indent`, `grdmmain`, `grdm`.

Outstanding bills = `billmain` rows not yet matched in `vouch` (bills enter `vouch`
only once settled). See the project memory / CLAUDE.md for the full schema notes.

## Preview (Claude Code)

Launch config `psa-dashboard` serves this folder on port 3459.
