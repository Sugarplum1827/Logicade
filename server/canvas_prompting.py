"""Stage-bound Canvas authoring contracts. Proposal validation is not runtime proof."""
from __future__ import annotations

import hashlib
import json
from pathlib import Path

from .canvas_games import canonical_difficulty, valid_objective_binding

ROOT = Path(__file__).resolve().parents[1]
PROMPT_PATH = Path(__file__).parent / 'prompts/canvas_authoring.txt'


def is_canvas_source(template: dict) -> bool:
    return isinstance(template.get('canvas_runtime'), dict) and template['canvas_runtime'].get('engine') == 'logicade_canvas_v2'


def canvas_context(template: dict) -> dict:
    """Use server-owned curriculum and mirrored data, never free-form source prose."""
    if not is_canvas_source(template):
        raise ValueError('A bound native Canvas source is required')
    runtime = (ROOT / 'games').resolve()
    relative = template['canvas_runtime'].get('game_path')
    if not isinstance(relative, str):
        raise ValueError('Canvas source has no mirrored game path')
    path = (runtime / relative).resolve()
    if not path.is_relative_to(runtime) or path.suffix != '.json':
        raise ValueError('Canvas reference must be inside the mirrored game library')
    game = json.loads(path.read_text(encoding='utf-8'))
    course = json.loads((ROOT/'data/curriculum.json').read_text(encoding='utf-8'))
    if not valid_objective_binding(game, course):
        raise ValueError('Canvas reference has a stale or mismatched learning objective')
    if (template.get('file_id') != game['file_id']
            or template.get('week') != game['week'] or template.get('level') != game['level']
            or canonical_difficulty(template.get('difficulty')) != canonical_difficulty(game['difficulty'])
            or template.get('learning_objective_id') != game['learning_objective_id']):
        raise ValueError('Canvas source does not match its mirrored learning objective')
    if game['week'] == 1 and game['level'] != 2:
        raise ValueError('The welcome video and unavailable historical stages are not LLM authoring targets')
    mission = game.get('programming', {})
    binding = {key:game[key] for key in ('week','level','source_week','source_level','curriculum_version','learning_objective_id')}
    binding.update(difficulty=canonical_difficulty(game['difficulty']),
                   mechanic_family=mission.get('family', 'flowchart' if game.get('flowchart') else 'archive'),
                   required_c_type=mission.get('required_declaration',{}).get('type'))
    if binding['mechanic_family'] == 'archive':
        from scripts.archive_lessons import authoring_questions
        target = game['source_level']
        questions = [{'id':row['id'],'prompt':row['prompt']} for row in authoring_questions(target)]
        parameters = {'question_ids': {'type':'array','length':3,'unique':True,'allowed':[q['id'] for q in questions]},
                      'layout_seed': {'type':'integer','minimum':0,'maximum':2147483647}}
    else:
        questions = []
        # The bounded builder interprets data through this exact objective.
        lower, upper = (0,5) if binding['required_c_type']=='char' else (1,20) if binding['source_week']==3 and binding['source_level']==9 else (-20,40)
        parameters = {'problem_variant': {'type':'integer','minimum':1,'maximum':10},
                      'primary_value': {'type':'integer','minimum':1,'maximum':30},
                      'secondary_value': {'type':'integer','minimum':1,'maximum':10},
                      'input_values': {'type':'array','min_length':3,'max_length':6,'items':{'type':'integer','minimum':lower,'maximum':upper}},
                      'layout_seed': {'type':'integer','minimum':0,'maximum':2147483647}}
    return {'binding':binding, 'fixed_focus':game['lesson']['stage_title'],
            'lesson_points':game['lesson']['points'], 'current_objective':game['objective'],
            'required_declaration':mission.get('required_declaration'),
            'parameter_contract':parameters, 'allowed_questions':questions,
            'validation_scope':'Parameter proposal only; runtime construction, output checks, solvability and publication are still required.'}


def build_canvas_prompt(context: dict, recent: list[str] | None = None) -> str:
    example = {}
    for key,rule in context['parameter_contract'].items():
        example[key] = rule['minimum'] if rule['type']=='integer' else rule['allowed'][:3] if 'allowed' in rule else [rule['items']['minimum']+i for i in range(3)]
    data = {**context, 'recent_parameter_fingerprints':list(recent or [])[-20:],
            'response_shape_example':{'schema_version':1,'binding':context['binding'],'parameters':example}}
    return PROMPT_PATH.read_text(encoding='utf-8').strip()+'\n'+json.dumps(data,ensure_ascii=False,separators=(',',':'))


def canvas_response_schema(context: dict) -> dict:
    """Constrain Ollama decoding; the independent validator still checks the result.

    JSON mode alone guarantees neither required parameter keys nor an unchanged
    lesson binding. Pin server-owned values with single-value enums so the model
    only chooses bounded problem data. This never coerces a model's answer.
    """
    def object_schema(properties):
        return {'type':'object','properties':properties,'required':list(properties),'additionalProperties':False}
    types={int:'integer',str:'string',type(None):'null'}
    binding={name:{'type':types[type(value)],'enum':[value]} for name,value in context['binding'].items()}
    parameters={}
    for name,rule in context['parameter_contract'].items():
        if rule['type']=='integer':parameters[name]={key:rule[key] for key in ('type','minimum','maximum')}
        elif 'allowed' in rule:
            parameters[name]={'type':'array','minItems':rule['length'],'maxItems':rule['length'],
                              'uniqueItems':True,'items':{'type':'string','enum':rule['allowed']}}
            allowed=context.get('authoring_constraints',{}).get('allowed_question_combinations')
            if allowed is not None:
                if not allowed:raise ValueError('No unused question combinations remain for this lesson')
                parameters[name]['enum']=allowed
        else:
            parameters[name]={'type':'array','minItems':rule['min_length'],'maxItems':rule['max_length'],
                              'items':{key:rule['items'][key] for key in ('type','minimum','maximum')}}
    return object_schema({'schema_version':{'type':'integer','enum':[1]},
                          'binding':object_schema(binding),'parameters':object_schema(parameters)})


def validate_canvas_proposal(raw: str, context: dict, recent: list[str] | None = None) -> tuple[dict, str]:
    """Strict data contract: no merge, coercion, executable text or silent overrides."""
    if not isinstance(raw,str) or len(raw)>12000:
        raise ValueError('Proposal exceeds its JSON size limit')
    def unique_object(pairs):
        obj={}
        for key,value in pairs:
            if key in obj: raise ValueError('Duplicate JSON key: '+key)
            obj[key]=value
        return obj
    try:
        obj=json.loads(raw,object_pairs_hook=unique_object)
    except (json.JSONDecodeError,TypeError) as exc:
        raise ValueError('Return one valid JSON object') from exc
    if not isinstance(obj,dict) or set(obj)!={'schema_version','binding','parameters'}:
        raise ValueError('Only schema_version, binding and parameters are allowed')
    if type(obj['schema_version']) is not int or obj['schema_version']!=1:
        raise ValueError('schema_version must be the integer 1')
    binding=obj['binding'];expected=context['binding']
    if (not isinstance(binding,dict) or set(binding)!=set(expected)
            or any(type(binding[k]) is not type(v) or binding[k]!=v for k,v in expected.items())):
        raise ValueError('Copy the fixed lesson binding exactly; expected fields: '+', '.join(expected)+'; difficulty, level and required type cannot change')
    values=obj['parameters'];rules=context['parameter_contract']
    if not isinstance(values,dict) or set(values)!=set(rules):
        missing=sorted(set(rules)-set(values)) if isinstance(values,dict) else sorted(rules)
        extra=sorted(set(values)-set(rules)) if isinstance(values,dict) else []
        raise ValueError('Parameters must contain exactly the allowed keys: '+', '.join(rules)+
                         '; missing: '+(', '.join(missing) or 'none')+'; unexpected: '+(', '.join(extra) or 'none'))
    def integer(value,rule):
        return type(value) is int and rule['minimum']<=value<=rule['maximum']
    for name,rule in rules.items():
        value=values[name]
        if rule['type']=='integer':
            if not integer(value,rule):raise ValueError(name+' must be an integer within its bounds')
        else:
            if not isinstance(value,list):raise ValueError(name+' must be an array')
            if 'length' in rule:
                if (len(value)!=rule['length'] or any(type(v) is not str or v not in rule['allowed'] for v in value)
                        or len(set(value))!=len(value)):
                    raise ValueError('Choose exactly three distinct question IDs from this lesson')
            elif (not rule['min_length']<=len(value)<=rule['max_length']
                  or any(not integer(v,rule['items']) for v in value)):
                raise ValueError(name+' contains invalid or out-of-range inputs')
    allowed=context.get('authoring_constraints',{}).get('allowed_question_combinations')
    if allowed is not None and sorted(values.get('question_ids',[])) not in [sorted(row) for row in allowed]:
        raise ValueError('Choose an available, unused question combination from the server context')
    # Layout seed / response ordering alone cannot claim a new learning problem.
    problem={key:value for key,value in values.items() if key!='layout_seed'}
    if 'question_ids' in problem:problem['question_ids']=sorted(problem['question_ids'])
    fingerprint=hashlib.sha256(json.dumps({'binding':binding,'problem':problem},sort_keys=True,separators=(',',':')).encode()).hexdigest()
    if fingerprint in (recent or []):raise ValueError('Repeated problem parameters; a new layout seed alone is not fresh')
    return obj,fingerprint
