"""
WBS Migration Script: Rebuild WBS hierarchy from Terminplan Excel.

Reads the Terminplan data, builds proper hierarchy with parent_id linkage,
handles "Already Executed" grouping, and generates SQL for Supabase.
"""

import json
import uuid
import sys

# Project constants
PROJECT_ID = "5f0fc90a-00b7-4cf7-aaba-22dde8118fa1"

# Deterministic UUID generation from pos code
NAMESPACE = uuid.UUID(PROJECT_ID)

def make_uuid(pos_code: str) -> str:
    return str(uuid.uuid5(NAMESPACE, pos_code))

ALREADY_EXECUTED_ID = make_uuid("ALREADY_EXECUTED")


def load_terminplan_data(filepath: str) -> list[dict]:
    items = []
    with open(filepath, 'r', encoding='utf-8') as f:
        for line in f:
            line = line.strip()
            if line.startswith('{'):
                items.append(json.loads(line))
    return items


def determine_level(pos: str) -> int:
    parts = pos.split('.')
    if len(parts) == 3:
        if parts[1] == '0' and parts[2] == '0':
            return 0
        elif parts[2] == '0':
            return 1
        else:
            return 2
    elif len(parts) == 4:
        return 3
    return 2


def determine_parent_pos(pos: str) -> str | None:
    parts = pos.split('.')
    if len(parts) == 4:
        return f"{parts[0]}.{parts[1]}.{parts[2]}"
    elif len(parts) == 3:
        if parts[2] != '0':
            return f"{parts[0]}.{parts[1]}.0"
        elif parts[1] != '0':
            return f"{parts[0]}.0.0"
        else:
            return None
    return None


def escape_sql(s) -> str:
    if s is None:
        return 'NULL'
    return "'" + str(s).replace("'", "''") + "'"


def build_wbs_sql(items: list[dict]) -> list[str]:
    statements = []

    # Delete existing data
    statements.append(f"DELETE FROM daily_allocations WHERE wbs_item_id IN (SELECT id FROM wbs_items WHERE project_id = '{PROJECT_ID}');")
    statements.append(f"DELETE FROM wbs_items WHERE project_id = '{PROJECT_ID}';")

    # Build lookup maps
    pos_map = {item['pos']: item for item in items}
    pos_to_uuid = {item['pos']: make_uuid(item['pos']) for item in items}
    pos_to_uuid['ALREADY_EXECUTED'] = ALREADY_EXECUTED_ID

    # Determine which items have children
    has_children = set()
    for item in items:
        parent_pos = determine_parent_pos(item['pos'])
        if parent_pos and parent_pos in pos_map:
            has_children.add(parent_pos)

    # Determine completed items (progress == 1.0)
    completed = {item['pos'] for item in items if item.get('progress') == 1.0}

    # Determine which completed items should be moved to "Already Executed"
    # Rule: move to AE if item is 100% AND its natural parent is NOT 100%
    # This means entire completed subtrees move together
    move_to_ae = set()
    for pos in completed:
        parent_pos = determine_parent_pos(pos)
        if parent_pos is None or parent_pos not in completed:
            move_to_ae.add(pos)

    # Sort items for proper insertion order:
    # 1. Area roots (level 0)
    # 2. Categories (level 1)
    # 3. Tasks (level 2)
    # 4. Sub-tasks (level 3)
    # Within each level, sort by pos code
    def sort_key(item):
        pos = item['pos']
        parts = pos.split('.')
        # Pad parts to consistent length for sorting
        nums = [int(p) for p in parts] + [0] * (4 - len(parts))
        return (determine_level(pos), nums[0], nums[1], nums[2], nums[3] if len(nums) > 3 else 0)

    sorted_items = sorted(items, key=sort_key)

    # Insert "Already Executed" container
    sort_order = 0
    statements.append(
        f"INSERT INTO wbs_items (id, project_id, parent_id, wbs_code, wbs_name, qty, unit, sort_order, level, is_summary) VALUES "
        f"('{ALREADY_EXECUTED_ID}', '{PROJECT_ID}', NULL, '0.0', 'Already Executed', 0, 'pcs', {sort_order}, 0, true);"
    )
    sort_order += 1

    # Insert all items
    for item in sorted_items:
        pos = item['pos']
        item_uuid = pos_to_uuid[pos]
        level = determine_level(pos)
        parent_pos = determine_parent_pos(pos)
        is_sum = pos in has_children

        # Determine parent_id
        if pos in move_to_ae:
            # This completed item/subtree root moves under Already Executed
            parent_id = ALREADY_EXECUTED_ID
        elif parent_pos and parent_pos in pos_to_uuid:
            parent_id = pos_to_uuid[parent_pos]
        else:
            parent_id = None

        # Handle qty/done
        qty = item.get('qty', 0) or 0
        done = item.get('done', 0) or 0

        # For leaf items with no data (qty=0), set qty=1, done=0
        if qty == 0 and not is_sum:
            if item.get('manpower', 0) == 0 and item.get('total_md', 0) == 0:
                qty = 1
                done = 0

        wbs_name = item.get('task', f'Item {pos}')
        parent_sql = f"'{parent_id}'" if parent_id else 'NULL'

        statements.append(
            f"INSERT INTO wbs_items (id, project_id, parent_id, wbs_code, wbs_name, qty, unit, sort_order, level, is_summary) VALUES "
            f"({escape_sql(item_uuid)}, '{PROJECT_ID}', {parent_sql}, {escape_sql(pos)}, {escape_sql(wbs_name)}, {qty}, {escape_sql('pcs')}, {sort_order}, {level}, {str(is_sum).lower()});"
        )
        sort_order += 1

    return statements


def main():
    data_file = sys.argv[1] if len(sys.argv) > 1 else "terminplan_data.jsonl"
    items = load_terminplan_data(data_file)

    print(f"Loaded {len(items)} WBS items from Terminplan")

    # Show completed items
    completed = [i for i in items if i.get('progress') == 1.0]
    print(f"Items at 100% progress: {len(completed)}")

    # Show which will be moved to Already Executed
    pos_map = {item['pos']: item for item in items}
    completed_set = {item['pos'] for item in items if item.get('progress') == 1.0}
    for c in completed:
        parent_pos = determine_parent_pos(c['pos'])
        if parent_pos is None or parent_pos not in completed_set:
            print(f"  -> AE: {c['pos']}: {c['task']}")
        else:
            print(f"  (stays under {parent_pos}): {c['pos']}: {c['task']}")

    # Build SQL
    sql_statements = build_wbs_sql(items)
    print(f"\nGenerated {len(sql_statements)} SQL statements")

    # Write combined SQL
    with open("wbs_migration.sql", 'w', encoding='utf-8') as f:
        for stmt in sql_statements:
            f.write(stmt + '\n')

    # Write batches for Supabase MCP execution
    batch_size = 30
    for i in range(0, len(sql_statements), batch_size):
        batch = sql_statements[i:i+batch_size]
        batch_file = f"wbs_migration_batch_{i//batch_size}.sql"
        with open(batch_file, 'w', encoding='utf-8') as f:
            f.write('\n'.join(batch))
        print(f"Batch {i//batch_size}: {batch_file} ({len(batch)} statements)")


if __name__ == '__main__':
    main()
