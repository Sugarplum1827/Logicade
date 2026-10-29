"""Deterministic, executable fork/join production puzzles for CP1 Week 5."""


def factory_mission(common, level, trial, rank, seed):
    topology = ('separate_outputs', 'merge_midpoint', 'merge_endpoint')[(trial - 1) % 3]
    fork_type = 'splitter' if trial % 2 else 'router'
    fork_x = 2 + ((trial + level) % 2)
    top, bottom = (0 if trial in (5, 7, 9, 10) else 1), (6 if trial in (3, 6, 8, 10) else 5)
    join_x = 8
    target = 2 + level + trial % 3 + rank
    threshold = level + trial + rank + 1
    condition = {'kind': 'threshold', 'value': threshold} if trial % 4 else {'kind': 'even'}
    values = ([threshold + 3 if i % 2 == 0 else threshold - 1 for i in range(target + 4)]
              if condition['kind'] == 'threshold' else list(range(1, target + 5)))
    if fork_type == 'splitter':
        branch_ids, upper_count = ['A', 'B'], (target + 1) // 2
    else:
        branch_ids = ['IF', 'ELSE']
        upper_count = sum((v >= threshold if condition['kind'] == 'threshold' else v % 2 == 0) for v in values[:target])

    machines = []
    def piece(identity, x, y, kind, direction='E', fixed=True, **extra):
        result = {'id': identity, 'x': x, 'y': y, 'type': kind, 'dir': direction, 'fixed': fixed, **extra}
        machines.append(result)
        return result

    piece('power', 0, 0, 'generator')
    piece('source', 1, 3, 'source')
    for x in range(2, fork_x): piece(f'feed_{x}', x, 3, 'belt', fixed=False)
    fork = piece('junction', fork_x, 3, fork_type, fixed=False,
                 outputs={branch_ids[0]: 'N', branch_ids[1]: 'S'},
                 **({'condition': condition.copy()} if fork_type == 'router' else {}))
    goals = []
    for index, (branch, row, count) in enumerate(zip(branch_ids, [top, bottom], [upper_count, target - upper_count])):
        name = 'upper' if index == 0 else 'lower'
        vertical = 'N' if index == 0 else 'S'
        for y in range(3 + (-1 if index == 0 else 1), row, -1 if index == 0 else 1):
            piece(f'{name}_rise_{y}', fork_x, y, 'belt', vertical, fixed=False)
        piece(f'{name}_corner', fork_x, row, 'belt', fixed=False)
        for x in range(fork_x + 1, join_x):
            kind = 'smelter' if x == 4 else 'assembler' if x == 6 and topology != 'merge_midpoint' else 'belt'
            piece(f'{name}_{x}', x, row, kind, fixed=kind != 'belt')
        via = [f'{name}_4'] + ([f'{name}_6'] if topology != 'merge_midpoint' else ['shared_assembler'])
        if topology == 'separate_outputs':
            piece(f'{name}_tail', join_x, row, 'belt', fixed=False)
            output = f'output_{name}'
            piece(output, join_x + 1, row, 'output')
        else:
            towards_join = 'S' if index == 0 else 'N'
            piece(f'{name}_join_corner', join_x, row, 'belt', towards_join, fixed=False)
            for y in range(row + (1 if index == 0 else -1), 3, 1 if index == 0 else -1):
                piece(f'{name}_join_{y}', join_x, y, 'belt', towards_join, fixed=False)
            output = 'output_shared'
        goals.append({'id': branch, 'label': name.title() + ' branch', 'target': count, 'via': via, 'output': output})
    merge = None
    if topology != 'separate_outputs':
        merge = piece('merge', join_x, 3, 'merger', fixed=False)
        piece('shared_assembler' if topology == 'merge_midpoint' else 'shared_tail', join_x + 1, 3,
              'assembler' if topology == 'merge_midpoint' else 'belt', fixed=topology == 'merge_midpoint')
        piece('output_shared', join_x + 2, 3, 'output')

    kind = ['if_else', 'while', 'for'][(trial - 1) % 3]
    controller = {'id': 'controller', 'x': 0, 'y': 1, 'type': kind, 'quota': target, 'dir': 'E', 'fixed': False}
    power = [['power', m['id']] for m in machines if m['type'] in ('source', 'smelter', 'assembler', 'splitter', 'router', 'merger')]
    power.append(['power', 'controller'])
    belts = [m for m in machines if m['type'] == 'belt']
    missing = {f'{name}_corner' for name in ('upper', 'lower')}
    if rank: missing.add('upper_join_corner' if merge else 'upper_tail')
    if rank == 2: missing.add('lower_join_corner' if merge else 'lower_tail')
    missing.add('junction')
    if merge: missing.add('merge')

    condition_text = (f'item value >= {threshold}' if condition['kind'] == 'threshold' else 'item value is even')
    branch_rule = ('Alternate items between A (upper) and B (lower); wait if the scheduled branch is blocked.'
                   if fork_type == 'splitter' else f'IF {condition_text}, send north to the upper branch; ELSE send south to the lower branch.')
    join_rule = {'separate_outputs': 'Finish both paths at their separate output depots.',
                 'merge_midpoint': 'Merge the two plate streams at (8, 3), then use the shared assembler and output.',
                 'merge_endpoint': 'Assemble components on both paths, then merge them at (8, 3) before the shared output.'}[topology]
    goals_text = '; '.join(f'{g["id"]}: {g["target"]} components via {", ".join(g["via"])} to {g["output"]}' for g in goals)
    common.update(family='factory', title=f'Branch Assembly {trial} · {topology.replace("_", " ").title()}',
        objective=f'Build the {fork_type} at ({fork_x}, 3), with the upper processing path on row {top} and lower path on row {bottom}. {branch_rule} {join_rule} Deliver exactly {target} components ({upper_count} upper, {target-upper_count} lower). Set the gold-socket controller batch to {target}.',
        width=11, height=7, machines=[m for m in machines if m['id'] not in missing], wires=power if rank == 0 else [],
        target=target, ore=target+4, ore_values=values, build_budget=len(belts)+rank+3,
        recipes={'smelter': {'input': 'ore', 'output': 'plate', 'ticks': 2+rank},
                 'assembler': {'input': 'plate', 'output': 'component', 'ticks': 3+level//4}},
        controller={'schema_version': 1, 'socket': [0, 1], 'required_kind': kind},
        controller_lesson=branch_rule,
        routing={'version': 1, 'topology': topology,
                 'fork': {'id': fork['id'], 'type': fork_type, 'position': [fork_x, 3], 'branches': branch_ids,
                          **({'condition': condition} if fork_type == 'router' else {})},
                 'merge': {'id': merge['id'], 'position': [join_x, 3]} if merge else None,
                 'targets': goals},
        reference={'machines': machines+[controller], 'wires': power},
        hint=f'{branch_rule} {join_rule} Branch contracts: {goals_text}. Power the junctions and production machines. A blocked branch waits without losing items.',
        controls='Drag sprites onto the grid. R rotates new pieces. Set fork output directions and router conditions in the inspector. Splitters alternate; routers evaluate each item; mergers accept one waiting item at a time fairly. Set batch size, connect power, repair rounded conveyors, then Run or Step. Grid controls are the keyboard alternative.')
    common['rules']['max_steps'] = max(common['rules']['max_steps'], 900+level*30)
    return common
