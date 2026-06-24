# Priyam Sales — Backend Setup Guide (v2)

Adds Google Sheets backup, counter sync, and full CRUD (view / edit / delete past orders) to your order generator.

## What you'll get

- Every order auto-saved to a Google Sheet
- WA and WB counters sync across all your devices
- **Past Orders panel** — view, edit, delete any old order
- Tool still works offline (just doesn't sync that time)
- OFR field shows the next number automatically on launch

---

## Step 1 — Create the Google Sheet

1. Go to sheets.google.com, create a new blank sheet
2. Rename it: **Priyam Sales — Orders**
3. Rename the first tab from "Sheet1" to **orders**
4. In row 1 of the `orders` tab, paste this header row (each in its own cell):

   ```
   id | timestamp | series | orderNo | date | party | supplier | transport | docsThrough | totalBales | itemsJson | imageFilename | updatedAt
   ```

5. Add a new tab named **counters**
6. In `counters`:

   | A | B |
   |---|---|
   | key | value |
   | last_wa | (your current WA number) |
   | last_wb | (your current WB number) |

   If unsure, just put 1000 in both — you can adjust later.

---

## Step 2 — Add the Apps Script

1. **Extensions > Apps Script**
2. Delete any existing `Code.gs` content
3. Paste the entire contents of `priyam_backend.gs`
4. **Save** (Ctrl+S), name the project "Priyam Sales Backend"

---

## Step 3 — Test the script

In Apps Script editor:

1. Select function **testGetCounters**, click **Run**. Authorize when prompted (Advanced > Go to project > Allow).
2. Open Execution log. Should show `{"ok":true,"wa":1000,"wb":1000}`.
3. Run **testSaveOrder**. Open your sheet — `orders` tab should have a test row with an auto-generated id.
4. Run **testListOrders**. Log should show the test row.
5. Delete the test row from the sheet manually.

---

## Step 4 — Deploy as web app

1. **Deploy > New deployment** > gear icon > **Web app**
2. Description: `v2`
3. Execute as: **Me**
4. Who has access: **Anyone**
5. Deploy. Copy the `/exec` URL.

---

## Step 5 — Wire into HTML

1. Open `priyam_order_generator_v3.html` in any text editor
2. Find: `const BACKEND_URL = '';`
3. Paste your URL: `const BACKEND_URL = 'https://script.google.com/macros/s/AKfycby.../exec';`
4. Save.

Done. Refresh the tool — you should see "✓ Synced — next OFR XXXX" briefly appear.

---

## How everything works now

**On launch:**
- OFR field auto-fills with next number (last used + 1) from local cache
- Backend sync runs in background, updates the number if cloud has a newer one
- Status shown briefly: "✓ Synced" or "⚠ Offline"

**On Copy WhatsApp / Download Image:**
- The OFR number is "locked in" as used (saved to localStorage)
- Order silently saves to Google Sheet in the background
- Feedback shows: "✓ Copied · ☁ Saved" or "✓ Copied · ⚠ Cloud offline"

**On New Order:**
- Number bumps to next (last + 1)
- Items cleared, party/supplier kept (often you're sending multiple orders to same supplier)

**Past Orders panel:**
- Click "📋 Past Orders" button under New Order
- Shows last 100 orders, newest first
- Search by OFR number, party name, supplier, or transport
- Filter by series (All / WA / WB)
- **Tap any order** → loads into the form for editing
- **Edit button** → same as tap, explicit
- **🗑 button** → delete with confirmation

**Edit mode:**
- Yellow banner shows at top of form: "✏ Editing OFR XXXX"
- Buttons change to "Update & Copy" / "Update & Download"
- Saving updates the same row in the sheet, sets an `updatedAt` timestamp
- Cancel button or "New Order" exits edit mode without saving
- Counters don't change during edits (only new orders bump the counter)

---

## If you're upgrading from v1

If you already had the v1 setup running:

1. **Add 2 columns to your `orders` sheet:**
   - Insert column A (leftmost): label it `id`
   - Append last column: label it `updatedAt`
2. **Fill IDs for existing rows:** in A2, paste:
   ```
   =TEXT(ROW()*1000+RANDBETWEEN(1,999),"0000000000")&"_legacy"
   ```
   Drag down. Then select column A, Copy, Edit > Paste Special > Values only.
3. **Update Apps Script:** replace all code with the new `priyam_backend.gs`
4. **Deploy > Manage deployments > pencil icon > Version: New version > Deploy**

This keeps your existing `/exec` URL working — no HTML change needed.

---

## Troubleshooting

**"Past Orders" button shows alert about backend URL**
- You haven't set `BACKEND_URL` in the HTML. See Step 5.

**Past Orders modal says "Could not reach cloud"**
- Phone might be offline, OR deployment access isn't "Anyone".
- Open the BACKEND_URL directly in a browser — should return JSON, not an error page.

**Counter didn't update after I copied/downloaded**
- Refresh the page. If still wrong, check the `counters` tab in your sheet — update the `last_wa` / `last_wb` row directly.

**I edited an order but it created a new row instead**
- Check that you actually loaded the order via "Past Orders" first. The yellow banner must say "Editing OFR XXXX". If you just typed a number into a fresh form, that's a new order.

**I deleted an order by mistake**
- Open the Google Sheet directly and check the bin (File > Version history > See version history) to recover deleted rows.

---

## Next steps when ready

- Make the HTML installable as a phone PWA (icon, full-screen, offline)
- Add summary screens (orders this month, top parties, supplier-wise totals)
- Bulk export to CSV/PDF
