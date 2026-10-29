"""Journaled publication of the five matching Canvas artifacts.

One API process publishes under its per-file package lock. On restart, prepared
transactions roll back before the catalog is loaded. Extracted leases are never
rewritten. Journal backups also retain recoverable previous content.
"""
import hashlib
import json
import re
import tempfile
import uuid
from dataclasses import replace
from pathlib import Path

from .canvas_games import _atomic_write, compile_canvas_package


class PublicationRollbackError(RuntimeError):pass


def encoded(value):return (json.dumps(value,ensure_ascii=False,indent=2)+'\n').encode()
def revision(config):return hashlib.sha256(json.dumps(config,sort_keys=True,separators=(',',':')).encode()).hexdigest()


def _target(root, relative):
    path=(root/relative).resolve()
    if not (path.is_relative_to((root/'data/fallback_pool').resolve()) or path.is_relative_to((root/'games').resolve())):
        raise ValueError('Publication target is outside the canonical game directories')
    if path.suffix not in ('.json','.zip') or not path.name.startswith('game_'):
        raise ValueError('Invalid publication target')
    return path


def rollback_journal(root: Path, folder: Path, journal: dict):
    for row in journal['targets']:
        path=_target(root,row['path'])
        if row['existed']:
            name=row['backup']
            if Path(name).name!=name:raise ValueError('Invalid journal backup name')
            content=(folder/name).read_bytes()
            if hashlib.sha256(content).hexdigest()!=row['old_sha256']:raise ValueError('Publication backup checksum failed')
            _atomic_write(path,content)
        else:path.unlink(missing_ok=True)
    journal['state']='rolled_back'
    _atomic_write(folder/'journal.json',encoded(journal))


def recover_publications(root: Path):
    count=0
    for file in (root/'data/runtime/canvas_publications').glob('*/journal.json'):
        journal=json.loads(file.read_text(encoding='utf-8'))
        if journal['state']=='prepared':rollback_journal(root,file.parent,journal);count+=1
    return count


def prune_publications(root: Path):
    """Keep two recoverable snapshots per slot; remove only our named flat files."""
    base=(root/'data/runtime/canvas_publications').resolve();groups={}
    for file in base.glob('*/journal.json'):
        data=json.loads(file.read_text(encoding='utf-8'))
        if data['state'] in ('committed','rolled_back'):groups.setdefault(data['file_id'],[]).append(file.parent)
    for folders in groups.values():
        for folder in sorted(folders,key=lambda p:p.stat().st_mtime,reverse=True)[2:]:
            if folder.parent.resolve()!=base:raise ValueError('Invalid publication snapshot directory')
            children=list(folder.iterdir())
            if all(p.is_file() and (p.name=='journal.json' or re.fullmatch(r'(old|new)_\d+\.bin',p.name)) for p in children):
                for p in children:p.unlink()
                folder.rmdir()


def publish_candidate(root: Path, runtime: Path, source: Path, old_game, spec: dict, game: dict,
                      expected_revision: str, expected_source_hash: str):
    root=root.resolve();runtime=runtime.resolve();source=source.resolve()
    mirror=old_game.config_path.resolve()
    if source!=_target(root,source.relative_to(root)) or mirror!=_target(root,mirror.relative_to(root)):
        raise ValueError('Invalid canonical publication paths')
    if (revision(json.loads(mirror.read_text(encoding='utf-8')))!=expected_revision
            or hashlib.sha256(source.read_bytes()).hexdigest()!=expected_source_hash):
        raise ValueError('Source revision changed while replacement was being prepared')
    candidate=replace(old_game,config=game,variation_title=game['title'])
    revisions=root/'data/runtime/canvas_revisions';revisions.mkdir(parents=True,exist_ok=True)
    for config in (old_game.config,game):
        identity=revision(config);snapshot=revisions/(identity+'.json')
        if snapshot.exists():
            if revision(json.loads(snapshot.read_text(encoding='utf-8')))!=identity:raise ValueError('Immutable revision snapshot checksum failed')
        else:_atomic_write(snapshot,encoded(config))
    staging_root=root/'data/runtime/canvas_staging';staging_root.mkdir(parents=True,exist_ok=True)
    with tempfile.TemporaryDirectory(prefix='candidate-',dir=staging_root) as temporary:
        stage=Path(temporary).resolve()
        if not stage.is_relative_to(staging_root.resolve()):raise ValueError('Invalid staging directory')
        staged=stage/source.name;staged.write_bytes(encoded(spec))
        compile_canvas_package(source_json=staged,pool_root=stage,runtime_root=runtime,
                               game=candidate,spec=spec,backup_root=stage/'backups')
        suffixes=[source.with_suffix('.zip'),source.with_name(source.stem+'.description.json'),source.with_name(source.stem+'.manifest.json')]
        contents={source:encoded(spec),mirror:encoded(game),**{p:(stage/p.name).read_bytes() for p in suffixes}}
    folder=root/'data/runtime/canvas_publications'/uuid.uuid4().hex;folder.mkdir(parents=True)
    targets=[]
    for i,(target,new) in enumerate(contents.items()):
        row={'path':target.relative_to(root).as_posix(),'existed':target.is_file(),'backup':f'old_{i}.bin'}
        if row['existed']:
            old=target.read_bytes();_atomic_write(folder/row['backup'],old);row['old_sha256']=hashlib.sha256(old).hexdigest()
        _atomic_write(folder/f'new_{i}.bin',new);targets.append(row)
    journal={'state':'prepared','file_id':old_game.file_id,'old_revision':expected_revision,'new_revision':candidate.content_revision,'targets':targets}
    _atomic_write(folder/'journal.json',encoded(journal))
    try:
        for target,content in contents.items():_atomic_write(target,content)
        journal['state']='committed';_atomic_write(folder/'journal.json',encoded(journal))
    except BaseException as error:
        try:rollback_journal(root,folder,{**journal,'state':'prepared'})
        except Exception as rollback_error:
            raise PublicationRollbackError('Publication rollback requires restart recovery: '+str(rollback_error)) from error
        raise
    try:prune_publications(root)
    except OSError:pass  # Retaining extra snapshots is preferable to failing a committed publication.
    return candidate
