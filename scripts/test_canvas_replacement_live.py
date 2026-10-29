"""Run the real local LLM→builder→verifier→publisher pipeline in an isolated copy."""
import asyncio
import argparse
import hashlib
import json
import shutil
import uuid
from datetime import datetime,timezone
from pathlib import Path

from dotenv import load_dotenv
import server.canvas_prompting as prompting
from server.canvas_games import discover_canvas_games
from server.canvas_publication import publish_candidate
from server.canvas_replacements import CanvasReplacementWorker
from server.game_packages import prepare_package
from server.llm_client import LLMClient

ROOT=Path(__file__).resolve().parents[1]


async def main(week=7,level=7,difficulty='standard',trial=1):
    load_dotenv();client=LLMClient.from_env()
    available=await client.probe()
    if not available:
        await client.close();raise RuntimeError('Configured local Ollama model is unavailable')
    workspace=ROOT/'artifacts/canvas-pipeline-live'/(datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%S')+'-'+uuid.uuid4().hex[:6])
    original=next((ROOT/'data/fallback_pool'/f'week_{week}'/f'level{level}'/difficulty).glob(f'*)_{trial}.json'))
    template=json.loads(original.read_text(encoding='utf-8'));relative=Path(template['canvas_runtime']['game_path'])
    before=hashlib.sha256(original.read_bytes()).hexdigest()
    source=workspace/'data/fallback_pool'/relative;source.parent.mkdir(parents=True)
    shutil.copyfile(original,source)
    mirror=workspace/'games'/relative;mirror.parent.mkdir(parents=True)
    shutil.copyfile(ROOT/'games'/relative,mirror)
    shutil.copytree(ROOT/'games/runtime',workspace/'games/runtime')
    (workspace/'games/assets').mkdir();shutil.copyfile(ROOT/'games/assets/manifest.json',workspace/'games/assets/manifest.json')
    shutil.copyfile(ROOT/'data/curriculum.json',workspace/'data/curriculum.json')
    prompting.ROOT=workspace
    games=discover_canvas_games(workspace/'games');current=[next(g for rows in games.values() for g in rows)];old=current[0]
    async def publish(path,game,spec,config,revision,source_hash):
        current[0]=publish_candidate(workspace,workspace/'games',path,game,spec,config,revision,source_hash)
        return current[0]
    worker=CanvasReplacementWorker(workspace,workspace/'games',lambda file_id:(source,current[0]) if file_id==old.file_id else None,
                                  lambda game:current,lambda:client,publish)
    try:
        await worker.start();queued=await worker.enqueue(old.file_id,old.content_revision)
        async def finish():
            while worker.state['jobs'][queued['job_id']]['status'] not in ('published','retry','obsolete'):await asyncio.sleep(.1)
        await asyncio.wait_for(finish(),210)
        job=worker.state['jobs'][queued['job_id']]
        report={'workspace':str(workspace),'status':job['status'],'model':client.model,'job':job,
                'event_loop':type(asyncio.get_running_loop()).__name__,
                'stage':{'week':week,'level':level,'difficulty':difficulty,'trial':trial},
                'original_pool_unchanged':hashlib.sha256(original.read_bytes()).hexdigest()==before}
        if job['status']=='published':
            package=prepare_package(source,workspace/'data/fallback_pool',workspace/'cache',shared_canvas_runtime_root=workspace/'games')
            report.update(package=package,source=str(source),archive=str(source.with_suffix('.zip')),
                          old_revision=old.content_revision,new_revision=current[0].content_revision)
        (workspace/'report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
        print(json.dumps({'report':str(workspace/'report.json'),'status':job['status'],'original_pool_unchanged':report['original_pool_unchanged']},ensure_ascii=False),flush=True)
        if job['status']!='published':raise RuntimeError(job.get('error','No replacement published'))
    finally:
        await worker.close();await client.close()


if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--week',type=int,default=7)
    parser.add_argument('--level',type=int,default=7)
    parser.add_argument('--difficulty',choices=['needs_support','standard','advanced'],default='standard')
    parser.add_argument('--trial',type=int,default=1)
    parser.add_argument('--selector-loop',action='store_true',help='Reproduce the Windows Uvicorn reload event loop')
    args=parser.parse_args()
    if args.selector_loop:
        with asyncio.Runner(loop_factory=asyncio.SelectorEventLoop) as runner:
            runner.run(main(args.week,args.level,args.difficulty,args.trial))
    else:asyncio.run(main(args.week,args.level,args.difficulty,args.trial))
