"""Isolated full-learner QA with real game routes and an in-memory study store.

Run only locally: python -m uvicorn scripts.learner_browser_preview:app --host 127.0.0.1 --port 8124
Fixture login: QA-CANVAS / qa-only-1234. No production database routes are registered.
"""
import json
import os
import shutil
import tempfile
from pathlib import Path

from fastapi import FastAPI, Header, HTTPException
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles
from starlette.middleware.cors import CORSMiddleware
from server import main
from server.canvas_games import discover_canvas_games

ROOT=Path(__file__).resolve().parents[1]
SCRATCH_HOLDER=tempfile.TemporaryDirectory(prefix='logicade-learner-browser-')
SCRATCH=Path(SCRATCH_HOLDER.name)
CACHE=SCRATCH/'cache'
CACHE.mkdir()
PARTICIPANT='QA-CANVAS-ONLY'
PK={'students':'student_id','levels':'level_id','level_attempts':'attempt_id',
    'events':'event_id','coin_transactions':'transaction_id','difficulty_decisions':'decision_id'}
TABLES={key:{} for key in PK}
LEDGER=TABLES['coin_transactions']
LEDGER['registration']={'transaction_id':'registration','student_id':PARTICIPANT,'amount':20}
GAMES=discover_canvas_games(ROOT/'games')
BY_ID={game.file_id:game for rows in GAMES.values() for game in rows}

class Catalog:
    def row(self,game):
        relative='data/fallback_pool/'+game.config['source_path']
        target=SCRATCH/relative
        if not target.exists():
            target.parent.mkdir(parents=True,exist_ok=True)
            shutil.copyfile(ROOT/relative,target)
        return {**json.loads(target.read_text(encoding='utf-8')),'source_path':relative}

    def get(self,week,level,difficulty):
        return [self.row(game) for game in BY_ID.values()
                if (game.week,game.level,game.difficulty)==(week,level,difficulty)]

    def get_by_id(self,identity):
        game=BY_ID.get(identity)
        return self.row(game) if game else None

# These process-local overrides only affect this disposable server. The normal
# server process and its source pool/database are never used for test writes.
os.environ['LOGICADE_SESSION_SECRET']='disposable-browser-fixture-secret'
os.environ['LOGICADE_NATIVE_CANVAS']='1'
main.REPO_ROOT=SCRATCH
main.GAME_BUILD_CACHE=CACHE
main._canvas_games=GAMES
main._registry=Catalog()
main._generated_games={}
main._served_pool_ids=set()
main._selection_queues={}
main._serve_locks={}
main._game_package_locks={}
app=FastAPI()

def owner(authorization): return main._require_participant(authorization,PARTICIPANT)
def balance(): return sum(int(row['amount']) for row in LEDGER.values())

@app.get('/')
def intro():
    return HTMLResponse('<h1>Disposable learner QA</h1><p>Login: QA-CANVAS / qa-only-1234</p><p>Records remain in memory and packages use temporary copies.</p><a href="/app/">Open learner app</a> · <a href="/preview/state">Inspect test records</a>')

@app.get('/api/config')
def config(): return {'apiBaseUrl':'/api','catalogPath':'/api/games','syncPath':'/api/sync/batch'}

@app.post('/api/auth/login')
def login(req:main.LoginRequest):
    if (req.student_number,req.password)!=('QA-CANVAS','qa-only-1234'):
        raise HTTPException(401,'Invalid test credentials')
    return {'student_id':PARTICIPANT,'username':'Canvas QA','token':main._issue_session(PARTICIPANT)}

@app.get('/api/coins/balance')
def coins(authorization:str|None=Header(default=None)):
    owner(authorization)
    return {'balance':balance()}

@app.post('/api/coins/spend-hint')
def hint(req:main.HintSpendRequest,authorization:str|None=Header(default=None)):
    owner(authorization)
    if req.transaction_id not in LEDGER:
        if balance()<6: raise HTTPException(409,'Not enough coins')
        LEDGER[req.transaction_id]={'transaction_id':req.transaction_id,'student_id':PARTICIPANT,
            'amount':-6,'reason':'hint_used','level_id':req.level_id}
    return {'balance':balance()}

@app.post('/api/sync/batch')
def sync(req:main.SyncBatchRequest,authorization:str|None=Header(default=None)):
    owner(authorization)
    for row in req.rows:
        if row.get('student_id')!=PARTICIPANT: raise HTTPException(403,'Test participant only')
        TABLES[req.table][row[PK[req.table]]]=row
    return {'ok':True,'accepted':len(req.rows)}

@app.post('/api/sync/status')
def status(authorization:str|None=Header(default=None)):
    owner(authorization)
    return {'ok':True}

@app.get('/api/progress/stages')
def progress(week:int,authorization:str|None=Header(default=None)):
    owner(authorization)
    completed={attempt['level_id'] for attempt in TABLES['level_attempts'].values() if attempt.get('completed')}
    stages=sorted({row['stage_number'] for row in TABLES['levels'].values()
                   if row.get('week')==week and row.get('level_id') in completed and row.get('stage_number')})
    return {'completed_stages':stages,'next_stage':min((max(stages,default=0)+1),2 if week==1 else 10)}

@app.get('/preview/state')
def state():
    return {'fixture':True,'balance':balance(),'counts':{key:len(rows) for key,rows in TABLES.items()},
        'levels':list(TABLES['levels'].values()),'attempts':list(TABLES['level_attempts'].values()),
        'ledger':list(LEDGER.values()),'difficulty_decisions':list(TABLES['difficulty_decisions'].values()),
        'live_leases':len(list(CACHE.glob('*/index.html')))}

for route,handler in [('/serve',main.serve),('/api/games/prepare',main.prepare_game),
                      ('/api/games/mark-used',main.mark_game_used),('/api/games/release',main.release_game)]:
    app.post(route)(handler)
for prefix,directory in [('/canvas-runtime',ROOT/'games'),('/vendor',ROOT/'vendor'),('/game-builds',CACHE)]:
    app.mount(prefix,CORSMiddleware(StaticFiles(directory=directory,html=True),allow_origins=['*'],allow_methods=['GET','HEAD'],allow_headers=['*']))
app.mount('/assets',StaticFiles(directory=ROOT/'client/dist/assets'))
app.mount('/app',StaticFiles(directory=ROOT/'client/dist',html=True))
