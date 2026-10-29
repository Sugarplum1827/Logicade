"""Bounded parameter-to-Canvas compiler; the model never supplies executable code."""
from __future__ import annotations

import copy
import hashlib
import json
import re

from .canvas_games import canonical_difficulty, valid_objective_binding, COURSE_PATH
from .canvas_prompting import canvas_context, validate_canvas_proposal


def problem_fingerprint(game: dict) -> str:
    """Learning semantics, excluding names, cosmetic seeds and response ordering."""
    if game.get('flowchart'):
        p=game['flowchart']
        data={'pieces':sorted([{'id':x['id'],'kind':x['kind'],'action':x['action']} for x in p['pieces'] if not x['id'].startswith('decoy')],key=lambda x:x['id']),
              'edges':[{k:v for k,v in e.items() if k!='via'} for e in p['edges']], 'cases':p['cases']}
    elif game.get('programming'):
        m=game['programming']
        if m['family']=='terminal':data={'reference':m['reference'],'cases':m['cases'],'type':m.get('required_declaration')}
        elif m['family']=='circuit':data={'source':m['reference']['program'],'cases':m['cases'],'globals':m.get('expected_globals'),'scope_contract':m.get('scope_contract'),
                                         'programs':m['reference'].get('programs'),'signal_network':m.get('signal_network')}
        elif m['family']=='factory':data={'reference':m['reference'],'targets':m['routing']['targets'],'source':m['source_exercise']['program']}
        else:
            # A different maze/seed alone cannot claim fresh C learning content.
            source=re.sub(r'move(?:Right|Left|Up|Down)\(\d+\);','',m['reference']['program'])
            data={'source':source,'outputs':m['expected_watch'],'globals':m['expected_globals']}
    else:
        data=sorted([(re.sub(r'^Archive case \d+: ','',t['prompt']),t['choices'][t['answer_index']]) for t in game['tasks']])
    return hashlib.sha256(json.dumps({'lesson':game['learning_objective_id'],'data':data},sort_keys=True,separators=(',',':')).encode()).hexdigest()


def apply_parameters(spec: dict, base: dict) -> dict:
    """Reproducible rebuild of a published generation, also used by the pool checker."""
    from scripts.programming_missions import programming_mission
    from scripts.flowchart_scenarios import make_flowchart
    from scripts.archive_lessons import authoring_questions
    generation=spec['canvas_generation'];proposal=generation['proposal']
    context=canvas_context(spec)
    validate_canvas_proposal(json.dumps(proposal),context)
    p=proposal['parameters'];game=copy.deepcopy(base)
    variant=p.get('problem_variant',game['trial']);seed=p['layout_seed']
    if game.get('flowchart'):
        puzzle=make_flowchart(game['file_id'],variant,game['difficulty'],seed,
                              level=game['source_level'] if game['source_week']==2 else None,parameters=p)
        puzzle['objective_id']=game['learning_objective_id']
        game.update(flowchart=puzzle,objective=puzzle['prompt'],title='Flowchart Lab · '+puzzle['title'],hint=puzzle['feedback'],
                    controls='Drag flowchart symbols onto numbered positions and follow the arrows. Check chart executes every case. Arrow keys and Enter also place selected blocks.')
        game['tasks']=[{'id':slot['id'],'kind':'flowchart_node','prompt':f'Build position {slot["number"]}.'} for slot in puzzle['slots']]
    elif game.get('programming'):
        mission=programming_mission(game['week'],game['level'],variant,game['difficulty'],seed,parameters=p)
        # A proposed layout must fit the existing difficulty's execution budgets.
        mission['rules']=copy.deepcopy(base['programming']['rules'])
        if 'command_budget' in base['programming']:mission['command_budget']=base['programming']['command_budget']
        game.update(programming=mission,objective=mission['objective'],title=mission['title'],hint=mission['hint'],controls=mission['controls'])
        game['tasks']=[{'id':mission['mission_id'],'kind':'program_execution','prompt':mission['objective']}]
    else:
        bank={row['id']:row for row in authoring_questions(game['source_level'])}
        import random
        rng=random.Random(seed);tasks=[]
        for identity in p['question_ids']:
            row=bank[identity];choices=[row['answer'],*row['distractors']]
            if canonical_difficulty(game['difficulty'])=='needs_support':choices=choices[:3]
            rng.shuffle(choices)
            tasks.append({'id':identity,'prompt':row['prompt'],'choices':choices,'answer_index':choices.index(row['answer']),
                          'explanation':row['answer']+'.','objective_id':game['learning_objective_id']})
        game['tasks']=tasks
        game['objective']=game['lesson']['stage_title']+': verify archive records '+', '.join(p['question_ids'])+'.'
    game['seed']=seed
    m=game.get('programming',{})
    if m.get('source_exercise'):game['source_code_snippet']=m['source_exercise']['program']
    elif m.get('reference',{}).get('program'):game['source_code_snippet']=m['reference']['program']
    elif m.get('reference',{}).get('programs'):game['source_code_snippet']='\n\n'.join(m['reference']['programs'])
    game['generation']=copy.deepcopy(generation)
    if not valid_objective_binding(game,json.loads(COURSE_PATH.read_text(encoding='utf-8'))):
        raise ValueError('Generated game no longer matches its stage objective')
    return game


def align_description(spec: dict, game: dict) -> None:
    spec.update(game_title=game['title'],player_objective=game['objective'],hint=game['hint'],controls=game['controls'])
    m=game.get('programming',{})
    if m.get('source_exercise'):spec['code_snippet']=m['source_exercise']['program']
    elif m.get('reference',{}).get('program'):spec['code_snippet']=m['reference']['program']
    elif m.get('reference',{}).get('programs'):spec['code_snippet']='\n\n'.join(m['reference']['programs'])


def build_candidate(template: dict, proposal: dict, metadata: dict) -> tuple[dict,dict]:
    from scripts.build_canvas_games import build_definition
    from pathlib import Path
    context=canvas_context(template)
    proposal,fingerprint=validate_canvas_proposal(json.dumps(proposal),context)
    spec=copy.deepcopy(template)
    spec['canvas_generation']={'schema_version':1,'proposal':proposal,'parameter_fingerprint':fingerprint,
                               'model_tag':metadata.get('model_tag'),'model_digest':metadata.get('model_digest')}
    game=build_definition(spec,Path(template['canvas_runtime']['game_path']))
    align_description(spec,game)
    return spec,game
