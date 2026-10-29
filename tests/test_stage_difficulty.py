"""Owner-scoped difficulty, region transitions, immutable starts and recovery."""
import asyncio
import copy
from types import SimpleNamespace
from uuid import uuid4

import httpx
import pytest
from fastapi import FastAPI

from server import main
from server.stage_difficulty import evidence, predecessor, RULE_VERSION

REAL_CLIENT=httpx.AsyncClient


def level(week,stage,index=0,owner='A'):
    return {'level_id':str(uuid4()),'student_id':owner,'week':week,'stage_number':stage,
            'level_index':index,'difficulty_assigned':'standard','difficulty_served':'standard','generated_at':'2026-10-01T00:00:00Z'}


def attempt(parent,number,accuracy,completed=True,status=None):
    return {'attempt_id':str(uuid4()),'student_id':parent['student_id'],'level_id':parent['level_id'],
            'attempt_number':number,'accuracy':accuracy,'completed':completed,'error_count':0,
            'status':status or ('completed' if completed else 'failed'),'started_at':f'2026-10-01T00:{number:02}:00Z'}


class Database:
    def __init__(self,levels=(),attempts=(),decisions=()):
        self.data={'levels':copy.deepcopy(list(levels)),'level_attempts':copy.deepcopy(list(attempts)),
                   'difficulty_decisions':copy.deepcopy(list(decisions)),'students':[{'student_id':'A'}]}
        self.calls=[];self.fail=False

    def __call__(self,request):
        import json
        self.calls.append(request);table=request.url.path.split('/')[-1]
        if self.fail:return httpx.Response(503,json={'message':'test database unavailable'})
        rows=self.data[table]
        def match(row):
            for key,value in request.url.params.items():
                if value.startswith('eq.') and str(row.get(key))!=value[3:]:return False
                if value.startswith('in.(') and str(row.get(key)) not in value[4:-1].split(','):return False
                if value=='is.null' and row.get(key) is not None:return False
            return True
        if request.method=='GET':
            found=copy.deepcopy([r for r in rows if match(r)])
            order=request.url.params.get('order','')
            for field in reversed(order.split(',')):
                name=field.split('.')[0]
                if name:found.sort(key=lambda r:(r.get(name) is None,r.get(name)),reverse=field.endswith('.desc'))
            offset=int(request.url.params.get('offset',0));limit=int(request.url.params.get('limit',1000))
            return httpx.Response(200,json=found[offset:offset+limit])
        if request.method=='POST':
            body=json.loads(request.content);key={'levels':'level_id','level_attempts':'attempt_id','difficulty_decisions':'decision_id','students':'student_id'}[table]
            for row in body:
                if not any(r[key]==row[key] for r in rows):rows.append(copy.deepcopy(row))
            return httpx.Response(201,json=body)
        if request.method=='PATCH':
            body=json.loads(request.content);changed=[]
            for row in rows:
                if match(row):row.update(copy.deepcopy(body));changed.append(row)
            return httpx.Response(200,json=changed)
        raise AssertionError(request.method)


@pytest.fixture
def routes(monkeypatch):
    monkeypatch.setenv('LOGICADE_SESSION_SECRET','difficulty-test-only-secret')
    monkeypatch.setenv('SUPABASE_URL','http://database.test')
    monkeypatch.setenv('SUPABASE_SERVICE_ROLE_KEY','test-only-key')
    monkeypatch.setattr(main,'_difficulty_owner_locks',{})
    app=FastAPI()
    app.get('/api/difficulty/resolve')(main.participant_difficulty)
    app.post('/api/difficulty/start')(main.start_stage_difficulty)
    app.post('/serve')(main.serve)
    app.post('/prepare')(main.prepare_game)
    app.post('/sync')(main.sync_batch)
    def request(database,method,url,body=None,owner='A'):
        if url=='/api/difficulty/start':
            body=dict(body)
            body.setdefault('content_revision','f'*64)
            body.setdefault('consumption_token',main._canvas_consumption_token(owner,body['file_id'],body['content_revision']))
        monkeypatch.setattr(httpx,'AsyncClient',lambda **kwargs:REAL_CLIENT(transport=httpx.MockTransport(database),**kwargs))
        async def run():
            async with REAL_CLIENT(transport=httpx.ASGITransport(app=app),base_url='http://logicade.test') as client:
                return await client.request(method,url,json=body,headers={'Authorization':'Bearer '+main._issue_session(owner)})
        return asyncio.run(run())
    return request


def test_unfinished_runs_are_not_zero_scored_adaptation_evidence():
    parent=level(3,1)
    rows=[attempt(parent,1,0,False,'abandoned'),attempt(parent,2,.25,False,'restarted'),attempt(parent,3,.9)]
    assert evidence(rows)['first_attempt_accuracy']==.9
    assert evidence(rows)['first_evaluated_attempt_number']==3
    rows.insert(2,attempt(parent,3,.4,False,'failed'));rows[-1]['attempt_number']=4;rows[-1]['started_at']='2026-10-01T00:04:00Z'
    assert evidence(rows)['first_attempt_accuracy']==.4


def test_attempt_number_preserves_first_evaluated_score_despite_clock_skew():
    parent=level(3,1)
    first,later=attempt(parent,1,.4,False),attempt(parent,2,1)
    first['started_at']='2026-10-02T00:00:00Z'
    assert evidence([later,first])['first_attempt_accuracy']==.4


@pytest.mark.parametrize('week',range(2,10))
def test_region_start_uses_preceding_regions_final_playable_stage(routes,week):
    prior=predecessor(week,1);parent=level(*prior)
    database=Database([parent],[attempt(parent,1,.9)])
    response=routes(database,'GET',f'/api/difficulty/resolve?week={week}&level=1')
    assert response.status_code==200,response.text
    data=response.json()
    assert data['difficulty']=='advanced' and data['previous_stage']==list(prior)
    assert data['decision']['inputs']['selected_week']==week
    assert data['decision']['previous_level_id']==parent['level_id']


def test_recovery_supplies_owned_level_ids_attempts_and_reuses_unserved_choice(routes):
    parent=level(7,1,18);database=Database([parent],[attempt(parent,1,.7)])
    one=routes(database,'GET','/api/difficulty/resolve?week=7&level=2&student_id=B').json()
    two=routes(database,'GET','/api/difficulty/resolve?week=7&level=2').json()
    assert one['difficulty']=='standard'
    assert one['decision']['decision_id']==two['decision']['decision_id']
    assert one['target_level_id']==two['target_level_id']
    assert one['attempts'] and one['levels']==[parent]
    assert all(row['student_id']=='A' for row in one['levels']+one['attempts'])


def test_missing_or_unavailable_history_does_not_grant_standard(routes):
    database=Database()
    assert routes(database,'GET','/api/difficulty/resolve?week=3&level=2').status_code==409
    database.fail=True
    assert routes(database,'GET','/api/difficulty/resolve?week=3&level=2').status_code==503


def test_a_missing_first_attempt_is_not_replaced_by_a_later_perfect_score(routes):
    parent=level(3,1);database=Database([parent],[attempt(parent,2,1)])
    response=routes(database,'GET','/api/difficulty/resolve?week=3&level=2')
    assert response.status_code==409 and 'missing attempt records' in response.text


def test_an_unserved_choice_can_change_without_erasing_earlier_decisions(routes):
    parent=level(3,1);database=Database([parent],[attempt(parent,1,.9)])
    before=routes(database,'GET','/api/difficulty/resolve?week=3&level=2').json()['decision']
    database.data['level_attempts'] += [attempt(parent,2,1),attempt(parent,3,1)]
    after=routes(database,'GET','/api/difficulty/resolve?week=3&level=2').json()['decision']
    assert before['difficulty_selected']=='advanced' and after['difficulty_selected']=='standard'
    assert after['inputs']['supersedes_decision_id']==before['decision_id']
    assert len(database.data['difficulty_decisions'])==2
    assert database.data['difficulty_decisions'][0]==before
    assert routes(database,'GET','/api/difficulty/resolve?week=3&level=2').json()['decision']['decision_id']==after['decision_id']


@pytest.mark.parametrize('stage',[1,2])
def test_kingdom_initial_stages_use_standard_without_video_score(routes,stage):
    data=routes(Database(),'GET',f'/api/difficulty/resolve?week=1&level={stage}').json()
    assert data['difficulty']=='standard' and data['decision'] is None


def test_historical_verified_served_choice_is_preserved_without_regrading_video(routes):
    video,played=level(1,1),level(1,2,1)
    old={'decision_id':str(uuid4()),'student_id':'A','previous_level_id':video['level_id'],'next_level_id':played['level_id'],
         'difficulty_selected':'needs_support','difficulty_served':'needs_support','rule_version':'cp1-60-v1',
         'inputs':{'selected_level':2,'server_verification':{'status':'verified'}},'decided_at':'2026-10-01T01:00:00Z'}
    database=Database([video,played],[],[old])
    result=routes(database,'GET','/api/difficulty/resolve?week=1&level=2').json()
    assert result['difficulty']=='needs_support' and result['decision']==old
    response=routes(database,'POST','/serve',{'student_id':'A','week':1,'level':2,'difficulty':'standard'})
    assert response.status_code==409


def test_database_transport_failure_is_reported_as_unavailable_history(routes):
    def unavailable(request):raise httpx.ConnectError('isolated database unavailable',request=request)
    response=routes(unavailable,'GET','/api/difficulty/resolve?week=3&level=2')
    assert response.status_code==503


def test_serve_and_prepare_cannot_bypass_assigned_category(routes,monkeypatch):
    parent=level(3,1);database=Database([parent],[attempt(parent,1,.9)])
    class Catalog:
        def get_by_id(self,_):return {'week':3,'level':2,'difficulty':'Standard'}
    monkeypatch.setattr(main,'_registry',Catalog())
    for url,body in [('/serve',{'student_id':'A','week':3,'level':2,'difficulty':'standard'}),('/prepare',{'file_id':'wrong-category'})]:
        response=routes(database,'POST',url,body)
        assert response.status_code==409 and 'advanced' in response.text


def test_start_freezes_selected_difficulty_and_retries_are_idempotent(routes,monkeypatch):
    parent=level(3,1);database=Database([parent],[attempt(parent,1,.9)])
    game=SimpleNamespace(week=3,level=2,difficulty='advanced',slug='terminal',content_revision='f'*64)
    monkeypatch.setattr(main,'_find_canvas_game',lambda _:game)
    assigned=routes(database,'GET','/api/difficulty/resolve?week=3&level=2').json()
    body={'file_id':'test-game','level_id':assigned['target_level_id']}
    for _ in range(2):
        response=routes(database,'POST','/api/difficulty/start',body)
        assert response.status_code==200,response.text
        assert response.json()['decision']['difficulty_served']=='advanced'
    assert len(database.data['levels'])==2
    assert database.data['levels'][-1]['difficulty_assigned']=='advanced'
    assert database.data['levels'][-1]['difficulty_served']=='advanced'
    database.data['level_attempts'] += [attempt(parent,2,1),attempt(parent,3,1)]
    later=routes(database,'GET','/api/difficulty/resolve?week=3&level=2').json()
    assert later['difficulty']=='advanced' and later['decision']['decision_id']==assigned['decision']['decision_id']
    assert later['decision']['inputs']['full_level_replays']==0


def test_start_rejects_wrong_level_identity_and_stale_difficulty(routes,monkeypatch):
    parent=level(3,1);database=Database([parent],[attempt(parent,1,.9)])
    game=SimpleNamespace(week=3,level=2,difficulty='standard',slug='terminal',content_revision='f'*64)
    monkeypatch.setattr(main,'_find_canvas_game',lambda _:game)
    assigned=routes(database,'GET','/api/difficulty/resolve?week=3&level=2').json()
    assert routes(database,'POST','/api/difficulty/start',{'file_id':'test','level_id':assigned['target_level_id']}).status_code==409
    game.difficulty='advanced'
    assert routes(database,'POST','/api/difficulty/start',{'file_id':'test','level_id':str(uuid4())}).status_code==409
    assert len(database.data['levels'])==1


def test_start_requires_an_issued_current_game_revision(routes,monkeypatch):
    parent=level(3,1);database=Database([parent],[attempt(parent,1,.9)])
    game=SimpleNamespace(week=3,level=2,difficulty='advanced',slug='terminal',content_revision='f'*64)
    monkeypatch.setattr(main,'_find_canvas_game',lambda _:game)
    assignment=routes(database,'GET','/api/difficulty/resolve?week=3&level=2').json()
    body={'file_id':'test','level_id':assignment['target_level_id']}
    assert routes(database,'POST','/api/difficulty/start',{**body,'consumption_token':'invalid'}).status_code==401
    assert routes(database,'POST','/api/difficulty/start',{**body,'content_revision':'e'*64}).status_code==409
    assert len(database.data['levels'])==1


def test_a_lost_conditional_start_update_cannot_report_a_served_choice(routes,monkeypatch):
    parent=level(3,1);database=Database([parent],[attempt(parent,1,.9)])
    game=SimpleNamespace(week=3,level=2,difficulty='advanced',slug='terminal',content_revision='f'*64)
    monkeypatch.setattr(main,'_find_canvas_game',lambda _:game)
    assignment=routes(database,'GET','/api/difficulty/resolve?week=3&level=2').json()
    def lost_update(request):
        if request.method=='PATCH' and request.url.path.endswith('/difficulty_decisions'):
            return httpx.Response(200,json=[])
        return database(request)
    response=routes(lost_update,'POST','/api/difficulty/start',{'file_id':'test','level_id':assignment['target_level_id']})
    assert response.status_code==409
    assert database.data['difficulty_decisions'][0]['difficulty_served'] is None


def test_a_cached_server_decision_is_acknowledged_without_mutation(routes):
    parent=level(3,1);database=Database([parent],[attempt(parent,1,.9)])
    saved=routes(database,'GET','/api/difficulty/resolve?week=3&level=2').json()['decision']
    assert routes(database,'POST','/sync',{'table':'difficulty_decisions','rows':[saved]}).status_code==200
    assert database.data['difficulty_decisions']==[saved]


def test_sync_cannot_create_or_change_server_decisions(routes):
    parent=level(3,1);database=Database([parent],[attempt(parent,1,.9)])
    saved=routes(database,'GET','/api/difficulty/resolve?week=3&level=2').json()['decision']
    for field,value in [('difficulty_selected','needs_support'),('inputs',{'authority':'server','first_attempt_accuracy':0})]:
        forged=copy.deepcopy(saved);forged[field]=value
        assert routes(database,'POST','/sync',{'table':'difficulty_decisions','rows':[forged]}).status_code==409
    forged=copy.deepcopy(saved);forged['decision_id']=str(uuid4())
    assert routes(database,'POST','/sync',{'table':'difficulty_decisions','rows':[forged]}).status_code==409
    assert database.data['difficulty_decisions']==[saved]


def test_legacy_sync_cannot_forge_a_historically_served_choice(routes):
    parent,current=level(3,1),level(3,2,1)
    database=Database([parent,current],[attempt(parent,1,.9)])
    row={'decision_id':str(uuid4()),'student_id':'A','previous_level_id':parent['level_id'],
         'next_level_id':current['level_id'],'difficulty_selected':'advanced','difficulty_served':'advanced',
         'rule_version':'cp1-60-v1','inputs':{'selected_level':2},'decided_at':'2026-10-01T01:00:00Z'}
    response=routes(database,'POST','/sync',{'table':'difficulty_decisions','rows':[row]})
    assert response.status_code==409
    assert not database.data['difficulty_decisions']


def test_another_account_cannot_recover_or_start_the_learners_stage(routes,monkeypatch):
    parent=level(3,1);database=Database([parent],[attempt(parent,1,.9)])
    response=routes(database,'GET','/api/difficulty/resolve?week=3&level=2',owner='B')
    assert response.status_code==409
    assert not database.data['difficulty_decisions']
