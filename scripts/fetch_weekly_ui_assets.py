"""Fetch verified CC0 UI packs; retain licenses and index shared runtime URLs.

Run with the project Python. Does not rewrite gameplay or participant data.
"""
import hashlib
import html
import io
import json
import stat
import subprocess
import urllib.request
import zipfile
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import quote

ROOT = Path(__file__).resolve().parents[1]
DEST = ROOT / 'vendor/kenney/weekly-ui'
PACKS = [
    ('ui-pack', 'https://kenney.nl/assets/ui-pack', 'https://kenney.nl/media/pages/assets/ui-pack/f651646eab-1718203990/kenney_ui-pack.zip', [2,3,4,5,6,7,8,9]),
    ('ui-pack-sci-fi', 'https://kenney.nl/assets/ui-pack-sci-fi', 'https://kenney.nl/media/pages/assets/ui-pack-sci-fi/b67c2acd31-1724181109/kenney_ui-pack-space-expansion.zip', [2]),
    ('ui-pack-adventure', 'https://kenney.nl/assets/ui-pack-adventure', 'https://kenney.nl/media/pages/assets/ui-pack-adventure/9a877376bc-1723597274/kenney_ui-pack-adventure.zip', [6,8,9]),
    ('fantasy-ui-borders', 'https://kenney.nl/assets/fantasy-ui-borders', 'https://kenney.nl/media/pages/assets/fantasy-ui-borders/ab29cd0165-1701602367/kenney_fantasy-ui-borders.zip', [6,8,9]),
    ('tiny-factory', 'https://kenney.nl/assets/tiny-factory', 'https://kenney.nl/media/pages/assets/tiny-factory/1652277319-1788860879/kenney_tiny-factory.zip', [5]),
]
ALLOWED = {'.png','.svg','.xml','.json','.txt','.md','.csv','.tmx','.tsx','.ogg','.wav','.mp3','.ttf','.otf','.woff','.woff2'}


def main():
    DEST.mkdir(parents=True, exist_ok=True)
    records = []
    for slug, page, url, weeks in PACKS:
        archive = DEST / 'archives' / f'{slug}.zip'
        archive.parent.mkdir(exist_ok=True)
        if not archive.exists():
            request = urllib.request.Request(url, headers={'User-Agent':'Mozilla/5.0','Referer':page})
            try:
                with urllib.request.urlopen(request, timeout=40) as response:
                    content = response.read(40*1024*1024+1)
            except urllib.error.HTTPError as error:
                if error.code!=403: raise
                # Some CDNs reject Python's TLS client while permitting curl.
                temporary=archive.with_suffix('.download')
                try:
                    subprocess.run(['curl.exe','-L','--fail','--silent','--show-error','--max-time','40',
                                    '--max-filesize',str(40*1024*1024),'-A','Mozilla/5.0','-e',page,
                                    '-o',str(temporary),url],check=True)
                    content=temporary.read_bytes()
                finally:
                    temporary.unlink(missing_ok=True)
            if len(content)>40*1024*1024: raise ValueError('Archive exceeds import size limit')
            if not zipfile.is_zipfile(io.BytesIO(content)): raise ValueError(f'Not a ZIP: {url}')
            archive.write_bytes(content)
        content = archive.read_bytes()
        target = (DEST / slug).resolve()
        files = []
        with zipfile.ZipFile(io.BytesIO(content)) as bundle:
            if sum(info.file_size for info in bundle.infolist())>200*1024*1024:
                raise ValueError('Expanded pack exceeds import size limit')
            for info in bundle.infolist():
                output = (target / info.filename.replace('\\','/')).resolve()
                if not output.is_relative_to(target) or stat.S_ISLNK(info.external_attr>>16):
                    raise ValueError('Unsafe ZIP entry')
                if info.is_dir() or output.suffix.lower() not in ALLOWED: continue
                data = bundle.read(info)
                if output.exists() and output.read_bytes()!=data:
                    raise ValueError(f'Refusing to overwrite changed asset: {output}')
                if not output.exists():
                    output.parent.mkdir(parents=True,exist_ok=True)
                    output.write_bytes(data)
                files.append({'path':output.relative_to(ROOT).as_posix(),
                              'url':'/'+quote(output.relative_to(ROOT).as_posix(),safe='/'),
                              'bytes':len(data),'sha256':hashlib.sha256(data).hexdigest()})
        licenses = [f for f in files if 'license' in Path(f['path']).name.lower()]
        if not licenses: raise ValueError(f'Pack has no bundled license: {slug}')
        for license_file in licenses:
            text = (ROOT/license_file['path']).read_text(encoding='utf-8-sig')
            if 'CC0' not in text and 'Creative Commons Zero' not in text:
                raise ValueError(f'Unexpected license for {slug}')
        records.append({'id':slug,'publisher':'Kenney','license':'CC0-1.0','source_page':page,
                        'download_url':url,'archive':archive.relative_to(ROOT).as_posix(),
                        'archive_sha256':hashlib.sha256(content).hexdigest(),'weeks':weeks,
                        'status':'downloaded_not_integrated','license_files':licenses,'files':files})
        print(f'{slug}: {len(files)} files; license retained')
    result={'schema_version':1,'checked_at':datetime.now(timezone.utc).isoformat(),
            'policy':'Shared URLs; no per-level asset copies. Source games are visual references only.',
            'packs':records}
    path=ROOT/'games/assets/weekly-ui-manifest.json'
    path.write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    cards=[]
    for pack in records:
        preview=next((f for f in pack['files'] if Path(f['path']).name.lower()=='preview.png'),None)
        if preview is None:
            preview=next(f for f in pack['files'] if f['path'].lower().endswith('.png'))
        cards.append(f'<article><h2>{html.escape(pack["id"])}</h2><p>Weeks {", ".join(map(str,pack["weeks"]))} · CC0 · {len(pack["files"])} files</p>'
                     f'<img src="{html.escape(preview["url"])}" alt="{html.escape(pack["id"])} pack preview">'
                     f'<a href="{html.escape(pack["source_page"])}">Official source and license</a></article>')
    gallery='''<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>LogiCade · Weekly UI asset library</title><style>
*{box-sizing:border-box}body{margin:0;background:#101923;color:#edf2f7;font:16px system-ui;padding:36px}
header{max-width:1200px;margin:0 auto 28px}h1{font-size:34px;margin:8px 0}p{color:#b8c8d5;line-height:1.6}
small{color:#85ddbc;text-transform:uppercase;letter-spacing:2px}main{max-width:1200px;margin:auto;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:22px}
article{background:#1b2937;border:1px solid #3a5167;border-radius:12px;padding:20px}h2{margin:0;font-size:22px}
img{width:100%;height:240px;object-fit:contain;background:#e2e7e8;border-radius:6px;margin:8px 0 16px}a{color:#93d9ff}
@media(max-width:700px){body{padding:20px}main{grid-template-columns:1fr}}
</style><header><small>LogiCade · shared asset library</small><h1>Materials for Weeks 2–9</h1>
<p>Five downloaded Kenney packs. Licenses and source archives retained. This is an asset preview; the weekly game interfaces have not yet been rebuilt using these packs.</p></header><main>'''+''.join(cards)+'</main></html>'
    (ROOT/'games/assets/weekly-ui-preview.html').write_text(gallery,encoding='utf-8')
    print(f'Indexed {sum(len(p["files"]) for p in records)} files in {path.relative_to(ROOT)}')


if __name__=='__main__': main()
