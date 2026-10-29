"""Read-only preview of an isolated real-LLM pipeline result; no learner records."""
import json
import os
from pathlib import Path

from fastapi import FastAPI
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles
from starlette.middleware.cors import CORSMiddleware

ROOT=Path(__file__).resolve().parents[1]
WORKSPACE=Path(os.environ['LOGICADE_GENERATION_QA_ROOT']).resolve()
if not WORKSPACE.is_relative_to((ROOT/'artifacts/canvas-pipeline-live').resolve()):raise ValueError('Use an isolated pipeline QA workspace')
REPORT=json.loads((WORKSPACE/'report.json').read_text(encoding='utf-8'))
app=FastAPI()


@app.get('/')
def index():
    url=REPORT['package']['launch_url']
    return HTMLResponse('<!doctype html><title>Verified LLM Canvas replacement · isolated QA</title><style>body{margin:0;background:#102028;color:white;font:16px system-ui}header{padding:8px}iframe{width:100%;height:calc(100vh - 70px);border:0;display:block}</style><header>Verified local Qwen replacement · Week 7 Level 7 · isolated QA<br>No learner or study records are written.</header><iframe title="Generated Canvas game" sandbox="allow-scripts allow-pointer-lock" src="'+url+'"></iframe>')


for prefix,folder in [('/game-builds',WORKSPACE/'cache'),('/canvas-runtime',WORKSPACE/'games'),('/vendor',ROOT/'vendor')]:
    app.mount(prefix,CORSMiddleware(StaticFiles(directory=folder,html=True),allow_origins=['*'],allow_methods=['GET','HEAD'],allow_headers=['*']))
