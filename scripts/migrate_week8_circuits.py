"""Verify and journal-publish Week 8 and its scope-review circuit packages."""
import argparse
import asyncio
import copy
import hashlib
import json
from collections import Counter
from dataclasses import replace
from datetime import datetime,timezone
from pathlib import Path

from scripts.build_canvas_games import adapt_fallback_spec,build_definition,write_json
from server.canvas_builder import align_description,problem_fingerprint
from server.canvas_games import discover_canvas_games
from server.canvas_prompting import canvas_context,validate_canvas_proposal
from server.canvas_publication import publish_candidate
from server.canvas_replacements import CanvasReplacementWorker
from server.canvas_verification import verify_candidate

ROOT=Path(__file__).resolve().parents[1]


async def migrate(write=False):
    stamp=datetime.now(timezone.utc).isoformat()
    report={'migration':'week8-c-scope-networks-v2','started_at':stamp,'write':write,'games':[]}
    library=discover_canvas_games(ROOT/'games')
    targets=[game for group in library.values() for game in group if game.config.get('source_week')==8]
    if len(targets)!=360:raise RuntimeError(f'Expected 360 Week 8/scope-review records; found {len(targets)}')
    guard=CanvasReplacementWorker(ROOT,ROOT/'games',None,None,None,None)
    # Use the same exclusive lock as the live generator. The server must be
    # stopped; no live generation may race the mechanic migration.
    guard.acquire()
    try:
        for index,old in enumerate(targets,1):
            if old.config.get('programming',{}).get('signal_network',{}).get('version')==2:continue
            source=ROOT/'data/fallback_pool'/old.config['source_path'];original=source.read_bytes()
            spec=json.loads(original);previous_generation=copy.deepcopy(spec.get('canvas_generation'))
            metadata={'version':2,'from_family':old.config.get('programming',{}).get('family'),'to_family':'circuit','requested_at':stamp,
                      'topology':'parallel_branches_sum_merge_bounded_feedback',
                      'previous_revision':old.content_revision,'lesson_unchanged':True}
            spec['mechanic_migration']=metadata
            adapt_fallback_spec(spec,Path(old.config['source_path']))
            config=build_definition(spec,Path(old.config['source_path']))
            align_description(spec,config)
            config=build_definition(spec,Path(old.config['source_path']))
            proof=await verify_candidate(config,ROOT/'games')
            if previous_generation:
                context=canvas_context(spec);context['binding']['mechanic_family']='circuit'
                generation=copy.deepcopy(previous_generation);generation['proposal']['binding']['mechanic_family']='circuit'
                _,fingerprint=validate_canvas_proposal(json.dumps(generation['proposal']),context)
                generation.update(parameter_fingerprint=fingerprint,problem_fingerprint=problem_fingerprint(config),runtime_verification=proof)
                generation['mechanic_migration']=metadata
                spec['canvas_generation']=generation;config['generation']=copy.deepcopy(generation)
            spec['canvas_runtime'].update(mode='circuit',asset_set='circuit')
            if write:
                descriptor=replace(old,slug='circuit',game_id='canvas_circuit',display_name='C Scope Circuit Workshop')
                publish_candidate(ROOT,ROOT/'games',source,descriptor,spec,config,old.content_revision,hashlib.sha256(original).hexdigest())
            report['games'].append({'file_id':old.file_id,'week':old.week,'level':old.level,'difficulty':old.difficulty,'verified':proof['passed']})
            if index%30==0:print(f'[{index}/{len(targets)}] {"Published" if write else "Verified"} scope circuit packages',flush=True)
        if write:
            course_path=ROOT/'data/curriculum.json';course=json.loads(course_path.read_text(encoding='utf-8'))
            for week in course['weeks']:
                if week['week']==8:week['genres']=['circuit']
            write_json(course_path,course)
            registry_path=ROOT/'games/registry.json';registry=json.loads(registry_path.read_text(encoding='utf-8'))
            fresh=discover_canvas_games(ROOT/'games');counts=Counter(g.slug for rows in fresh.values() for g in rows)
            registry['modes']={key:counts.get(key,0) for key in registry['modes']}
            registry['week_modes']['8']='circuit';write_json(registry_path,registry)
        path=ROOT/'artifacts/week8-network-migration.json';write_json(path,report)
        print(f'{len(report["games"])} verified {"and published" if write else "in dry run"}; report: {path}',flush=True)
    finally:
        await guard.close()


if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--write',action='store_true')
    args=parser.parse_args();asyncio.run(migrate(args.write))
