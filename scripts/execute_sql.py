"""Execute SQL files against Supabase using the REST API."""

import sys
import requests

SUPABASE_URL = "https://tfcmfbfnvrtsfqevwsko.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRmY21mYmZudnJ0c2ZxZXZ3c2tvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE1OTU3OTUsImV4cCI6MjA4NzE3MTc5NX0.Oy8IQgRFTpZI6Trl8RH15_RpofI-KqW0SddFLhvOcW0"

def execute_sql(sql: str) -> dict:
    """Execute SQL via Supabase REST API (rpc endpoint)."""
    url = f"{SUPABASE_URL}/rest/v1/rpc/exec_sql"
    headers = {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type": "application/json",
    }
    response = requests.post(url, json={"query": sql}, headers=headers)
    return response.status_code, response.text

def main():
    files = sys.argv[1:]
    if not files:
        print("Usage: python execute_sql.py file1.sql file2.sql ...")
        return

    for f in files:
        print(f"\n--- Executing {f} ---")
        with open(f, 'r', encoding='utf-8') as fh:
            sql = fh.read()
        print(f"  SQL length: {len(sql)} chars")

        status, text = execute_sql(sql)
        print(f"  Status: {status}")
        if status != 200:
            print(f"  Error: {text[:500]}")
        else:
            print(f"  OK: {text[:200]}")

if __name__ == '__main__':
    main()
