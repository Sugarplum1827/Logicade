"""Research-backed syllabus and executable C exercises; no study outcomes."""
import json
from pathlib import Path

COURSE_PATH = Path(__file__).resolve().parents[1] / 'data/curriculum.json'
EXAM_WEEKS = {1: 2, 2: 3, 3: 4, 4: 5, 5: 6, 6: 7, 7: 8, 8: 2, 9: 5, 10: 8}
EXAM_LEVELS = {1: 10, 2: 10, 3: 10, 4: 10, 5: 10, 6: 10, 7: 9, 8: 10, 9: 9, 10: 10}


def source_level(week, level):
    return EXAM_LEVELS[level] if week == 9 else min(level, 2) if week == 1 else level


def source_week(week, level):
    return EXAM_WEEKS[level] if week == 9 else week


def lesson_for(week, level):
    course = json.loads(COURSE_PATH.read_text(encoding='utf-8'))
    origin = source_week(week, level)
    row = next(w for w in course['weeks'] if w['week'] == origin)
    target = source_level(week, level)
    stage = row['stages'][target - 1]
    return {**row['lesson'], 'week': week, 'source_week': origin, 'source_level': target,
            'objective_id': f'cp1_w{origin}_l{target}',
            'title': row['title'], 'stage_title': stage,
            'objectives': [stage], 'points': [stage, *row['lesson']['points']],
            'sources': [course['sources'][key] for key in row['source_ids']],
            'assessment_kind': 'examination_practice' if week == 9 else 'lesson_practice',
            'coverage': [origin], 'exam_coverage': list(range(2,9)) if week==9 else [],
            'formal_assessment': False}


def c_source_exercise(level, trial, rank, week=5, parameters=None):
    n = parameters['primary_value'] if parameters else level + trial + rank
    k = parameters['secondary_value'] if parameters else trial + rank + 1
    forms = [
        ('Initialize an integer', f'int total = {n};', n),
        ('Add two values', f'int total = {n} + 3;', n + 3),
        ('Update a variable', f'int total = {n};\ntotal = total + 2;', n + 2),
        ('Use a symbolic constant', 'int total = LIMIT + 1;', n + 1),
        ('Multiply a value', f'int total = {n};\ntotal = total * 2;', n * 2),
        ('Subtract before output', f'int total = {n};\ntotal = total - 1;', n - 1),
        ('Combine expressions', f'int total = ({n} + 2) * 2;', (n + 2) * 2),
        ('Integer division', f'int total = {n} / 2;', n // 2),
        ('Use a remainder', f'int total = {n} % 3;', n % 3),
        ('Read a block in order', f'int total = 1;\ntotal = total + {n};', n + 1),
    ]
    # The level owns the learning focus. Trial changes its operands and layout.
    title, body, expected = forms[(trial - 1) if level == 10 else level - 1]
    if week == 5:
        body = ('int total = LIMIT;' if level in (3, 4, 5) else
                f'int total = {n};\ntotal = total + {k};' if level in (7, 8, 9) else body)
        expected = n if level in (3, 4, 5) else n+k if level in (7, 8, 9) else expected
    elif level == 1:
        title, body, expected = 'The main function', f'int total = {n};', n
    elif level == 2:
        title, body, expected = 'Blocks and semicolons', f'int total = {n};\n{{ total = total + {k}; }}', n+k
    elif level == 3:
        title, body, expected = 'Initialization', f'int total = {n};', n
    elif level == 4:
        title, body, expected = 'Ordered assignment', f'int total = {n};\ntotal = total + {k};\ntotal = total * 2;', (n+k)*2
    elif level == 5:
        title, body, expected = 'Integer expressions', f'int total = ({n} + {k}) * 2;', (n+k)*2
    elif level == 6:
        title, body, expected = 'Formatted output', f'int total = {n} + {k};', n+k
    elif level == 7:
        title, body, expected = 'Read and trace', f'int total = {n};\ntotal = total * 2;\ntotal = total - {k};', n*2-k
    elif level == 8:
        title, body, expected = 'Repair a short program', f'int total = {n};\ntotal = total + {k};', n+k
    elif level == 9:
        title, body, expected = 'Output verification', f'int total = {n} * 2 + {k};', n*2+k
    source = f'#include <stdio.h>\n#define LIMIT {n}\nint main(void)\n{{\n{body}\nprintf("%d\\n", total);\nreturn 0;\n}}'
    focus = lesson_for(week, level)['stage_title']
    return {'title': focus, 'focus': focus, 'objective_id': f'cp1_w{week}_l{level}',
            'prompt': f'{focus}: build a valid C source file that prints {expected}. Put preprocessing before main; keep declarations and statements inside its body.',
            'categories': {'int':'keyword','return':'keyword','main':'identifier','printf':'identifier','#include':'directive','#define':'directive'},
            'program': source, 'expected': [expected],
            'parts': [{'id': 'header', 'label': 'Preprocessor include', 'code': '#include <stdio.h>'},
                      {'id': 'macro', 'label': 'Object-like macro', 'code': f'#define LIMIT {n}'},
                      {'id': 'main', 'label': 'Main function and opening block', 'code': 'int main(void)\n{'},
                      {'id': 'body', 'label': 'Declaration and statements', 'code': body},
                      {'id': 'output', 'label': 'Library call and semicolon', 'code': 'printf("%d\\n", total);'},
                      {'id': 'return', 'label': 'Return statement and closing block', 'code': 'return 0;\n}'}],
            'reference_order': ['header', 'macro', 'main', 'body', 'output', 'return']}


def c_variable_mission(common, level, trial, rank, seed, parameters=None):
    n = parameters['primary_value'] if parameters else level + trial + rank
    typename = 'float' if level == 7 else 'double' if level == 8 else 'char' if level == 9 else 'int'
    factor = parameters['secondary_value'] if parameters else 2 + trial % 3
    divisor = parameters['secondary_value'] if parameters else 2 + trial % 4
    offset = 65 + n % 20 if parameters else 65 + trial
    fraction = n + .5 if parameters else trial + .5
    operations = ['resource', f'resource + {n}', f'resource == {n}', f'resource * {factor}', '-resource',
                  f'(resource + {n}) * {factor}', f'resource + {fraction}', f'resource * {factor}.5', f'resource + {offset}', f'resource / {divisor}']
    expr = operations[level - 1]
    # readInput is a declared game-port helper, not a standard C library call.
    body = f'{typename} resource = readInput();\nresource = {expr};'
    fmt = '%c' if typename == 'char' else '%.1f' if typename in ('float', 'double') else '%d'
    program = '#include <stdio.h>\n#include "logicade.h"\nint main(void)\n{\n'+body+f'\nprintf("{fmt}\\n", resource);\nreturn 0;\n}}'
    cases = []
    for case in range(3):
        inputs = [0, 1, 2, 3+case] if typename == 'char' else [case - 3, 0, n + case, n + 3]
        if parameters:
            base=parameters['input_values']
            inputs=[*base, n] if typename!='char' else base[:]
            if case==1:inputs=list(reversed(inputs))
            elif case==2:inputs=[x+1 for x in inputs]
        def calculate(x):
            return [lambda:x, lambda:x+n, lambda:int(x==n), lambda:x*factor, lambda:-x,
                    lambda:(x+n)*factor, lambda:x+fraction, lambda:x*(factor+.5), lambda:x+offset, lambda:int(x/divisor)][level-1]()
        values = [calculate(x) for x in inputs]
        cases.append({'id': f'case_{case+1}', 'inputs': inputs,
                      'expected': [chr(x) for x in values] if typename == 'char' else values,
                      'required_values': {'resource': values[-1]}})
    focus = lesson_for(7, level)['stage_title']
    common.update(family='terminal', language='c_subset', title=f'{focus} · variation {trial}',
        objective=f'{focus}: declare resource as {typename}, apply {expr}, and print each result with {fmt}. Dataset {trial} starts with {cases[0]["inputs"]}. Match every stream. Use a full main function and a return statement.',
        cases=cases, nodes=[{'id':'C1','program':'#include <stdio.h>\n#include "logicade.h"\nint main(void)\n{\n// Declare, compute and print here.\nreturn 0;\n}'}],
        required_declaration={'name':'resource','type':typename}, reference={'programs':[program]},
        hint=f'Declare before use. {typename} resource = readInput(); creates the named game-port value; printf uses {fmt}.',
        controls='Edit the C program. Run tests all streams; Step shows declarations, assignments and output. readInput() is a LogiCade game-port helper declared in logicade.h. This safe practice runtime supports a documented C subset.')
    return common
