import os
import subprocess
import tempfile
from pathlib import Path

def run_validator(csv_path):
    env = os.environ.copy()
    env['CSV_PATH'] = str(csv_path)
    proc = subprocess.run(['python','scripts/validate_csv.py'], env=env, capture_output=True, text=True)
    return proc.returncode, proc.stdout + proc.stderr

def test_validate_good_csv():
    tmp = tempfile.TemporaryDirectory()
    p = Path(tmp.name) / 'projects.csv'
    p.write_text('id,title,ngo_name,ngo_contact_email,year,destination_country,eligible_residence_countries,infopack_url,application_form_url_default,application_form_urls_by_residence,description,tags,status,submitted_at,approved_at\n1,Test,NGO,test@ngo,2025,Spain,ALL,https://a,https://b,"",desc,tag,APPROVED,2025-01-01T00:00:00Z,2025-01-02T00:00:00Z')
    code,out = run_validator(p)
    assert code == 0, out

def test_validate_bad_row():
    tmp = tempfile.TemporaryDirectory()
    p = Path(tmp.name) / 'projects.csv'
    # missing one column
    p.write_text('id,title,ngo_name,ngo_contact_email,year,destination_country,eligible_residence_countries,infopack_url,application_form_url_default,application_form_urls_by_residence,description,tags,status,submitted_at,approved_at\n1,Test,NGO,test@ngo,2025,Spain')
    code,out = run_validator(p)
    assert code != 0
