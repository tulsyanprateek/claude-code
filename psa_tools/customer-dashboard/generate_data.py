"""
PSA Customer Dashboard — Data Pipeline
=======================================
Reads FoxPro DBF files from data-shadow/ and outputs dashboard_data.js.

Usage:
    python generate_data.py

Output:
    dashboard_data.js  (same folder as this script, i.e. data-dump/)

Run this script every time after a fresh backup lands in data-shadow/.
"""

import os, sys, json, datetime, traceback
from collections import defaultdict

try:
    import dbfread
except ImportError:
    sys.exit("ERROR: dbfread not installed.  Run:  pip install dbfread")

# ── Config ────────────────────────────────────────────────────────────────────
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
SHADOW_DIR = os.environ.get(
    "KP_SHADOW",
    os.path.normpath(os.path.join(SCRIPT_DIR, "..", "data-shadow"))
)
OUTPUT_FILE = os.path.join(SCRIPT_DIR, "dashboard_data.js")
ENCODING = "cp1252"

def highest_fy(root):
    yrs = [d for d in os.listdir(root)
           if len(d) == 4 and d.isdigit() and os.path.isdir(os.path.join(root, d))]
    if not yrs:
        raise FileNotFoundError(f"No fiscal-year subfolders found in: {root}")
    return os.path.join(root, sorted(yrs)[-1])

DATA_DIR = highest_fy(SHADOW_DIR)

def dbf_path(name):
    return os.path.join(DATA_DIR, name)

# ── Helpers ───────────────────────────────────────────────────────────────────
def load_dbf(filename, required=True):
    path = dbf_path(filename)
    if not os.path.exists(path):
        if required:
            raise FileNotFoundError(f"Required file missing: {filename}")
        print(f"  WARNING: {filename} not found, skipping.")
        return []
    try:
        table = dbfread.DBF(path, encoding=ENCODING, ignore_missing_memofile=True)
        rows = [dict(r) for r in table]
        print(f"  {filename}: {len(rows):,} rows")
        return rows
    except Exception as e:
        print(f"  ERROR reading {filename}: {e}")
        if required:
            raise
        return []

def s(v):
    return str(v).strip() if v is not None else ''

def f(v, default=0.0):
    if v is None:
        return default
    try:
        return float(v)
    except (ValueError, TypeError):
        return default

def d(v):
    if v is None:
        return ''
    if isinstance(v, (datetime.date, datetime.datetime)):
        return v.isoformat()
    return str(v)

def latest_date(rows, field):
    dates = [r.get(field) for r in rows if isinstance(r.get(field), (datetime.date, datetime.datetime))]
    return max(dates).isoformat() if dates else ''

# ── Main ──────────────────────────────────────────────────────────────────────
def main():
    print(f"\nPSA Dashboard - Data Pipeline")
    print(f"Shadow dir  : {SHADOW_DIR}")
    print(f"Data folder : {DATA_DIR}")
    print(f"Output      : {OUTPUT_FILE}")
    print(f"Started at  : {datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")

    errors = []

    print("Loading tables...")
    ptm_rows     = load_dbf("ptm.dbf",      required=True)
    itm_rows     = load_dbf("itm.dbf",      required=True)
    bm_rows      = load_dbf("billmain.dbf", required=True)
    bill_rows    = load_dbf("bill.dbf",      required=True)
    vouch_rows   = load_dbf("vouch.dbf",    required=True)
    hism_rows    = load_dbf("hisbmain.dbf", required=False)
    hisl_rows    = load_dbf("hisablst.dbf", required=False)
    draft_rows   = load_dbf("draft1.dbf",   required=False)
    indm_rows    = load_dbf("indtmain.dbf", required=False)
    ind_rows     = load_dbf("indent.dbf",   required=False)
    grdm_rows    = load_dbf("grdmmain.dbf", required=False)
    grd_rows     = load_dbf("grdm.dbf",     required=False)
    print()

    data_as_of = latest_date(bm_rows, 'CDATE') or datetime.date.today().isoformat()
    today = datetime.date.today()

    # ── Party Master ──────────────────────────────────────────────────────────
    print("Building party master...")
    customers = {}
    suppliers = {}
    for r in ptm_rows:
        code   = s(r.get('PTCODE'))
        status = s(r.get('STATUS'))
        if not code:
            continue
        party = {
            "code":        code,
            "name":        s(r.get('PTNM')),
            "short":       s(r.get('PTSNM')),
            "city":        s(r.get('CITY')),
            "state":       s(r.get('STATE')),
            "mobile":      s(r.get('MOBILE')) or s(r.get('MOB1')),
            "email":       s(r.get('EMAIL')),
            "gstno":       s(r.get('GSTNO')),
            "credit_days": int(r.get('CREDIT') or 0),
            "limit":       f(r.get('LIMIT')),
            "remarks":     s(r.get('REMARKS')),
        }
        if status == 'C':
            customers[code] = party
        elif status == 'S':
            suppliers[code] = party

    print(f"  Customers: {len(customers)}, Suppliers: {len(suppliers)}")

    # ── Item Master ───────────────────────────────────────────────────────────
    print("Building item master...")
    items = {}
    for r in itm_rows:
        code = s(r.get('ITCODE'))
        if not code:
            continue
        items[code] = {
            "code":    code,
            "name":    s(r.get('ITNM')),
            "brand":   s(r.get('B_CODE')),
            "group":   s(r.get('GRCODE')),
            "company": s(r.get('COMPANY')),
            "gst_pct": f(r.get('GSTPS')),
        }

    # ── Bill Lines ────────────────────────────────────────────────────────────
    print("Indexing bill line items...")
    bill_lines_by_chno = defaultdict(list)
    for r in bill_rows:
        chno = int(r.get('CHNO') or 0)
        if not chno:
            continue
        itcode = s(r.get('ITCODE'))
        item_info = items.get(itcode, {})
        bill_lines_by_chno[chno].append({
            "item_code":  itcode,
            "item_name":  s(r.get('B_CODE')) or item_info.get('brand') or item_info.get('name', ''),
            "group":      s(r.get('GRCODE')) or item_info.get('group', ''),
            "company":    s(r.get('COMPANY')) or item_info.get('company', ''),
            "bales":      f(r.get('BALES')),
            "rate":       f(r.get('RATE')),
            "metres":     f(r.get('MTR')),
            "amount":     f(r.get('AMT')),
            "gst_pct":    f(r.get('GSTPS')),
            "igst":       f(r.get('IGST')),
            "taxable":    f(r.get('TAXABLEVLU')),
            "indent_ref": s(r.get('INDT_ABBR')) + ' ' + s(str(r.get('INDT_NO') or '')).strip(),
        })

    # ── Settled bill index from vouch ─────────────────────────────────────────
    print("Building settled-bill index from vouch...")
    settled_keys = set()
    vouch_by_customer = defaultdict(list)
    for r in vouch_rows:
        cacode = s(r.get('CACODE'))
        co     = s(r.get('CO_CODE'))
        inv_no = s(r.get('INV_NO'))
        billfg = s(r.get('BILLFG'))
        payfg  = s(r.get('PAYFG'))
        cdrcr  = s(r.get('CDRCR'))
        camt   = f(r.get('CAMT'))
        cdate  = d(r.get('CDATE'))

        if billfg == 'Y':
            settled_keys.add((inv_no, co, cacode))

        if cacode and cacode in customers:
            vouch_by_customer[cacode].append({
                "date":     cdate,
                "type":     "bill"    if billfg == 'Y' else
                            "payment" if payfg  == 'Y' else "other",
                "dr_cr":    cdrcr,
                "amount":   camt,
                "inv_no":   inv_no,
                "supplier": co,
                "narr":     s(r.get('CNRR1')),
            })

    print(f"  Settled bill keys: {len(settled_keys):,}")

    # ── Classify bills ────────────────────────────────────────────────────────
    print("Classifying bills...")
    bills_by_customer = defaultdict(list)
    bills_by_supplier = defaultdict(list)

    for r in bm_rows:
        chno    = int(r.get('CHNO') or 0)
        cust_cd = s(r.get('CUST_CD'))
        co_code = s(r.get('CO_CODE'))
        inv_no  = s(r.get('INV_NO'))
        inv_dt  = d(r.get('INV_DT'))
        cdate   = d(r.get('CDATE'))

        if not cust_cd or not co_code or not inv_no:
            continue

        is_outstanding = (inv_no, co_code, cust_cd) not in settled_keys

        bill_date_raw = r.get('INV_DT') or r.get('CDATE')
        if isinstance(bill_date_raw, (datetime.date, datetime.datetime)):
            age_days = (today - (bill_date_raw if isinstance(bill_date_raw, datetime.date)
                                 else bill_date_raw.date())).days
        else:
            age_days = None

        bill = {
            "chno":        chno,
            "inv_no":      inv_no,
            "inv_dt":      inv_dt,
            "entry_dt":    cdate,
            "cust_cd":     cust_cd,
            "supplier":    co_code,
            "nett":        f(r.get('NETT')),
            "taxable":     f(r.get('TAXABLEVLU')),
            "igst":        f(r.get('IGST')),
            "cgst":        f(r.get('CGST')),
            "sgst":        f(r.get('SGST')),
            "transport":   s(r.get('TRANSPORT')),
            "lr_no":       s(r.get('LR_NO')),
            "lr_dt":       d(r.get('LR_DT')),
            "dest":        s(r.get('DESTI')),
            "bales":       int(r.get('TBALES') or 0),
            "qty":         f(r.get('TQTY')),
            "due_dt":      d(r.get('E_DATE')),
            "indent_abbr": s(r.get('INDT_ABBR')),
            "indent_no":   int(r.get('INDT_NO') or 0),
            "narr":        s(r.get('NARR')),
            "outstanding": is_outstanding,
            "age_days":    age_days,
            "lines":       bill_lines_by_chno.get(chno, []),
        }

        bills_by_customer[cust_cd].append(bill)
        bills_by_supplier[co_code].append(bill)

    total_outstanding = sum(
        b['nett'] for bills in bills_by_customer.values()
        for b in bills if b['outstanding']
    )
    total_settled = sum(
        b['nett'] for bills in bills_by_customer.values()
        for b in bills if not b['outstanding']
    )
    print(f"  Outstanding bills: {sum(1 for bills in bills_by_customer.values() for b in bills if b['outstanding']):,}  |  "
          f"Total: Rs.{total_outstanding:,.0f}")
    print(f"  Settled bills    : {sum(1 for bills in bills_by_customer.values() for b in bills if not b['outstanding']):,}  |  "
          f"Total: Rs.{total_settled:,.0f}")

    # ── Payment days from hisablst ────────────────────────────────────────────
    print("Computing payment days from hisablst...")
    payment_records = defaultdict(list)
    for r in hisl_rows:
        cacode  = s(r.get('CACODE'))
        co      = s(r.get('CO_CODE'))
        days    = f(r.get('XDAYS') or r.get('DAYS'))
        dddate  = d(r.get('DDDATE'))
        ddamt   = f(r.get('DDAMT'))
        billno  = s(r.get('BILLNO'))
        billdt  = d(r.get('BILLDATE'))
        billamt = f(r.get('BILLAMT'))
        cdamt   = f(r.get('CDAMT'))

        if not cacode or not dddate:
            continue

        payment_records[cacode].append({
            "bill_no":  billno,
            "bill_dt":  billdt,
            "bill_amt": billamt,
            "cd_amt":   cdamt,
            "paid_amt": ddamt,
            "paid_dt":  dddate,
            "days":     days,
            "supplier": co,
        })

    # ── Orders (indent) ───────────────────────────────────────────────────────
    print("Building orders...")
    indm_idx = {}
    for r in indm_rows:
        abbr = s(r.get('INDT_ABBR'))
        no   = int(r.get('INDT_NO') or 0)
        indm_idx[(abbr, no)] = r

    orders_by_customer = defaultdict(list)
    lines_by_order = defaultdict(list)
    for r in ind_rows:
        abbr = s(r.get('INDT_ABBR'))
        no   = int(r.get('INDT_NO') or 0)
        lines_by_order[(abbr, no)].append(r)

    for (abbr, no), header in indm_idx.items():
        cust_cd = s(header.get('CUST_CD'))
        co_code = s(header.get('CO_CODE'))
        if not cust_cd:
            continue

        lines = lines_by_order.get((abbr, no), [])
        pending_lines = []
        for ln in lines:
            canc = s(ln.get('CANC_FG')).upper()
            cflg = s(ln.get('CANC_FLG')).upper()
            if 'C' in (canc, cflg):
                continue
            ordered  = f(ln.get('BALES'))
            received = f(ln.get('RC_BALE'))
            if ordered <= 0 or received >= ordered:
                continue

            itcode = s(ln.get('ITCODE'))
            item_info = items.get(itcode, {})
            pending_lines.append({
                "item_code": itcode,
                "item_name": s(ln.get('B_CODE')) or item_info.get('brand') or item_info.get('name', ''),
                "group":     s(ln.get('GRCODE')) or item_info.get('group', ''),
                "company":   s(ln.get('COMPANY')) or item_info.get('company', ''),
                "ordered":   ordered,
                "received":  received,
                "pending":   ordered - received,
                "rate":      f(ln.get('RATE')),
                "delivery":  s(ln.get('DELIVERY')),
            })

        orders_by_customer[cust_cd].append({
            "order_ref":     abbr + ' ' + str(no),
            "order_abbr":    abbr,
            "order_no":      no,
            "order_dt":      d(header.get('INDT_DT') or header.get('CDATE')),
            "due_dt":        d(header.get('E_DATE')),
            "cust_cd":       cust_cd,
            "supplier":      co_code,
            "transport":     s(header.get('TRANSPORT')),
            "dest":          s(header.get('DESTI')),
            "nett":          f(header.get('NETT')),
            "pending_lines": pending_lines,
            "has_pending":   len(pending_lines) > 0,
        })

    total_pending_orders = sum(
        1 for orders in orders_by_customer.values() for o in orders if o['has_pending']
    )
    print(f"  Total orders with pending lines: {total_pending_orders:,}")

    # ── Returns (damage) ──────────────────────────────────────────────────────
    print("Building returns...")
    grd_lines_by_chno = defaultdict(list)
    for r in grd_rows:
        chno = int(r.get('CHNO') or 0)
        itcode = s(r.get('ITCODE'))
        item_info = items.get(itcode, {})
        grd_lines_by_chno[chno].append({
            "item_name": s(r.get('PARTYNO')) or item_info.get('brand', ''),
            "group":     s(r.get('GRCODE')),
            "metres":    f(r.get('MTR')),
            "rate":      f(r.get('RATE')),
            "amount":    f(r.get('AMT')),
        })

    returns_by_customer = defaultdict(list)
    for r in grdm_rows:
        chno    = int(r.get('CHNO') or 0)
        cust_cd = s(r.get('CUST_CD'))
        if not cust_cd:
            continue
        returns_by_customer[cust_cd].append({
            "chno":     chno,
            "inv_no":   s(r.get('INV_NO')),
            "inv_dt":   d(r.get('INV_DT')),
            "entry_dt": d(r.get('CDATE')),
            "supplier": s(r.get('CO_CODE')),
            "nett":     f(r.get('NETT')),
            "ref_bill": s(r.get('REFNO')),
            "type":     s(r.get('F_D')) or 'RETURN',
            "lines":    grd_lines_by_chno.get(chno, []),
        })

    # ── Customer summaries ────────────────────────────────────────────────────
    print("Assembling customer summaries...")
    customer_data = {}
    for code, info in customers.items():
        cust_bills    = bills_by_customer.get(code, [])
        cust_vouch    = sorted(vouch_by_customer.get(code, []), key=lambda x: x['date'])
        cust_payments = payment_records.get(code, [])
        cust_orders   = orders_by_customer.get(code, [])
        cust_returns  = returns_by_customer.get(code, [])

        outstanding_bills = [b for b in cust_bills if b['outstanding']]
        settled_bills     = [b for b in cust_bills if not b['outstanding']]

        total_outstanding_amt = sum(b['nett'] for b in outstanding_bills)
        total_settled_amt     = sum(b['nett'] for b in settled_bills)
        total_paid_amt        = sum(
            v['amount'] for v in cust_vouch
            if v['type'] == 'payment' and v['dr_cr'] == 'C'
        )

        all_days = [p['days'] for p in cust_payments if p['days'] and p['days'] > 0]
        avg_days = round(sum(all_days) / len(all_days), 1) if all_days else None

        ageing = {"0_30": 0.0, "31_60": 0.0, "61_90": 0.0, "91_plus": 0.0}
        for b in outstanding_bills:
            age = b.get('age_days') or 0
            amt = b['nett']
            if age <= 30:   ageing["0_30"]    += amt
            elif age <= 60: ageing["31_60"]   += amt
            elif age <= 90: ageing["61_90"]   += amt
            else:           ageing["91_plus"] += amt

        monthly = defaultdict(float)
        for b in cust_bills:
            dt = b.get('inv_dt') or b.get('entry_dt')
            if dt and len(dt) >= 7:
                monthly[dt[:7]] += b['nett']
        monthly_trend = [{"month": k, "amount": round(v, 2)}
                         for k, v in sorted(monthly.items())[-15:]]

        suppliers_used = sorted(set(b['supplier'] for b in cust_bills if b['supplier']))

        customer_data[code] = {
            "info": info,
            "summary": {
                "total_bills":       len(cust_bills),
                "outstanding_count": len(outstanding_bills),
                "outstanding_amt":   round(total_outstanding_amt, 2),
                "settled_count":     len(settled_bills),
                "settled_amt":       round(total_settled_amt, 2),
                "total_paid_amt":    round(total_paid_amt, 2),
                "avg_payment_days":  avg_days,
                "pending_orders":    sum(1 for o in cust_orders if o['has_pending']),
                "ageing":            {k: round(v, 2) for k, v in ageing.items()},
                "monthly_trend":     monthly_trend,
                "suppliers_used":    suppliers_used,
            },
            "outstanding_bills": sorted(outstanding_bills, key=lambda x: x.get('inv_dt',''), reverse=True),
            "settled_bills":     sorted(settled_bills,     key=lambda x: x.get('inv_dt',''), reverse=True),
            "ledger":            cust_vouch,
            "payments":          sorted(cust_payments, key=lambda x: x.get('paid_dt',''), reverse=True),
            "orders":            sorted(cust_orders,   key=lambda x: x.get('order_dt',''), reverse=True),
            "returns":           sorted(cust_returns,  key=lambda x: x.get('entry_dt',''), reverse=True),
        }

    # ── Supplier summaries ────────────────────────────────────────────────────
    print("Building supplier summary...")
    supplier_data = {}
    for code, info in suppliers.items():
        sup_bills = bills_by_supplier.get(code, [])
        if not sup_bills:
            continue

        by_cust = defaultdict(list)
        for b in sup_bills:
            by_cust[b['cust_cd']].append(b)

        cust_summaries = []
        for cust_cd, cbills in by_cust.items():
            outstanding = [b for b in cbills if b['outstanding']]
            settled     = [b for b in cbills if not b['outstanding']]
            cust_info   = customers.get(cust_cd, {"name": cust_cd, "city": ""})
            cust_summaries.append({
                "cust_cd":          cust_cd,
                "cust_name":        cust_info.get("name", cust_cd),
                "city":             cust_info.get("city", ""),
                "outstanding_bills": len(outstanding),
                "outstanding_amt":   round(sum(b['nett'] for b in outstanding), 2),
                "settled_bills":     len(settled),
                "settled_amt":       round(sum(b['nett'] for b in settled), 2),
                "total_bills":       len(cbills),
                "total_amt":         round(sum(b['nett'] for b in cbills), 2),
            })

        supplier_data[code] = {
            "info":              info,
            "customers":         sorted(cust_summaries, key=lambda x: -x['outstanding_amt']),
            "total_outstanding": round(sum(c['outstanding_amt'] for c in cust_summaries), 2),
            "total_business":    round(sum(c['total_amt']        for c in cust_summaries), 2),
        }

    # ── Write output ──────────────────────────────────────────────────────────
    print(f"\nWriting {OUTPUT_FILE} ...")
    payload = {
        "meta": {
            "generated_at":   datetime.datetime.now().isoformat(),
            "data_as_of":     data_as_of,
            "data_folder":    DATA_DIR,
            "customer_count": len(customer_data),
            "supplier_count": len(supplier_data),
            "bill_count":     len(bm_rows),
        },
        "customers": customer_data,
        "suppliers": supplier_data,
    }

    js_content  = "// PSA Dashboard Data - auto-generated by generate_data.py\n"
    js_content += "// DO NOT EDIT MANUALLY - re-run generate_data.py to refresh\n"
    js_content += f"// Generated: {datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n\n"
    js_content += "window.PSA_DATA = "
    js_content += json.dumps(payload, ensure_ascii=False, separators=(',', ':'))
    js_content += ";\n"

    with open(OUTPUT_FILE, 'w', encoding='utf-8') as fh:
        fh.write(js_content)

    size_kb = os.path.getsize(OUTPUT_FILE) // 1024
    print(f"Done. Output size: {size_kb:,} KB")
    print(f"\nErrors during run: {len(errors)}")
    for e in errors:
        print(f"  - {e}")
    print("\nAll done. Open psa_dashboard.html in your browser.")

if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        print(f"\nFATAL ERROR: {exc}")
        traceback.print_exc()
        sys.exit(1)
