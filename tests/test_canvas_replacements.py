"""Bounded authoring, runtime execution, transactional publication and durable queue."""
import asyncio
import copy
import hashlib
import json
import shutil
import time
from dataclasses import replace
from pathlib import Path
from zipfile import ZipFile

import pytest

from server.canvas_builder import build_candidate, problem_fingerprint
from server.canvas_games import discover_canvas_games, compile_canvas_package
from server.canvas_prompting import canvas_context
from server.canvas_publication import publish_candidate, recover_publications
from server.canvas_replacements import CanvasReplacementWorker
from server.canvas_verification import verify_candidate
from server.game_packages import prepare_package

ROOT=Path(__file__).resolve().parents[1]


def source(week,level,difficulty='standard'):
    folder=ROOT/'data/fallback_pool'/f'week_{week}'/f'level{level}'/difficulty
    return next(p for p in folder.glob('game_*.json') if p.name.endswith(')_1.json'))


def proposal(template,seed=7):
    ctx=canvas_context(template)
    if ctx['binding']['mechanic_family']=='archive':
        parameters={'question_ids':ctx['parameter_contract']['question_ids']['allowed'][-3:],'layout_seed':seed}
    else:
        domain=ctx['parameter_contract']['input_values']['items']
        values=[0,1,2] if domain['minimum']==0 else [1,2,4] if domain['minimum']==1 else [-7,0,11]
        parameters={'problem_variant':1,'primary_value':23,'secondary_value':7,'input_values':values,'layout_seed':seed}
    return {'schema_version':1,'binding':ctx['binding'],'parameters':parameters}


def test_every_stage_and_difficulty_builds_a_valid_new_problem():
    async def run():
        gate=asyncio.Semaphore(3)
        async def check(week,level,difficulty):
            async with gate:
                path=source(week,level,difficulty);template=json.loads(path.read_text(encoding='utf-8'))
                original=json.loads((ROOT/'games'/template['canvas_runtime']['game_path']).read_text(encoding='utf-8'))
                errors=[]
                for seed in [original['seed']%2147483647,7,11,17,23,31]:
                    p=proposal(template,seed);spec,game=build_candidate(template,p,{'model_tag':'test'})
                    assert spec['file_id']==template['file_id'] and spec['trial']==template['trial']
                    assert spec['game_settings']==template['game_settings']
                    assert game['learning_objective_id']==original['learning_objective_id']
                    assert game['assets']==original['assets'] and game['starting_lives']==original['starting_lives']
                    if game.get('programming'):assert game['programming']['rules']==original['programming']['rules']
                    try:
                        verified=await verify_candidate(game,ROOT/'games')
                        assert verified['passed']
                        assert problem_fingerprint(game)!=problem_fingerprint(original)
                        # Rebuilding a published source must not reset it to the authored starter.
                        from scripts.build_canvas_games import build_definition
                        assert build_definition(spec,Path(template['canvas_runtime']['game_path']))==game
                        return
                    except ValueError as exc:errors.append(str(exc))
                raise AssertionError(f'{week}/{level}/{difficulty}: {errors}')
        await asyncio.gather(*[check(week,level,difficulty) for week in range(1,10)
            for level in ([2] if week==1 else range(1,11)) for difficulty in ('standard','needs_support','advanced')])
    asyncio.run(run())


@pytest.fixture
def isolated(monkeypatch,tmp_path):
    import server.canvas_prompting as prompting
    original=source(7,7);spec=json.loads(original.read_text(encoding='utf-8'))
    relative=Path(spec['canvas_runtime']['game_path'])
    pool=tmp_path/'data/fallback_pool'/relative;pool.parent.mkdir(parents=True)
    shutil.copyfile(original,pool)
    mirror=tmp_path/'games'/relative;mirror.parent.mkdir(parents=True)
    shutil.copyfile(ROOT/'games'/relative,mirror)
    shutil.copytree(ROOT/'games/runtime',tmp_path/'games/runtime')
    (tmp_path/'games/assets').mkdir()
    shutil.copyfile(ROOT/'games/assets/manifest.json',tmp_path/'games/assets/manifest.json')
    shutil.copyfile(ROOT/'data/curriculum.json',tmp_path/'data/curriculum.json')
    monkeypatch.setattr(prompting,'ROOT',tmp_path)
    games=discover_canvas_games(tmp_path/'games');game=next(g for rows in games.values() for g in rows)
    return tmp_path,pool,spec,game


def test_publication_updates_all_five_files_and_preserves_an_active_lease(isolated):
    root,path,template,old=isolated
    compile_canvas_package(source_json=path,pool_root=root/'data/fallback_pool',runtime_root=root/'games',game=old,spec=template,backup_root=root/'backups')
    lease=prepare_package(path,root/'data/fallback_pool',root/'cache',shared_canvas_runtime_root=root/'games')
    active=root/'cache'/lease['package_id']/'index.html';before=active.read_bytes()
    spec,game=build_candidate(template,proposal(template),{'model_tag':'test'})
    asyncio.run(verify_candidate(game,root/'games'))
    updated=publish_candidate(root,root/'games',path,old,spec,game,old.content_revision,hashlib.sha256(path.read_bytes()).hexdigest())
    assert updated.content_revision!=old.content_revision and active.read_bytes()==before
    revisions=root/'data/runtime/canvas_revisions'
    assert json.loads((revisions/(old.content_revision+'.json')).read_text(encoding='utf-8'))==old.config
    assert json.loads((revisions/(updated.content_revision+'.json')).read_text(encoding='utf-8'))==game
    assert json.loads(path.read_text(encoding='utf-8'))==spec
    assert json.loads(old.config_path.read_text(encoding='utf-8'))==game
    for suffix in ('.description.json','.manifest.json'):
        doc=json.loads(path.with_name(path.stem+suffix).read_text(encoding='utf-8'))
        assert doc['content_revision']==updated.content_revision
    with ZipFile(path.with_suffix('.zip')) as bundle:
        assert json.loads(bundle.read('variation.json'))==game
        assert json.loads(bundle.read('description.json'))['content_revision']==updated.content_revision
    fresh=prepare_package(path,root/'data/fallback_pool',root/'cache',shared_canvas_runtime_root=root/'games')
    assert fresh['package_id']!=lease['package_id']


def test_corrupt_revision_history_blocks_publication_without_changing_the_pool(isolated):
    root,path,template,old=isolated
    snapshots=root/'data/runtime/canvas_revisions';snapshots.mkdir(parents=True)
    (snapshots/(old.content_revision+'.json')).write_text('{}',encoding='utf-8')
    original=path.read_bytes();mirror=old.config_path.read_bytes()
    spec,game=build_candidate(template,proposal(template),{})
    with pytest.raises(ValueError,match='snapshot checksum'):
        publish_candidate(root,root/'games',path,old,spec,game,old.content_revision,hashlib.sha256(original).hexdigest())
    assert path.read_bytes()==original and old.config_path.read_bytes()==mirror


def test_failed_publication_restores_the_original_files(isolated,monkeypatch):
    import server.canvas_publication as publication
    root,path,template,old=isolated
    originals={p:p.read_bytes() for p in (path,old.config_path)}
    spec,game=build_candidate(template,proposal(template),{})
    write=publication._atomic_write;failed=False
    def fail_once(target,content):
        nonlocal failed
        if target==old.config_path and not failed:failed=True;raise OSError('simulated disk failure')
        return write(target,content)
    monkeypatch.setattr(publication,'_atomic_write',fail_once)
    with pytest.raises(OSError,match='disk failure'):
        publish_candidate(root,root/'games',path,old,spec,game,old.content_revision,hashlib.sha256(path.read_bytes()).hexdigest())
    assert all(p.read_bytes()==raw for p,raw in originals.items())
    assert not path.with_suffix('.zip').exists()
    assert recover_publications(root)==0


def test_restart_recovers_a_prepared_transaction_and_rejects_stale_publish(isolated):
    root,path,template,old=isolated
    before=path.read_bytes();mirror=old.config_path.read_bytes()
    spec,game=build_candidate(template,proposal(template),{})
    publish_candidate(root,root/'games',path,old,spec,game,old.content_revision,hashlib.sha256(before).hexdigest())
    with pytest.raises(ValueError,match='revision changed'):
        publish_candidate(root,root/'games',path,old,spec,game,old.content_revision,hashlib.sha256(before).hexdigest())
    journal=next((root/'data/runtime/canvas_publications').glob('*/journal.json'))
    data=json.loads(journal.read_text());data['state']='prepared';journal.write_text(json.dumps(data))
    assert recover_publications(root)==1
    assert path.read_bytes()==before and old.config_path.read_bytes()==mirror


class Client:
    def __init__(self,fail=False,hold=None):self.calls=0;self.fail=fail;self.hold=hold
    async def propose_canvas_challenge(self,template,*args,**kwargs):
        self.calls+=1
        if self.hold:await self.hold.wait()
        if self.fail:return None,{'errors':['model unavailable']}
        return proposal(template),{'model_tag':'test','verification_result':'canvas_parameter_proposal'}


def worker_for(isolated,client):
    root,path,template,game=isolated;current=[game]
    def lookup(file_id):return (path,current[0]) if file_id==game.file_id else None
    async def publish(source,old,spec,new,revision,source_hash):
        current[0]=publish_candidate(root,root/'games',source,old,spec,new,revision,source_hash)
        return current[0]
    worker=CanvasReplacementWorker(root,root/'games',lookup,lambda g:current,lambda:client,publish)
    return worker,current


def test_queue_coalesces_consumption_and_publishes_only_a_new_verified_problem(isolated):
    async def run():
        client=Client();worker,current=worker_for(isolated,client);old=current[0]
        first=await worker.enqueue(old.file_id,old.content_revision)
        second=await worker.enqueue(old.file_id,old.content_revision)
        assert first['job_id']==second['job_id'] and second['coalesced']
        await worker.run_job(first['job_id'])
        job=worker.state['jobs'][first['job_id']]
        assert job['status']=='published' and job['verification']['passed'] and client.calls==1
        assert (await worker.enqueue(old.file_id,old.content_revision))['reason']=='older_revision'
        before=isolated[1].read_bytes()
        next_job=await worker.enqueue(current[0].file_id,current[0].content_revision)
        await worker.run_job(next_job['job_id'])  # Same parameters must not masquerade as a fresh game.
        assert worker.state['jobs'][next_job['job_id']]['status']=='retry'
        assert isolated[1].read_bytes()==before
        assert worker.state['jobs'][next_job['job_id']]['next_retry_at']>=time.time()+298
    asyncio.run(run())


def test_bad_proposals_and_failed_models_never_replace_existing_content(isolated):
    async def run():
        client=Client(fail=True);worker,current=worker_for(isolated,client)
        before=isolated[1].read_bytes();job=await worker.enqueue(current[0].file_id,current[0].content_revision)
        await worker.run_job(job['job_id'])
        assert client.calls==3 and worker.state['jobs'][job['job_id']]['status']=='retry'
        assert isolated[1].read_bytes()==before
    asyncio.run(run())


def test_cancellation_restart_and_single_worker_lock(isolated):
    async def run():
        held=asyncio.Event();client=Client(hold=held);worker,current=worker_for(isolated,client)
        await worker.start();job=await worker.enqueue(current[0].file_id,current[0].content_revision)
        async def entered():
            while client.calls==0:await asyncio.sleep(.01)
        await asyncio.wait_for(entered(),2)
        other,_=worker_for(isolated,Client())
        with pytest.raises(RuntimeError,match='one API process'):other.acquire()
        await worker.close()
        assert json.loads(worker.path.read_text())['jobs'][job['job_id']]['status']=='generating'
        restarted,current=worker_for(isolated,Client())
        try:
            await restarted.start()
            async def completed():
                while restarted.state['jobs'][job['job_id']]['status']!='published':await asyncio.sleep(.02)
            await asyncio.wait_for(completed(),15)
        finally:await restarted.close()
    asyncio.run(run())


def test_runtime_rejects_bad_reference_and_wrong_archive_key():
    async def run():
        template=json.loads(source(7,7).read_text(encoding='utf-8'))
        _,game=build_candidate(template,proposal(template),{})
        game['programming']['reference']['programs'][0]='window.fetch("bad")'
        with pytest.raises(ValueError):await verify_candidate(game,ROOT/'games')
        template=json.loads(source(4,2).read_text(encoding='utf-8'))
        _,game=build_candidate(template,proposal(template),{})
        game['tasks'][0]['answer_index']=(game['tasks'][0]['answer_index']+1)%len(game['tasks'][0]['choices'])
        with pytest.raises(ValueError):await verify_candidate(game,ROOT/'games')
    asyncio.run(run())


def test_consumption_api_is_nonblocking_revision_safe_and_issued_to_the_owner(isolated,monkeypatch):
    import httpx
    from fastapi import FastAPI
    from server import main
    async def assignment(*_):return {'difficulty':'standard'}
    monkeypatch.setattr(main,'_resolve_stage_difficulty',assignment)
    root,path,template,old=isolated
    entry={**template,'source_path':path.relative_to(root).as_posix()}
    class Catalog:
        def get_by_id(self,key):return entry if key==old.file_id else None
        def get(self,*_):return [entry]
    monkeypatch.setattr(main,'REPO_ROOT',root);monkeypatch.setattr(main,'CANVAS_RUNTIME_ROOT',root/'games')
    monkeypatch.setattr(main,'GAME_BUILD_CACHE',root/'cache');monkeypatch.setattr(main,'CANVAS_USAGE_PATH',root/'data/runtime/usage.json')
    monkeypatch.setattr(main,'_registry',Catalog());monkeypatch.setattr(main,'_canvas_games',{old.slug:[old]})
    monkeypatch.setattr(main,'_game_package_locks',{});monkeypatch.setattr(main,'_serve_locks',{})
    monkeypatch.setattr(main,'_canvas_usage',{});monkeypatch.setattr(main,'_canvas_usage_lock',asyncio.Lock())
    monkeypatch.setattr(main,'_served_pool_ids',set());monkeypatch.setenv('LOGICADE_SESSION_SECRET','isolated-qa-secret')
    monkeypatch.setenv('LOGICADE_NATIVE_CANVAS','1')
    app=FastAPI()
    for url,handler in [('/serve',main.serve),('/prepare',main.prepare_game),('/consume',main.mark_game_used)]:app.post(url)(handler)
    app.mount('/data',main.PublicDataFiles(directory=root/'data'))
    async def run():
        hold=asyncio.Event();model=Client(hold=hold)
        worker=CanvasReplacementWorker(root,root/'games',main._canvas_replacement_lookup,main._canvas_replacement_bucket,
            lambda:model,main._publish_canvas_replacement)
        monkeypatch.setattr(main,'_canvas_replacement_worker',worker)
        await worker.start()
        try:
            async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app),base_url='http://qa') as client:
                headers={'Authorization':'Bearer '+main._issue_session('QA-A')}
                selected=(await client.post('/serve',headers=headers,json={'student_id':'QA-A','week':7,'level':7,'difficulty':'standard'})).json()
                meta=selected['meta'];payload={'file_id':old.file_id,'generated_game_id':old.variation_id,
                    'content_revision':meta['generated_game']['content_revision'],'consumption_token':meta['consumption_token']}
                prepared=await client.post('/prepare',headers=headers,json=payload)
                assert prepared.status_code==200,prepared.text
                active=root/'cache'/prepared.json()['package_id']/'index.html';lease_content=active.read_bytes()
                before=path.read_bytes()
                used=await asyncio.wait_for(client.post('/consume',headers=headers,json=payload),2)
                assert used.status_code==200 and used.json()['replacement']['queued']
                job_id=used.json()['replacement']['job_id']
                duplicate=await client.post('/consume',headers=headers,json=payload)
                assert duplicate.json()['replacement']['coalesced']
                assert len(worker.state['jobs'])==1 and path.read_bytes()==before
                other={'Authorization':'Bearer '+main._issue_session('QA-B')}
                forbidden=await client.post('/consume',headers=other,json=payload)
                assert forbidden.status_code==403
                forged=await client.post('/consume',headers=headers,json={**payload,'content_revision':'f'*64})
                assert forged.status_code==403
                # A player can still prepare and play while model inference is held.
                again=await client.post('/prepare',headers=headers,json=payload)
                assert again.status_code==200
                hold.set()
                async def finished():
                    while worker.state['jobs'][job_id]['status']!='published':await asyncio.sleep(.02)
                await asyncio.wait_for(finished(),15)
                assert path.read_bytes()!=before and active.read_bytes()==lease_content
                archive=path.with_suffix('.zip').read_bytes()
                stale=await client.post('/consume',headers=headers,json=payload)
                assert stale.json()['replacement']['reason']=='older_revision' and not stale.json()['package_popped']
                assert path.with_suffix('.zip').read_bytes()==archive
                stale_prepare=await client.post('/prepare',headers=headers,json=payload)
                assert stale_prepare.status_code==409
                fresh=(await client.post('/serve',headers=headers,json={'student_id':'QA-A','week':7,'level':7,'difficulty':'standard'})).json()
                assert fresh['meta']['generated_game']['content_revision']!=old.content_revision
                assert (await client.get('/data/runtime/canvas_replacement_jobs.json')).status_code==404
                assert (await client.get('/data/curriculum.json')).status_code==200
        finally:await worker.close()
    asyncio.run(run())


def test_archive_worker_offers_unused_curated_combinations():
    games=discover_canvas_games(ROOT/'games')
    rows=[g for bucket in games.values() for g in bucket if (g.week,g.level,g.difficulty)==(4,2,'standard')]
    worker=CanvasReplacementWorker(ROOT,ROOT/'games',lambda _:None,lambda _:rows,lambda:None,None)
    choices=worker.constraints(rows[0],[])['allowed_question_combinations']
    assert len(choices)==10
    assert all('c4_l2_q6' in row for row in choices),'Existing ten combinations must not masquerade as new questions'
    recent=[{'question_ids':row} for row in choices[:8]]
    assert len(worker.constraints(rows[0],recent)['allowed_question_combinations'])==2


def test_scope_comparison_and_global_declaration_have_more_than_ten_problems():
    for level in (1,9):
        template=json.loads(source(8,level).read_text(encoding='utf-8'));seen=set()
        for value in range(1,16):
            p=proposal(template);p['parameters']['primary_value']=value
            _,game=build_candidate(template,p,{})
            seen.add(problem_fingerprint(game))
        assert len(seen)==15


def test_api_lifespan_starts_and_stops_the_durable_worker(isolated,monkeypatch):
    from fastapi import FastAPI
    from server import main
    root,path,spec,game=isolated
    for name in ('_registry','_client','_pool','_canvas_games','_canvas_usage','_served_pool_ids','_canvas_replacement_worker',
                 '_opencode_used_by_student','_opencode_last_by_student','_generated_games'):
        monkeypatch.setattr(main,name,getattr(main,name))
    class Catalog:
        missing=[]
        def get_by_id(self,key):return {**spec,'source_path':path.relative_to(root).as_posix()} if key==game.file_id else None
        def stats(self):return {'total':1,'attempted':1,'missing':0,'invalid':0,'dups':0,'unique_mechanics':1}
    class Model:
        host='http://test.invalid';model='test';model_tag='test';model_digest='test';closed=False
        async def probe(self):return True
        async def close(self):self.closed=True
        async def generate(self,*_):raise AssertionError('No inference without a consumption event')
    model=Model()
    for key,value in [('REPO_ROOT',root),('CANVAS_RUNTIME_ROOT',root/'games'),('GAME_BUILD_CACHE',root/'cache'),
                      ('CANVAS_USAGE_PATH',root/'data/runtime/usage.json'),('OPENCODE_USAGE_PATH',root/'legacy_usage.json')]:
        monkeypatch.setattr(main,key,value)
    monkeypatch.setattr(main,'load_registry',lambda:Catalog())
    monkeypatch.setattr(main.LLMClient,'from_env',classmethod(lambda cls:model))
    monkeypatch.setenv('LOGICADE_NATIVE_CANVAS','1');monkeypatch.setenv('LOGICADE_CANVAS_REPLACEMENTS','1')
    async def run():
        async with main.lifespan(FastAPI()):
            worker=main._canvas_replacement_worker
            assert worker and worker.status()['running'] and worker.path.exists()
        assert main._canvas_replacement_worker is None and model.closed
        later,_=worker_for(isolated,Client());later.acquire();await later.close()
    asyncio.run(run())


def test_publication_lock_is_released_on_startup_failure(isolated,monkeypatch):
    from contextlib import asynccontextmanager
    from fastapi import FastAPI
    from server import main
    root,_,_,_=isolated
    monkeypatch.setattr(main,'REPO_ROOT',root);monkeypatch.setattr(main,'CANVAS_RUNTIME_ROOT',root/'games')
    monkeypatch.setattr(main,'_client',None)
    @asynccontextmanager
    async def broken(*_):
        raise ValueError('simulated startup failure')
        yield
    monkeypatch.setattr(main,'_application_lifespan',broken)
    async def run():
        with pytest.raises(ValueError,match='startup failure'):
            async with main.lifespan(FastAPI()):pass
        later,_=worker_for(isolated,Client());later.acquire();await later.close()
    asyncio.run(run())
