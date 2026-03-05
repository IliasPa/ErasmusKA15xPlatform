import os
import subprocess
import tempfile
from pathlib import Path
import json

def run_csv_to_json(csv_path, json_path):
    env = os.environ.copy()
    env['CSV_PATH'] = str(csv_path)
    env['JSON_PATH'] = str(json_path)
    proc = subprocess.run(['python','scripts/csv_to_json.py'], env=env, capture_output=True, text=True)
    return proc.returncode, proc.stdout + proc.stderr

def test_csv_to_json_creates_json():
    tmp = tempfile.TemporaryDirectory()
    csv_p = Path(tmp.name) / 'projects.csv'
    json_p = Path(tmp.name) / 'projects.json'
    csv_p.write_text('id,title,ngo_name,ngo_contact_email,year,destination_country,eligible_residence_countries,infopack_url,application_form_url_default,application_form_urls_by_residence,description,tags,status,submitted_at,approved_at\n1,Test,NGO,test@ngo,2025,Spain,ALL,https://a,https://b,"",desc,tag,APPROVED,2025-01-01T00:00:00Z,2025-01-02T00:00:00Z\n2,Pending,NGO,test2@ngo,2025,Italy,ALL,https://a,https://b,"",desc,tag,PENDING,2025-01-01T00:00:00Z,')
    code,out = run_csv_to_json(csv_p, json_p)
    assert code == 0, out
    data = json.loads(json_p.read_text())
    assert isinstance(data, list)
    assert len(data) == 1
