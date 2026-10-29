"""Current canonical catalog, ZIP identity, private leases and learner route checks."""
import asyncio
import json
import shutil
from zipfile import ZipFile

import httpx
import pytest
from fastapi import FastAPI
from server import main
from server.canvas_games import canonical_difficulty, compile_canvas_package, discover_canvas_games
from server.game_packages import PackageError, prepare_package, release_package


@pytest.fixture(scope="module")
def games():
    return discover_canvas_games(main.CANVAS_RUNTIME_ROOT)


def test_canonical_count_week_mapping_and_playability(games):
    manifest=json.loads((main.REPO_ROOT/'data/manifest.json').read_text(encoding='utf-8'))
    rows=[g for values in games.values() for g in values]
    assert len(rows)==2700
    assert {g.file_id for g in rows}=={r['file_id'] for r in manifest}
    expected={1:{'welcome_video','tetris'},2:{'circuit'},3:{'terminal'},4:{'pending'},5:{'factory'},6:{'dungeon'},7:{'terminal'},8:{'dungeon'},9:{'circuit','terminal','pending','factory','dungeon'}}
    for week,modes in expected.items():
        assert {g.slug for g in rows if g.week==week}==modes
    assert sum(g.week!=1 or g.level<=2 for g in rows)==2460
    week_four=[g for g in rows if g.week==4]
    assert len(week_four)==300
    for game in week_four:
        assert game.slug=='pending' and 'programming' not in game.config
        source=json.loads((main.REPO_ROOT/'data/fallback_pool'/game.config['source_path']).read_text(encoding='utf-8'))
        assert 'classif' in source['player_objective'].lower()
        assert game.config['lesson']['source_week']==4
        assert any('Ritchie' in item['title'] for item in game.config['lesson']['sources'])


@pytest.mark.parametrize('mode',['welcome_video','tetris','circuit','terminal','pending','factory','dungeon'])
def test_package_identity_assets_and_independent_leases(tmp_path,games,mode):
    game=games[mode][0]
    original=main.REPO_ROOT/'data/fallback_pool'/game.config['source_path']
    source=tmp_path/original.name
    shutil.copyfile(original,source)
    spec=json.loads(source.read_text(encoding='utf-8'))
    before=source.read_bytes()
    result=compile_canvas_package(source_json=source,pool_root=tmp_path,runtime_root=main.CANVAS_RUNTIME_ROOT,
        game=game,spec=spec,backup_root=tmp_path/'backups')
    with ZipFile(source.with_suffix('.zip')) as bundle:
        assert set(bundle.namelist())=={'index.html','game.json','variation.json','description.json','package_manifest.json'}
        html=bundle.read('index.html').decode()
        assert '/canvas-runtime/runtime/engine.js' in html
        assert '/game-runtime/' not in html
        assert json.loads(bundle.read('game.json'))['game']['file_id']==spec['file_id']
    assert source.read_bytes()==before
    assert result['description']['formal_assessment'] is False
    options=dict(shared_canvas_runtime_root=main.CANVAS_RUNTIME_ROOT)
    first=prepare_package(source,tmp_path,tmp_path/'cache',expected_generated_game_id=game.variation_id,**options)
    second=prepare_package(source,tmp_path,tmp_path/'cache',**options)
    assert first['package_id']!=second['package_id']
    release_package(first['package_id'],tmp_path/'cache')
    assert (tmp_path/'cache'/second['package_id']/'index.html').is_file()
    with pytest.raises(PackageError,match='selected variation'):
        prepare_package(source,tmp_path,tmp_path/'cache',expected_generated_game_id='wrong-variation',**options)
    with pytest.raises(ValueError,match='identity'):
        compile_canvas_package(source_json=source,pool_root=tmp_path,runtime_root=main.CANVAS_RUNTIME_ROOT,
            game=game,spec={**spec,'file_id':'wrong'},backup_root=tmp_path/'backups')


def test_factory_branch_contracts_and_shared_assets(games):
    factories=games['factory']
    assert len(factories)==360
    assert {g.public_info()['routing_topology'] for g in factories}=={'separate_outputs','merge_midpoint','merge_endpoint'}
    for game in factories:
        mission=game.config['programming']
        goals=game.public_info()['branch_targets']
        assert len(goals)==2 and sum(g['target'] for g in goals)==mission['target']
        reference={n['id']:n for n in mission['reference']['machines']}
        assert all(reference[g['output']]['type']=='output' for g in goals)
        if mission['routing']['merge']:
            assert reference[mission['routing']['merge']['id']]['type']=='merger'
        for kind in ('splitter','router','merger'):
            asset=game.config['assets']['machine_'+kind]
            assert asset.startswith('/vendor/kenney/')
            assert (main.REPO_ROOT/asset.lstrip('/')).is_file()


def test_researched_curriculum_and_examination_cover_every_user_week(games):
    course=json.loads((main.REPO_ROOT/'data/curriculum.json').read_text(encoding='utf-8'))
    rows=[g for values in games.values() for g in values]
    assert {int(v) for v in course['exam_blueprint'].values()}==set(range(2,9))
    for game in rows:
        lesson=game.public_info()['lesson']
        assert lesson['week']==game.week and lesson['stage_title']
        assert lesson['source_week']==(int(course['exam_blueprint'][str(game.level)]) if game.week==9 else game.week)
        assert lesson['coverage']==[lesson['source_week']]
        assert game.config['curriculum_version']==course['version']
        if game.week>1: assert lesson['sources']
        if game.config['source_week']==2: assert game.config.get('flowchart') and not game.config.get('programming')
        if game.config['source_week'] in {6,7,8}: assert game.config['programming']['language']=='c_subset'
        if game.config['source_week']==5: assert game.config['programming']['source_exercise']['categories']['main']=='identifier'
        if game.week==9: assert lesson['assessment_kind']=='examination_practice'


@pytest.mark.parametrize('week,level',[(1,1),(1,2),(9,1)])
def test_selection_cycle_prepare_pop_release_and_week_one_limit(monkeypatch,tmp_path,games,week,level):
    async def assignment(*_):return {'difficulty':'standard'}
    monkeypatch.setattr(main,'_resolve_stage_difficulty',assignment)
    specs=[]
    for game in (g for values in games.values() for g in values if g.week==week and g.level==level and g.difficulty=='standard'):
        relative='data/fallback_pool/'+game.config['source_path']
        target=tmp_path/relative
        target.parent.mkdir(parents=True,exist_ok=True)
        shutil.copyfile(main.REPO_ROOT/relative,target)
        specs.append({**json.loads(target.read_text(encoding='utf-8')),'source_path':relative})
    assert len(specs)==10
    class Catalog:
        def get(self,*_args): return specs
        def get_by_id(self,identity): return next((r for r in specs if r['file_id']==identity),None)
    monkeypatch.setattr(main,'REPO_ROOT',tmp_path)
    monkeypatch.setattr(main,'GAME_BUILD_CACHE',tmp_path/'cache')
    monkeypatch.setattr(main,'_canvas_games',games)
    monkeypatch.setattr(main,'_registry',Catalog())
    monkeypatch.setattr(main,'_generated_games',{})
    monkeypatch.setattr(main,'_served_pool_ids',set())
    monkeypatch.setattr(main,'_canvas_usage',{})
    monkeypatch.setattr(main,'_canvas_usage_lock',asyncio.Lock())
    monkeypatch.setattr(main,'CANVAS_USAGE_PATH',tmp_path/'usage.json')
    for name in ('_selection_queues','_serve_locks','_game_package_locks'):
        monkeypatch.setattr(main,name,{})
    monkeypatch.setenv('LOGICADE_SESSION_SECRET','disposable-test-secret')
    monkeypatch.setenv('LOGICADE_NATIVE_CANVAS','1')
    app=FastAPI()
    for route,handler in (('/serve',main.serve),('/api/games/prepare',main.prepare_game),('/api/games/mark-used',main.mark_game_used),('/api/games/release',main.release_game)):
        app.post(route)(handler)
    async def run():
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app),base_url='http://test') as client:
            headers={'Authorization':'Bearer '+main._issue_session('QA-ONLY')}
            seen=set()
            objectives=set()
            for _ in range(10):
                response=await client.post('/serve',headers=headers,json={'student_id':'QA-ONLY','week':week,'level':level,'difficulty':'standard'})
                assert response.status_code==200,response.text
                selected=response.json()
                variation=selected['meta']['generated_game']['variation_id']
                assert variation not in seen
                seen.add(variation)
                objective=selected['meta']['game_description']['objective']
                if (week,level)!=(1,1):
                    assert objective not in objectives
                objectives.add(objective)
            payload={'file_id':selected['spec']['file_id'],'generated_game_id':variation,
                     'content_revision':selected['meta']['generated_game']['content_revision'],
                     'consumption_token':selected['meta']['consumption_token']}
            prepared=await client.post('/api/games/prepare',headers=headers,json=payload)
            assert prepared.status_code==200,prepared.text
            lease=prepared.json()['package_id']
            popped=await client.post('/api/games/mark-used',headers=headers,json=payload)
            assert popped.status_code==200 and popped.json()['package_popped']
            assert (tmp_path/'cache'/lease/'index.html').is_file()
            released=await client.post('/api/games/release',headers=headers,json={'package_id':lease})
            assert released.status_code==200
            fresh=await client.post('/serve',headers=headers,json={'student_id':'QA-ONLY','week':week,'level':level,'difficulty':'standard'})
            assert fresh.status_code==200
            assert fresh.json()['spec']['file_id']!=selected['spec']['file_id']
            if (week,level)!=(1,1):
                assert fresh.json()['meta']['game_description']['objective']!=objective
            blocked=await client.post('/serve',headers=headers,json={'student_id':'QA-ONLY','week':1,'level':3,'difficulty':'standard'})
            assert blocked.status_code==404
    asyncio.run(run())


@pytest.mark.parametrize('week',range(1,10))
def test_learner_objective_cycles_survive_restart_and_other_players(monkeypatch,tmp_path,games,week):
    monkeypatch.setattr(main,'_canvas_games',games)
    monkeypatch.setattr(main,'_canvas_usage',{})
    monkeypatch.setattr(main,'_canvas_usage_lock',asyncio.Lock())
    monkeypatch.setattr(main,'CANVAS_USAGE_PATH',tmp_path/'usage.json')
    async def run():
        for difficulty in ('standard','needs_support','advanced'):
            level=2 if week==1 else 1
            pool=[g for rows in games.values() for g in rows if (g.week,g.level,g.difficulty)==(week,level,difficulty)]
            lookup={g.file_id:g.config['objective'] for g in pool}
            assert len(set(lookup.values()))==10
            candidates=[{'file_id':g.file_id} for g in pool]
            req=main.ServeRequest(student_id='A',week=week,level=level,difficulty=difficulty)
            seen=set()
            last=None
            for i in range(22):
                if i%10==0: seen.clear()
                selected=await main._reserve_canvas_description('A',req,candidates)
                objective=lookup[selected]
                assert objective!=last and objective not in seen
                seen.add(objective)
                last=objective
                # Another learner does not consume this learner's choices.
                await main._reserve_canvas_description('B',req,candidates)
                if i==4:
                    restored=json.loads(main.CANVAS_USAGE_PATH.read_text(encoding='utf-8'))
                    monkeypatch.setattr(main,'_canvas_usage',restored)
    asyncio.run(run())


def test_every_playable_scored_stage_has_alternative_objectives(games):
    groups={}
    for rows in games.values():
        for game in rows:
            if game.slug=='welcome_video' or (game.week==1 and game.level>2): continue
            groups.setdefault((game.week,game.level,game.difficulty),set()).add(game.config['objective'])
    assert len(groups)==243
    # Some historical records share a goal; rotation compares goal content,
    # rather than pretending every filename is a different objective.
    assert all(len(objectives)>=9 for objectives in groups.values())


def test_concurrent_previews_reserve_different_objectives(monkeypatch,tmp_path,games):
    monkeypatch.setattr(main,'_canvas_games',games)
    monkeypatch.setattr(main,'_canvas_usage',{})
    monkeypatch.setattr(main,'_canvas_usage_lock',asyncio.Lock())
    monkeypatch.setattr(main,'CANVAS_USAGE_PATH',tmp_path/'usage.json')
    req=main.ServeRequest(student_id='A',week=1,level=2,difficulty='standard')
    candidates=[{'file_id':g.file_id} for g in games['tetris'] if g.level==2 and g.difficulty=='standard']
    async def run():
        selected=await asyncio.gather(*[main._reserve_canvas_description('A',req,candidates) for _ in range(10)])
        assert len(set(selected))==10
    asyncio.run(run())


def test_objective_reservation_rolls_back_on_storage_failure(monkeypatch,tmp_path,games):
    monkeypatch.setattr(main,'_canvas_games',games)
    monkeypatch.setattr(main,'_canvas_usage',{})
    monkeypatch.setattr(main,'_canvas_usage_lock',asyncio.Lock())
    monkeypatch.setattr(main,'CANVAS_USAGE_PATH',tmp_path/'usage.json')
    def fail(*_args): raise OSError('disk unavailable')
    monkeypatch.setattr(main,'_write_json_atomically',fail)
    req=main.ServeRequest(student_id='A',week=1,level=2,difficulty='standard')
    candidates=[{'file_id':g.file_id} for g in games['tetris'] if g.level==2 and g.difficulty=='standard']
    with pytest.raises(main.HTTPException) as failure:
        asyncio.run(main._reserve_canvas_description('A',req,candidates))
    assert failure.value.status_code==503
    assert main._canvas_usage=={}


def test_reservations_stay_in_the_requested_week(monkeypatch,tmp_path,games):
    monkeypatch.setattr(main,'_canvas_games',games)
    monkeypatch.setattr(main,'_canvas_usage',{})
    monkeypatch.setattr(main,'_canvas_usage_lock',asyncio.Lock())
    monkeypatch.setattr(main,'CANVAS_USAGE_PATH',tmp_path/'usage.json')
    async def run():
        for week in range(1,10):
            game=await main._reserve_canvas_game('QA-ONLY',week)
            assert game.week==week
            assert week!=1 or game.level<=2
    asyncio.run(run())


def test_shared_files_allow_opaque_sandbox_requests():
    async def run():
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=main.app),base_url='http://test') as client:
            for path in ('/canvas-runtime/runtime/engine.js','/canvas-runtime/registry.json','/vendor/kenney/organized/tiles/roguelike_characters/roguelike_char_transparent/r10_c00.png'):
                response=await client.get(path,headers={'Origin':'null'})
                assert response.status_code==200,path
                assert response.headers['access-control-allow-origin']=='*'
    asyncio.run(run())


def test_unavailable_stage_cannot_bypass_serve_via_prepare(monkeypatch):
    class Catalog:
        def get_by_id(self, _identity): return {'week':1,'level':3}
    monkeypatch.setattr(main,'_registry',Catalog())
    monkeypatch.setenv('LOGICADE_SESSION_SECRET','test-only-secret')
    app=FastAPI()
    app.post('/prepare')(main.prepare_game)
    async def run():
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app),base_url='http://test') as client:
            response=await client.post('/prepare',headers={'Authorization':'Bearer '+main._issue_session('QA-ONLY')},json={'file_id':'hidden-stage'})
            assert response.status_code==404
    asyncio.run(run())


def test_unscoped_reservations_never_select_hidden_stages_or_repeat(monkeypatch,tmp_path,games):
    monkeypatch.setattr(main,'_canvas_games',games)
    monkeypatch.setattr(main,'_canvas_usage',{})
    monkeypatch.setattr(main,'_canvas_usage_lock',asyncio.Lock())
    monkeypatch.setattr(main,'CANVAS_USAGE_PATH',tmp_path/'usage.json')
    async def run():
        seen=set()
        for _ in range(10):
            game=await main._reserve_canvas_game('QA-ONLY')
            assert game.week!=1 or game.level<=2
            assert game.variation_id not in seen
            seen.add(game.variation_id)
    asyncio.run(run())


@pytest.mark.parametrize('raw,expected',[('Need Assistance','needs_support'),('NeedAssistance','needs_support'),
    ('Needs Support','needs_support'),('Advance','advanced'),('Hard','advanced'),('Standard','standard')])
def test_native_difficulty_aliases(raw,expected):
    assert canonical_difficulty(raw)==expected


def test_selection_history_moves_outside_public_data(tmp_path):
    legacy=tmp_path/'data/canvas_usage.json'
    private=tmp_path/'.state/canvas_usage.json'
    legacy.parent.mkdir()
    state={'QA-ONLY':{'used':['canvas_example']}}
    legacy.write_text(json.dumps(state),encoding='utf-8')
    assert main._load_canvas_usage(private,legacy)==state
    assert not legacy.exists()
    assert json.loads(private.read_text(encoding='utf-8'))==state


def test_selection_history_is_not_downloadable(tmp_path):
    (tmp_path/'canvas_usage.json').write_text('{"private":"history"}',encoding='utf-8')
    app=FastAPI()
    app.mount('/data',main.PublicDataFiles(directory=tmp_path))
    async def run():
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app),base_url='http://test') as client:
            for path in ('/data/canvas_usage.json','/data//canvas_usage.json','/data/%63anvas_usage.json'):
                assert (await client.get(path)).status_code==404
    asyncio.run(run())
