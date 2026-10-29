# -*- mode: python ; coding: utf-8 -*-
import json
from pathlib import Path

shared_assets=set()
for definition in Path('games').glob('week_*/level*/*/game_*.json'):
    for asset in json.loads(definition.read_text(encoding='utf-8')).get('assets',{}).values():
        if isinstance(asset,str) and asset.startswith('/vendor/'):
            shared_assets.add(Path(asset.lstrip('/')))
private_data={'runtime','canvas_usage.json','game_build_cache','package_backups','opencode_package_backups'}
content_data=[(str(path),str(path if path.is_dir() else path.parent)) for path in Path('data').iterdir() if path.name not in private_data]

a = Analysis(
    ['run_desktop.py'],
    pathex=[],
    binaries=[],
    datas=[('client', 'client'), ('admin', 'admin'), ('server/prompts', 'server/prompts'),
           ('server/canvas_verify.cjs', 'server'), ('games', 'games')]
          + content_data + [(str(path),str(path.parent)) for path in sorted(shared_assets)],
    hiddenimports=[],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    noarchive=False,
    optimize=0,
)
pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name='LogiCade',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    console=False,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)
coll = COLLECT(
    exe,
    a.binaries,
    a.datas,
    strip=False,
    upx=True,
    upx_exclude=[],
    name='LogiCade',
)
