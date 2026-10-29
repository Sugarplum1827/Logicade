"""Durable, single-model background replacement queue; gameplay never awaits inference."""
from __future__ import annotations

import asyncio
import copy
import hashlib
import json
import itertools
import re
import time
from datetime import datetime,timezone
from pathlib import Path

from .canvas_builder import build_candidate, problem_fingerprint
from .canvas_games import _atomic_write
from .canvas_verification import verify_candidate


class CanvasReplacementWorker:
    def __init__(self,root,runtime,lookup,bucket,client,publish,log=None,retry_seconds=300):
        self.root=Path(root);self.runtime=Path(runtime);self.lookup=lookup;self.bucket=bucket
        self.client=client;self.publish=publish;self.log=log;self.retry_seconds=retry_seconds
        self.path=self.root/'data/runtime/canvas_replacement_jobs.json'
        self.state={'schema_version':1,'jobs':{}};self.guard=asyncio.Lock();self.wake=asyncio.Event()
        self.task=None;self.handle=None

    def acquire(self):
        if self.handle:return
        path=self.root/'data/runtime/canvas_worker.lock';path.parent.mkdir(parents=True,exist_ok=True)
        self.handle=path.open('a+b')
        try:
            if path.stat().st_size==0:self.handle.write(b'0');self.handle.flush()
            self.handle.seek(0)
            if __import__('os').name=='nt':
                import msvcrt
                msvcrt.locking(self.handle.fileno(),msvcrt.LK_NBLCK,1)
            else:
                import fcntl
                fcntl.flock(self.handle.fileno(),fcntl.LOCK_EX|fcntl.LOCK_NB)
        except OSError:
            self.handle.close();self.handle=None
            raise RuntimeError('Canvas publication requires one API process; use --workers 1') from None

    def _save(self):
        jobs=self.state['jobs'];keep=set();groups={}
        for key,row in jobs.items():
            if row['status']=='published':groups.setdefault((row['week'],row['level'],row['difficulty']),[]).append(row)
            elif row['status']!='obsolete':keep.add(key)
        for rows in groups.values():keep.update(r['job_id'] for r in sorted(rows,key=lambda r:r['updated_at'],reverse=True)[:8])
        keep.update(r['job_id'] for r in sorted([j for j in jobs.values() if j['status']=='obsolete'],key=lambda r:r['updated_at'],reverse=True)[:100])
        state={**self.state,'jobs':{key:row for key,row in jobs.items() if key in keep}}
        _atomic_write(self.path,(json.dumps(state,ensure_ascii=False,indent=2)+'\n').encode());self.state=state

    async def start(self):
        self.acquire()
        if self.path.exists():
            state=json.loads(self.path.read_text(encoding='utf-8'))
            if state.get('schema_version')!=1 or not isinstance(state.get('jobs'),dict):raise ValueError('Invalid Canvas replacement queue')
            self.state=state
        for job in self.state['jobs'].values():
            if job['status'] in ('generating','verifying','publishing'):job.update(status='queued',next_retry_at=0)
        self._save();self.task=asyncio.create_task(self.run(),name='canvas-replacements')

    async def close(self):
        if self.task:
            self.task.cancel();await asyncio.gather(self.task,return_exceptions=True);self.task=None
        if self.handle:self.handle.close();self.handle=None

    async def enqueue(self,file_id,revision):
        found=self.lookup(file_id)
        if not found:return {'queued':False,'reason':'unavailable'}
        source,game=found
        if game.week==1 and game.level!=2:return {'queued':False,'reason':'orientation_video'}
        if revision!=game.content_revision:return {'queued':False,'reason':'older_revision'}
        identity=hashlib.sha256((file_id+':'+revision).encode()).hexdigest()
        async with self.guard:
            if identity in self.state['jobs']:return {'queued':True,'job_id':identity,'coalesced':True}
            active=sum(j['status'] in ('queued','generating','verifying','publishing','retry') for j in self.state['jobs'].values())
            if active>=1000:return {'queued':False,'reason':'queue_full_existing_pool_retained'}
            now=time.time()
            self.state['jobs'][identity]={'job_id':identity,'file_id':file_id,'revision':revision,'week':game.week,'level':game.level,
                'difficulty':game.difficulty,'status':'queued','actor':'system:canvas_worker','attempts':0,'created_at':now,'updated_at':now,'next_retry_at':0}
            try:self._save()
            except BaseException:self.state['jobs'].pop(identity,None);raise
        self.wake.set()
        return {'queued':True,'job_id':identity,'coalesced':False}

    async def update(self,identity,**fields):
        async with self.guard:
            job=self.state['jobs'][identity];before=copy.deepcopy(job)
            job.update(fields,updated_at=time.time())
            try:self._save()
            except BaseException:self.state['jobs'][identity]=before;raise

    def recent(self,job):
        rows=[r for r in self.state['jobs'].values() if (r['week'],r['level'],r['difficulty'])==(job['week'],job['level'],job['difficulty']) and r['status']=='published']
        return sorted(rows,key=lambda r:r['updated_at'],reverse=True)[:8]

    def constraints(self,game,recent):
        if game.config.get('programming') or game.config.get('flowchart'):return {}
        from scripts.archive_lessons import authoring_questions
        bank=authoring_questions(game.config['source_level']);by_prompt={r['prompt']:r['id'] for r in bank}
        blocked={tuple(sorted(by_prompt[re.sub(r'^Archive case \d+: ','',t['prompt'])] for t in g.config['tasks'])) for g in self.bucket(game)}
        blocked.update(tuple(sorted(r['question_ids'])) for r in recent if r.get('question_ids'))
        # Review banks are larger; bound prompt size while offering many fresh choices.
        choices=[list(row) for row in itertools.islice((row for row in itertools.combinations([r['id'] for r in bank],3) if tuple(sorted(row)) not in blocked),30)]
        return {'allowed_question_combinations':choices}

    async def run_job(self,identity):
        job=self.state['jobs'][identity];last_error=job.get('error','')
        for attempt in range(1,4):
            found=self.lookup(job['file_id'])
            if found and found[1].config.get('generation',{}).get('job_id')==identity:
                generation=found[1].config['generation']
                await self.update(identity,status='published',result_revision=found[1].content_revision,error=None,
                                  problem_fingerprint=generation['problem_fingerprint'],parameter_fingerprint=generation['parameter_fingerprint'],
                                  question_ids=generation['proposal']['parameters'].get('question_ids'));return
            if not found or found[1].content_revision!=job['revision']:
                await self.update(identity,status='obsolete',error='Consumed revision has already been replaced');return
            source,game=found;raw=source.read_bytes();template=json.loads(raw)
            await self.update(identity,status='generating',attempts=job['attempts']+1)
            print(f'[{attempt}/3] Generating new JSON: {source.name} replacement for JSON: {source.name}',flush=True)
            started=time.perf_counter();meta={}
            try:
                recent=self.recent(job)
                proposals=[r['parameter_fingerprint'] for r in recent if r.get('parameter_fingerprint')]
                constraints=self.constraints(game,recent)
                proposal,meta=await self.client().propose_canvas_challenge(template,proposals,max_attempts=1,builder_feedback=last_error,
                                                                        authoring_constraints=constraints)
                if proposal is None:raise ValueError('; '.join(meta.get('errors',[])) or 'LLM proposal rejected')
                spec,candidate=build_candidate(template,proposal,meta)
                fingerprint=problem_fingerprint(candidate)
                previous={problem_fingerprint(g.config) for g in self.bucket(game)}|{r.get('problem_fingerprint') for r in recent}
                if fingerprint in previous:raise ValueError('The compiled learning problem repeats a current or recently published problem; choose different effective values/question IDs')
                await self.update(identity,status='verifying')
                verification=await verify_candidate(candidate,self.runtime)
                generation=spec['canvas_generation']
                generation.update(problem_fingerprint=fingerprint,runtime_verification=verification,generated_at=time.time(),origin='ollama',
                                  job_id=identity,replaces_revision=job['revision'])
                spec.update(is_fallback=False,generated_at=datetime.now(timezone.utc).isoformat())
                candidate['generation']=copy.deepcopy(generation)
                await self.update(identity,status='publishing')
                new_game=await self.publish(source,game,spec,candidate,job['revision'],hashlib.sha256(raw).hexdigest())
                await self.update(identity,status='published',next_retry_at=0,error=None,
                                  parameter_fingerprint=generation['parameter_fingerprint'],problem_fingerprint=fingerprint,
                                  result_revision=new_game.content_revision,verification=verification,
                                  question_ids=proposal['parameters'].get('question_ids'))
                print(f'Generation JSON: {source.name} is Complete sent to {source}',flush=True)
                if self.log:
                    try:await self.log(game,'verified_saved',attempt,started,meta,spec,None)
                    except Exception:pass  # Telemetry cannot undo an already committed publication.
                return
            except asyncio.CancelledError:raise
            except Exception as exc:
                last_error=f'{type(exc).__name__}: {exc}'[:900]
                print(f'Generation {source.name} failed: {last_error}',flush=True)
                if self.log:
                    try:await self.log(game,'generation_failed',attempt,started,meta,template,last_error)
                    except Exception:pass
        await self.update(identity,status='retry',error=last_error,next_retry_at=time.time()+self.retry_seconds)
        print(f'Generation {source.name} failed, Generating again after 5mins',flush=True)

    async def run(self):
        while True:
            now=time.time()
            due=[j for j in self.state['jobs'].values() if j['status'] in ('queued','retry') and j.get('next_retry_at',0)<=now]
            if due:
                job=min(due,key=lambda j:(j['status']!='queued',j.get('next_retry_at',0),j['created_at']))
                try:await self.run_job(job['job_id'])
                except asyncio.CancelledError:raise
                except Exception as exc:
                    await self.update(job['job_id'],status='retry',error=f'{type(exc).__name__}: {exc}'[:900],next_retry_at=time.time()+self.retry_seconds)
                continue
            self.wake.clear()
            try:await asyncio.wait_for(self.wake.wait(),timeout=5)
            except asyncio.TimeoutError:pass

    def status(self):
        counts={}
        for row in self.state['jobs'].values():counts[row['status']]=counts.get(row['status'],0)+1
        return {'enabled':True,'running':bool(self.task and not self.task.done()),'counts':counts,
                'jobs':sorted(self.state['jobs'].values(),key=lambda r:r['updated_at'],reverse=True)[:100]}
