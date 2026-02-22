"""Upsert all WBS items from wbs_rebuild_v3.json into Supabase with full data."""
import json
import sys
import os
import urllib.request
import urllib.error

sys.stdout.reconfigure(encoding='utf-8')

SUPABASE_URL = "https://tfcmfbfnvrtsfqevwsko.supabase.co"
SUPABASE_SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_KEY", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRmY21mYmZudnJ0c2ZxZXZ3c2tvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTU5NTc5NSwiZXhwIjoyMDg3MTcxNzk1fQ.TJGOIGfkIStpduRxdCjm8w29uiag_1mk2ic6jdOVIlU")
PROJECT_ID = "5f0fc90a-00b7-4cf7-aaba-22dde8118fa1"

JSON_FILE = os.path.join(os.path.dirname(os.path.dirname(__file__)), "wbs_rebuild_v3.json")

def supabase_request(method, path, data=None):
    url = f"{SUPABASE_URL}/rest/v1/{path}"
    headers = {
        "apikey": SUPABASE_SERVICE_KEY,
        "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
        "Content-Type": "application/json",
        "Prefer": "resolution=merge-duplicates,return=minimal",
    }
    body = json.dumps(data).encode() if data else None
    req = urllib.request.Request(url, data=body, headers=headers, method=method)
    try:
        resp = urllib.request.urlopen(req)
        return resp.status, resp.read().decode()
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode()

def main():
    with open(JSON_FILE, "r", encoding="utf-8") as f:
        items = json.load(f)

    print(f"Loaded {len(items)} WBS items from JSON")

    # First, get existing items to map wbs_code -> id
    status, body = supabase_request("GET", f"wbs_items?project_id=eq.{PROJECT_ID}&select=id,wbs_code")
    existing = {}
    if status == 200 and body:
        for item in json.loads(body):
            existing[item["wbs_code"]] = item["id"]
    print(f"Found {len(existing)} existing items in DB")

    # Build parent_id map from JSON
    code_to_id = {}
    for item in items:
        code_to_id[item["wbs_code"]] = item["id"]

    # Process items sorted by level (parents first)
    items.sort(key=lambda x: x.get("level", 0))

    inserted = 0
    updated = 0
    errors = 0

    for item in items:
        wbs_code = item["wbs_code"]

        # Resolve parent_id
        parent_id = item.get("parent_id")
        if parent_id and parent_id not in existing.values():
            # Parent might be a JSON-generated UUID, need to find actual DB id
            # Find the parent wbs_code from JSON items
            parent_wbs = None
            for p in items:
                if p["id"] == parent_id:
                    parent_wbs = p["wbs_code"]
                    break
            if parent_wbs and parent_wbs in existing:
                parent_id = existing[parent_wbs]
            else:
                parent_id = None

        row = {
            "project_id": PROJECT_ID,
            "wbs_code": wbs_code,
            "wbs_name": item["wbs_name"],
            "qty": item.get("qty", 0) or 0,
            "unit": item.get("unit", "pcs"),
            "sort_order": item.get("sort_order", 0),
            "level": item.get("level", 0),
            "is_summary": item.get("is_summary", False),
            "building": item.get("building", ""),
            "nta_ref": item.get("nta_ref", ""),
            "status": item.get("status", ""),
            "budget_eur": item.get("budget_eur", 0) or 0,
            "target_kw": item.get("target_kw", ""),
            "scope": item.get("scope", ""),
            "notes": item.get("notes", ""),
            "qty_ext": item.get("qty_ext", 0) or 0,
            "done_ext": item.get("done_ext", 0) or 0,
            "rem_ext": item.get("rem_ext", 0) or 0,
            "qty_int": item.get("qty_int", 0) or 0,
            "done_int": item.get("done_int", 0) or 0,
            "rem_int": item.get("rem_int", 0) or 0,
        }

        if wbs_code in existing:
            # Update existing item
            db_id = existing[wbs_code]
            if parent_id:
                row["parent_id"] = parent_id
            # Remove project_id and wbs_code from update (they're part of unique constraint)
            update_row = {k: v for k, v in row.items() if k not in ("project_id", "wbs_code")}
            status, body = supabase_request("PATCH", f"wbs_items?id=eq.{db_id}", update_row)
            if status in (200, 204):
                updated += 1
            else:
                print(f"  ERROR updating {wbs_code}: {status} {body[:100]}")
                errors += 1
        else:
            # Insert new item
            if parent_id:
                row["parent_id"] = parent_id
            # Use the JSON-generated UUID as id
            row["id"] = item["id"]
            status, body = supabase_request("POST", "wbs_items", row)
            if status in (200, 201, 204):
                existing[wbs_code] = item["id"]
                inserted += 1
            else:
                print(f"  ERROR inserting {wbs_code}: {status} {body[:100]}")
                errors += 1

    print(f"\nDone! Inserted: {inserted}, Updated: {updated}, Errors: {errors}")
    print(f"Total WBS items in DB: {len(existing)}")

if __name__ == "__main__":
    main()
