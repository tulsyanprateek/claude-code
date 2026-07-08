#!/usr/bin/env python3
"""Extract KP master tables from the shadow's highest fiscal-year folder.
Writes CSV (utf-8-sig) + JSON with plain-English headers, overwriting in place."""
import os, csv, json, glob, re
from dbfread import DBF

_HERE = os.path.dirname(os.path.abspath(__file__))
# shadow lives next to data-dump: psa_tools/data-shadow (works on Windows and in sandbox mounts)
SHADOW = os.environ.get("KP_SHADOW", os.path.normpath(os.path.join(_HERE, "..", "data-shadow")))
OUTDIR = os.environ.get("KP_DATADUMP", _HERE)

def highest_fy(root):
    yrs = [d for d in os.listdir(root)
           if len(d) == 4 and d.isdigit() and os.path.isdir(os.path.join(root, d))]
    return os.path.join(root, sorted(yrs)[-1])

def load(path, table):
    return list(DBF(os.path.join(path, table), ignore_missing_memofile=True,
                    char_decode_errors='ignore'))

def clean(v):
    if v is None: return ""
    if isinstance(v, str): return v.strip()
    return v

ACRONYMS = {"MSME", "LLP", "HUF", "GST"}

def smart_title(s):
    # ALLCAPS -> Title Case; tokens with digits (A-1, 450331, 1ST) and known acronyms left as-is
    def cap(tok):
        if not tok or any(c.isdigit() for c in tok) or tok.upper() in ACRONYMS:
            return tok
        return tok[0].upper() + tok[1:].lower()
    parts = re.split(r'([^A-Za-z0-9]+)', s)
    return ''.join(p if i % 2 else cap(p) for i, p in enumerate(parts))

def fmt(k, v, title_fields, lower_fields):
    v = clean(v)
    if isinstance(v, str):
        if k in title_fields: return smart_title(v)
        if k in lower_fields: return v.lower()
    return v

def write(name, headers, rows, title_fields=(), lower_fields=()):
    csv_path = os.path.join(OUTDIR, name + ".csv")
    json_path = os.path.join(OUTDIR, name + ".json")
    cols = list(headers.values())
    with open(csv_path, "w", newline="", encoding="utf-8-sig") as f:
        w = csv.writer(f)
        w.writerow(cols)
        for r in rows:
            w.writerow([fmt(k, r.get(k, ""), title_fields, lower_fields) for k in headers])
    objs = [{lbl: fmt(k, r.get(k, ""), title_fields, lower_fields)
             for k, lbl in headers.items()} for r in rows]
    with open(json_path, "w", encoding="utf-8-sig") as f:
        json.dump(objs, f, ensure_ascii=False, indent=2, default=str)
    return len(rows)

fy = highest_fy(SHADOW)
counts = {}

# current-FY activity <- billmain.dbf (bills per supplier / customer / transport)
try:
    billmain = load(fy, "billmain.dbf")
except Exception:
    billmain = []
supp_bills, cust_bills, trans_bills = {}, {}, {}
for r in billmain:
    co = (r.get("CO_CODE") or "").strip()
    cu = (r.get("CUST_CD") or "").strip()
    tr = (r.get("TRANSPORT") or "").strip().upper()
    if co: supp_bills[co] = supp_bills.get(co, 0) + 1
    if cu: cust_bills[cu] = cust_bills.get(cu, 0) + 1
    if tr: trans_bills[tr] = trans_bills.get(tr, 0) + 1

# customers_suppliers_master <- ptm.dbf (STATUS C=Customer, S=Supplier)
ptm = load(fy, "ptm.dbf")
for r in ptm:
    st = (r.get("STATUS") or "").strip().upper()
    r["_PARTY_TYPE"] = "Customer" if st == "C" else "Supplier" if st == "S" else st
    code = (r.get("PTCODE") or "").strip()
    r["_BILLS_FY"] = (supp_bills if st == "S" else cust_bills).get(code, 0)
ptm_headers = {
    "_PARTY_TYPE": "Party Type", "STATUS": "Status Code", "PTCODE": "Party Code",
    "PTNM": "Party Name", "PTSNM": "Short Name", "PTADD1": "Address 1",
    "PTADD2": "Address 2", "PTADD3": "Address 3", "CITY": "City",
    "DISTT": "District", "STATE": "State", "PIN": "PIN Code",
    "CONT_PER": "Contact Person 1", "CONT_PER2": "Contact Person 2",
    "MOBILE": "Mobile", "MOB1": "Mobile 1", "MOB2": "Mobile 2",
    "WAPP": "WhatsApp", "EMAIL": "Email", "EMAIL2": "Email 2",
    "WEBADD": "Website", "FAX": "Fax", "GSTNO": "GST No", "PANNO": "PAN No",
    "AADHAR": "Aadhaar", "TINNO": "TIN No", "CSTNO": "CST No", "CINNO": "CIN No",
    "MSME": "MSME Flag", "MSMEID": "MSME ID", "IFSC": "Bank IFSC",
    "CBSBANK": "Bank Name", "CBSAC": "Bank Account", "RTGSNO": "RTGS No",
    "CREDIT": "Credit Days", "LIMIT": "Credit Limit", "OPBAL": "Opening Balance",
    "DC": "Dr/Cr", "CLBAL": "Closing Balance", "TRANS": "Transport",
    "COURIER": "Courier", "DESTI": "Destination", "REMARKS": "Remarks",
    "REMARKS1": "Remarks 2", "OUT_STATE": "Out of State",
    "_BILLS_FY": "Bills FY",
}
ptm_title = {"PTNM", "PTADD1", "PTADD2", "PTADD3", "CITY", "DISTT",
             "STATE", "CONT_PER", "CONT_PER2", "CBSBANK", "TRANS", "COURIER",
             "DESTI", "REMARKS", "REMARKS1"}
ptm_lower = {"EMAIL", "EMAIL2", "WEBADD"}
counts["customers_suppliers_master"] = write("customers_suppliers_master", ptm_headers, ptm,
                                             title_fields=ptm_title, lower_fields=ptm_lower)

# items_master <- itm.dbf
itm = load(fy, "itm.dbf")
itm_headers = {
    "ITCODE": "Item Code", "GRCODE": "Group Code", "ITNM": "Item Name",
    "B_CODE": "Barcode/Print Name", "COMPANY": "Company", "QLTY": "Quality",
    "UNIT": "Unit", "OPQTY": "Opening Qty", "OPVLU": "Opening Value",
    "MIN_LVL": "Min Level", "REO_LVL": "Reorder Level",
    "FIX_SL": "Fixed Sale Rate", "FIX_PR": "Fixed Purchase Rate",
    "WH_SL_RT": "Wholesale Rate", "P_RT": "Purchase Rate",
    "C_RATE_A": "Cost Rate A", "C_RATE_B": "Cost Rate B", "C_RATE_C": "Cost Rate C",
    "HSNCODE": "HSN Code", "GSTPS": "GST %", "BOX": "Box", "CUT": "Cut",
    "MARK": "Mark", "DATE": "Date", "ACT_YN": "Active",
}
counts["items_master"] = write("items_master", itm_headers, itm,
                               title_fields={"ITNM", "B_CODE", "COMPANY", "QLTY", "MARK"})

# transports <- transport.dbf + transpor.dbf merged, dedup by name
tr = load(fy, "transport.dbf") + load(fy, "transpor.dbf")
seen, merged = set(), []
for r in tr:
    nm = (r.get("NAME") or "").strip()
    key = nm.upper()
    if nm and key not in seen:
        seen.add(key)
        merged.append({"NAME": nm, "_BILLS_FY": trans_bills.get(key, 0)})
counts["transports"] = write("transports", {"NAME": "Transport Name", "_BILLS_FY": "Bills FY"},
                             merged, title_fields={"NAME"})

# stations <- city.dbf
city = load(fy, "city.dbf")
city_headers = {"CITY": "Station/City", "STATUS": "Status Code"}
counts["stations"] = write("stations", city_headers, city, title_fields={"CITY"})

print("FY folder:", fy)
for k, v in counts.items():
    print(f"{k}: {v} rows")
