"""
Import WBS activities + daily allocations from CSV files into Supabase.

Reads:
  DATA/260222_WBS_DB Files/wbs_activities.csv
  DATA/260222_WBS_DB Files/wbs_daily_allocation.csv

Generates:
  scripts/sql_01_delete.sql       — Clear existing data
  scripts/sql_02_wbs_insert.sql   — Insert WBS items (chunked)
  scripts/sql_03_alloc_insert.sql — Insert daily allocations (chunked)
  scripts/qa_report.txt           — QA/QC validation report

Column mapping (CSV → Supabase wbs_items):
  wbs_code        → wbs_code
  description     → wbs_name
  tp_pos          → tp_pos
  package         → pkg
  building        → building
  nta_ref         → nta_ref
  status          → status
  budget_eur      → budget_eur
  target_kw       → target_kw
  qty_total       → qty
  qty_done/rem    → done_ext/rem_ext or done_int/rem_int (based on scope)
  manpower_per_day→ manpower
  duration_days   → duration
  total_mandays   → total_md
  scope           → scope
  responsible     → responsible
  payment_ref     → pmt_ref
  level           → level
  parent_wbs      → parent_id (UUID lookup)
  is_leaf         → is_summary (inverted)
  CSV row order   → sort_order
"""

import csv
import uuid
import json
import os
from datetime import datetime

PROJECT_ID = '5f0fc90a-00b7-4cf7-aaba-22dde8118fa1'

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(BASE_DIR, 'DATA', '260222_WBS_DB Files')
OUT_DIR = os.path.join(BASE_DIR, 'scripts')

def read_activities():
    """Read wbs_activities.csv and return list of dicts."""
    path = os.path.join(DATA_DIR, 'wbs_activities.csv')
    with open(path, encoding='utf-8') as f:
        reader = csv.DictReader(f)
        return list(reader)

def read_allocations():
    """Read wbs_daily_allocation.csv and return list of dicts."""
    path = os.path.join(DATA_DIR, 'wbs_daily_allocation.csv')
    with open(path, encoding='utf-8') as f:
        reader = csv.DictReader(f)
        return list(reader)

def escape_sql(val):
    """Escape single quotes for SQL."""
    if val is None:
        return 'NULL'
    s = str(val).replace("'", "''")
    return f"'{s}'"

def num_or_null(val, default=None):
    """Convert to number or NULL."""
    if val is None or val == '' or val == 'null':
        if default is not None:
            return str(default)
        return 'NULL'
    try:
        return str(float(val))
    except ValueError:
        if default is not None:
            return str(default)
        return 'NULL'

def int_or_null(val, default=None):
    """Convert to integer or NULL."""
    if val is None or val == '' or val == 'null':
        if default is not None:
            return str(default)
        return 'NULL'
    try:
        return str(int(float(val)))
    except ValueError:
        if default is not None:
            return str(default)
        return 'NULL'

def str_or_null(val):
    """Convert to escaped string or NULL."""
    if val is None or val == '' or val == 'null':
        return 'NULL'
    return escape_sql(val)

def validate_activities(activities):
    """QA/QC validation of activities data."""
    errors = []
    warnings = []

    wbs_codes = set()
    for i, a in enumerate(activities):
        code = a['wbs_code']

        # Check unique wbs_code
        if code in wbs_codes:
            errors.append(f"ROW {i+2}: Duplicate wbs_code '{code}'")
        wbs_codes.add(code)

        # Check description not empty
        if not a['description'].strip():
            errors.append(f"ROW {i+2}: Empty description for wbs_code '{code}'")

        # Check level is valid
        try:
            level = int(a['level'])
            if level < 1 or level > 6:
                errors.append(f"ROW {i+2}: Invalid level {level} for '{code}'")
        except ValueError:
            errors.append(f"ROW {i+2}: Non-numeric level for '{code}'")

        # Check parent exists
        parent = a['parent_wbs']
        if parent and parent not in wbs_codes:
            # Parent might come later? Check all codes
            all_codes = set(x['wbs_code'] for x in activities)
            if parent not in all_codes:
                errors.append(f"ROW {i+2}: Parent '{parent}' not found for '{code}'")

        # Check parent level consistency
        if parent:
            parent_row = next((x for x in activities if x['wbs_code'] == parent), None)
            if parent_row:
                parent_level = int(parent_row['level'])
                child_level = int(a['level'])
                if child_level != parent_level + 1:
                    warnings.append(f"ROW {i+2}: Level mismatch '{code}' (L{child_level}) under '{parent}' (L{parent_level})")

        # Check is_leaf consistency
        is_leaf = a['is_leaf'] == 'True'
        has_children = any(x['parent_wbs'] == code for x in activities)
        if is_leaf and has_children:
            warnings.append(f"ROW {i+2}: '{code}' marked as leaf but has children")

        # Validate numeric fields
        for field in ['budget_eur', 'qty_total', 'qty_done', 'qty_remaining',
                       'manpower_per_day', 'duration_days', 'total_mandays']:
            val = a[field]
            if val and val != '':
                try:
                    n = float(val)
                    if n < 0:
                        warnings.append(f"ROW {i+2}: Negative {field}={val} for '{code}'")
                except ValueError:
                    errors.append(f"ROW {i+2}: Non-numeric {field}='{val}' for '{code}'")

        # Check baseline dates
        bs = a['baseline_start']
        bf = a['baseline_finish']
        if bs and bf:
            try:
                start = datetime.strptime(bs, '%Y-%m-%d')
                finish = datetime.strptime(bf, '%Y-%m-%d')
                if finish < start:
                    errors.append(f"ROW {i+2}: baseline_finish < baseline_start for '{code}'")
            except ValueError:
                errors.append(f"ROW {i+2}: Invalid date format for '{code}'")

    return errors, warnings

def validate_allocations(allocations, wbs_codes):
    """QA/QC validation of allocations data."""
    errors = []
    warnings = []

    seen = set()
    for i, a in enumerate(allocations):
        code = a['wbs_code']
        date = a['date']

        # Check WBS code exists
        if code not in wbs_codes:
            errors.append(f"ALLOC ROW {i+2}: wbs_code '{code}' not in activities")

        # Check unique (wbs_code, date)
        key = (code, date)
        if key in seen:
            errors.append(f"ALLOC ROW {i+2}: Duplicate ({code}, {date})")
        seen.add(key)

        # Check date format
        try:
            d = datetime.strptime(date, '%Y-%m-%d')
            if d.year < 2025 or d.year > 2027:
                warnings.append(f"ALLOC ROW {i+2}: Unusual date {date} for '{code}'")
        except ValueError:
            errors.append(f"ALLOC ROW {i+2}: Invalid date '{date}'")

        # Check manpower values
        bm = a['baseline_manpower']
        try:
            n = int(bm)
            if n < 0:
                errors.append(f"ALLOC ROW {i+2}: Negative baseline_manpower={bm}")
            if n > 50:
                warnings.append(f"ALLOC ROW {i+2}: High baseline_manpower={bm} for '{code}'")
        except (ValueError, TypeError):
            errors.append(f"ALLOC ROW {i+2}: Invalid baseline_manpower='{bm}'")

    return errors, warnings

def generate_wbs_sql(activities, uuid_map, parent_map):
    """Generate INSERT SQL for wbs_items."""
    columns = [
        'id', 'project_id', 'parent_id', 'wbs_code', 'wbs_name',
        'qty', 'unit', 'sort_order', 'level', 'is_summary',
        'building', 'nta_ref', 'status', 'scope', 'budget_eur',
        'target_kw', 'notes', 'qty_ext', 'done_ext', 'rem_ext',
        'qty_int', 'done_int', 'rem_int', 'tp_pos', 'pkg',
        'manpower', 'duration', 'total_md', 'responsible', 'pmt_ref'
    ]

    col_str = ', '.join(columns)

    values_list = []
    for i, a in enumerate(activities):
        code = a['wbs_code']
        item_uuid = uuid_map[code]
        parent_wbs = a['parent_wbs']
        parent_uuid = parent_map.get(code)

        is_leaf = a['is_leaf'] == 'True'
        is_summary = not is_leaf  # summary = branch node

        scope = a.get('scope', '')
        qty_total = a.get('qty_total', '')
        qty_done = a.get('qty_done', '')
        qty_remaining = a.get('qty_remaining', '')

        # Split qty into ext/int based on scope
        qty_ext = qty_int = done_ext = done_int = rem_ext = rem_int = '0'
        if 'INT' in scope.upper() and 'EXT' not in scope.upper():
            qty_int = num_or_null(qty_total, 0)
            done_int = num_or_null(qty_done, 0)
            rem_int = num_or_null(qty_remaining, 0)
        elif 'EXT' in scope.upper() and 'INT' not in scope.upper():
            qty_ext = num_or_null(qty_total, 0)
            done_ext = num_or_null(qty_done, 0)
            rem_ext = num_or_null(qty_remaining, 0)
        elif 'EXT' in scope.upper() and 'INT' in scope.upper():
            # Both: put in ext for now
            qty_ext = num_or_null(qty_total, 0)
            done_ext = num_or_null(qty_done, 0)
            rem_ext = num_or_null(qty_remaining, 0)
        else:
            # No scope specified, put in ext
            qty_ext = num_or_null(qty_total, 0)
            done_ext = num_or_null(qty_done, 0)
            rem_ext = num_or_null(qty_remaining, 0)

        vals = [
            f"'{item_uuid}'",                      # id
            f"'{PROJECT_ID}'",                      # project_id
            f"'{parent_uuid}'" if parent_uuid else 'NULL',  # parent_id
            escape_sql(code),                       # wbs_code
            escape_sql(a['description']),           # wbs_name
            num_or_null(qty_total, 0),              # qty
            "'pcs'",                                # unit
            str(i),                                 # sort_order
            int_or_null(a['level'], 0),             # level
            str(is_summary).lower(),                # is_summary
            str_or_null(a.get('building')),          # building
            str_or_null(a.get('nta_ref')),           # nta_ref
            str_or_null(a.get('status')),            # status
            str_or_null(scope),                      # scope
            num_or_null(a.get('budget_eur'), 0),     # budget_eur
            str_or_null(a.get('target_kw')),         # target_kw
            str_or_null(a.get('source')),             # notes (using source field)
            qty_ext,                                 # qty_ext
            done_ext,                                # done_ext
            rem_ext,                                 # rem_ext
            qty_int,                                 # qty_int
            done_int,                                # done_int
            rem_int,                                 # rem_int
            str_or_null(a.get('tp_pos')),             # tp_pos
            str_or_null(a.get('package')),             # pkg
            num_or_null(a.get('manpower_per_day'), 0), # manpower
            num_or_null(a.get('duration_days'), 0),    # duration
            num_or_null(a.get('total_mandays'), 0),    # total_md
            str_or_null(a.get('responsible')),         # responsible
            str_or_null(a.get('payment_ref')),         # pmt_ref
        ]

        values_list.append(f"  ({', '.join(vals)})")

    # Chunk into batches of 50
    chunks = []
    for start in range(0, len(values_list), 50):
        batch = values_list[start:start+50]
        sql = f"INSERT INTO wbs_items ({col_str}) VALUES\n"
        sql += ',\n'.join(batch) + ';\n'
        chunks.append(sql)

    return chunks

def generate_alloc_sql(allocations, uuid_map):
    """Generate INSERT SQL for daily_allocations."""
    columns = ['id', 'wbs_item_id', 'date', 'planned_manpower', 'actual_manpower',
                'qty_done', 'notes', 'source']
    col_str = ', '.join(columns)

    values_list = []
    skipped = []

    for a in allocations:
        code = a['wbs_code']
        if code not in uuid_map:
            skipped.append(code)
            continue

        alloc_uuid = str(uuid.uuid4())
        wbs_uuid = uuid_map[code]

        baseline_mp = int_or_null(a['baseline_manpower'], 0)
        actual_mp = int_or_null(a.get('actual_manpower'), 0)

        vals = [
            f"'{alloc_uuid}'",          # id
            f"'{wbs_uuid}'",            # wbs_item_id
            f"'{a['date']}'",           # date
            baseline_mp,                 # planned_manpower
            actual_mp,                   # actual_manpower
            '0',                         # qty_done
            str_or_null(f"KW{a.get('kw', '')} {a.get('day_of_week', '')}"),  # notes
            "'baseline'",                # source
        ]

        values_list.append(f"  ({', '.join(vals)})")

    # Chunk into batches of 100
    chunks = []
    for start in range(0, len(values_list), 100):
        batch = values_list[start:start+100]
        sql = f"INSERT INTO daily_allocations ({col_str}) VALUES\n"
        sql += ',\n'.join(batch) + ';\n'
        chunks.append(sql)

    return chunks, skipped

def main():
    print("=" * 70)
    print("WBS Import Script v4 — QA/QC + SQL Generation")
    print("=" * 70)

    # 1. Read data
    print("\n[1] Reading CSV files...")
    activities = read_activities()
    allocations = read_allocations()
    print(f"    Activities:  {len(activities)} rows")
    print(f"    Allocations: {len(allocations)} rows")

    # 2. Validate activities
    print("\n[2] Validating activities...")
    act_errors, act_warnings = validate_activities(activities)
    print(f"    Errors:   {len(act_errors)}")
    print(f"    Warnings: {len(act_warnings)}")
    for e in act_errors[:10]:
        print(f"    ❌ {e}")
    for w in act_warnings[:10]:
        print(f"    ⚠️  {w}")

    # 3. Validate allocations
    print("\n[3] Validating allocations...")
    wbs_codes = set(a['wbs_code'] for a in activities)
    alloc_errors, alloc_warnings = validate_allocations(allocations, wbs_codes)
    print(f"    Errors:   {len(alloc_errors)}")
    print(f"    Warnings: {len(alloc_warnings)}")
    for e in alloc_errors[:10]:
        print(f"    ❌ {e}")
    for w in alloc_warnings[:10]:
        print(f"    ⚠️  {w}")

    if act_errors or alloc_errors:
        print("\n⛔ CRITICAL ERRORS FOUND — review before proceeding")

    # 4. Generate UUIDs
    print("\n[4] Generating UUIDs...")
    uuid_map = {}
    for a in activities:
        uuid_map[a['wbs_code']] = str(uuid.uuid4())
    print(f"    Generated {len(uuid_map)} UUIDs")

    # 5. Build parent mapping
    print("\n[5] Building parent hierarchy...")
    parent_map = {}
    orphans = []
    for a in activities:
        parent_wbs = a['parent_wbs']
        if parent_wbs:
            if parent_wbs in uuid_map:
                parent_map[a['wbs_code']] = uuid_map[parent_wbs]
            else:
                orphans.append(a['wbs_code'])

    roots = [a['wbs_code'] for a in activities if not a['parent_wbs']]
    print(f"    Root nodes:  {len(roots)} ({', '.join(roots)})")
    print(f"    With parent: {len(parent_map)}")
    print(f"    Orphans:     {len(orphans)}")
    if orphans:
        for o in orphans:
            print(f"    ❌ Orphan: {o}")

    # 6. Level distribution
    print("\n[6] Level distribution:")
    levels = {}
    for a in activities:
        lvl = int(a['level'])
        levels[lvl] = levels.get(lvl, 0) + 1
    for lvl in sorted(levels):
        print(f"    L{lvl}: {levels[lvl]} items")

    # 7. Generate DELETE SQL
    print("\n[7] Generating SQL...")
    delete_sql = f"""-- Delete existing data for project
DELETE FROM daily_allocations
WHERE wbs_item_id IN (
  SELECT id FROM wbs_items WHERE project_id = '{PROJECT_ID}'
);
DELETE FROM wbs_items WHERE project_id = '{PROJECT_ID}';
"""

    with open(os.path.join(OUT_DIR, 'sql_01_delete.sql'), 'w', encoding='utf-8') as f:
        f.write(delete_sql)
    print(f"    sql_01_delete.sql written")

    # 8. Generate WBS INSERT SQL
    wbs_chunks = generate_wbs_sql(activities, uuid_map, parent_map)
    for i, chunk in enumerate(wbs_chunks):
        fname = f'sql_02_wbs_insert_{i+1}.sql'
        with open(os.path.join(OUT_DIR, fname), 'w', encoding='utf-8') as f:
            f.write(chunk)
        print(f"    {fname} written ({chunk.count('VALUES') * 50} rows approx)")

    # 9. Generate allocation INSERT SQL
    alloc_chunks, skipped = generate_alloc_sql(allocations, uuid_map)
    for i, chunk in enumerate(alloc_chunks):
        fname = f'sql_03_alloc_insert_{i+1}.sql'
        with open(os.path.join(OUT_DIR, fname), 'w', encoding='utf-8') as f:
            f.write(chunk)
        print(f"    {fname} written")
    if skipped:
        print(f"    ⚠️  Skipped {len(set(skipped))} allocation codes (not in activities)")

    # 10. Save UUID mapping for reference
    with open(os.path.join(OUT_DIR, 'uuid_mapping.json'), 'w', encoding='utf-8') as f:
        json.dump(uuid_map, f, indent=2)
    print(f"    uuid_mapping.json written")

    # 11. QA Report
    print("\n[8] Writing QA report...")
    report = []
    report.append("=" * 70)
    report.append("QA/QC REPORT — WBS Import v4")
    report.append(f"Generated: {datetime.now().isoformat()}")
    report.append("=" * 70)
    report.append(f"\nProject ID: {PROJECT_ID}")
    report.append(f"Activities: {len(activities)}")
    report.append(f"Allocations: {len(allocations)}")
    report.append(f"Leaf activities: {sum(1 for a in activities if a['is_leaf'] == 'True')}")
    report.append(f"Branch activities: {sum(1 for a in activities if a['is_leaf'] != 'True')}")
    report.append(f"Root nodes: {len(roots)} ({', '.join(roots)})")
    report.append(f"\nLevel distribution:")
    for lvl in sorted(levels):
        report.append(f"  L{lvl}: {levels[lvl]}")
    report.append(f"\nAllocation coverage:")
    alloc_codes = set(a['wbs_code'] for a in allocations)
    leaf_codes = set(a['wbs_code'] for a in activities if a['is_leaf'] == 'True')
    report.append(f"  Leaf activities with allocations: {len(alloc_codes & leaf_codes)}/{len(leaf_codes)}")
    report.append(f"  Leaf activities without allocations: {len(leaf_codes - alloc_codes)}")
    unmatched = alloc_codes - wbs_codes
    report.append(f"  Allocation codes not in activities: {len(unmatched)}")
    if unmatched:
        for u in sorted(unmatched):
            report.append(f"    ❌ {u}")

    report.append(f"\nDate range: {min(a['date'] for a in allocations)} to {max(a['date'] for a in allocations)}")
    kws = sorted(set(int(a['kw']) for a in allocations))
    report.append(f"KW range: KW{min(kws)} to KW{max(kws)}")

    report.append(f"\n--- ERRORS ({len(act_errors) + len(alloc_errors)}) ---")
    for e in act_errors:
        report.append(f"  ❌ {e}")
    for e in alloc_errors:
        report.append(f"  ❌ {e}")

    report.append(f"\n--- WARNINGS ({len(act_warnings) + len(alloc_warnings)}) ---")
    for w in act_warnings:
        report.append(f"  ⚠️  {w}")
    for w in alloc_warnings:
        report.append(f"  ⚠️  {w}")

    report.append(f"\n--- HIERARCHY VALIDATION ---")
    # Check every parent_wbs resolves
    for a in activities:
        if a['parent_wbs'] and a['parent_wbs'] not in wbs_codes:
            report.append(f"  ❌ Broken parent ref: {a['wbs_code']} → {a['parent_wbs']}")

    # Check sort_order preserves DFS order (parent before children)
    code_to_idx = {a['wbs_code']: i for i, a in enumerate(activities)}
    for a in activities:
        if a['parent_wbs'] and a['parent_wbs'] in code_to_idx:
            parent_idx = code_to_idx[a['parent_wbs']]
            child_idx = code_to_idx[a['wbs_code']]
            if parent_idx >= child_idx:
                report.append(f"  ❌ Sort violation: parent '{a['parent_wbs']}' (idx {parent_idx}) after child '{a['wbs_code']}' (idx {child_idx})")

    report.append(f"\n--- MANPOWER SUMMARY ---")
    total_baseline_md = sum(int(a['baseline_manpower']) for a in allocations)
    report.append(f"  Total baseline man-days: {total_baseline_md}")
    by_kw = {}
    for a in allocations:
        kw = int(a['kw'])
        by_kw[kw] = by_kw.get(kw, 0) + int(a['baseline_manpower'])
    for kw in sorted(by_kw):
        report.append(f"  KW{kw:02d}: {by_kw[kw]} man-days")

    report_text = '\n'.join(report)
    with open(os.path.join(OUT_DIR, 'qa_report.txt'), 'w', encoding='utf-8') as f:
        f.write(report_text)
    print(f"    qa_report.txt written")

    # Summary
    print("\n" + "=" * 70)
    print("SUMMARY")
    print("=" * 70)
    print(f"  Total activities:    {len(activities)}")
    print(f"  Total allocations:   {len(allocations)}")
    print(f"  SQL files generated: {len(wbs_chunks) + len(alloc_chunks) + 1}")
    print(f"  Errors:              {len(act_errors) + len(alloc_errors)}")
    print(f"  Warnings:            {len(act_warnings) + len(alloc_warnings)}")

    if not (act_errors or alloc_errors):
        print("\n✅ All validations passed. SQL ready for execution.")
    else:
        print("\n⚠️  Review errors before executing SQL.")

if __name__ == '__main__':
    main()
