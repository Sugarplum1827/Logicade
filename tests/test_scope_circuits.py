import asyncio
import copy
import json
from pathlib import Path
from scripts.programming_missions import programming_mission
from server.canvas_verification import verify_candidate

ROOT=Path(__file__).resolve().parents[1]

def test_all_scope_circuit_reference_programs_and_wiring_pass():
    async def run():
        for level in range(1,11):
            for difficulty in ['needs_support','standard','advanced']:
                mission=programming_mission(8,level,1,difficulty,level*317)
                assert mission['family']=='circuit' and mission['language']=='c_subset'
                assert 'map' not in mission and 'moveRight' not in mission['reference']['program']
                assert mission['scope_contract']['global_names']
                assert mission['signal_network']['version']==2
                assert len(mission['signal_network']['branch_ids'])>=2
                assert ['loop','split'] in mission['reference']['wires']
                assert (await verify_candidate({'programming':mission},ROOT/'games'))['passed']
    asyncio.run(run())

def test_scope_review_stages_use_the_same_circuit_lesson():
    for stage,source in [(7,9),(10,10)]:
        mission=programming_mission(9,stage,3,'standard',17)
        assert mission['family']=='circuit' and mission['source_week']==8
        assert mission['source_level']==source and mission['objective_id']==f'cp1_w8_l{source}'


def test_scope_catalog_rejects_empty_mission_contracts(tmp_path):
    from server.canvas_games import discover_canvas_games
    original=json.loads(next((ROOT/'games/week_8/level1/standard').glob('game_*.json')).read_text(encoding='utf-8'))
    path=tmp_path/'week_8/level1/standard/game_scope.json';path.parent.mkdir(parents=True)
    for malformed in [{}, {'family':'circuit'}, {'family':'circuit','objective':'Missing execution limits'}]:
        game=copy.deepcopy(original);game['programming']=malformed;game['flowchart']={}
        path.write_text(json.dumps(game),encoding='utf-8')
        assert discover_canvas_games(tmp_path)=={}
