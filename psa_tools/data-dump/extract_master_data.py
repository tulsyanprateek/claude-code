#!/usr/bin/env python3
"""
KP master-data extractor.
Reads FoxPro/dBASE .dbf tables from the shadow backup (current fiscal year)
and writes clean CSV + JSON to the data-dump folder for downstream apps.

Source (read-only) : D:\PSA - Essentials\Kpbkup\raw  -> shadow -> D:\claude_cowork\kp raw data
Output             : D:\claude_code\psa_tools\data-dump
Run nightly after the shadow backup. Overwrites in place (stable filenames).
"""
import csv, json, os, sys, glob
from dbfread import DBF

# --- paths (Linux mount form for bash runs; adjust YEAR if fiscal year rolls) ---
SHADOW = os.environ.get("KP_SHADOW", "/sessions/stoic-dazzling-volta/mnt/kp raw data")
OUT    = os.environ.get("KP_OUT",    "/sessions/stoic-dazzling-volta/mnt/data-dump")

def pick_year(shadow):
    """Use the highest-numbered fiscal-year subfolder (e.g. 2627 > 2526)."""
    yrs = [d for d in os.listdir(shadow) if d.isdigit() and len(d)==4]
    if not yrs:
        raise SystemExit(f"No fiscal-year folder found in {shadow}")
    return os.path.join(shadow, max(yrs))

def clean(v):
    return v.strip() if isinstance(v, str) else v

def write_outputs(name, heads, rows):
    csv_p = os.path.join(OUT, f"{name}.csv")
    json_p = os.path.join(OUT, f"{name}.json")
    with open(csv_p, "w", newline="", encoding="utf-8-sig") as f:
        w = csv.DictWriter(f, fieldnames=heads); w.writeheader(); w.writerows(rows)
    with open(json_p, "w", encoding="utf-8") as f:
        json.dump(rows, f, ensure_ascii=False, indent=2, default=str)
    return len(rows)

def extract(src):
    counts = {}

    # 1. PARTY MASTER (customers + suppliers) -- from ptm.dbf (NOT master.dbf)
    party_map = [("STATUS","Type"),("PTCODE","Code"),("PTNM","Name"),("PTSNM","ShortName"),
        ("PTADD1","Address1"),("PTADD2","Address2"),("PTADD3","Address3"),("CITY","Station"),
        ("DISTT","District"),("STATE","State"),("STATE_CD","StateCode"),("PIN","PIN"),
        ("GSTNO","GSTIN"),("PANNO","PAN"),("TINNO","TIN"),("CSTNO","CST"),("MOBILE","Mobile"),
        ("MOB1","Mobile2"),("MOB2","Mobile3"),("HEL","Phone"),("EMAIL","Email"),("EMAIL2","Email2"),
        ("CONT_PER","ContactPerson"),("TRANS","Transport"),("COURIER","Courier"),("DESTI","Destination"),
        ("CREDIT","CreditDays"),("LIMIT","CreditLimit"),("OPBAL","OpeningBalance"),("DC","OpBalDrCr"),
        ("MAST_GR","MasterGroup"),("MSMEID","MSMEID"),("AADHAR","Aadhaar"),("REMARKS","Remarks")]
    d = DBF(os.path.join(src,"ptm.dbf"), ignore_missing_memofile=True, char_decode_errors='ignore')
    rows=[]
    for r in d:
        o={}
        for raw,plain in party_map:
            v=clean(r.get(raw,""))
            if raw=="STATUS":
                v={"C":"Customer","S":"Supplier"}.get((v or "").strip().upper(), v)
            o[plain]=v
        rows.append(o)
    counts["customers_suppliers_master"]=write_outputs("customers_suppliers_master",[p for _,p in party_map],rows)

    # 2. ITEMS -- from itm.dbf
    item_map=[("ITCODE","ItemCode"),("ITNM","ItemName"),("B_CODE","BarcodeName"),("GRCODE","Quality"),
        ("QLTY","QualityCode"),("COMPANY","Company"),("UNIT","Unit"),("FIX_SL","SaleRate"),
        ("WH_SL_RT","WholesaleRate"),("P_RT","PurchaseRate"),("HSNCODE","HSNCode"),("GSTPS","GSTPercent"),
        ("BOX","BoxQty"),("MIN_LVL","MinLevel"),("REO_LVL","ReorderLevel"),("TQTY","TotalQty"),
        ("ITTY","ItemType"),("MARK","Mark"),("ACT_YN","Active"),("DATE","LastUpdated")]
    d = DBF(os.path.join(src,"itm.dbf"), ignore_missing_memofile=True, char_decode_errors='ignore')
    rows=[{plain:clean(r.get(raw,"")) for raw,plain in item_map} for r in d]
    counts["items_master"]=write_outputs("items_master",[p for _,p in item_map],rows)

    # 3. TRANSPORTS -- merge transport.dbf + transpor.dbf, dedup by name
    trows=[]
    for fn in ["transport.dbf","transpor.dbf"]:
        p=os.path.join(src,fn)
        if os.path.exists(p):
            for r in DBF(p, ignore_missing_memofile=True, char_decode_errors='ignore'):
                nm=clean(r.get("NAME",""))
                if nm: trows.append({"TransportName":nm,"Source":fn})
    seen=set(); uniq=[]
    for r in trows:
        k=r["TransportName"].upper()
        if k not in seen: seen.add(k); uniq.append(r)
    counts["transports"]=write_outputs("transports",["TransportName","Source"],uniq)

    # 4. STATIONS reference -- from city.dbf
    d = DBF(os.path.join(src,"city.dbf"), ignore_missing_memofile=True, char_decode_errors='ignore')
    srows=[{"Station":clean(r.get("CITY","")),"Status":clean(r.get("STATUS",""))} for r in d if clean(r.get("CITY",""))]
    counts["stations"]=write_outputs("stations",["Station","Status"],srows)

    return counts

if __name__=="__main__":
    src=pick_year(SHADOW)
    os.makedirs(OUT, exist_ok=True)
    counts=extract(src)
    print(f"Extracted from {src}")
    for k,v in counts.items():
        print(f"  {k}: {v} rows")
