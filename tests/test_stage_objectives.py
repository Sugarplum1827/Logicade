"""Lesson boundaries must survive trials, difficulty, examination mapping and packaging."""
import copy
import json
from collections import defaultdict
from pathlib import Path

import pytest

from scripts.cp1_lessons import lesson_for, source_week, source_level
from server.canvas_games import valid_objective_binding, discover_canvas_games, compile_canvas_package

ROOT = Path(__file__).resolve().parents[1]
COURSE = json.loads((ROOT/'data/curriculum.json').read_text(encoding='utf-8'))


@pytest.fixture(scope='module')
def definitions():
    return [json.loads(p.read_text(encoding='utf-8')) for p in (ROOT/'games').glob('week_*/level*/*/game_*.json')]


def test_every_pool_entry_binds_to_the_level_not_the_variation(definitions):
    assert len(definitions) == 2700
    for game in definitions:
        week, level = game['week'], game['level']
        lesson = lesson_for(week, level)
        assert valid_objective_binding(game, COURSE), game['file_id']
        assert game['lesson']['stage_title'] == lesson['stage_title']
        if week > 1:
            assert game['learning_objectives'] == [lesson['stage_title']]
        spec = json.loads((ROOT/'data/fallback_pool'/game['source_path']).read_text(encoding='utf-8'))
        assert spec['learning_objective_id'] == lesson['objective_id']
        assert spec['source_level'] == source_level(week, level)


def test_declaration_types_and_scope_constructs_are_owned_by_level(definitions):
    for game in definitions:
        week, level = game['source_week'], game['source_level']
        if week == 7:
            mission = game['programming']
            expected = {7:'float',8:'double',9:'char'}.get(level,'int')
            assert mission['required_declaration']['type'] == expected
            assert f'{expected} resource = readInput();' in mission['reference']['programs'][0]
            if level == 3: assert 'resource == ' in mission['reference']['programs'][0]
            if level == 10: assert 'resource / ' in mission['reference']['programs'][0]
        if week == 8:
            code = game['programming']['reference']['program']
            global_code, main = code.split('int main(void)',1)
            if level == 3: assert 'int steps;' in global_code
            if level == 5: assert '{ int steps =' in main and 'steps = steps + 1;' in main
            if level == 6: assert main.count('{ int steps =') == 2
            if level == 2: assert 'int local =' in main and 'int local' not in global_code
        if week == 6 and level == 8:
            m=game['programming']
            assert 'total = total -' in m['program']
            assert 'total = total +' in m['reference']['program']
        if week == 5:
            exercise = game['programming']['source_exercise']
            assert exercise['objective_id'] == game['learning_objective_id']
            if level in (3,4,5): assert 'int total = LIMIT;' in exercise['program']


def test_flowchart_concepts_and_archive_questions_do_not_leak_across_levels(definitions):
    from scripts.archive_lessons import archive_questions
    for game in definitions:
        if game['source_week'] == 2:
            p=game['flowchart'];level=game['source_level']
            kinds={piece['kind'] for piece in p['pieces'] if not piece['id'].startswith('decoy')}
            if level <= 3: assert 'decision' not in kinds
            if level == 2: assert kinds == {'start','input','output','end'}
            if level in (4,5,9):
                assert 'decision' in kinds
                assert {e.get('label') for e in p['edges']} >= {'Yes','No'}
            if level in (6,7,8): assert any(e.get('label') in ('Loop','Yes') and e.get('via') for e in p['edges'])
            if level == 7: assert any(v['name']=='total' for piece in p['pieces'] for v in piece['action'].get('values',[]))
        if game['source_week'] == 4:
            expected={row['prompt'] for row in archive_questions(game['source_level'],game['trial'])}
            assert {row['prompt'] for row in game['tasks']} == expected


def test_each_playable_level_keeps_ten_distinct_problems_per_difficulty(definitions):
    groups=defaultdict(list)
    for game in definitions:
        if game['week']==1: continue  # The prologue is intentionally a single video.
        groups[game['week'],game['level'],game['difficulty']].append(game)
    assert len(groups)==240
    for key, games in groups.items():
        assert len(games)==10
        payloads=[json.dumps(g.get('programming') or g.get('flowchart') or g['tasks'],sort_keys=True) for g in games]
        assert len(set(payloads))==10, key
        assert len({g['objective'] for g in games})==10, key
        assert len({g['learning_objective_id'] for g in games})==1
        if games[0]['source_week'] == 4:
            question_sets={tuple(sorted(t['prompt'].split(': ',1)[1] for t in g['tasks'])) for g in games}
            assert len(question_sets)==10, key
        elif games[0].get('flowchart'):
            assert len({json.dumps(g['flowchart']['cases'],sort_keys=True) for g in games})==10, key
            assert len({json.dumps([g['flowchart']['slots'],g['flowchart']['edges']],sort_keys=True) for g in games})>1, key
        elif games[0].get('programming',{}).get('family')=='terminal':
            assert len({json.dumps(g['programming']['cases'],sort_keys=True) for g in games})==10, key
        if games[0].get('programming',{}).get('family')=='adventure':
            assert len({tuple(g['programming']['map']) for g in games})==10


def test_misfiled_or_stale_lessons_are_not_discoverable_or_compilable(tmp_path,definitions):
    original=next(g for g in definitions if g['week']==7 and g['level']==1)
    for field,wrong in [('level',7),('learning_objective_id','cp1_w7_l7'),('source_level',7),('curriculum_version','old')]:
        config=copy.deepcopy(original);config[field]=wrong
        assert not valid_objective_binding(config,COURSE)
    config=copy.deepcopy(original);config['programming']['objective_id']='cp1_w7_l7'
    target=tmp_path/'week_7/level1/standard/game_bad.json';target.parent.mkdir(parents=True)
    target.write_text(json.dumps(config),encoding='utf-8')
    assert discover_canvas_games(tmp_path)=={}
    game=next(g for values in discover_canvas_games(ROOT/'games').values() for g in values if g.file_id==original['file_id'])
    spec=json.loads((ROOT/'data/fallback_pool'/game.config['source_path']).read_text(encoding='utf-8'))
    spec['learning_objective_id']='cp1_w7_l7'
    source=tmp_path/'pool'/Path(game.config['source_path']).name;source.parent.mkdir()
    source.write_text(json.dumps(spec),encoding='utf-8')
    with pytest.raises(ValueError,match='learning objective'):
        compile_canvas_package(source_json=source,pool_root=source.parent,runtime_root=ROOT/'games',game=game,spec=spec,backup_root=tmp_path/'backup')


def test_exam_references_the_intended_review_level():
    for stage in range(1,11):
        lesson=lesson_for(9,stage)
        assert lesson['source_week']==source_week(9,stage)
        assert lesson['source_level']==int(COURSE['exam_level_blueprint'][str(stage)])
        assert lesson['objective_id']==f'cp1_w{lesson["source_week"]}_l{lesson["source_level"]}'
