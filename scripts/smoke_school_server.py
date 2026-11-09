"""Disposable deployment rehearsal; never connects to the laptop's study stack.

Requires the image logicade-school-app:verification. Leaves its explicitly named
containers running for browser review; --cleanup removes ONLY these test resources.
"""
from pathlib import Path
import base64, hashlib, hmac, json, os, secrets, subprocess, sys, time
from urllib.request import Request, urlopen
from urllib.error import HTTPError

ROOT=Path(__file__).resolve().parents[1]
WORK=ROOT/'artifacts/school-server-verify'
NET='logicade-school-verification'
PREFIX='logicade-school-check-'
IMAGE='logicade-school-app:verification'
NAMES=[PREFIX+x for x in ['gateway','app','api','rest','db']]

def docker(*args, data=None):
    p=subprocess.run(['docker',*args],input=data,capture_output=True)
    if p.returncode:raise RuntimeError(p.stderr.decode('utf-8','replace')[-2200:])
    return p.stdout

def wait(check, seconds=120):
    end=time.monotonic()+seconds
    while True:
        try:
            if check():return
        except Exception:pass
        if time.monotonic()>end:raise RuntimeError('Readiness timed out')
        time.sleep(2)

def sql(code):return docker('exec','-i',PREFIX+'db','psql','-U','postgres','-d','postgres','-v','ON_ERROR_STOP=1','-tAc',code).decode().strip()

def http(path, body=None, token=None, private=False):
    headers={'Content-Type':'application/json'}
    if token:headers['Authorization']='Bearer '+token
    req=Request(('http://127.0.0.1:18180' if private else 'http://127.0.0.1:18181')+path,
                data=json.dumps(body).encode() if body is not None else None,headers=headers)
    try:
        with urlopen(req,timeout=45) as r:return r.status,r.read()
    except HTTPError as e:return e.code,e.read()

def cleanup():
    for name in NAMES:
        subprocess.run(['docker','rm','-f','-v',name],capture_output=True)
    subprocess.run(['docker','network','rm',NET],capture_output=True)
    print('Removed only explicitly named school-server rehearsal resources.')

def setup():
    WORK.mkdir(parents=True,exist_ok=True)
    existing=docker('ps','-a','--format','{{.Names}}').decode().splitlines()
    if any(name in existing for name in NAMES):raise RuntimeError('Rehearsal already exists; use --test or --cleanup')
    docker('network','create',NET)
    secret=secrets.token_hex(32);pgpass=secrets.token_hex(32)
    encode=lambda x:base64.urlsafe_b64encode(x).decode().rstrip('=')
    head=encode(b'{"alg":"HS256","typ":"JWT"}')
    claims=encode(json.dumps({'role':'service_role','exp':int(time.time())+86400}).encode())
    signature=encode(hmac.new(secret.encode(),(head+'.'+claims).encode(),hashlib.sha256).digest())
    key=head+'.'+claims+'.'+signature
    values={'POSTGRES_PASSWORD':pgpass,'JWT_SECRET':secret,'PGRST_DB_URI':f'postgres://authenticator:{pgpass}@db:5432/postgres',
            'PGRST_DB_SCHEMAS':'public','PGRST_DB_ANON_ROLE':'anon','PGRST_JWT_SECRET':secret,
            'DATABASE_URL':f'postgresql://postgres:{pgpass}@db:5432/postgres','SUPABASE_URL':'http://supabase-api:8000',
            'SUPABASE_SERVICE_ROLE_KEY':key,'LOGICADE_SESSION_SECRET':secrets.token_hex(32),
            'LOGICADE_ADMIN_EMAIL':'installer-check@example.invalid','LOGICADE_ADMIN_KEY':secrets.token_hex(16),
            'OLLAMA_HOST':'http://127.0.0.1:1','LOGICADE_CANVAS_REPLACEMENTS':'0','LOGICADE_NODE_BINARY':'/usr/local/bin/node'}
    env=WORK/'rehearsal.env'
    env.write_text('\n'.join(k+'='+v for k,v in values.items())+'\n')
    (WORK/'rehearsal-test.json').write_text(json.dumps({'admin_password':values['LOGICADE_ADMIN_KEY']}))
    docker('run','-d','--name',PREFIX+'db','--network',NET,'--network-alias','db','--env-file',str(env),
           '--mount',f'type=bind,source={ROOT / "deployment/school-server/db-init.sql"},target=/docker-entrypoint-initdb.d/init-scripts/99-logicade-roles.sql,readonly',
           'supabase/postgres:17.6.1.136')
    wait(lambda:docker('exec',PREFIX+'db','pg_isready','-U','postgres') and sql('SELECT 1')=='1')
    for _ in range(2):
        output=docker('run','--rm','--network',NET,'--env-file',str(env),IMAGE,'python','deployment/school-server/migrate.py')
        print(output.decode().strip(),flush=True)
    assert sql('SELECT count(*) FROM public.app_accounts')=='0'
    print('PASS fresh database, all migrations, and repeat migration run',flush=True)
    docker('run','-d','--name',PREFIX+'rest','--network',NET,'--network-alias','rest','--env-file',str(env),'postgrest/postgrest:v14.18')
    docker('run','-d','--name',PREFIX+'api','--network',NET,'--network-alias','supabase-api','--mount',
           f'type=bind,source={ROOT / "deployment/school-server/supabase-api.conf"},target=/etc/nginx/conf.d/default.conf,readonly','nginx:1.28-alpine')
    docker('run','-d','--name',PREFIX+'app','--network',NET,'--network-alias','app','--env-file',str(env),'-p','127.0.0.1:18180:8000',IMAGE)
    wait(lambda:http('/api/config',private=True)[0]==200)
    docker('run','-d','--name',PREFIX+'gateway','--network',NET,'-p','127.0.0.1:18181:8080','--mount',
           f'type=bind,source={ROOT / "deployment/school-server/public-gateway.conf"},target=/etc/nginx/conf.d/default.conf,readonly','nginx:1.28-alpine')
    wait(lambda:http('/app/')[0]==200)
    test()

def test():
    wait(lambda:http('/api/config')[0]==200)
    checks={}
    for path in ['/api/config','/app/','/canvas-runtime/runtime/engine.js','/admin/','/api/admin/analytics','/data/runtime/private.json','/openapi.json']:
        status,_=http(path)
        expected=404 if path.startswith(('/admin','/api/admin','/data/runtime','/openapi')) else 200
        assert status==expected,(path,status)
        checks[path]=status
    status,raw=http('/api/auth/register',{'username':'InstallerSmoke','student_number':'SCHOOL-CHECK-001','password':'SchoolCheck12345!'})
    if status==409:
        status,raw=http('/api/auth/login',{'student_number':'SCHOOL-CHECK-001','password':'SchoolCheck12345!'})
    assert status==200,raw
    account=json.loads(raw);token=account['token']
    assert http('/api/auth/register',{'username':'InstallerSmoke','student_number':'SCHOOL-CHECK-001','password':'SchoolCheck12345!'})[0]==409
    status,raw=http('/api/coins/balance',token=token);assert status==200,raw
    assert json.loads(raw)['balance']==20,raw
    status,raw=http('/serve',{'student_id':account['student_id'],'week':1,'level':2,'difficulty':'standard'},token)
    assert status==200,raw
    served=json.loads(raw);(WORK/'served-check.json').write_text(json.dumps(served))
    # File ID comes from the canonical description, not a hard-coded game filename.
    file_id=served.get('file_id') or served.get('spec',{}).get('file_id')
    if not file_id:
        for value in served.values():
            if isinstance(value,dict) and value.get('file_id'):file_id=value['file_id'];break
    assert file_id,served.keys()
    game=served['meta']['generated_game']
    status,raw=http('/api/games/prepare',{'file_id':file_id,'generated_game_id':game['variation_id'],
                                        'content_revision':game['content_revision']},token)
    assert status==200,raw
    prepared=json.loads(raw);(WORK/'prepared-check.json').write_text(json.dumps(prepared))
    assert prepared['package_id'] and prepared['launch_url'] and prepared['archive'].endswith('.zip'),prepared.keys()
    assert http(prepared['launch_url'])[0]==200
    print('Prepared package fields:',', '.join(prepared.keys()),flush=True)
    print('PASS production app, public route restrictions, registration/login, duplicate protection, 20-coin wallet, /serve, ZIP preparation',flush=True)
    (WORK/'smoke-results.json').write_text(json.dumps({'routes':checks,'account_and_package':'passed'},indent=2))

if __name__=='__main__':
    if '--cleanup' in sys.argv:cleanup()
    elif '--test' in sys.argv:test()
    else:setup()
