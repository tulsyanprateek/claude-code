#!/usr/bin/env python3
"""
Push data-dump JSON files to the shared PSA Master Data Google Sheet.

Run this after extract_master_data.py regenerates the CSV/JSON files, to
sync today's ERP data into the sheet that all psa_tools apps read from.

Usage:
    python push_to_sheets.py
"""
import json, os, sys, urllib.request

# Paste your deployed psa_masterdata_backend.gs Web App /exec URL here.
BACKEND_URL = os.environ.get(
    "PSA_MASTERDATA_URL",
    "https://script.google.com/macros/s/AKfycbyj_R7d3FJF4Wy-N4c5yCAmO9A9e6aLVxdRoTY4jTeKvnA7x-kzYCVjnYYQ7PdrxeR2UA/exec"
)
DATA_DIR = os.path.dirname(os.path.abspath(__file__))

DATASETS = {
    "parties":    "customers_suppliers_master.json",
    "items":      "items_master.json",
    "transports": "transports.json",
    "stations":   "stations.json",
}

def push(dataset, filename):
    path = os.path.join(DATA_DIR, filename)
    with open(path, encoding="utf-8-sig") as f:
        rows = json.load(f)
    payload = json.dumps({"action": "importMaster", "dataset": dataset, "rows": rows}).encode("utf-8")
    req = urllib.request.Request(
        BACKEND_URL, data=payload,
        headers={"Content-Type": "text/plain;charset=utf-8"}
    )
    with urllib.request.urlopen(req, timeout=120) as resp:
        result = json.loads(resp.read().decode("utf-8"))
    print(f"  {dataset}: {result}")
    return bool(result.get("ok"))

def main():
    if not BACKEND_URL:
        sys.exit(
            "ERROR: paste your deployed psa_masterdata_backend.gs Web App /exec URL "
            "into BACKEND_URL near the top of this file, then run again."
        )
    print(f"Pushing to {BACKEND_URL}\n")
    ok = True
    for dataset, filename in DATASETS.items():
        ok = push(dataset, filename) and ok
    print("\n" + ("All datasets pushed OK." if ok else "One or more datasets FAILED — see above."))
    sys.exit(0 if ok else 1)

if __name__ == "__main__":
    main()
