#!/usr/bin/env python3
import csv
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
# Allow overriding paths via env for tests
CSV = Path((__import__('os').environ.get('CSV_PATH') or (ROOT / 'data' / 'projects.csv')).replace('\\','/'))
JSON = Path((__import__('os').environ.get('JSON_PATH') or (ROOT / 'data' / 'projects.json')).replace('\\','/'))

def load_csv():
    with CSV.open(newline='', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        rows = list(reader)
    return rows

def main():
    rows = load_csv()
    # Only include APPROVED projects for the public JSON
    approved = [r for r in rows if (r.get('status') or '').upper() == 'APPROVED']
    # Normalize fields if needed
    for r in approved:
        # ensure tags as array
        if 'tags' in r:
            r['tags'] = [t.strip() for t in (r['tags'] or '').split(';') if t.strip()]
    with JSON.open('w', encoding='utf-8') as f:
        json.dump(approved, f, ensure_ascii=False, indent=2)
    print('Wrote', JSON, 'with', len(approved), 'approved projects')

if __name__ == '__main__':
    main()
