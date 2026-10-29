"""C scope lessons on a programmable signal board; no movement-game dependency."""
import random


def scope_circuit(common,level,trial,rank,seed,parameters=None):
    n=parameters['primary_value'] if parameters else level+trial+rank+1
    g=(parameters['primary_value'] if level==1 else parameters['secondary_value']) if parameters else 1+trial+rank
    offset=n if parameters else 1
    variants=[
        ('declare steps at file scope and print its value',f'int steps = {g};','printf("%d\\n", steps);',[g],{'steps':g}),
        ('declare a main-local alongside a global',f'int steps = {g};',f'int local = {n};\nprintf("%d\\n", local);\nprintf("%d\\n", steps);',[n,g],{'steps':g}),
        ('observe zero-initialized file-scope state','int steps;',f'int local = {n};\nprintf("%d\\n", local);\nprintf("%d\\n", steps);',[n,0],{'steps':0}),
        ('read global state in a local expression',f'int steps = {g};',f'int local = steps + {n};\nprintf("%d\\n", local);\nprintf("%d\\n", steps);',[g+n,g],{'steps':g}),
        ('keep local assignments out of a global',f'int steps = {g};',f'{{ int steps = {n}; steps = steps + 1; printf("%d\\n", steps); }}\nprintf("%d\\n", steps);',[n+1,g],{'steps':g}),
        ('trace two nested local scopes',f'int steps = {g};',f'{{ int steps = {n}; {{ int steps = {n+2}; printf("%d\\n", steps); }} printf("%d\\n", steps); }}\nprintf("%d\\n", steps);',[n+2,n,g],{'steps':g}),
        ('use a main-local to update a global',f'int shared = {g};',f'int steps = {n};\nshared = shared + steps;\nprintf("%d\\n", shared);\nprintf("%d\\n", steps);',[g+n,n],{'shared':g+n}),
        ('separate sibling local lifetimes',f'int steps = {g};',f'{{ int steps = {n}; printf("%d\\n", steps); }}\n{{ int steps = {n+3}; printf("%d\\n", steps); }}\nprintf("%d\\n", steps);',[n,n+3,g],{'steps':g}),
        ('initialize a local from visible global state',f'int steps = {g};',f'int local = steps + {offset};\nprintf("%d\\n", local);\nprintf("%d\\n", steps);',[g+offset,g],{'steps':g}),
        ('restore global visibility after a local block',f'int steps = {g};',f'{{ int steps = {n}; printf("%d\\n", steps); }}\nsteps = steps + 1;\nprintf("%d\\n", steps);',[n,g+1],{'steps':g+1}),
    ]
    focus,globals_source,body,watch,globals_expected=variants[level-1]
    program='#include <stdio.h>\n#include "logicade.h"\n'+globals_source+'\nint main(void)\n{\n  int signal = readInput();\n'+body+'\n  writeOutput(signal);\n  return 0;\n}'
    starter='#include <stdio.h>\n#include "logicade.h"\n// Add the required file-scope declaration here.\nint main(void)\n{\n  int signal = readInput();\n  // Complete the scope task and print its trace.\n  writeOutput(signal);\n  return 0;\n}'
    rng=random.Random(seed^0x8C10)
    branch_count=2+(trial+rank+level)%3
    passes=2+(rank==2 or level>=6)
    nodes=[{'id':'input','type':'INPUT','label':'Sensor','x':.02,'y':.34,'fixed':True},
           {'id':'controller','type':'MCU','label':'Scope C','x':.19,'y':.34},
           {'id':'split','type':'SPLITTER','label':'Broadcast','x':.36,'y':.34}]
    programs={'controller':starter};references={'controller':program};tasks={}
    for index in range(branch_count):
        identity=f'branch_{index+1}'
        operand=1+(trial+index+rank+(parameters['secondary_value'] if parameters else level))%4
        operation='multiply' if (index+trial)%3==0 else 'add'
        symbol='*' if operation=='multiply' else '+'
        tasks[identity]={'operation':operation,'operand':operand,'description':f'Read one signal; {operation} {operand}; write one result. Each invocation starts fresh C scopes.'}
        nodes.append({'id':identity,'type':'MCU','label':f'Branch {index+1}','x':.53+(rng.random()-.5)*.025,'y':.08+index*.62/max(1,branch_count-1)})
        references[identity]='#include "logicade.h"\nint adjustment = '+str(operand)+';\nint main(void)\n{\n  int signal = readInput();\n  { int local = adjustment; signal = signal '+symbol+' local; }\n  writeOutput(signal);\n  return 0;\n}'
        programs[identity]='#include "logicade.h"\nint main(void)\n{\n  int signal = readInput();\n  // '+tasks[identity]['description']+'\n  writeOutput(signal);\n  return 0;\n}'
    nodes += [{'id':'merge','type':'MERGER','label':'Sum all','x':.70,'y':.34},
              {'id':'loop','type':'LOOP','label':'Feedback','passes':passes,'x':.85,'y':.34},
              {'id':'output','type':'OUTPUT','label':'Probe','x':.96,'y':.68,'fixed':True}]
    wires=[['input','controller'],['controller','split'],
           *[['split',identity] for identity in tasks],*[[identity,'merge'] for identity in tasks],
           ['merge','loop'],['loop','split'],['loop','output']]
    def output(value):
        for _ in range(passes):
            value=sum(value*task['operand'] if task['operation']=='multiply' else value+task['operand'] for task in tasks.values())
        return value
    samples=parameters['input_values'][:3] if parameters else [n,-n,g+n]
    cases=[{'id':f'case_{i+1}','inputs':[value],'expected':watch+[output(value)]} for i,value in enumerate(samples)]
    common['rules']['max_nodes']=12
    local_name='local' if level in (2,3,4,9) else 'steps' if level>=5 else None
    minimum_depth=3 if level==6 else 2 if level in (5,8,10) else 1
    common.update(family='circuit',language='c_subset',circuit_kind='scope_controller',
        title=f'C Scope Circuit · {common["focus"]} · variation {trial}',
        objective=f'Build {branch_count} parallel branches, merge every branch by SUM, and feed the merged signal back for {passes} passes before the output probe. In the scope controller, {focus}. '
                  f'Print the scope trace {watch}, then send the incoming signal with writeOutput(signal) into the broadcast splitter. '
                  f'Final file-scope values: {globals_expected}. Pass all {len(cases)} signal tests.',
        nodes=nodes,wires=wires[:2] if rank==0 else [],palette=['MCU','SPLITTER','MERGER','LOOP'],cases=cases,
        programs=programs,expected_globals=globals_expected,scope_trace_length=len(watch),
        signal_network={'version':2,'branch_ids':list(tasks),'branch_tasks':tasks,'merge_mode':'sum','passes':passes,'required_wires':wires,'max_queue':32},
        scope_contract={'global_names':list(globals_expected),'local_name':local_name,'minimum_depth':minimum_depth,
                        'sibling_blocks':level==8,'zero_initialized_global':level==3},
        reference={'nodes':nodes,'wires':wires,'programs':references,'program':program},
        hint='Wire every splitter branch into the SUM merger. The feedback controller repeats the merged signal for the required pass count, then sends it to the probe. Declare globals before main. Braces create local scopes; an inner declaration hides an outer name until its block ends. Use Step to inspect the variable scopes and output trace.',
        controls='Drag components and connect pins. A splitter broadcasts a copy to every branch; the SUM merger waits for one result from each branch in the same pass. LOOP sends intermediate results back to split, and the final result to output. Select Program node to edit each C controller. Run tests every case; Step highlights the active node, wire and C line. Each node invocation starts fresh C scopes. Feedback passes and execution are bounded. readInput and writeOutput are bounded LogiCade helpers from logicade.h, not standard C functions.')
    return common
