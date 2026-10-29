"""Authored mechanics, deterministic layouts and independently checkable goals."""
import random
from collections import deque
try:
    from .factory_missions import factory_mission
    from .scope_circuits import scope_circuit
    from .cp1_lessons import source_week, source_level, lesson_for, c_source_exercise, c_variable_mission
except ImportError:
    from factory_missions import factory_mission
    from scope_circuits import scope_circuit
    from cp1_lessons import source_week, source_level, lesson_for, c_source_exercise, c_variable_mission


def adventure_map(seed,level,rank,gem_count):
    rng=random.Random(seed ^ 0xA571)
    width=13+2*((level-1)//4)+rank*2
    height=9+2*((level-1)//5)+rank*2
    grid=[['#']*width for _ in range(height)]
    start=(1,1);grid[1][1]='.';stack=[start]
    while stack:
        x,y=stack[-1]
        options=[(x+dx,y+dy) for dx,dy in [(2,0),(-2,0),(0,2),(0,-2)] if 0<x+dx<width-1 and 0<y+dy<height-1 and grid[y+dy][x+dx]=='#']
        if not options: stack.pop();continue
        nx,ny=rng.choice(options);grid[(y+ny)//2][(x+nx)//2]='.';grid[ny][nx]='.';stack.append((nx,ny))
    rooms=1+rank+(level>=6)
    for _ in range(rooms):
        cx,cy=rng.randrange(1,width-1,2),rng.randrange(1,height-1,2)
        for y in range(max(1,cy-1),min(height-1,cy+2)):
            for x in range(max(1,cx-1),min(width-1,cx+2)):grid[y][x]='.'
    walls=[(x,y) for y in range(1,height-1) for x in range(1,width-1) if grid[y][x]=='#' and ((grid[y][x-1]==grid[y][x+1]=='.') or (grid[y-1][x]==grid[y+1][x]=='.'))]
    rng.shuffle(walls)
    for x,y in walls[:1+rank+level//3]:grid[y][x]='.'
    def neighbors(p):
        x,y=p
        return [(x+dx,y+dy) for dx,dy in [(1,0),(-1,0),(0,1),(0,-1)] if 0<=x+dx<width and 0<=y+dy<height and grid[y+dy][x+dx]=='.']
    def paths(origin):
        previous={origin:None};queue=deque([origin])
        while queue:
            parent=queue.popleft()
            for p in neighbors(parent):
                if p not in previous:previous[p]=parent;queue.append(p)
        def route_to(end):
            result=[end]
            while result[-1]!=origin:result.append(previous[result[-1]])
            return list(reversed(result))
        return previous,route_to
    cells,route_from_start=paths(start)
    exit_cell=max(cells,key=lambda p:len(route_from_start(p)))
    dead=[p for p in cells if p not in (start,exit_cell) and len(neighbors(p))==1]
    candidates=sorted(dead or [p for p in cells if p not in (start,exit_cell)],key=lambda p:len(route_from_start(p)),reverse=True)
    if len(candidates)<gem_count:candidates += [p for p in cells if p not in candidates and p not in (start,exit_cell)]
    gems=candidates[:gem_count]
    route=[start];remaining=gems[:]
    while remaining:
        _,find=paths(route[-1]);target=min(remaining,key=lambda p:len(find(p)));route+=find(target)[1:];remaining.remove(target)
    _,find=paths(route[-1]);route+=find(exit_cell)[1:]
    features={'width':width,'height':height,'rooms':rooms,'junctions':sum(len(neighbors(p))>=3 for p in cells),
              'dead_ends':sum(len(neighbors(p))==1 for p in cells),'cycles':sum(len(neighbors(p)) for p in cells)//2-len(cells)+1}
    return [''.join(row) for row in grid],list(start),list(exit_cell),[list(p) for p in gems],route,features


def programming_mission(week, level, trial, difficulty, seed, parameters=None):
    if week==9:
        origin=source_week(week,level)
        mission=programming_mission(origin,source_level(week,level),trial,difficulty,seed,parameters)
        if mission:
            mission['mission_id']=f'cp1_w9_l{level}_v{trial}_{mission["difficulty_profile"]}'
            mission['title']='Examination practice · '+mission['title']
            mission['objective']=f'Week {origin} examination practice: '+mission['objective']
            mission['source_week']=origin
        return mission
    if week not in (3,5,6,7,8):
        return None
    rank={'needs_support':0,'standard':1,'advanced':2}.get(str(difficulty).lower().replace(' ','_'),1)
    if str(difficulty).lower() in ('need assistance','needassistance'): rank=0
    if str(difficulty).lower()=='advance': rank=2
    rng=random.Random(seed)
    n=parameters['primary_value'] if parameters else level+trial+rank+1
    common={'version':1,'mission_id':f'cp1_w{week}_l{level}_v{trial}_{rank}',
            'rules':{'max_steps':500+level*30,'max_lines':40+rank*10,'max_nodes':7},
            'construction_timer':False,'difficulty_profile':rank,
            'reference_is_practice_only':True, 'objective_id':f'cp1_w{week}_l{level}',
            'source_level':level, 'focus':lesson_for(week,level)['stage_title']}
    if week==7:
        return c_variable_mission(common,level,trial,rank,seed,parameters)
    if week==8:
        return scope_circuit(common,level,trial,rank,seed,parameters)
    if week==3:
        variants=[('relay',[],lambda x:x,'relay each value unchanged'),
                  ('add',[('ADD',n)],lambda x:x+n,f'add {n} to each value'),
                  ('subtract',[('SUB',n)],lambda x:x-n,f'subtract {n} from each value'),
                  ('double',[('MUL',2)],lambda x:x*2,'double every value'),
                  ('negate',[('NEG',None)],lambda x:-x,'negate every value'),
                  ('offset_double',[('ADD',n),('MUL',2)],lambda x:(x+n)*2,f'add {n}, then double'),
                  ('double_offset',[('MUL',2),('ADD',n)],lambda x:x*2+n,f'double, then add {n}'),
                  ('difference',[('SUB',n),('NEG',None)],lambda x:n-x,f'calculate {n} minus each value'),
                  ('scale',[('MUL',3+rank)],lambda x:x*(3+rank),f'multiply every value by {3+rank}'),
                  ('square',[('MUL','ACC')],lambda x:x*x,'square each value')]
        index = {1:0,2:5,3:2,4:3,5:4,6:5,7:6,8:5,9:0}.get(level,trial-1)
        name,ops,fn,goal=variants[index]
        samples=[rng.sample(range(-8-level,12+level),4+rank) for _ in range(3)]
        if level==9:
            samples=[rng.sample(range(1,12+trial),4+rank) for _ in range(3)]
            goal='reduce each positive input to zero by subtracting 1 until the condition fails; every procedure must terminate'
            fn=lambda x:0
        if parameters:
            xs=parameters['input_values']
            samples=[xs[:],list(reversed(xs)),[x+1 for x in xs]]
        fixtures=[{'id':f'case_{i+1}','inputs':xs,'expected':[fn(x) for x in xs]} for i,xs in enumerate(samples)]
        focus=common['focus']
        extra={3:'Trace ACC after every instruction. ',7:'Compare doubling before addition with addition before doubling. ',8:'Repair the reversed arithmetic instructions in the starter. ',9:'Use Step to inspect the loop condition. '}.get(level,'')
        common.update(family='terminal',title=f'{focus} · variation {trial}',
                      objective=f'{focus}: {extra}{goal}. Match all {len(fixtures)} streams; preserve their order. Dataset {trial}, operand {n}.',cases=fixtures,
                      hint='Follow the input through each operation. Compare every output, including negative inputs.')
        if week==2:
            nodes=[{'id':'input','type':'INPUT','x':.1,'y':.45,'fixed':True},
                   *[{'id':f'op{i}','type':op,'value':v if isinstance(v,int) else 0,'x':.35+i*.2,'y':.45} for i,(op,v) in enumerate(ops)],
                   {'id':'output','type':'OUTPUT','x':.88,'y':.45,'fixed':True}]
            # Squaring is a one-input component, not a hard-coded expected output.
            if name=='square': nodes[1].update(type='SQUARE',value=0)
            ids=[a['id'] for a in nodes]
            wires=[[a,b] for a,b in zip(ids,ids[1:])]
            palette=['ADD','SUB','MUL','NEG','SQUARE','RELAY']
            common.update(palette=palette,nodes=[nodes[0],nodes[-1]],wires=[],
                          reference={'nodes':nodes,'wires':wires},component_default=n,
                          controls='Add components, set their values, then connect output pins to input pins. Run tests or Step signals.')
        else:
            prefix=['MOV IN ACC']
            if week==7: prefix+=['INT resource 0','SET resource ACC']
            body=[f'{op} {v}' if v is not None else op for op,v in ops]
            code='\n'.join(prefix+body+(['SET resource ACC','MOV resource OUT'] if week==7 else ['MOV ACC OUT']))
            starter='MOV IN ACC\n# Transform ACC here\nMOV ACC OUT'
            if level==8:starter=f'MOV IN ACC\nMUL 2\nADD {n}\nMOV ACC OUT'
            if level==9:code='MOV IN ACC\ncountdown: SUB 1\nJGZ countdown\nMOV ACC OUT'
            second='MOV IN ACC\nMOV ACC OUT'
            common.update(nodes=[{'id':'N1','program':starter},
                                 {'id':'N2','program':second}],reference={'programs':[code,second]},
                          instruction_set=['MOV','ADD','SUB','MUL','NEG','SAV','SWP','JMP','JEZ','JGZ','JLZ','INT','SET','NOP'],
                          controls='Edit both node programs. IN reads the upstream queue; OUT sends to the next node. Step advances one cycle; Run checks every stream.')
            if week==7:
                common['required_variable']='resource'
                common['objective']+=' Declare resource with INT and store the computed output in it before forwarding.'
        return common
    if week==5:
        mission=factory_mission(common, level, trial, rank, seed)
        exercise=c_source_exercise(level,trial,rank,week=5,parameters=parameters)
        mission['source_exercise']=exercise
        mission['reference'].update(source_order=exercise['reference_order'],c_categories=exercise['categories'])
        mission['objective']=exercise['prompt']+' Then test its compiler-factory route: '+mission['objective']
        return mission
    # Code-controlled adventure with actual state, collision and collectible goals.
    gem_count=1+(trial+level+rank)%3
    grid,start_cell,exit_cell,gems,route,features=adventure_map(seed,level,rank,gem_count)
    exercise=c_source_exercise(level,trial,rank,week=6,parameters=parameters)
    prefix=exercise['program'].replace('#include <stdio.h>','#include <stdio.h>\n#include "logicade.h"').replace('return 0;\n}','')
    expected_watch=exercise['expected'];expected_globals={};focus=exercise['title']
    runs=[]
    for (x,y),(tx,ty) in zip(route,route[1:]):
        command='moveRight' if tx>x else 'moveLeft' if tx<x else 'moveDown' if ty>y else 'moveUp'
        if runs and runs[-1][0]==command:runs[-1][1]+=1
        else:runs.append([command,1])
    program=(prefix+'\n'.join(f'{command}({count});' for command,count in runs)+'\nreturn 0;\n}').splitlines()
    common['rules']['max_lines']=max(common['rules']['max_lines'],len(program)+10)
    common['rules']['max_steps']=max(common['rules']['max_steps'],len(route)+len(program)*3+40)
    starter='#include <stdio.h>\n#include "logicade.h"\n// Add file-scope declarations here when required.\nint main(void)\n{\n// Declare, print and navigate here.\nreturn 0;\n}'
    if week==6 and level==8:
        starter='\n'.join(program).replace('total = total +','total = total -',1)
    common.update(family='adventure',language='c_subset',title=f'{common["focus"]} · variation {trial}',
                  objective=f'Maze {trial} ({features["width"]}×{features["height"]}, {features["junctions"]} junctions): collect {gem_count} crystal(s) from the branches and reach beacon ({exit_cell[0]}, {exit_cell[1]}). '+
                            f'Use a C main program to {focus}. Print {expected_watch}; final file-scope values must be {expected_globals}.',
                  map=grid,map_features=features,start=start_cell,exit=exit_cell,gems=gems,
                  expected_watch=expected_watch,expected_globals=expected_globals,command_budget=len(route)+len(program)*2+30,program=starter,
                  reference={'program':'\n'.join(program)},
                  hint='Use printf with stdio.h. File-scope declarations belong before main; block locals hide names only within that block. Coordinates start at the top left.',
                  controls='Write int main(void) with declarations, assignments, printf and braces. Movement calls moveRight(n), moveLeft(n), moveUp(n), moveDown(n) are game helpers from logicade.h. Run or Step verifies real map goals, printed values and global state in the documented safe C subset.')
    return common
