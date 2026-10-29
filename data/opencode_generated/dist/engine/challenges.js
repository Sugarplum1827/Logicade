// Interactive challenge renderers for LogiCade.
//
// This module is deliberately Phaser-free: the 12 game mechanics are DOM-based
// so they stay readable and usable at phone widths. The arena around them uses
// the theme art. No renderer is a four-button multiple-choice quiz.

import { rng, shuffle } from './core.js';

export const MECHANICS = [
  {
    id: 'order',
    label: 'Order',
    title: 'Order the steps',
    blurb: 'Put a procedure, timeline, or set of instructions into the right sequence.',
    icon: '123',
  },
  {
    id: 'assemble',
    label: 'Assemble',
    title: 'Assemble the code',
    blurb: 'Build a statement from tokens, with decoys in the bank.',
    icon: '{}',
  },
  {
    id: 'flow',
    label: 'Wire',
    title: 'Wire the flowchart',
    blurb: 'Connect nodes into a valid flowchart by clicking ports.',
    icon: '->',
  },
  {
    id: 'vars',
    label: 'Vault',
    title: 'Fill the variable vault',
    blurb: 'Assign values to named variables and make the program state consistent.',
    icon: '[]',
  },
  {
    id: 'sort',
    label: 'Sort',
    title: 'Sort into bins',
    blurb: 'Classify concepts, values, or claims into the correct categories.',
    icon: 'AZ',
  },
  {
    id: 'bug',
    label: 'Bug hunt',
    title: 'Find the bug',
    blurb: 'Read a code block and click the line that breaks it.',
    icon: '!',
  },
  {
    id: 'scope',
    label: 'Scope',
    title: 'Split the scopes',
    blurb: 'Place declarations into global, function, and block scope frames.',
    icon: '{}',
  },
  {
    id: 'robot',
    label: 'Robot',
    title: 'Program the robot',
    blurb: 'Build a command program that moves the robot to the goal.',
    icon: '^>',
  },
  {
    id: 'match',
    label: 'Match',
    title: 'Match the pairs',
    blurb: 'Connect terms to definitions, symbols to meanings, or inputs to outputs.',
    icon: '=',
  },
  {
    id: 'repair',
    label: 'Repair',
    title: 'Repair the program',
    blurb: 'Fill the missing tokens in a multi-line program.',
    icon: '__',
  },
  {
    id: 'trace',
    label: 'Trace',
    title: 'Trace the output',
    blurb: 'Read a program and type the value it produces.',
    icon: '>',
  },
  {
    id: 'simulate',
    label: 'Simulate',
    title: 'Step the machine',
    blurb: 'Run the program line by line and commit the final variable state.',
    icon: '||',
  },
];

export const MECHANIC_IDS = MECHANICS.map((mechanic) => mechanic.id);

export const mechanicInfo = (id) =>
  MECHANICS.find((mechanic) => mechanic.id === id) || {
    id,
    label: id,
    title: id,
    blurb: '',
    icon: '*',
  };

const normalize = (value) =>
  String(value ?? '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();

const numeric = (value) => {
  const cleaned = String(value ?? '').trim().replace(/^["']|["']$/g, '');
  if (!cleaned) return null;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
};

const svg = (tag, attributes = {}) => {
  const node = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, value);
  return node;
};

const el = (tag, attributes = {}, ...children) => {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attributes || {})) {
    if (value === false || value == null) continue;
    if (key === 'class') node.className = value;
    else if (key === 'text') node.textContent = value;
    else if (key === 'dataset') Object.assign(node.dataset, value);
    else if (key === 'style') Object.assign(node.style, value);
    else if (key.startsWith('on') && typeof value === 'function') {
      node.addEventListener(key.slice(2).toLowerCase(), value);
    } else if (value === true) node.setAttribute(key, '');
    else node.setAttribute(key, String(value));
  }
  for (const child of children.flat()) {
    if (child == null || child === false) continue;
    node.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return node;
};

const chip = (textValue, options = {}) =>
  el(
    'button',
    {
      type: 'button',
      class: `challenge-chip${options.className ? ` ${options.className}` : ''}`,
      dataset: options.dataset || {},
      disabled: Boolean(options.disabled),
      title: options.title || '',
      onclick: options.onClick,
    },
    options.icon ? el('span', { class: 'chip-icon', text: options.icon }) : null,
    el('span', { class: 'chip-text', text: textValue }),
  );

const action = (label, onClick, className = '') =>
  el('button', { type: 'button', class: `challenge-mini ${className}`.trim(), onclick: onClick }, label);

const pressable = (onActivate) => ({
  role: 'button',
  tabindex: '0',
  onclick: onActivate,
  onkeydown: (event) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    onActivate();
  },
});

const progressBar = (value) => {
  const clamped = Math.max(0, Math.min(1, Number(value) || 0));
  return el(
    'div',
    { class: 'challenge-progress', role: 'progressbar', 'aria-valuemin': '0', 'aria-valuemax': '100', 'aria-valuenow': String(Math.round(clamped * 100)) },
    el('span', { style: { width: `${clamped * 100}%` } }),
  );
};

const lineList = (lines, options = {}) =>
  el(
    'div',
    { class: `challenge-code${options.className ? ` ${options.className}` : ''}`, role: 'group', 'aria-label': options.label || 'Code' },
    lines.map((line, index) =>
      el(
        'div',
        { class: `code-line${options.active === index ? ' is-active' : ''}`, dataset: { line: String(index) } },
        el('span', { class: 'code-number', text: String(index + 1).padStart(2, '0') }),
        el('code', { text: typeof line === 'string' ? line : line.text }),
      ),
    ),
  );

const emptySlots = (count, label = 'slot') =>
  Array.from({ length: count }, (_, index) =>
    el('span', { class: 'slot-label', text: `${label} ${index + 1}` }),
  );

function withRender(root, render) {
  const refresh = () => {
    root.replaceChildren();
    render();
  };
  refresh();
  return refresh;
}

// ---------------------------------------------------------------------------
// 1. Order
// ---------------------------------------------------------------------------

function renderOrder(root, payload, options) {
  const items = (payload.items || []).map((item) => (typeof item === 'string' ? { id: item, text: item } : item));
  const byId = new Map(items.map((item) => [item.id, item]));
  const answer = payload.answer || [];
  const random = rng(options.seed ?? 1);
  let pool = shuffle(items, random);
  let placed = [];

  const refresh = withRender(root, () => {
    const ordered = placed.map((id) => byId.get(id)).filter(Boolean);
    const bank = pool.filter((item) => !placed.includes(item.id));
    root.append(
      el('div', { class: 'challenge-subhead' }, el('strong', { text: 'Your sequence' }), el('span', { text: `${placed.length}/${answer.length} placed` })),
      el(
        'ol',
        { class: 'order-track', 'aria-label': 'Your sequence' },
        Array.from({ length: answer.length }, (_, index) => {
          const item = ordered[index];
          return el(
            'li',
            { class: `order-slot${item ? ' is-filled' : ''}` },
            el('span', { class: 'order-number', text: String(index + 1) }),
            item
              ? el(
                  'button',
                  {
                    type: 'button',
                    class: 'order-card',
                    onclick: () => {
                      placed = placed.filter((id) => id !== item.id);
                      refresh();
                    },
                  },
                  item.text,
                  el('span', { class: 'chip-remove', text: '×' }),
                )
              : el('span', { class: 'order-placeholder', text: 'Drop the next step here' }),
          );
        }),
      ),
      el('div', { class: 'challenge-subhead' }, el('strong', { text: 'Available pieces' }), el('span', { text: 'Tap to add' })),
      el(
        'div',
        { class: 'chip-bank', 'aria-label': 'Available pieces' },
        bank.length
          ? bank.map((item) =>
              chip(item.text, {
                dataset: { item: item.id },
                onClick: () => {
                  placed = [...placed, item.id];
                  refresh();
                },
              }),
            )
          : el('p', { class: 'challenge-empty', text: 'All pieces are placed.' }),
      ),
      progressBar(placed.length / Math.max(1, answer.length)),
    );
  });

  return {
    root,
    checkLabel: 'Check sequence',
    read: () => ({ placed: [...placed] }),
    refresh,
    check: () => placed.length === answer.length && placed.every((id, index) => byId.get(id)?.text === byId.get(answer[index])?.text),
    hint: () => {
      const index = placed.findIndex((id, position) => id !== answer[position]);
      const target = byId.get(answer[index === -1 ? placed.length : index]);
      if (!target) return 'The sequence is already complete.';
      const button = root.querySelector(`[data-item="${target.id}"]`);
      button?.classList.add('hint-target');
      button?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
      return 'Hint: the highlighted piece is the next one in the sequence.';
    },
    reveal: () => {
      placed = [...answer];
      refresh();
      return 'Solution shown: the steps are now in the correct order.';
    },
    reset: () => {
      placed = [];
      pool = shuffle(items, rng(options.seed ?? 1));
      refresh();
    },
    progress: () => placed.length / Math.max(1, answer.length),
    focus: () => root.querySelector('button:not([disabled])')?.focus(),
  };
}

// ---------------------------------------------------------------------------
// 2. Assemble
// ---------------------------------------------------------------------------

function renderAssemble(root, payload, options) {
  const bank = (payload.bank || []).map((item) => (typeof item === 'string' ? { id: item, text: item } : item));
  const byId = new Map(bank.map((item) => [item.id, item]));
  const answer = payload.answer || [];
  const slots = payload.slots || answer.map((_, index) => ({ id: `s${index}` }));
  const random = rng((options.seed ?? 1) ^ 0x51ed270b);
  let state = Array(slots.length).fill(null);
  let selectedSlot = null;
  let bankItems = shuffle(bank, random);

  const refresh = withRender(root, () => {
    const used = new Set(state.filter(Boolean));
    const available = bankItems.filter((item) => !used.has(item.id));
    const filled = state.filter(Boolean).length;
    root.append(
      el('div', { class: 'challenge-subhead' }, el('strong', { text: 'Code bench' }), el('span', { text: `${filled}/${slots.length} tokens` })),
      el(
        'div',
        { class: 'assemble-frame' },
        payload.prefix ? el('code', { class: 'assemble-prefix', text: payload.prefix }) : null,
        el(
          'div',
          { class: 'assemble-line', role: 'group', 'aria-label': 'Code slots' },
          slots.map((slot, index) =>
            el(
              'button',
              {
                type: 'button',
                class: `assemble-slot${state[index] ? ' is-filled' : ''}${selectedSlot === index ? ' is-selected' : ''}`,
                onclick: () => {
                  if (state[index]) {
                    state[index] = null;
                    refresh();
                  } else {
                    selectedSlot = index;
                    refresh();
                  }
                },
              },
              state[index] ? byId.get(state[index])?.text || '?' : slot.label || '___',
            ),
          ),
        ),
        payload.suffix ? el('code', { class: 'assemble-suffix', text: payload.suffix }) : null,
      ),
      el('div', { class: 'challenge-subhead' }, el('strong', { text: 'Token bank' }), el('span', { text: 'Tap a token' })),
      el(
        'div',
        { class: 'chip-bank' },
        available.length
          ? available.map((item) =>
              chip(item.text, {
                className: 'token-chip',
                dataset: { item: item.id },
                onClick: () => {
                  let index = selectedSlot;
                  if (index == null) index = state.findIndex((value) => !value);
                  if (index == null || index < 0) return;
                  state[index] = item.id;
                  selectedSlot = null;
                  refresh();
                },
              }),
            )
          : el('p', { class: 'challenge-empty', text: 'All tokens are placed.' }),
      ),
      progressBar(filled / Math.max(1, slots.length)),
    );
  });

  return {
    root,
    checkLabel: 'Check code',
    read: () => ({ tokens: [...state] }),
    refresh,
    check: () => state.length === answer.length && state.every((id, index) => id != null && byId.get(id)?.text === byId.get(answer[index])?.text),
    hint: () => {
      const index = state.findIndex((id, position) => id !== answer[position]);
      if (index === -1) return 'The code is already complete.';
      const target = byId.get(answer[index]);
      const button = root.querySelector(`[data-item="${target?.id || ''}"]`);
      button?.classList.add('hint-target');
      button?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
      return 'Hint: the highlighted token belongs in the next open slot.';
    },
    reveal: () => {
      state = [...answer];
      selectedSlot = null;
      refresh();
      return 'Solution shown: the code is assembled correctly.';
    },
    reset: () => {
      state = Array(slots.length).fill(null);
      selectedSlot = null;
      bankItems = shuffle(bank, rng((options.seed ?? 1) ^ 0x51ed270b));
      refresh();
    },
    progress: () => state.filter(Boolean).length / Math.max(1, slots.length),
    focus: () => root.querySelector('.assemble-slot')?.focus(),
  };
}

// ---------------------------------------------------------------------------
// 3. Flow
// ---------------------------------------------------------------------------

function renderFlow(root, payload, options) {
  const nodes = payload.nodes || [];
  const answers = new Set((payload.edges || []).map(([from, to]) => `${from}->${to}`));
  let edges = [];
  let selected = null;

  const getNode = (id) => nodes.find((node) => node.id === id);
  const key = (from, to) => `${from}->${to}`;
  const edgeSet = () => new Set(edges.map(([from, to]) => key(from, to)));

  const refresh = withRender(root, () => {
    const current = edgeSet();
    const svgNode = svg('svg', { viewBox: '0 0 100 100', class: 'flow-lines', 'aria-hidden': 'true' });
    for (const [from, to] of edges) {
      const a = getNode(from);
      const b = getNode(to);
      if (!a || !b) continue;
      const line = svg('line', {
        x1: a.x,
        y1: a.y,
        x2: b.x,
        y2: b.y,
        class: 'flow-edge',
        'vector-effect': 'non-scaling-stroke',
      });
      line.addEventListener('click', () => {
        edges = edges.filter(([x, y]) => !(x === from && y === to));
        refresh();
      });
      svgNode.append(line);
    }
    if (selected) {
      const node = getNode(selected);
      if (node) {
        svgNode.append(
          svg('circle', { cx: node.x, cy: node.y, r: 5.4, class: 'flow-selected-ring' }),
        );
      }
    }
    root.append(
      el('div', { class: 'challenge-subhead' }, el('strong', { text: 'Flowchart board' }), el('span', { text: `${edges.length} connections` })),
      el(
        'div',
        { class: 'flow-board', role: 'group', 'aria-label': 'Flowchart nodes' },
        svgNode,
        nodes.map((node) =>
          el(
            'button',
            {
              type: 'button',
              class: `flow-node flow-${node.kind || 'process'}${selected === node.id ? ' is-selected' : ''}`,
              style: { left: `${node.x}%`, top: `${node.y}%` },
              dataset: { node: node.id },
              onclick: () => {
                if (!selected) {
                  selected = node.id;
                } else if (selected === node.id) {
                  selected = null;
                } else {
                  const next = key(selected, node.id);
                  if (!current.has(next)) edges = [...edges, [selected, node.id]];
                  selected = null;
                }
                refresh();
              },
            },
            el('span', { class: 'flow-node-label', text: node.label }),
            el('span', { class: 'flow-node-kind', text: node.kind || 'process' }),
          ),
        ),
        el('p', { class: 'flow-help', text: 'Tap a source node, then a destination. Click a line to remove it.' }),
      ),
      progressBar([...answers].filter((edge) => current.has(edge)).length / Math.max(1, answers.size)),
    );
  });

  return {
    root,
    checkLabel: 'Check wiring',
    read: () => ({ edges: edges.map(edge => [...edge]) }),
    refresh,
    check: () => {
      const current = edgeSet();
      return current.size === answers.size && [...answers].every((edge) => current.has(edge));
    },
    hint: () => {
      const current = edgeSet();
      const missing = [...answers].find((edge) => !current.has(edge));
      if (!missing) return 'The flowchart is complete.';
      const [from, to] = missing.split('->');
      for (const node of nodes) {
        if (node.id === from || node.id === to) {
          root.querySelector(`[data-node="${node.id}"]`)?.classList.add('hint-target');
        }
      }
      return 'Hint: the highlighted nodes should be connected in that direction.';
    },
    reveal: () => {
      edges = [...answers].map((edge) => edge.split('->'));
      selected = null;
      refresh();
      return 'Solution shown: every connection is wired.';
    },
    reset: () => {
      edges = [];
      selected = null;
      refresh();
    },
    progress: () => {
      const current = edgeSet();
      return [...answers].filter((edge) => current.has(edge)).length / Math.max(1, answers.size);
    },
    focus: () => root.querySelector('.flow-node')?.focus(),
  };
}

// ---------------------------------------------------------------------------
// 4. Vars
// ---------------------------------------------------------------------------

function renderVars(root, payload, options) {
  const variables = payload.variables || [];
  const bank = (payload.bank || []).map((item) => (typeof item === 'string' ? { id: item, text: item } : item));
  const byId = new Map(bank.map((item) => [item.id, item]));
  let state = {};
  let selectedValue = null;
  let selectedName = null;
  const random = rng((options.seed ?? 1) ^ 0x2f6e2b1);
  const shuffledBank = shuffle(bank, random);

  const refresh = withRender(root, () => {
    const used = new Set(Object.values(state).filter(Boolean));
    const available = shuffledBank.filter((item) => !used.has(item.id));
    root.append(
      payload.code?.length ? lineList(payload.code, { label: 'Program' }) : null,
      el('div', { class: 'challenge-subhead' }, el('strong', { text: 'Variable vault' }), el('span', { text: 'Tap a value, then a variable' })),
      el(
        'div',
        { class: 'vault-grid' },
        variables.map((variable) =>
          el(
            'button',
            {
              type: 'button',
              class: `vault-box${state[variable.name] ? ' is-filled' : ''}${selectedName === variable.name ? ' is-selected' : ''}`,
              dataset: { variable: variable.name },
              onclick: () => {
                if (state[variable.name]) {
                  delete state[variable.name];
                  refresh();
                  return;
                }
                if (selectedValue) {
                  state[variable.name] = selectedValue;
                  selectedValue = null;
                  selectedName = null;
                  refresh();
                } else {
                  selectedName = variable.name;
                  refresh();
                }
              },
            },
            el('span', { class: 'vault-name', text: variable.name }),
            el('span', { class: 'vault-type', text: variable.type || 'value' }),
            el('span', { class: 'vault-value', text: state[variable.name] ? byId.get(state[variable.name])?.text || '?' : 'empty' }),
          ),
        ),
      ),
      el('div', { class: 'challenge-subhead' }, el('strong', { text: 'Value bank' }), el('span', { text: 'Tap a value' })),
      el(
        'div',
        { class: 'chip-bank' },
        available.length
          ? available.map((item) =>
              chip(item.text, {
                className: selectedValue === item.id ? 'is-selected' : '',
                dataset: { item: item.id },
                onClick: () => {
                  if (selectedName) {
                    state[selectedName] = item.id;
                    selectedName = null;
                    selectedValue = null;
                  } else {
                    selectedValue = item.id;
                  }
                  refresh();
                },
              }),
            )
          : el('p', { class: 'challenge-empty', text: 'All values are assigned.' }),
      ),
      progressBar(Object.keys(state).length / Math.max(1, variables.length)),
    );
  });

  return {
    root,
    checkLabel: 'Check state',
    read: () => ({ values: { ...state } }),
    refresh,
    check: () => variables.every((variable) => state[variable.name] != null && byId.get(state[variable.name])?.text === byId.get(payload.answer?.[variable.name])?.text),
    hint: () => {
      const target = variables.find((variable) => state[variable.name] !== payload.answer?.[variable.name]);
      if (!target) return 'The vault is complete.';
      const correct = byId.get(payload.answer?.[target.name]);
      root.querySelector(`[data-variable="${target.name}"]`)?.classList.add('hint-target');
      root.querySelector(`[data-item="${correct?.id || ''}"]`)?.classList.add('hint-target');
      return 'Hint: the highlighted variable and value belong together.';
    },
    reveal: () => {
      state = { ...(payload.answer || {}) };
      selectedValue = null;
      selectedName = null;
      refresh();
      return 'Solution shown: every variable holds the correct value.';
    },
    reset: () => {
      state = {};
      selectedValue = null;
      selectedName = null;
      refresh();
    },
    progress: () => variables.filter((variable) => state[variable.name] === payload.answer?.[variable.name]).length / Math.max(1, variables.length),
    focus: () => root.querySelector('.vault-box')?.focus(),
  };
}

// ---------------------------------------------------------------------------
// 5. Sort
// ---------------------------------------------------------------------------

function renderSort(root, payload, options) {
  const bins = payload.bins || [];
  const items = payload.items || [];
  let placements = {};
  let selectedItem = null;

  const refresh = withRender(root, () => {
    const unplaced = items.filter((item) => !placements[item.id]);
    root.append(
      el('div', { class: 'challenge-subhead' }, el('strong', { text: 'Classification bench' }), el('span', { text: `${Object.keys(placements).length}/${items.length} placed` })),
      el(
        'div',
        { class: 'bin-grid' },
        bins.map((bin) =>
          el(
            'div',
            {
              class: `sort-bin${selectedItem ? ' is-ready' : ''}`,
              dataset: { bin: bin.id },
              ...pressable(() => {
                if (!selectedItem) return;
                placements[selectedItem] = bin.id;
                selectedItem = null;
                refresh();
              }),
            },
            el('span', { class: 'bin-label', text: bin.label }),
            bin.desc ? el('span', { class: 'bin-desc', text: bin.desc }) : null,
            el(
              'span',
              { class: 'bin-items' },
              items
                .filter((item) => placements[item.id] === bin.id)
                .map((item) =>
                  el(
                    'button',
                    {
                      type: 'button',
                      class: 'bin-chip',
                      dataset: { item: item.id },
                      onclick: (event) => {
                        event.stopPropagation();
                        delete placements[item.id];
                        refresh();
                      },
                    },
                    item.text,
                  ),
                ),
            ),
          ),
        ),
      ),
      el('div', { class: 'challenge-subhead' }, el('strong', { text: 'Items' }), el('span', { text: 'Tap an item, then a bin' })),
      el(
        'div',
        { class: 'chip-bank' },
        unplaced.length
          ? unplaced.map((item) =>
              chip(item.text, {
                className: selectedItem === item.id ? 'is-selected' : '',
                dataset: { item: item.id },
                onClick: () => {
                  selectedItem = selectedItem === item.id ? null : item.id;
                  refresh();
                },
              }),
            )
          : el('p', { class: 'challenge-empty', text: 'All items are classified.' }),
      ),
      progressBar(items.filter((item) => placements[item.id] === item.bin).length / Math.max(1, items.length)),
    );
  });

  return {
    root,
    checkLabel: 'Check bins',
    refresh,
    check: () => items.every((item) => placements[item.id] === item.bin),
    read: () => ({ placements: { ...placements } }),
    hint: () => {
      const target = items.find((item) => placements[item.id] !== item.bin);
      if (!target) return 'All bins are correct.';
      const bin = bins.find((entry) => entry.id === target.bin);
      root.querySelector(`[data-bin="${bin?.id || ''}"]`)?.classList.add('hint-target');
      root.querySelector(`[data-item="${target.id}"]`)?.classList.add('hint-target');
      return 'Hint: the highlighted item belongs in the highlighted bin.';
    },
    reveal: () => {
      placements = Object.fromEntries(items.map((item) => [item.id, item.bin]));
      selectedItem = null;
      refresh();
      return 'Solution shown: every item is in its correct bin.';
    },
    reset: () => {
      placements = {};
      selectedItem = null;
      refresh();
    },
    progress: () => items.filter((item) => placements[item.id] === item.bin).length / Math.max(1, items.length),
    focus: () => root.querySelector('.chip-bank button')?.focus(),
  };
}

// ---------------------------------------------------------------------------
// 6. Bug hunt
// ---------------------------------------------------------------------------

function renderBug(root, payload, options) {
  const lines = payload.lines || [];
  let selected = null;

  const refresh = withRender(root, () => {
    root.append(
      el('div', { class: 'challenge-subhead' }, el('strong', { text: payload.language === 'c' ? 'C source' : 'Source' }), el('span', { text: 'Tap the line with the bug' })),
      el(
        'div',
        { class: 'challenge-code bug-code', role: 'group', 'aria-label': 'Code lines' },
        lines.map((line, index) =>
          el(
            'button',
            {
              type: 'button',
              class: `code-line code-line-button${selected === index ? ' is-selected' : ''}${payload.eliminated?.includes(index) ? ' is-eliminated' : ''}`,
              onclick: () => {
                selected = index;
                refresh();
              },
            },
            el('span', { class: 'code-number', text: String(index + 1).padStart(2, '0') }),
            el('code', { text: line }),
          ),
        ),
      ),
      el('p', { class: 'challenge-help', text: 'A bug is a line that prevents the program from compiling or from doing what the comment says.' }),
      progressBar(selected == null ? 0 : 1),
    );
  });

  return {
    root,
    checkLabel: 'Check line',
    read: () => ({ selected }),
    refresh,
    check: () => selected === payload.answer,
    hint: () => {
      const wrong = lines.map((_, index) => index).filter((index) => index !== payload.answer && !(payload.eliminated || []).includes(index));
      if (!wrong.length) return 'Only the buggy line remains.';
      const remove = wrong[Math.floor(((options.seed ?? 1) % 997) / 997 * wrong.length)];
      payload.eliminated = [...(payload.eliminated || []), remove];
      refresh();
      return 'Hint: one innocent line has been struck out.';
    },
    reveal: () => {
      selected = payload.answer;
      refresh();
      return 'Solution shown: the buggy line is highlighted.';
    },
    reset: () => {
      selected = null;
      payload.eliminated = [];
      refresh();
    },
    progress: () => (selected == null ? 0 : 1),
    focus: () => root.querySelector('.code-line-button')?.focus(),
  };
}

// ---------------------------------------------------------------------------
// 7. Scope
// ---------------------------------------------------------------------------

function renderScope(root, payload, options) {
  const scopes = payload.scopes || [
    { id: 'global', label: 'Global scope' },
    { id: 'function', label: 'Function scope' },
    { id: 'block', label: 'Block scope' },
  ];
  const items = payload.items || [];
  let placements = {};
  let selectedItem = null;

  const refresh = withRender(root, () => {
    const unplaced = items.filter((item) => !placements[item.id]);
    root.append(
      payload.code?.length ? lineList(payload.code, { label: 'Scope map' }) : null,
      el('div', { class: 'challenge-subhead' }, el('strong', { text: 'Scope frames' }), el('span', { text: 'Tap a declaration, then its scope' })),
      el(
        'div',
        { class: 'scope-stack' },
        scopes.map((scope) =>
          el(
            'div',
            {
              class: `scope-frame scope-${scope.id}${selectedItem ? ' is-ready' : ''}`,
              dataset: { scope: scope.id },
              ...pressable(() => {
                if (!selectedItem) return;
                placements[selectedItem] = scope.id;
                selectedItem = null;
                refresh();
              }),
            },
            el('span', { class: 'scope-title', text: scope.label }),
            scope.desc ? el('span', { class: 'scope-desc', text: scope.desc }) : null,
            el(
              'span',
              { class: 'scope-items' },
              items
                .filter((item) => placements[item.id] === scope.id)
                .map((item) =>
                  el(
                    'button',
                    {
                      type: 'button',
                      class: 'scope-chip',
                      dataset: { item: item.id },
                      onclick: (event) => {
                        event.stopPropagation();
                        delete placements[item.id];
                        refresh();
                      },
                    },
                    item.text,
                  ),
                ),
            ),
          ),
        ),
      ),
      el('div', { class: 'challenge-subhead' }, el('strong', { text: 'Declarations' }), el('span', { text: 'Tap a declaration' })),
      el(
        'div',
        { class: 'chip-bank' },
        unplaced.length
          ? unplaced.map((item) =>
              chip(item.text, {
                className: selectedItem === item.id ? 'is-selected' : '',
                dataset: { item: item.id },
                onClick: () => {
                  selectedItem = selectedItem === item.id ? null : item.id;
                  refresh();
                },
              }),
            )
          : el('p', { class: 'challenge-empty', text: 'Every declaration is placed.' }),
      ),
      progressBar(items.filter((item) => placements[item.id] === item.scope).length / Math.max(1, items.length)),
    );
  });

  return {
    root,
    checkLabel: 'Check scopes',
    refresh,
    check: () => items.every((item) => placements[item.id] === item.scope),
    read: () => ({ placements: { ...placements } }),
    hint: () => {
      const target = items.find((item) => placements[item.id] !== item.scope);
      if (!target) return 'Every declaration is in the right frame.';
      const scope = scopes.find((entry) => entry.id === target.scope);
      root.querySelector(`[data-scope="${scope?.id || ''}"]`)?.classList.add('hint-target');
      root.querySelector(`[data-item="${target.id}"]`)?.classList.add('hint-target');
      return 'Hint: the highlighted declaration belongs in the highlighted frame.';
    },
    reveal: () => {
      placements = Object.fromEntries(items.map((item) => [item.id, item.scope]));
      selectedItem = null;
      refresh();
      return 'Solution shown: every item is in the correct frame.';
    },
    reset: () => {
      placements = {};
      selectedItem = null;
      refresh();
    },
    progress: () => items.filter((item) => placements[item.id] === item.scope).length / Math.max(1, items.length),
    focus: () => root.querySelector('.chip-bank button')?.focus(),
  };
}

// ---------------------------------------------------------------------------
// 8. Robot
// ---------------------------------------------------------------------------

const DIRS = [
  { x: 0, y: -1, label: 'north' },
  { x: 1, y: 0, label: 'east' },
  { x: 0, y: 1, label: 'south' },
  { x: -1, y: 0, label: 'west' },
];

const ROBOT_COMMANDS = {
  forward: { label: 'Forward', icon: '^', apply: (state) => ({ ...state, x: state.x + DIRS[state.dir].x, y: state.y + DIRS[state.dir].y }) },
  left: { label: 'Turn left', icon: '<', apply: (state) => ({ ...state, dir: (state.dir + 3) % 4 }) },
  right: { label: 'Turn right', icon: '>', apply: (state) => ({ ...state, dir: (state.dir + 1) % 4 }) },
};

const inGrid = (state, cols, rows, walls) =>
  state.x >= 0 && state.x < cols && state.y >= 0 && state.y < rows && !walls.some((wall) => wall.x === state.x && wall.y === state.y);

const simulateRobot = (start, program, cols, rows, walls) => {
  let state = { ...start };
  const path = [{ ...state }];
  for (const command of program) {
    const applied = ROBOT_COMMANDS[command]?.apply(state);
    if (!applied) continue;
    if (command === 'forward' && !inGrid(applied, cols, rows, walls)) {
      path.push({ ...state, blocked: true });
      break;
    }
    state = applied;
    path.push({ ...state });
  }
  return { state, path };
};

const robotBfs = (start, goal, cols, rows, walls) => {
  const key = (state) => `${state.x},${state.y},${state.dir}`;
  const queue = [{ ...start, moves: [] }];
  const seen = new Set([key(start)]);
  while (queue.length) {
    const current = queue.shift();
    if (current.x === goal.x && current.y === goal.y) return current.moves;
    for (const command of ['left', 'right', 'forward']) {
      const next = ROBOT_COMMANDS[command].apply(current);
      if (!inGrid(next, cols, rows, walls)) continue;
      const stateKey = key(next);
      if (seen.has(stateKey)) continue;
      seen.add(stateKey);
      queue.push({ ...next, moves: [...current.moves, command] });
    }
  }
  return [];
};

function renderRobot(root, payload, options) {
  const cols = Number(payload.cols) || 5;
  const rows = Number(payload.rows) || 4;
  const start = payload.start || { x: 0, y: rows - 1, dir: 1 };
  const goal = payload.goal || { x: cols - 1, y: 0 };
  const walls = payload.walls || [];
  const commands = payload.commands || ['forward', 'left', 'right'];
  let program = [];
  let last = simulateRobot(start, program, cols, rows, walls);

  const drawGrid = (simulated) => {
    const grid = el('div', { class: 'robot-grid', style: { '--cols': cols, '--rows': rows }, role: 'img', 'aria-label': 'Robot grid' });
    for (let y = 0; y < rows; y += 1) {
      for (let x = 0; x < cols; x += 1) {
        const wall = walls.some((entry) => entry.x === x && entry.y === y);
        const isGoal = goal.x === x && goal.y === y;
        const isRobot = simulated.state.x === x && simulated.state.y === y;
        const isTrail = simulated.path.some((entry) => entry.x === x && entry.y === y && !entry.blocked);
        grid.append(
          el(
            'span',
            {
              class: `robot-cell${wall ? ' is-wall' : ''}${isGoal ? ' is-goal' : ''}${isRobot ? ' is-robot' : ''}${isTrail ? ' is-trail' : ''}`,
              dataset: { x: String(x), y: String(y) },
            },
            wall ? el('span', { class: 'robot-wall', text: '▦' }) : isGoal ? el('span', { class: 'robot-goal', text: '★' }) : isRobot ? el('span', { class: 'robot-body', text: '◆' }) : '',
          ),
        );
      }
    }
    return grid;
  };

  const refresh = withRender(root, () => {
    last = simulateRobot(start, program, cols, rows, walls);
    root.append(
      el('div', { class: 'challenge-subhead' }, el('strong', { text: 'Robot grid' }), el('span', { text: `${program.length}/${payload.max || 12} commands` })),
      drawGrid(last),
      el('div', { class: 'challenge-subhead' }, el('strong', { text: 'Program' }), el('span', { text: 'Tap a command to append' })),
      el(
        'div',
        { class: 'robot-program', 'aria-label': 'Robot program' },
        program.length
          ? program.map((command, index) =>
              el(
                'button',
                {
                  type: 'button',
                  class: 'robot-command is-programmed',
                  title: 'Remove command',
                  onclick: () => {
                    program = program.filter((_, position) => position !== index);
                    refresh();
                  },
                },
                `${index + 1}. ${ROBOT_COMMANDS[command]?.icon || ''} ${ROBOT_COMMANDS[command]?.label || command}`,
              ),
            )
          : el('span', { class: 'challenge-empty', text: 'The program is empty. Add commands below.' }),
      ),
      el(
        'div',
        { class: 'chip-bank' },
        commands.map((command) =>
          chip(ROBOT_COMMANDS[command]?.label || command, {
            icon: ROBOT_COMMANDS[command]?.icon || '*',
            dataset: { command },
            onClick: () => {
              if (program.length >= (payload.max || 12)) return;
              program = [...program, command];
              refresh();
            },
          }),
        ),
      ),
      el('p', { class: 'challenge-help', text: `Goal: reach the star. The robot starts facing ${DIRS[start.dir]?.label || 'east'}.` }),
      progressBar(last.state.x === goal.x && last.state.y === goal.y ? 1 : Math.min(0.9, program.length / Math.max(1, payload.max || 12))),
    );
  });

  return {
    root,
    checkLabel: 'Run program',
    read: () => ({ program: [...program], simulation: simulateRobot(start, program, cols, rows, walls) }),
    refresh,
    check: () => {
      const result = simulateRobot(start, program, cols, rows, walls);
      last = result;
      refresh();
      return result.state.x === goal.x && result.state.y === goal.y;
    },
    hint: () => {
      const current = simulateRobot(start, program, cols, rows, walls);
      const next = robotBfs(current.state, goal, cols, rows, walls)[0];
      if (!next) return 'The robot can already reach the goal.';
      root.querySelector(`[data-command="${next}"]`)?.classList.add('hint-target');
      return `Hint: try “${ROBOT_COMMANDS[next]?.label || next}” next.`;
    },
    reveal: () => {
      program = robotBfs(start, goal, cols, rows, walls);
      refresh();
      return 'Solution shown: the command tape reaches the goal.';
    },
    reset: () => {
      program = [];
      refresh();
    },
    progress: () => {
      const result = simulateRobot(start, program, cols, rows, walls);
      return result.state.x === goal.x && result.state.y === goal.y ? 1 : Math.min(0.9, program.length / Math.max(1, payload.max || 12));
    },
    focus: () => root.querySelector('.chip-bank button')?.focus(),
  };
}

// ---------------------------------------------------------------------------
// 9. Match
// ---------------------------------------------------------------------------

function renderMatch(root, payload, options) {
  const left = payload.left || [];
  const right = payload.right || [];
  const answer = payload.answer || {};
  const random = rng((options.seed ?? 1) ^ 0x6a09e667);
  let rightOrder = shuffle(right, random);
  let matched = new Set();
  let selectedLeft = null;
  let wrongPair = null;

  const refresh = withRender(root, () => {
    root.append(
      el('div', { class: 'challenge-subhead' }, el('strong', { text: 'Match the pairs' }), el('span', { text: `${matched.size / 2}/${Object.keys(answer).length} locked` })),
      el(
        'div',
        { class: 'match-grid' },
        el(
          'div',
          { class: 'match-column' },
          left.map((item) =>
            el(
              'button',
              {
                type: 'button',
                class: `match-card match-left${matched.has(item.id) ? ' is-matched' : ''}${selectedLeft === item.id ? ' is-selected' : ''}`,
                dataset: { left: item.id },
                disabled: matched.has(item.id),
                onclick: () => {
                  selectedLeft = selectedLeft === item.id ? null : item.id;
                  wrongPair = null;
                  refresh();
                },
              },
              item.text,
            ),
          ),
        ),
        el(
          'div',
          { class: 'match-column' },
          rightOrder.map((item) =>
            el(
              'button',
              {
                type: 'button',
                class: `match-card match-right${matched.has(item.id) ? ' is-matched' : ''}${wrongPair?.right === item.id ? ' is-wrong' : ''}`,
                dataset: { right: item.id },
                disabled: matched.has(item.id),
                onclick: () => {
                  if (!selectedLeft) return;
                  const leftId = selectedLeft;
                  if (answer[leftId] === item.id) {
                    matched.add(leftId);
                    matched.add(item.id);
                    selectedLeft = null;
                    wrongPair = null;
                  } else {
                    wrongPair = { left: leftId, right: item.id };
                    selectedLeft = null;
                  }
                  refresh();
                },
              },
              item.text,
            ),
          ),
        ),
      ),
      el('p', { class: 'challenge-help', text: 'Tap a left card, then its partner on the right. Correct pairs lock.' }),
      progressBar(matched.size / Math.max(1, Object.keys(answer).length * 2)),
    );
  });

  return {
    root,
    checkLabel: 'Check matches',
    read: () => ({ pairs: Object.entries(answer).filter(([leftId]) => matched.has(leftId)) }),
    refresh,
    check: () => Object.entries(answer).every(([leftId, rightId]) => matched.has(leftId) && matched.has(rightId)),
    hint: () => {
      const pair = Object.entries(answer).find(([leftId]) => !matched.has(leftId));
      if (!pair) return 'Every pair is locked.';
      const [leftId, rightId] = pair;
      matched.add(leftId);
      matched.add(rightId);
      refresh();
      return 'Hint: one correct pair has been locked for you.';
    },
    reveal: () => {
      matched = new Set();
      for (const [leftId, rightId] of Object.entries(answer)) {
        matched.add(leftId);
        matched.add(rightId);
      }
      selectedLeft = null;
      wrongPair = null;
      refresh();
      return 'Solution shown: every pair is locked.';
    },
    reset: () => {
      matched = new Set();
      selectedLeft = null;
      wrongPair = null;
      rightOrder = shuffle(right, rng((options.seed ?? 1) ^ 0x6a09e667));
      refresh();
    },
    progress: () => matched.size / Math.max(1, Object.keys(answer).length * 2),
    focus: () => root.querySelector('.match-left')?.focus(),
  };
}

// ---------------------------------------------------------------------------
// 10. Repair
// ---------------------------------------------------------------------------

const blankPattern = /\{\{([a-zA-Z0-9_-]+)\}\}/g;

function renderRepair(root, payload, options) {
  const blanks = payload.blanks || [];
  const byId = new Map(blanks.map((blank) => [blank.id, blank]));
  const bank = (payload.bank || []).map((item) => (typeof item === 'string' ? { id: item, text: item } : item));
  const byToken = new Map(bank.map((item) => [item.id, item]));
  const random = rng((options.seed ?? 1) ^ 0x1b873593);
  const shuffledBank = shuffle(bank, random);
  let state = {};
  let selectedBlank = null;
  let selectedToken = null;

  const renderLines = () => {
    const wrapper = el('div', { class: 'challenge-code repair-code', role: 'group', 'aria-label': 'Program with blanks' });
    for (const [lineIndex, line] of (payload.lines || []).entries()) {
      const code = el('code');
      let cursor = 0;
      for (const match of line.matchAll(blankPattern)) {
        if (match.index > cursor) code.append(line.slice(cursor, match.index));
        const blankId = match[1];
        const tokenId = state[blankId];
        const button = el(
          'button',
          {
            type: 'button',
            class: `repair-blank${tokenId ? ' is-filled' : ''}${selectedBlank === blankId ? ' is-selected' : ''}`,
            dataset: { blank: blankId },
            onclick: () => {
              if (tokenId) {
                delete state[blankId];
                selectedBlank = null;
                selectedToken = null;
              } else {
                if (selectedToken) {
                  state[blankId] = selectedToken;
                  selectedBlank = null;
                  selectedToken = null;
                } else {
                  selectedBlank = blankId;
                }
              }
              refresh();
            },
          },
          tokenId ? byToken.get(tokenId)?.text || '?' : byId.get(blankId)?.label || '____',
        );
        code.append(button);
        cursor = match.index + match[0].length;
      }
      if (cursor < line.length) code.append(line.slice(cursor));
      wrapper.append(
        el('div', { class: 'code-line' }, el('span', { class: 'code-number', text: String(lineIndex + 1).padStart(2, '0') }), code),
      );
    }
    return wrapper;
  };

  const refresh = withRender(root, () => {
    const used = new Set(Object.values(state).filter(Boolean));
    const available = shuffledBank.filter((item) => !used.has(item.id));
    root.append(
      el('div', { class: 'challenge-subhead' }, el('strong', { text: 'Broken build' }), el('span', { text: `${Object.keys(state).length}/${blanks.length} blanks` })),
      renderLines(),
      el('div', { class: 'challenge-subhead' }, el('strong', { text: 'Token bank' }), el('span', { text: 'Tap a token, then a blank' })),
      el(
        'div',
        { class: 'chip-bank' },
        available.length
          ? available.map((item) =>
              chip(item.text, {
                className: selectedToken === item.id ? 'is-selected' : '',
                dataset: { item: item.id },
                onClick: () => {
                  if (selectedBlank) {
                    state[selectedBlank] = item.id;
                    selectedBlank = null;
                    selectedToken = null;
                  } else {
                    selectedToken = selectedToken === item.id ? null : item.id;
                  }
                  refresh();
                },
              }),
            )
          : el('p', { class: 'challenge-empty', text: 'All tokens are placed.' }),
      ),
      progressBar(Object.keys(state).length / Math.max(1, blanks.length)),
    );
  });

  return {
    root,
    checkLabel: 'Check repair',
    read: () => ({ values: { ...state } }),
    refresh,
    check: () => blanks.every((blank) => state[blank.id] != null && byToken.get(state[blank.id])?.text === byToken.get(blank.answer)?.text),
    hint: () => {
      const blank = blanks.find((entry) => state[entry.id] !== entry.answer);
      if (!blank) return 'The program is already repaired.';
      const token = byToken.get(blank.answer);
      root.querySelector(`[data-blank="${blank.id}"]`)?.classList.add('hint-target');
      root.querySelector(`[data-item="${token?.id || ''}"]`)?.classList.add('hint-target');
      return 'Hint: the highlighted token fills the highlighted blank.';
    },
    reveal: () => {
      state = Object.fromEntries(blanks.map((blank) => [blank.id, blank.answer]));
      selectedBlank = null;
      selectedToken = null;
      refresh();
      return 'Solution shown: every blank is filled correctly.';
    },
    reset: () => {
      state = {};
      selectedBlank = null;
      selectedToken = null;
      refresh();
    },
    progress: () => Object.keys(state).length / Math.max(1, blanks.length),
    focus: () => root.querySelector('.repair-blank')?.focus(),
  };
}

// ---------------------------------------------------------------------------
// 11. Trace
// ---------------------------------------------------------------------------

function renderTrace(root, payload, options) {
  const answer = String(payload.answer ?? '');
  let value = '';
  let input;
  let flashTimer = null;

  const refresh = withRender(root, () => {
    clearTimeout(flashTimer);
    input = el('input', {
      type: 'text',
      class: 'trace-input',
      autocomplete: 'off',
      spellcheck: 'false',
      placeholder: payload.placeholder || 'type the output',
      value,
      'aria-label': payload.prompt || 'Your answer',
      oninput: (event) => {
        value = event.target.value;
      },
    });
    root.append(
      payload.code?.length ? lineList(payload.code, { label: 'Program' }) : null,
      payload.input ? el('p', { class: 'trace-input-line' }, el('span', { text: 'Input: ' }), el('code', { text: payload.input })) : null,
      el('p', { class: 'trace-question', text: payload.prompt || 'What does the program output?' }),
      el('label', { class: 'trace-field' }, el('span', { text: payload.label || 'Output' }), input),
      el('p', { class: 'challenge-help', text: 'Type the exact value. Spaces and letter case are ignored.' }),
      progressBar(value.trim() ? 1 : 0),
    );
    if (payload.flash) {
      const hintBox = el('p', { class: 'trace-flash', text: `Memorise: ${answer}` });
      root.append(hintBox);
      clearTimeout(flashTimer);
      flashTimer = setTimeout(() => {
        hintBox.classList.add('is-hidden');
        hintBox.textContent = 'The flash is gone. Reconstruct it from the code.';
        flashTimer = null;
      }, 2600);
    }
  });

  return {
    root,
    checkLabel: 'Check output',
    read: () => ({ value }),
    refresh,
    check: () => {
      if (payload.numeric) {
        const expected = numeric(answer);
        const actual = numeric(value);
        return expected != null && actual != null && Math.abs(expected - actual) < 1e-6;
      }
      const accepted = [answer, ...(payload.accept || [])].map(normalize);
      return accepted.includes(normalize(value));
    },
    hint: () => payload.hint || 'Hint: follow each assignment in order and write down the value after it changes.',
    reveal: () => {
      value = answer;
      refresh();
      return 'Solution shown: the expected answer is in the field.';
    },
    reset: () => {
      value = '';
      refresh();
    },
    destroy: () => {
      clearTimeout(flashTimer);
      flashTimer = null;
    },
    progress: () => (value.trim() ? 1 : 0),
    focus: () => input?.focus(),
  };
}

// ---------------------------------------------------------------------------
// 12. Simulate
// ---------------------------------------------------------------------------

function renderSimulate(root, payload, options) {
  const code = payload.code || [];
  const variables = payload.variables || [];
  const steps = payload.steps || [];
  const ask = payload.ask || variables;
  let step = 0;
  let inputs = {};
  let fields = new Map();

  const currentState = () => {
    if (!steps.length) return {};
    return steps[Math.min(step, steps.length - 1)]?.state || {};
  };

  const refresh = withRender(root, () => {
    const state = currentState();
    const activeLine = steps[Math.min(step, steps.length - 1)]?.line;
    root.append(
      el('div', { class: 'challenge-subhead' }, el('strong', { text: 'Execution machine' }), el('span', { text: `step ${step}/${steps.length}` })),
      lineList(code, { label: 'Program', active: activeLine }),
      el(
        'div',
        { class: 'sim-controls' },
        action('Step', () => {
          step = Math.min(steps.length, step + 1);
          refresh();
        }, 'is-accent'),
        action('Reset steps', () => {
          step = 0;
          refresh();
        }),
      ),
      el(
        'div',
        { class: 'variable-table', role: 'table', 'aria-label': 'Variable state' },
        el('div', { class: 'variable-row variable-head', role: 'row' }, el('span', { role: 'columnheader', text: 'Variable' }), el('span', { role: 'columnheader', text: 'Current value' })),
        variables.map((name) =>
          el(
            'div',
            { class: 'variable-row', role: 'row' },
            el('span', { role: 'cell', text: name }),
            el('code', { role: 'cell', text: state[name] == null ? '—' : String(state[name]) }),
          ),
        ),
      ),
      el('div', { class: 'challenge-subhead' }, el('strong', { text: 'Commit final state' }), el('span', { text: 'Type the values after the last step' })),
      el(
        'div',
        { class: 'sim-answers' },
        ask.map((name) => {
          const field = el('input', {
            type: 'text',
            class: 'trace-input',
            autocomplete: 'off',
            spellcheck: 'false',
            value: inputs[name] || '',
            'aria-label': `Final value of ${name}`,
            oninput: (event) => {
              inputs[name] = event.target.value;
            },
          });
          fields.set(name, field);
          return el('label', { class: 'trace-field' }, el('span', { text: `${name} =` }), field);
        }),
      ),
      el('p', { class: 'challenge-help', text: 'Use Step to execute the program, then commit the final values.' }),
      progressBar(step / Math.max(1, steps.length)),
    );
  });

  return {
    root,
    checkLabel: 'Commit state',
    read: () => ({ step, inputs: { ...inputs }, machine: { ...currentState() } }),
    refresh,
    check: () => ask.every((name) => normalize(inputs[name]) === normalize(payload.answer?.[name])),
    hint: () => {
      if (step < steps.length) {
        step += 1;
        refresh();
        return `Hint: the machine advanced to step ${step} of ${steps.length}.`;
      }
      return payload.hint || 'Hint: the final state is shown after the last assignment.';
    },
    reveal: () => {
      step = steps.length;
      inputs = { ...(payload.answer || {}) };
      refresh();
      return 'Solution shown: the machine is at the final step with the expected values.';
    },
    reset: () => {
      step = 0;
      inputs = {};
      refresh();
    },
    progress: () => step / Math.max(1, steps.length),
    focus: () => fields.values().next().value?.focus(),
  };
}

const RENDERERS = {
  order: renderOrder,
  assemble: renderAssemble,
  flow: renderFlow,
  vars: renderVars,
  sort: renderSort,
  bug: renderBug,
  scope: renderScope,
  robot: renderRobot,
  match: renderMatch,
  repair: renderRepair,
  trace: renderTrace,
  simulate: renderSimulate,
};

export function renderChallenge(type, payload, options = {}) {
  const renderer = RENDERERS[type];
  if (!renderer) throw new Error(`Unknown challenge type: ${type}`);
  const root = el('div', { class: `challenge-body challenge-${type}`, dataset: { challengeType: type } });
  return renderer(root, payload || {}, options);
}

// ---------------------------------------------------------------------------
// Classic-track adapters
// ---------------------------------------------------------------------------

const words = (value) =>
  String(value || '')
    .split(/\s+/)
    .map((word) => word.trim())
    .filter(Boolean);

const tokenize = (value) => {
  const tokens = String(value || '').match(/[A-Za-z_][A-Za-z0-9_]*|\d+(?:\.\d+)?|==|!=|<=|>=|\+\+|--|&&|\|\||[^\sA-Za-z0-9_]/g);
  return tokens && tokens.length ? tokens : words(value);
};

const unique = (items) => [...new Set(items)];

const answerPieces = (answer) => {
  const wordPieces = words(answer);
  if (wordPieces.length >= 2) return { mode: 'words', pieces: wordPieces };
  const letterPieces = Array.from(String(answer || '')).filter((char) => char.trim().length > 0);
  return { mode: 'letters', pieces: letterPieces };
};

const chunkPieces = (answer, size = 3) => {
  const letters = Array.from(String(answer || '')).filter((char) => char.trim().length > 0);
  if (letters.length <= size) return letters;
  const chunks = [];
  for (let index = 0; index < letters.length; index += size) {
    chunks.push(letters.slice(index, index + size).join(''));
  }
  return chunks;
};

/**
 * Turn one classic multiple-choice question into a non-MC challenge.
 * The classic track has only prompt/options/answer/explanation, so the
 * adapter deliberately uses six interaction primitives and two presentation
 * variants. The CP1 track uses the full twelve purpose-built engines.
 */
export function buildAdaptiveChallenge(question, type, options = {}) {
  const answer = question.options[question.answer];
  const decoys = question.options.filter((_, index) => index !== question.answer);
  const seed = options.seed ?? 1;

  if (type === 'order' || type === 'speed') {
    const { mode, pieces } = answerPieces(answer);
    if (pieces.length < 2) {
      return {
        type: 'trace',
        title: 'Type the answer',
        prompt: question.prompt,
        instruction: 'Type the key idea from memory.',
        payload: { prompt: question.prompt, answer, accept: [], hint: question.explanation, placeholder: 'type the answer' },
        explanation: question.explanation,
        source: question,
      };
    }
    const items = pieces.map((text, index) => ({ id: `w${index}`, text }));
    return {
      type: 'order',
      title: type === 'speed' ? 'Quick order' : mode === 'letters' ? 'Spell the answer' : 'Order the words',
      prompt: question.prompt,
      instruction:
        mode === 'letters'
          ? 'Rebuild the correct answer one letter at a time.'
          : 'Tap the words in the right order to rebuild the answer.',
      payload: { items, answer: items.map((item) => item.id) },
      explanation: question.explanation,
      adaptive: { kind: type, timer: type === 'speed' ? 30 : 0 },
      source: question,
    };
  }

  if (type === 'assemble' || type === 'tokens') {
    const { mode, pieces: wordPieces } = answerPieces(answer);
    const pieces = mode === 'words' ? wordPieces : chunkPieces(answer);
    if (pieces.length < 2) {
      return buildAdaptiveChallenge(question, 'order', options);
    }
    const decoySource = decoys.flatMap((option) => (mode === 'words' ? words(option) : chunkPieces(option)));
    const decoysTokens = unique(decoySource).filter((token) => !pieces.includes(token)).slice(0, 3);
    const bank = [...pieces, ...decoysTokens].map((text, index) => ({ id: `t${index}`, text }));
    const answerIds = bank.slice(0, pieces.length).map((item) => item.id);
    return {
      type: 'assemble',
      title: mode === 'words' ? 'Assemble the answer' : 'Assemble the spelling',
      prompt: question.prompt,
      instruction: 'Build the answer from the token bank. Some tokens are decoys.',
      payload: { bank, slots: answerIds.map((_, index) => ({ id: `s${index}` })), answer: answerIds },
      explanation: question.explanation,
      adaptive: { kind: type },
      source: question,
    };
  }

  if (type === 'repair' || type === 'blanks') {
    const { mode, pieces: wordPieces } = answerPieces(answer);
    const pieces = mode === 'words' ? wordPieces : chunkPieces(answer, 2);
    if (pieces.length < 2) {
      return buildAdaptiveChallenge(question, 'assemble', options);
    }
    const keep = pieces.map((text, index) => (index % 2 === 0 ? `{{b${index}}}` : text));
    const blanks = pieces
      .map((text, index) => ({ id: `b${index}`, label: `${mode === 'words' ? 'word' : 'chunk'} ${index + 1}`, answer: text }))
      .filter((_, index) => index % 2 === 0);
    const bank = [
      ...blanks.map((blank, index) => ({ id: `r${index}`, text: blank.answer })),
      ...unique(decoys.flatMap((option) => (mode === 'words' ? words(option) : chunkPieces(option, 2))))
        .filter((token) => !pieces.includes(token))
        .slice(0, 2)
        .map((text, index) => ({ id: `d${index}`, text })),
    ];
    const answerForBlank = Object.fromEntries(
      blanks.map((blank, index) => [blank.id, bank[index].id]),
    );
    return {
      type: 'repair',
      title: mode === 'words' ? 'Repair the answer' : 'Repair the spelling',
      prompt: question.prompt,
      instruction: 'Fill the missing pieces of the correct answer.',
      payload: { lines: [keep.join(mode === 'words' ? ' ' : '')], blanks: blanks.map(blank => ({ ...blank, answer: answerForBlank[blank.id] })), bank, answer: answerForBlank },
      explanation: question.explanation,
      adaptive: { kind: type },
      source: question,
    };
  }

  if (type === 'sort' || type === 'scope') {
    return {
      type: 'sort',
      title: 'Sort the candidates',
      prompt: question.prompt,
      instruction: 'Sort every candidate into “fits the answer” or “does not fit”.',
      payload: {
        bins: [
          { id: 'yes', label: 'Fits the answer', desc: 'This statement is correct.' },
          { id: 'no', label: 'Does not fit', desc: 'This statement is a distractor.' },
        ],
        items: question.options.map((text, index) => ({
          id: `o${index}`,
          text,
          bin: index === question.answer ? 'yes' : 'no',
        })),
      },
      explanation: question.explanation,
      adaptive: { kind: type },
      source: question,
    };
  }

  if (type === 'match' || type === 'memory') {
    return {
      type: 'trace',
      title: type === 'memory' ? 'Recall the answer' : 'Type the answer',
      prompt: question.prompt,
      instruction: type === 'memory' ? 'The answer flashes for a moment. Rebuild it from memory.' : 'Type the key answer from memory.',
      payload: {
        prompt: question.prompt,
        answer,
        accept: [answer.replace(/[.!?]+$/, '')],
        hint: question.explanation,
        flash: type === 'memory',
        placeholder: 'type the answer',
      },
      explanation: question.explanation,
      adaptive: { kind: type },
      source: question,
    };
  }

  if (type === 'trace' || type === 'type') {
    return {
      type: 'trace',
      title: 'Type the answer',
      prompt: question.prompt,
      instruction: 'Type the key answer. This is recall, not a button choice.',
      payload: {
        prompt: question.prompt,
        answer,
        accept: [answer.replace(/[.!?]+$/, '')],
        hint: question.explanation,
        placeholder: 'type the answer',
        numeric: /^-?\d+(?:\.\d+)?$/.test(answer.trim()),
      },
      explanation: question.explanation,
      adaptive: { kind: type },
      source: question,
    };
  }

  // Unknown adapter type: use a safe ordering transform.
  return buildAdaptiveChallenge(question, 'order', options);
}

export const CLASSIC_MECHANICS = ['order', 'assemble', 'repair', 'sort', 'match', 'trace', 'speed', 'tokens', 'blanks', 'memory'];
