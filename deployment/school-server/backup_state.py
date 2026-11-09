"""Archive application-owned content and state, with no public output mount."""
import sys
import tarfile
from pathlib import Path

target=Path(sys.argv[1]).resolve()
if target.parent!=Path('/backups') or not target.name.endswith('.content.tar.gz'):
    raise SystemExit('Backup output must be a named /backups/*.content.tar.gz file')
target.parent.mkdir(parents=True,exist_ok=True)
root=Path('/opt/logicade')
with tarfile.open(target,'w:gz') as archive:
    for name in ['data','games','.state']:
        archive.add(root/name,arcname=name,filter=lambda info: None if '/game_build_cache/' in info.name else info)
print('Content and state archive created.')
