import os
import json

def process_sql_file(input_file, output_file, temp_dir, row_sep='),('):
    os.makedirs(os.path.dirname(output_file), exist_ok=True)
    os.makedirs(temp_dir, exist_ok=True)

    with open(input_file, 'r', encoding='utf-8', errors='ignore') as f:
        data = f.read()

    if 'VALUES (' not in data:
        return

    start = data.index('VALUES (') + len('VALUES (')
    values = data[start:].strip().rstrip(';')

    rows = values.split(row_sep)
    rows[0] = rows[0].lstrip('(')
    rows[-1] = rows[-1].rstrip(')')

    incomplete_top = rows.pop(0)
    incomplete_tail = rows.pop() if not rows[-1].endswith("'") else None

    if incomplete_top:
        with open(os.path.join(temp_dir, f'{os.path.basename(input_file)}_head.sql'), 'w', encoding='utf-8') as tf:
            tf.write(incomplete_top)

    if incomplete_tail:
        with open(os.path.join(temp_dir, f'{os.path.basename(input_file)}_tail.sql'), 'w', encoding='utf-8') as tf:
            tf.write(incomplete_tail)

    with open(output_file, 'w', encoding='utf-8') as out:
        json.dump(rows, out)
    print(f'Written {len(rows)} rows to {output_file}')

def process_all_parts(input_dir, output_dir, temp_dir):
    for fname in sorted(os.listdir(input_dir)):
        if fname.startswith('part_') and fname.endswith('.sql'):
            part_num = int(fname.split('_')[1].split('.')[0])
            if part_num >= 33:
                in_path = os.path.join(input_dir, fname)
                out_path = os.path.join(output_dir, f'{fname.replace(".sql", ".json")}')
                process_sql_file(in_path, out_path, temp_dir)

# Example usage:
process_all_parts('split_sql', 'json_output', 'temp_output')
