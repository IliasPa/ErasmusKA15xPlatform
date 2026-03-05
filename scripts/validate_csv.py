#!/usr/bin/env python3
"""
Validate /data/projects.csv has the expected header and consistent columns.
Exits non-zero on errors.
"""
import csv
import sys
import os
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
# Allow overriding path for tests via env var
CSV = Path((os.environ.get('CSV_PATH') or (ROOT / 'data' / 'projects.csv')).replace('\\','/'))
EXPECTED_HEADER = ['id','title','ngo_name','ngo_contact_email','year','destination_country','eligible_residence_countries','infopack_url','application_form_url_default','application_form_urls_by_residence','description','tags','status','submitted_at','approved_at']

def main():
    if not CSV.exists():
        print('ERROR: projects.csv not found at', CSV)
        return 2
    with CSV.open(newline='', encoding='utf-8') as f:
        reader = csv.reader(f)
        rows = list(reader)
    if not rows:
        print('ERROR: CSV is empty')
        return 2
    header = rows[0]
    if header != EXPECTED_HEADER:
        print('ERROR: Header mismatch.\nExpected:', EXPECTED_HEADER, '\nFound:', header)
        return 2
    ncols = len(header)
    for i,row in enumerate(rows[1:], start=2):
        if len(row) != ncols:
            print(f'ERROR: Row {i} has {len(row)} columns, expected {ncols}. Row content:', row)
            return 2
    print('OK: CSV header and rows look consistent (rows=%d)' % (len(rows)-1))
    return 0

if __name__ == '__main__':
    sys.exit(main())
