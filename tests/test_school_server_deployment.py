"""Deployment privacy and transfer invariants; no study database is accessed."""
from pathlib import Path
import hashlib
import io
import json
import struct
import zipfile
import yaml

ROOT=Path(__file__).resolve().parents[1]

def test_private_services_have_no_published_host_ports():
    compose=yaml.safe_load((ROOT/'deployment/school-server/compose.yaml').read_text())
    for name in ['db','rest','supabase-api','ollama','gateway','tunnel']:
        assert not compose['services'][name].get('ports'),name
    assert compose['services']['app']['ports']==['127.0.0.1:18000:8000']
    assert compose['networks']['database']['internal'] is True
    assert compose['services']['app']['volumes'][:3]==['content:/opt/logicade/data','games:/opt/logicade/games','state:/opt/logicade/.state']

def test_public_proxy_keeps_admin_routes_private():
    text=(ROOT/'deployment/school-server/public-gateway.conf').read_text()
    for value in ['api/admin','admin-info','openapi','limit_req','return 404']:
        assert value in text
    assert 'rest:3000' not in text
    assert '11434' not in text

def test_installer_contains_verified_canonical_content_without_private_files():
    raw=(ROOT/'dist/LogiCade School Server Setup.exe').read_bytes()
    assert raw[:2]==b'MZ'
    assert raw[-8:]==b'LGCADE01'
    length=struct.unpack('<q',raw[-16:-8])[0]
    payload=raw[-48-length:-48]
    assert hashlib.sha256(payload).digest()==raw[-48:-16]
    with zipfile.ZipFile(io.BytesIO(payload)) as z:
        assert z.testzip() is None
        names=z.namelist()
        for name in names:
            assert not name.startswith(('/', '\\'))
            assert '..' not in Path(name).parts
            assert '.env' not in Path(name).parts
            assert '.state' not in Path(name).parts
            assert 'app/data/runtime/' not in name
            assert 'app/data/mlr/' not in name
            assert not name.endswith(('.dump','.joblib'))
        definitions=[x for x in names if x.startswith('app/games/week_') and x.endswith('.json')]
        fallbacks=[x for x in names if x.startswith('app/data/fallback_pool/') and x.endswith('.json')]
        assert len(definitions)==2700
        assert len(fallbacks)==2700
        assert 'app/client/dist/index.html' in names
        assert 'app/deployment/school-server/migrate.py' in names
        assert not any('/node_modules/' in x for x in names)
        assert not any(x.startswith('app/client-react/') for x in names)

def test_migration_files_are_all_shipped():
    inventory=json.loads((ROOT/'artifacts/school-server-build/inventory.json').read_text())['files']
    for p in (ROOT/'supabase/migrations').glob('*.sql'):
        record=inventory['app/supabase/migrations/'+p.name]
        assert hashlib.sha256(p.read_bytes()).hexdigest()==record['sha256']
    for p in (ROOT/'deployment/school-server').iterdir():
        if p.is_file():
            record=inventory['app/deployment/school-server/'+p.name]
            assert hashlib.sha256(p.read_bytes()).hexdigest()==record['sha256']

def test_linux_image_uses_the_verified_build_and_writable_game_pools():
    dockerfile=(ROOT/'deployment/school-server/Dockerfile').read_text()
    assert 'COPY client/dist ./client/dist' in dockerfile
    assert 'chmod -R u+rwX data games .state' in dockerfile
    assert 'USER logicade' in dockerfile
    assert 'npm ci' not in dockerfile
    compose=yaml.safe_load((ROOT/'deployment/school-server/compose.yaml').read_text())
    assert compose['services']['app']['healthcheck']['test'][-1].endswith('healthcheck.py')
    assert "'/rest/v1/students?" in (ROOT/'deployment/school-server/healthcheck.py').read_text()
