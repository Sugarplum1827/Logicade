"""Disposable browser QA server; never writes participant data or the source pool.

Run: python -m uvicorn scripts.canvas_browser_preview:app --host 127.0.0.1 --port 8123
"""
from pathlib import Path
import json
import shutil
import tempfile

from fastapi import FastAPI, HTTPException
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles
from starlette.middleware.cors import CORSMiddleware

from server.canvas_games import compile_canvas_package, discover_canvas_games
from server.game_packages import prepare_package, release_package

ROOT=Path(__file__).resolve().parents[1]
RUNTIME=ROOT/'games'
SCRATCH_HOLDER=tempfile.TemporaryDirectory(prefix='logicade-canvas-browser-')
SCRATCH=Path(SCRATCH_HOLDER.name)
CACHE=SCRATCH/'cache'
CACHE.mkdir()
GAMES=discover_canvas_games(RUNTIME)
app=FastAPI()

HTML='''<!doctype html><html><head><meta charset="utf-8"><title>LogiCade isolated Canvas QA</title>
<style>body{margin:0;background:#101926;color:#edf3fa;font:15px system-ui}header{height:64px;box-sizing:border-box;padding:8px;display:flex;gap:8px;align-items:center}button,select{padding:6px}iframe{display:block;width:1100px;height:600px;border:0}pre{white-space:pre-wrap;margin:8px}#status,#answers{height:20px;line-height:20px;margin:0}#answers{color:#b3d5e8}</style></head>
<body><header><b>Disposable Canvas QA · no study writes</b><label>Stage <select id="stage">'''+''.join(f'<option value="{w}:{l}">Week {w} Stage {l}</option>' for w,l in [(1,1),(1,2),*[(w,l) for w in range(2,10) for l in range(1,11)]])+'''</select></label>
<label>Difficulty <select id="difficulty"><option>standard</option><option>needs_support</option><option>advanced</option></select></label>
<label>Variation <select id="trial">'''+''.join(f'<option>{i}</option>' for i in range(1,11))+'''</select></label>
<label><input id="first-visit" type="checkbox">First-visit pointers</label><button id="prepare">Prepare and start ZIP</button><button id="pause">Pause</button><button id="resume">Resume</button><button id="hint">Hint</button><button id="release">Release</button></header>
<pre id="status" role="status">Ready</pre><pre id="answers"></pre><iframe title="Canvas package" sandbox="allow-scripts allow-pointer-lock" allow="autoplay; fullscreen"></iframe><pre id="fixture-data"></pre><pre id="events"></pre>
<script>
let lease=null,round=0;const frame=document.querySelector('iframe'),status=document.querySelector('#status'),events=document.querySelector('#events');
const send=(type,fields={})=>frame.contentWindow?.postMessage({channel:'logicade-host',version:1,type,...fields},'*');
frame.addEventListener('load',()=>{if(lease){const [week,level]=document.querySelector('#stage').value.split(':').map(Number);send('initialize',{week,level,first_visit_guidance:document.querySelector('#first-visit').checked});}});
window.addEventListener('message',e=>{if(e.source!==frame.contentWindow||e.data?.channel!=='logicade-game')return;const m=e.data;events.textContent+=JSON.stringify(m)+'\\n';if(m.type==='game_over')status.textContent=(m.won?'PASS':'FAIL')+' '+m.reason;});
document.querySelector('#prepare').onclick=async()=>{status.textContent='Preparing';events.textContent='';const [week,level]=document.querySelector('#stage').value.split(':');const difficulty=document.querySelector('#difficulty').value;
try{if(lease)await fetch('/preview/release/'+lease,{method:'POST'});const r=await fetch('/preview/package?week='+week+'&level='+level+'&difficulty='+difficulty+'&trial='+document.querySelector('#trial').value);const data=await r.json();if(!r.ok)throw Error(JSON.stringify(data));lease=data.package_id;document.querySelector('#answers').textContent='Mode '+data.mode+' · '+(data.flowchart?.title||'answer keys: '+data.answers.join(','));document.querySelector('#fixture-data').textContent=JSON.stringify(data.flowchart||{});status.textContent='Running '+data.mode;frame.src=data.launch_url;}catch(e){status.textContent='FAIL '+e.message;}};
for(const type of ['pause','resume','hint'])document.querySelector('#'+type).onclick=()=>send(type,{hint:'Inspect the current CP1 rule and trace its output.'});
document.querySelector('#release').onclick=async()=>{if(lease){const r=await fetch('/preview/release/'+lease,{method:'POST'});status.textContent=r.ok?'Released':'FAIL release';lease=null;frame.src='about:blank';}};
</script></body></html>'''

@app.get('/')
def index(): return HTMLResponse(HTML)

@app.get('/preview/package')
def package(week:int,level:int,difficulty:str,trial:int=1):
    if week==1 and level>2: raise HTTPException(404,'Week 1 contains two stages')
    game=next((g for rows in GAMES.values() for g in rows if (g.week,g.level,g.difficulty,g.index)==(week,level,difficulty,trial)),None)
    if not game: raise HTTPException(404,'No matching canonical game')
    relative=Path(game.config['source_path'])
    source=SCRATCH/'pool'/relative
    source.parent.mkdir(parents=True,exist_ok=True)
    shutil.copyfile(ROOT/'data/fallback_pool'/relative,source)
    spec=json.loads(source.read_text(encoding='utf-8'))
    compile_canvas_package(source_json=source,pool_root=SCRATCH/'pool',runtime_root=RUNTIME,
        game=game,spec=spec,backup_root=SCRATCH/'backups')
    result=prepare_package(source,SCRATCH/'pool',CACHE,shared_canvas_runtime_root=RUNTIME,
        expected_generated_game_id=game.variation_id)
    return {**result,'mode':game.slug,'answers':[t['answer_index']+1 for t in game.config['tasks'] if 'answer_index' in t],
            'flowchart':game.config.get('flowchart'),'programming':game.config.get('programming')}

@app.post('/preview/release/{lease}')
def release(lease:str):
    release_package(lease,CACHE)
    return {'ok':True}

for prefix,directory in [('/canvas-runtime',RUNTIME),('/vendor',ROOT/'vendor'),('/game-builds',CACHE)]:
    app.mount(prefix,CORSMiddleware(StaticFiles(directory=directory,html=True),allow_origins=['*'],allow_methods=['GET','HEAD'],allow_headers=['*']))
