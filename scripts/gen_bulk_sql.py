"""Generate a single bulk INSERT for all WBS items."""

import json
import uuid
import sys

PROJECT_ID = "5f0fc90a-00b7-4cf7-aaba-22dde8118fa1"
NAMESPACE = uuid.UUID(PROJECT_ID)

def make_uuid(pos_code: str) -> str:
    return str(uuid.uuid5(NAMESPACE, pos_code))

ALREADY_EXECUTED_ID = make_uuid("ALREADY_EXECUTED")

def load_data(filepath: str) -> list[dict]:
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
        if parts[1] == '0' and parts[2] == '0': return 0
        elif parts[2] == '0': return 1
        else: return 2
    elif len(parts) == 4: return 3
    return 2

def determine_parent_pos(pos: str) -> str | None:
    parts = pos.split('.')
    if len(parts) == 4:
        return f"{parts[0]}.{parts[1]}.{parts[2]}"
    elif len(parts) == 3:
        if parts[2] != '0': return f"{parts[0]}.{parts[1]}.0"
        elif parts[1] != '0': return f"{parts[0]}.0.0"
    return None

def esc(s) -> str:
    if s is None: return 'NULL'
    return "'" + str(s).replace("'", "''").replace('\u2013', '-').replace('\u00fc', 'u').replace('\u00e4', 'a').replace('\u00f6', 'o') + "'"

def main():
    data_file = sys.argv[1]
    items = load_data(data_file)

    pos_map = {item['pos']: item for item in items}
    pos_to_uuid = {item['pos']: make_uuid(item['pos']) for item in items}

    has_children = set()
    for item in items:
        pp = determine_parent_pos(item['pos'])
        if pp and pp in pos_map:
            has_children.add(pp)

    completed = {item['pos'] for item in items if item.get('progress') == 1.0}
    move_to_ae = set()
    for pos in completed:
        pp = determine_parent_pos(pos)
        if pp is None or pp not in completed:
            move_to_ae.add(pos)

    def sort_key(item):
        pos = item['pos']
        parts = [int(p) for p in pos.split('.')]
        parts += [0] * (4 - len(parts))
        return (determine_level(pos), parts[0], parts[1], parts[2], parts[3])

    sorted_items = sorted(items, key=sort_key)

    # Build VALUES rows
    rows = []
    sort_order = 0

    # Already Executed
    rows.append(f"('{ALREADY_EXECUTED_ID}', '{PROJECT_ID}', NULL, '0.0', 'Already Executed', 0, 'pcs', {sort_order}, 0, true)")
    sort_order += 1

    for item in sorted_items:
        pos = item['pos']
        item_uuid = pos_to_uuid[pos]
        level = determine_level(pos)
        pp = determine_parent_pos(pos)
        is_sum = pos in has_children

        if pos in move_to_ae:
            parent_id = ALREADY_EXECUTED_ID
        elif pp and pp in pos_to_uuid:
            parent_id = pos_to_uuid[pp]
        else:
            parent_id = None

        qty = item.get('qty', 0) or 0
        if qty == 0 and not is_sum and level >= 2:
            if item.get('manpower', 0) == 0 and item.get('total_md', 0) == 0:
                qty = 1

        name = esc(item.get('task', f'Item {pos}'))
        pid = f"'{parent_id}'" if parent_id else 'NULL'

        rows.append(f"('{item_uuid}', '{PROJECT_ID}', {pid}, {esc(pos)}, {name}, {qty}, 'pcs', {sort_order}, {level}, {str(is_sum).lower()})")
        sort_order += 1

    # Split into chunks of 40 rows each
    chunk_size = 40
    for i in range(0, len(rows), chunk_size):
        chunk = rows[i:i+chunk_size]
        sql = "INSERT INTO wbs_items (id, project_id, parent_id, wbs_code, wbs_name, qty, unit, sort_order, level, is_summary) VALUES\n"
        sql += ",\n".join(chunk) + ";"
        fname = f"wbs_bulk_{i//chunk_size}.sql"
        with open(fname, 'w', encoding='utf-8') as f:
            f.write(sql)
        print(f"Chunk {i//chunk_size}: {fname} ({len(chunk)} rows)")

if __name__ == '__main__':
    main()
