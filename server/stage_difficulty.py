"""Authoritative stage transitions using existing participant research records."""
from datetime import datetime, timezone
import math
from uuid import UUID, uuid4, uuid5, NAMESPACE_URL

from fastapi import HTTPException

from .difficulty_engine import DIFFICULTIES, next_difficulty

RULE_VERSION = 'cp1-60-v2'
UNEVALUATED = {'abandoned', 'restarted', 'incomplete', 'started'}


def predecessor(week, stage):
    if week == 1 and stage <= 2:return None  # Orientation has no scored evidence.
    return (week, stage-1) if stage > 1 else (week-1, 2 if week == 2 else 10)


def evidence(attempts,level_order=None):
    if level_order is None:
        level_order=list(dict.fromkeys(a.get('level_id') for a in sorted(attempts,key=lambda a:str(a.get('started_at') or ''))))
    ranks={identity:index for index,identity in enumerate(level_order)}
    # Attempt numbers define order within a stage identity. Device clocks and
    # duration-based start timestamps must not turn a later score into the first.
    history=sorted(attempts,key=lambda a:(ranks.get(a.get('level_id'),len(ranks)),a.get('attempt_number',0),str(a.get('started_at') or ''),str(a.get('attempt_id',''))))
    for level_id in {a.get('level_id') for a in history}:
        numbers={a.get('attempt_number') for a in history if a.get('level_id')==level_id}
        if numbers and numbers!=set(range(1,max(numbers)+1)):
            raise HTTPException(409,'The preceding stage has missing attempt records. Synchronize the device that played it before continuing.')
    evaluated=[a for a in history if a.get('status') not in UNEVALUATED]
    first=evaluated[0] if evaluated else None
    if not first or not any(a.get('completed') is True for a in history):
        raise HTTPException(409,'Complete the preceding stage and synchronize its evaluated attempts before continuing.')
    value=first.get('accuracy')
    if isinstance(value,bool) or not isinstance(value,(int,float)) or not math.isfinite(value) or not 0<=value<=1:
        raise HTTPException(409,'The preceding stage has no valid evaluated accuracy.')
    completed=False;replays=0
    for row in history:
        if completed and row.get('completed') is True:replays+=1
        if row.get('completed') is True:completed=True
    return {'first_attempt_accuracy':value,'first_evaluated_attempt_id':first.get('attempt_id'),
            'first_evaluated_attempt_number':first.get('attempt_number'),
            'full_level_replays':replays,'total_errors':sum(max(0,int(a.get('error_count') or 0)) for a in history)}


class StageDifficulty:
    def __init__(self,client,base,key,owner):
        self.client,self.base,self.owner=client,base,owner
        self.headers={'apikey':key,'Authorization':f'Bearer {key}'}

    async def rows(self,table,**params):
        result=[]
        for offset in range(0,10000,500):
            response=await self.client.get(f'{self.base}/rest/v1/{table}',headers=self.headers,
                params={'select':'*','student_id':f'eq.{self.owner}',**params,'limit':'500','offset':str(offset)})
            if not response.is_success:raise HTTPException(503,f'Could not recover synchronized {table} for difficulty assignment.')
            try:batch=response.json()
            except ValueError:raise HTTPException(503,'Invalid difficulty history response.') from None
            if not isinstance(batch,list) or any(not isinstance(r,dict) or r.get('student_id')!=self.owner for r in batch):
                raise HTTPException(503,'Invalid participant difficulty history.')
            result.extend(batch)
            if len(batch)<500:return result
        raise HTTPException(503,'Difficulty history exceeds the supported recovery size; contact the administrator.')

    async def insert(self,table,row,key):
        response=await self.client.post(f'{self.base}/rest/v1/{table}',
            headers={**self.headers,'Prefer':'resolution=ignore-duplicates,return=minimal'},
            params={'on_conflict':key},json=[row])
        if not response.is_success:raise HTTPException(503,f'Could not save the authoritative {table} record.')

    async def resolve(self,week,stage):
        levels=await self.rows('levels',order='level_index.asc,generated_at.asc,level_id.asc')
        prior=predecessor(week,stage)
        previous=[r for r in levels if prior and (r.get('week'),r.get('stage_number'))==prior]
        current=[r for r in levels if (r.get('week'),r.get('stage_number'))==(week,stage)]
        relevant=previous+current
        ids=sorted({str(UUID(r['level_id'])) for r in relevant})
        attempts=await self.rows('level_attempts',level_id=f'in.({",".join(ids)})',order='started_at.asc,attempt_number.asc,attempt_id.asc') if ids else []
        decisions=await self.rows('difficulty_decisions',order='decided_at.desc,decision_id.asc')
        previous_ids={r['level_id'] for r in previous};current_ids={r['level_id'] for r in current}
        legacy_previous_ids=previous_ids or {r['level_id'] for r in levels if week==1 and stage==2 and (r.get('week'),r.get('stage_number'))==(1,1)}
        def matches(row):
            p=row.get('inputs') or {}
            return (not prior or row.get('previous_level_id') in previous_ids) and p.get('selected_level')==stage and (p.get('selected_week')==week or
                ('selected_week' not in p and row.get('previous_level_id') in legacy_previous_ids))
        matching=[r for r in decisions if matches(r)]
        # Old explicitly served choices stay historical. Client-supplied v2
        # records cannot enter this table: the sync route treats v2 as server owned.
        frozen=next((r for r in matching if r.get('difficulty_served') in DIFFICULTIES
            and r.get('difficulty_selected') in DIFFICULTIES and r.get('next_level_id') in current_ids
            and (r.get('rule_version')==RULE_VERSION or (r.get('inputs',{}).get('server_verification') or {}).get('status')=='verified')),None)
        target_id=(frozen or {}).get('next_level_id') or (current[0]['level_id'] if current else
            str(uuid5(NAMESPACE_URL,f'logicade:{self.owner}:week:{week}:stage:{stage}')))
        decision=frozen
        if not decision and prior:
            if not previous:raise HTTPException(409,'The preceding stage is not synchronized for this account.')
            values=evidence([a for a in attempts if a.get('level_id') in previous_ids],[r['level_id'] for r in previous])
            values.update(previous_week=prior[0],previous_level=prior[1],selected_week=week,selected_level=stage,
                          evidence_policy='first_evaluated_attempt',authority='server')
            selected=next_difficulty(values['first_attempt_accuracy'],values['full_level_replays'],values['total_errors'])
            decision=next((r for r in matching if r.get('rule_version')==RULE_VERSION
                and r.get('difficulty_selected')==selected and all(r.get('inputs',{}).get(k)==v for k,v in values.items())),None)
            if not decision:
                if matching:values['supersedes_decision_id']=matching[0]['decision_id']
                now=datetime.now(timezone.utc).isoformat()
                decision={'decision_id':str(uuid4()),'student_id':self.owner,
                    'previous_level_id':previous[0]['level_id'],'next_level_id':None,
                    'difficulty_before':previous[0].get('difficulty_served'),'difficulty_selected':selected,
                    'difficulty_served':None,'inputs':values,'rule_version':RULE_VERSION,
                    'reason':f"First evaluated accuracy {values['first_attempt_accuracy']*100}%; {values['full_level_replays']} completed full-level replays. Approved 60%/80% table.",
                    'decided_at':now,'created_at':now}
                await self.insert('difficulty_decisions',decision,'decision_id')
        return {'difficulty':decision['difficulty_selected'] if decision else 'standard','decision':decision,
                'target_level_id':target_id,'week':week,'stage':stage,'levels':levels,'attempts':attempts,
                'previous_stage':list(prior) if prior else None}

    async def start(self,assignment,game,level_id):
        if level_id!=assignment['target_level_id']:raise HTTPException(409,'Stage history changed. Select the stage again.')
        if game.difficulty!=assignment['difficulty']:raise HTTPException(409,'Difficulty changed. Select the stage again.')
        existing=next((r for r in assignment['levels'] if r['level_id']==level_id),None)
        config=getattr(game,'config',{})
        level=existing or {'level_id':level_id,'student_id':self.owner,'week':game.week,'stage_number':game.level,
            'level_index':max([-1,*[r['level_index'] for r in assignment['levels']]])+1,
            'difficulty_assigned':assignment['difficulty'],'difficulty_served':game.difficulty,
            'game_type':game.slug,'map_id':game.slug,'sprite_ids':[],
            'game_id':getattr(game,'file_id',None),'game_title':config.get('title') or getattr(game,'display_name',game.slug),
            'primary_mechanic':config.get('programming',{}).get('family',game.slug),'learning_topic':config.get('topic'),
            'template_id':getattr(game,'game_id',None),'template_version':'2.0.0',
            'variation_id':getattr(game,'variation_id',None),'variation_seed':config.get('seed'),
            'fingerprint':game.content_revision,'verification_result':'catalogue','pool_status':'served',
            'generated_at':datetime.now(timezone.utc).isoformat()}
        await self.insert('levels',level,'level_id')
        decision=assignment['decision']
        if decision and not decision.get('difficulty_served'):
            response=await self.client.patch(f'{self.base}/rest/v1/difficulty_decisions',headers={**self.headers,'Prefer':'return=representation'},
                params={'decision_id':f'eq.{decision["decision_id"]}','student_id':f'eq.{self.owner}','difficulty_served':'is.null'},
                json={'difficulty_served':game.difficulty,'next_level_id':level_id})
            if not response.is_success:raise HTTPException(503,'Could not record the served difficulty. Try Start again.')
            saved=response.json()
            if not saved:saved=await self.rows('difficulty_decisions',decision_id=f'eq.{decision["decision_id"]}')
            if (not saved or saved[0].get('difficulty_served')!=game.difficulty or saved[0].get('next_level_id')!=level_id):
                raise HTTPException(409,'The served decision changed. Select the stage again.')
            decision=saved[0]
        # Keep selected and actual values independently, including older levels
        # whose historical discrepancy must remain visible in their decision.
        response=await self.client.patch(f'{self.base}/rest/v1/levels',headers=self.headers,
            params={'level_id':f'eq.{level_id}','student_id':f'eq.{self.owner}'},
            json={'difficulty_assigned':assignment['difficulty'],'difficulty_served':game.difficulty})
        if not response.is_success:raise HTTPException(503,'Could not record the started stage. Try Start again.')
        return {**assignment,'decision':decision,'levels':[{**level,'difficulty_assigned':assignment['difficulty'],'difficulty_served':game.difficulty}]}
