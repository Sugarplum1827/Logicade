"""Build the transferable Windows bootstrap EXE without participant records or secrets."""
from __future__ import annotations
import argparse
import hashlib
import json
import os
import shutil
import struct
import subprocess
import zipfile
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
DEPLOY=ROOT/'deployment/school-server'
BUILD=ROOT/'artifacts/school-server-build'
OUTPUT=ROOT/'dist/LogiCade School Server Setup.exe'
DENIED={'.env','.state','.git','.venv','__pycache__','node_modules','runtime','game_build_cache','package_backups','opencode_package_backups','mlr','backups'}

def files():
    selected={}
    def add(p:Path,target:str):
        if any(part in DENIED for part in Path(target).parts):raise ValueError(f'Private/operational file selected: {target}')
        if p.suffix.lower() in {'.pyc','.zip','.7z','.rar','.exe','.dump','.joblib'}:return
        if Path(target).name in {'.served_ids','canvas_usage.json','used_variations.json'}:return
        selected[target]=p
    def tree(folder:Path,prefix:str):
        for p in sorted(folder.rglob('*')):
            if p.is_file() and not any(part in DENIED for part in p.relative_to(folder).parts):
                add(p,prefix+'/'+p.relative_to(folder).as_posix())
    for name in ['server','admin','games']:
        tree(ROOT/name,'app/'+name)
    # Native runtime directory is code, while data/runtime is private operational history.
    for p in sorted((ROOT/'games/runtime').rglob('*')):
        if p.is_file() and '__pycache__' not in p.parts:selected['app/games/runtime/'+p.relative_to(ROOT/'games/runtime').as_posix()]=p
    for p in (ROOT/'data').glob('*'):
        if p.is_file() and p.suffix in {'.json','.csv'}:add(p,'app/data/'+p.name)
    identities={entry['file_id'] for entry in json.loads((ROOT/'data/manifest.json').read_text(encoding='utf-8'))}
    found=set()
    for definition in sorted((ROOT/'games').glob('week_*/level*/*/*.json')):
        game=json.loads(definition.read_text(encoding='utf-8'))
        if game.get('file_id') not in identities:continue
        rel=game['source_path'].removeprefix('data/fallback_pool/').removeprefix('fallback_pool/')
        path=ROOT/'data/fallback_pool'/rel
        if not path.is_file():raise FileNotFoundError(path)
        add(path,'app/data/fallback_pool/'+rel)
        found.add(game['file_id'])
    if found!=identities:raise ValueError(f'Missing canonical games: {len(identities-found)}')
    tree(ROOT/'data/fallback_templates','app/data/fallback_templates')
    # Every native definition declares its assets; keep those plus the shared manifest.
    # Do not walk tens of thousands of unused source pack tiles or ZIP archives.
    asset_urls=set()
    def collect(value):
        if isinstance(value,str) and value.startswith('/vendor/'):asset_urls.add(value.split('?',1)[0])
        elif isinstance(value,dict):
            for item in value.values():collect(item)
        elif isinstance(value,list):
            for item in value:collect(item)
    collect(json.loads((ROOT/'games/assets/manifest.json').read_text(encoding='utf-8')))
    for definition in (ROOT/'games').glob('week_*/level*/*/*.json'):
        collect(json.loads(definition.read_text(encoding='utf-8')).get('assets',{}))
    for url in sorted(asset_urls):
        asset=ROOT/url.lstrip('/')
        if not asset.is_file():raise FileNotFoundError(asset)
        add(asset,'app/'+url.lstrip('/'))
    for folder in [ROOT/'vendor/kenney/weekly-ui/tiny-factory',ROOT/'vendor/kenney/organized/licenses']:
        if folder.exists():tree(folder,'app/'+folder.relative_to(ROOT).as_posix())
    # Ship the tested production build; a school host never needs npm or Vite.
    if not (ROOT/'client/dist/index.html').is_file():raise FileNotFoundError('Build client-react before packaging the installer')
    tree(ROOT/'client/dist','app/client/dist')
    tree(ROOT/'supabase/migrations','app/supabase/migrations')
    for p in DEPLOY.iterdir():
        if p.is_file():
            add(p,'app/deployment/school-server/'+p.name)
            if p.name in {'compose.yaml','compose.gpu.yaml','db-init.sql','supabase-api.conf','public-gateway.conf','Manage-Server.ps1','SCHOOL_SERVER_GUIDE.md'}:add(p,p.name)
    return selected

def main():
    parser=argparse.ArgumentParser();parser.add_argument('--inventory-only',action='store_true');parser.add_argument('--skip-web-build',action='store_true');args=parser.parse_args()
    if not args.inventory_only and not args.skip_web_build:
        subprocess.run(['npm.cmd','run','build'],cwd=ROOT/'client-react',check=True)
    selected=files()
    BUILD.mkdir(parents=True,exist_ok=True);OUTPUT.parent.mkdir(exist_ok=True)
    inventory={'schema':1,'fresh_database':True,'includes_source_credentials':False,'files':{k:{'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()} for k,p in sorted(selected.items())}}
    (BUILD/'inventory.json').write_text(json.dumps(inventory,indent=2),encoding='utf-8')
    print(f'Curated payload: {len(selected)} files; {sum(p.stat().st_size for p in selected.values())/1024**2:.1f} MiB before compression',flush=True)
    if args.inventory_only:return
    windows_dir=os.environ.get('WINDIR') or os.environ.get('SystemRoot')
    if not windows_dir:raise RuntimeError('Build the Windows installer on a supported Windows PC')
    compiler=Path(windows_dir)/'Microsoft.NET/Framework64/v4.0.30319/csc.exe'
    if not compiler.is_file():raise FileNotFoundError('The Windows .NET Framework C# compiler is unavailable')
    stub=BUILD/'SchoolServerStub.exe'
    common=[str(compiler),'/nologo','/target:winexe','/platform:x64','/optimize+',
            '/r:System.Windows.Forms.dll','/r:System.Drawing.dll','/r:System.IO.Compression.dll','/r:System.IO.Compression.FileSystem.dll','/r:System.Web.Extensions.dll']
    subprocess.run(common+['/win32manifest:'+str(DEPLOY/'setup.manifest'),'/out:'+str(stub),str(DEPLOY/'SchoolServer.cs')],check=True)
    # As-invoker preview is for inspecting the manager UI; it never installs itself automatically.
    subprocess.run(common+['/out:'+str(BUILD/'SchoolServerUiPreview.exe'),str(DEPLOY/'SchoolServer.cs')],check=True)
    archive=BUILD/'payload.zip'
    with zipfile.ZipFile(archive,'w',compression=zipfile.ZIP_DEFLATED,compresslevel=6) as z:
        for target,path in sorted(selected.items()):z.write(path,target)
        z.writestr('payload-inventory.json',json.dumps(inventory,separators=(',',':')))
    digest=hashlib.sha256(archive.read_bytes()).digest()
    with OUTPUT.open('wb') as dest:
        with stub.open('rb') as src:shutil.copyfileobj(src,dest)
        with archive.open('rb') as src:shutil.copyfileobj(src,dest)
        dest.write(digest);dest.write(struct.pack('<q',archive.stat().st_size));dest.write(b'LGCADE01')
    (OUTPUT.with_suffix('.exe.sha256')).write_text(hashlib.sha256(OUTPUT.read_bytes()).hexdigest()+'  '+OUTPUT.name+'\n')
    print(f'Built {OUTPUT} ({OUTPUT.stat().st_size/1024**2:.1f} MiB)',flush=True)

if __name__=='__main__':main()
