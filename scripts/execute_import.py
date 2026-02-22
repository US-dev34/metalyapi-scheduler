"""Execute SQL files against Supabase via PostgREST RPC function.

Uses the exec_dynamic_sql() function created in the database to execute
arbitrary SQL via the REST API with the service role key.
"""
import os
import json
import urllib.request
import urllib.error
import sys

SUPABASE_URL = 'https://tfcmfbfnvrtsfqevwsko.supabase.co'
SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRmY21mYmZudnJ0c2ZxZXZ3c2tvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTU5NTc5NSwiZXhwIjoyMDg3MTcxNzk1fQ.TJGOIGfkIStpduRxdCjm8w29uiag_1mk2ic6jdOVIlU'

BASE_DIR = os.path.dirname(os.path.abspath(__file__))


def execute_sql_via_rpc(sql, label=""):
    """Execute SQL via PostgREST RPC calling exec_dynamic_sql()."""
    headers = {
        'apikey': SERVICE_KEY,
        'Authorization': f'Bearer {SERVICE_KEY}',
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal',
    }

    url = f"{SUPABASE_URL}/rest/v1/rpc/exec_dynamic_sql"
    data = json.dumps({"sql_text": sql}).encode('utf-8')

    req = urllib.request.Request(url, data=data, headers=headers, method='POST')
    try:
        with urllib.request.urlopen(req, timeout=120) as resp:
            result = resp.read().decode('utf-8')
            print(f"  OK: {label} ({resp.status})")
            return True, result
    except urllib.error.HTTPError as e:
        body = e.read().decode('utf-8')
        print(f"  HTTP {e.code}: {label}: {body[:500]}")
        return False, body
    except Exception as e:
        print(f"  ERROR: {label}: {e}")
        return False, str(e)


def verify_count(table, expected_label=""):
    """Verify row count via REST API."""
    headers = {
        'apikey': SERVICE_KEY,
        'Authorization': f'Bearer {SERVICE_KEY}',
        'Prefer': 'count=exact',
        'Range-Unit': 'items',
        'Range': '0-0',
    }
    url = f"{SUPABASE_URL}/rest/v1/{table}?select=id&project_id=eq.5f0fc90a-00b7-4cf7-aaba-22dde8118fa1"
    if table == 'daily_allocations':
        url = f"{SUPABASE_URL}/rest/v1/{table}?select=id&wbs_item_id=not.is.null"

    req = urllib.request.Request(url, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            count = resp.headers.get('Content-Range', '').split('/')[-1]
            print(f"  {expected_label}: {count} rows")
            return count
    except Exception as e:
        print(f"  Verify error: {e}")
        return None


def main():
    sys.stdout.reconfigure(encoding='utf-8')

    # Skip WBS chunk 1 (already executed via MCP)
    skip_wbs_1 = '--skip-wbs1' in sys.argv or True  # Always skip, already done

    # Collect SQL files
    sql_files = []

    # WBS inserts (skip chunk 1 if already done)
    for i in range(1, 6):
        if i == 1 and skip_wbs_1:
            print(f"  Skipping WBS chunk 1 (already inserted)")
            continue
        path = os.path.join(BASE_DIR, f'sql_02_wbs_insert_{i}.sql')
        if os.path.exists(path):
            sql_files.append((path, f'WBS chunk {i}'))

    # Allocation inserts
    for i in range(1, 10):
        path = os.path.join(BASE_DIR, f'sql_03_alloc_insert_{i}.sql')
        if os.path.exists(path):
            sql_files.append((path, f'Allocation chunk {i}'))

    print(f"\nExecuting {len(sql_files)} SQL files via RPC...")
    print("=" * 60)

    success = 0
    fail = 0
    for path, label in sql_files:
        with open(path, encoding='utf-8') as f:
            sql = f.read()
        ok, result = execute_sql_via_rpc(sql, label)
        if ok:
            success += 1
        else:
            fail += 1
            print(f"  STOPPING: {label} failed")
            break

    print("=" * 60)
    print(f"Results: {success} succeeded, {fail} failed")

    if fail == 0:
        print("\nVerifying counts...")
        verify_count('wbs_items', 'WBS items')
        verify_count('daily_allocations', 'Daily allocations')

    return fail == 0


if __name__ == '__main__':
    ok = main()
    sys.exit(0 if ok else 1)
