(() => {
  'use strict';

  const ritchie = 'Dennis Ritchie, The Development of the C Language';
  const artifacts = [
    {
      id: 'punch', name: 'Punch Card', era: 'Early computer input', source: 'IBM, The Punched Card',
      history: 'Holes in fixed positions encoded data or characters. In many early computing installations, a programmer prepared a deck of cards and submitted it as a job.',
      connection: 'A missing or reordered card could change the submitted program. Interactive terminals later made it easier to edit a line and try again.',
      shape: '<path fill="#d7aa6a" stroke="#49321f" stroke-width="3" d="M9 18h92l12 10v47H9z"/><path stroke="#93653b" d="M15 31h92M15 68h92"/><path stroke="#3c291c" stroke-width="5" stroke-dasharray="3 4" d="M17 40h88M23 49h79M17 58h87"/><path stroke="#eed3a4" d="M16 23h83"/>',
    },
    {
      id: 'floppy', name: 'Floppy Disk', era: '1971 and after', source: 'Computer History Museum, The Storage Engine',
      history: 'IBM shipped its first floppy drive units in 1971. Removable magnetic disks later became a practical way to carry files, including source programs.',
      connection: 'The drawing shows a later square diskette. The medium stores programs, while the programming language describes what those programs do.',
      shape: '<path fill="#465a67" stroke="#1d2530" stroke-width="4" d="M26 10h61l10 10v61H26z"/><path fill="#a6aeac" d="M41 12h42v25H41z"/><path fill="#343e49" d="M65 14h13v20H65z"/><rect x="34" y="48" width="55" height="26" rx="3" fill="#d0b082"/><path stroke="#7b4539" d="M38 54h47M38 59h34"/>',
    },
    {
      id: 'bcpl', name: 'BCPL Binder', era: 'Before B and C', source: ritchie,
      history: 'Martin Richards designed BCPL. It influenced B, which Ken Thompson developed at Bell Labs. Dennis Ritchie later developed C from B.',
      connection: 'The family resemblance helps explain the order BCPL → B → C. C added a richer system of types as it evolved.',
      shape: '<path fill="#615241" stroke="#30251d" stroke-width="4" d="M25 13h62l10 10v54H25z"/><path stroke="#b99252" stroke-width="4" d="M30 17v56"/><rect x="38" y="28" width="48" height="28" rx="2" fill="#e1c18c"/><text x="62" y="47" text-anchor="middle" fill="#30251d" font-size="15" font-weight="bold">BCPL</text>',
    },
    {
      id: 'b-notes', name: 'B Language Notes', era: 'Early Unix development', source: ritchie,
      history: 'Ken Thompson’s B carried ideas from BCPL into early Unix development. B used a word-oriented model and did not have the richer type system introduced by C.',
      connection: 'The PDP-11 made the distinction between characters and machine words important. Types helped C express those distinctions.',
      shape: '<path fill="#a98459" stroke="#49321f" stroke-width="3" d="m26 21 65-4 7 54-63 8z"/><path fill="#d4b687" stroke="#795b3a" stroke-width="2" d="m17 15 68 6-5 55-68-6z"/><path stroke="#856441" d="m26 42 42 5m-43 2 44 5m-44 2 34 4"/><text x="46" y="40" fill="#3f2e25" font-size="21" font-weight="bold">B</text>',
    },
    {
      id: 'bell', name: 'Bell Labs File', era: '1969–1973', source: ritchie,
      history: 'Dennis Ritchie developed C at Bell Labs as Unix was taking shape. In his account, the most active period of C’s development was 1972.',
      connection: 'C grew alongside a real operating-system project. Work on Unix helped reveal where the language needed new types and tools.',
      shape: '<path fill="#b58448" stroke="#5d3c24" stroke-width="3" d="M12 24h39l8-8h39v61H12z"/><path fill="#d4a967" stroke="#74512f" stroke-width="2" d="M16 32h88l-9 44H12z"/><rect x="30" y="42" width="53" height="22" fill="#eccea2"/><text x="56" y="57" text-anchor="middle" fill="#4c3528" font-size="12" font-weight="bold">BELL LABS</text>',
    },
    {
      id: 'board', name: 'Computer Board', era: 'The PDP-11 era', source: ritchie,
      history: 'Early C development took place on the PDP-11. Its ability to address individual bytes made it useful to distinguish characters from full machine words.',
      connection: 'C supports high-level procedures while offering operations close to machine memory. Some courses call this “middle-level,” an informal teaching description.',
      shape: '<path fill="#516b50" stroke="#27372c" stroke-width="4" d="m11 29 88-12 11 46-89 15z"/><path fill="none" stroke="#c99b5a" stroke-width="2" d="m24 41 30-5 4 22 32-6M35 66l-4-18 55-7 8-12M19 35l53-7 4 12 24-5"/><path fill="#252b2c" stroke="#aaad95" d="m44 37 32-5 5 20-32 5z"/><path stroke="#d2bd77" stroke-width="4" stroke-dasharray="4 4" d="m28 75 62-10"/>',
    },
    {
      id: 'unix', name: 'Unix Manual', era: 'Early Unix', source: 'Dennis Ritchie, The Evolution of the Unix Time-sharing System',
      history: 'Early Unix was written in assembly. Much of its kernel was rewritten in C by 1973. C later helped Unix move to computers with different hardware.',
      connection: 'Portable code still depends on choices the programmer makes. Assumptions about machine sizes and system-specific behavior can require changes.',
      shape: '<path fill="#7e5242" stroke="#352823" stroke-width="4" d="M21 15h69v63H21q-7 0-7-7V23q0-8 7-8Z"/><path fill="#c4a979" d="M21 66h67v9H21z"/><path stroke="#b3865a" stroke-width="2" d="M25 19v43M32 24h47M32 56h47"/><text x="55" y="47" text-anchor="middle" fill="#e2bf82" font-size="16" font-weight="bold">UNIX</text>',
    },
    {
      id: 'book', name: 'C Programming Book', era: '1978', source: ritchie,
      history: 'Brian Kernighan and Dennis Ritchie published The C Programming Language in 1978. It gave programmers a widely used guide to C before the first formal standard.',
      connection: 'C is general purpose and procedural. Functions let a programmer break a task into steps. Assignments change program state as those steps run.',
      shape: '<path fill="#ab5d42" stroke="#492b22" stroke-width="4" d="m29 10 60 9-8 62-61-9z"/><path fill="#d8bd92" d="m22 64 60 9-2 6-60-9z"/><path stroke="#e5ac7c" d="m34 16 48 7-5 44-48-6z"/><text x="56" y="54" text-anchor="middle" fill="#edd19a" font-size="34" font-weight="bold">C</text>',
    },
    {
      id: 'compiler', name: 'Compiler Listing', era: 'From source to machine', source: ritchie,
      history: 'Ritchie wrote the first C compiler while developing the language from B. A compiler translates source into a form suitable for running on a target machine, often through an object file and linker.',
      connection: 'Successful compilation tells you the translator accepted the source. Run tests to check whether the program does what the problem requires.',
      shape: '<path fill="#e0c594" stroke="#705337" stroke-width="3" d="m18 16 83 2-4 56-84-2z"/><path stroke="#7f7359" stroke-width="3" stroke-dasharray="2 5" d="M22 24h74M19 66h73"/><path stroke="#5b6249" stroke-width="2" d="M31 35h55M31 42h39M37 49h49M37 56h28"/><path fill="#98533f" d="M22 32h5v28h-5z"/>',
    },
    {
      id: 'standard', name: 'C89 Standards Folder', era: '1989 and 1990', source: ritchie,
      history: 'ANSI adopted a standard for C in 1989. ISO published the international C standard in 1990. A shared specification helps programmers write code for different implementations.',
      connection: 'The standard defines language and library behavior. Portable programs still need care where the standard leaves details to an implementation.',
      shape: '<path fill="#667180" stroke="#2e3138" stroke-width="4" d="M19 16h78v62H19z"/><path stroke="#3d4754" stroke-width="6" d="M25 18v58"/><rect x="36" y="29" width="51" height="26" rx="2" fill="#cdb28a"/><text x="62" y="47" text-anchor="middle" fill="#373a42" font-size="17" font-weight="bold">C89</text>',
    },
  ];

  // Alternate physical records carry the same curriculum evidence as their matching catalog items.
  const alternates = [
    { id: 'card-deck', name: 'Punched Card Deck', shape: '<path fill="#8c6a48" stroke="#4c3829" stroke-width="3" d="m14 33 87-10 8 42-87 12z"/><path fill="#b49464" stroke="#5c4734" stroke-width="2" d="m15 28 87-10 7 41-88 12z"/><path stroke="#655034" stroke-width="4" stroke-dasharray="3 4" d="m23 36 75-9m-73 18 75-9m-73 18 75-9"/><path fill="none" stroke="#d2b991" stroke-width="3" d="m52 25 8 42 10-1-9-42"/>' },
    { id: 'disk-sleeve', name: 'Floppy Disk Sleeve', connection: 'The protective sleeve holds a floppy disk. The disk stores files, while a programming language describes what the programs in those files do.', shape: '<path fill="#8b7258" stroke="#342922" stroke-width="4" d="M23 17h70l8 57H17z"/><path fill="#454649" d="M31 11h52v36H31z"/><circle cx="57" cy="28" r="8" fill="#a29b89"/><path fill="#b3a07e" stroke="#62513f" stroke-width="2" d="M20 38h22l14 9 15-9h28v38H20z"/><path stroke="#786149" d="M33 59h51M33 65h30"/>' },
    { id: 'bcpl-printout', name: 'BCPL Printout', shape: '<path fill="#aaa484" stroke="#594d39" stroke-width="3" d="m16 23 91-7-4 54-88 7z"/><path stroke="#625841" stroke-width="3" stroke-dasharray="2 5" d="m20 30 81-7M20 69l79-7"/><path stroke="#686653" d="m31 47 57-5m-57 11 49-4m-49 10 36-4"/><text x="35" y="43" fill="#494331" font-size="13" font-family="monospace">BCPL</text>' },
    { id: 'b-notebook', name: 'B Pocket Notebook', shape: '<path fill="#928878" stroke="#403b36" stroke-width="3" d="M16 26q20-8 43 1 24-9 45-3l-4 46q-20-6-41 3-24-6-43 1z"/><path fill="#c5af88" d="M20 28q20-6 37 1v39q-20-6-37 0zm40 1q18-7 40-3l-3 39q-20-4-37 3z"/><path stroke="#8c7654" d="M69 41h22m-22 7h21m-21 7h18"/><text x="33" y="55" fill="#534836" font-size="22">B</text>' },
    { id: 'bell-badge', name: 'Bell Labs Badge', shape: '<path fill="none" stroke="#5c5848" stroke-width="5" d="M47 25q9-36 23 0"/><path fill="#90877a" stroke="#3f3b35" stroke-width="3" d="m25 23 69 3-4 48-69-4z"/><path fill="#c5b59d" d="m28 30 60 3-3 34-60-3z"/><path fill="#696458" d="M33 39h15v19H33z"/><text x="51" y="46" fill="#474539" font-size="7">BELL LABS</text><path stroke="#696458" d="M53 51h25m-25 5h22"/>' },
    { id: 'pdp-panel', name: 'PDP-11 Switch Panel', shape: '<path fill="#514b43" stroke="#292620" stroke-width="4" d="m10 29 98-4 4 36-99 6z"/><path fill="#79736a" d="m16 34 88-4 2 27-89 4z"/><path stroke="#4d3f34" stroke-width="6" stroke-dasharray="5 4" d="m34 51 59-3"/><path stroke="#ba8a57" stroke-width="4" stroke-dasharray="3 6" d="m35 45 59-3"/><text x="20" y="44" fill="#d1bd95" font-size="8">PDP-11</text>' },
    { id: 'unix-reel', name: 'Unix Tape Reel', shape: '<ellipse cx="60" cy="48" rx="45" ry="32" fill="#82786a" stroke="#352f29" stroke-width="4"/><ellipse cx="60" cy="47" rx="37" ry="26" fill="#aaa18c" stroke="#51473c" stroke-width="2"/><path fill="#514640" d="M35 45q2-12 17-15l4 14-11 9zm39-11q14 4 17 16l-15 4-10-9zM47 62l11-12 12 4 4 11q-14 5-27-3z"/><circle cx="60" cy="47" r="5" fill="#7e7462"/><text x="55" y="26" fill="#403830" font-size="9">UNIX</text>' },
    { id: 'c-index', name: 'C Reference Index', shape: '<path fill="#88745e" stroke="#493b31" stroke-width="3" d="m20 27 11-11 61 4 9 10-5 49-76-4z"/><path fill="#b29b74" stroke="#594931" stroke-width="2" d="m16 34 84 3-3 38-83-4z"/><path stroke="#776046" stroke-width="2" d="m26 45 63 3m-63 17 63 3"/><text x="58" y="63" text-anchor="middle" fill="#534435" font-size="15" font-weight="bold">C INDEX</text>' },
    { id: 'object-file', name: 'Object File Envelope', shape: '<path fill="#9b8464" stroke="#524330" stroke-width="3" d="m12 23 94-4 4 51-94 4z"/><path fill="#b49c76" stroke="#67563c" stroke-width="2" d="m13 24 47 27 45-30"/><path fill="#827354" d="m46 41 25-1 1 19-25 2z"/><text x="53" y="55" fill="#ded1a8" font-size="12">.o</text><path stroke="#79674b" d="m26 59 16 9m39-12 16 9"/>' },
    { id: 'standards-tab', name: 'C Standards Booklet', shape: '<path fill="#58616a" stroke="#31363b" stroke-width="4" d="m30 13 65 9-8 57-65-8z"/><path fill="#ac9f87" d="m30 62 58 8-1 6-58-8z"/><path fill="none" stroke="#a99f89" d="m38 21 49 7-6 32-49-6z"/><path fill="#90765a" d="m80 29 20 3-2 10-19-4z"/><text x="43" y="47" fill="#cfbd98" font-size="13">ANSI C</text>' },
  ];

  // Normalized scene coordinates, angle, relative size and light. Locations sit on clutter or furniture.
  const rooms = {
    room: { name: 'Private archive', spots: [
      [11, 9, -8, .92, .75], [20, 23, 5, .84, .72], [19, 55, -9, .92, .78],
      [28, 49, 11, .86, .69], [40, 30, -4, .9, .77], [49, 31, 6, .81, .76],
      [46, 44, -12, .93, .8], [62, 43, 8, .92, .77], [69, 47, -12, .9, .69],
      [79, 32, 4, .81, .71], [91, 53, -4, .94, .76], [92, 66, 7, .95, .71],
      [10, 65, -8, .95, .81], [16, 86, 14, 1.06, .79], [83, 68, -10, 1.06, .76],
    ] },
    stacks: { name: 'University stacks', spots: [
      [13, 29, 7, .88, .78], [28, 34, 12, .81, .68], [41, 22, -6, .82, .71],
      [49, 39, 4, .89, .77], [59, 34, -8, .86, .79], [69, 45, 8, .79, .68],
      [83, 28, -7, .79, .69], [93, 53, 6, .89, .72], [14, 52, 4, .96, .74],
      [23, 62, -13, .95, .77], [7, 75, 9, 1.04, .75], [37, 67, -11, 1, .81],
      [55, 66, 7, .94, .83], [73, 69, -10, 1.04, .86], [90, 85, 11, 1.04, .77],
    ] },
    workbench: { name: 'Electronics workshop', spots: [
      [24, 15, 6, .82, .74], [33, 17, -8, .84, .81], [46, 19, 5, .81, .75],
      [24, 36, -11, .8, .71], [30, 46, -5, .88, .78], [50, 47, 6, .87, .8],
      [62, 45, -14, .89, .77], [77, 43, 5, .9, .73], [91, 32, 3, .85, .74],
      [93, 53, -9, .97, .83], [11, 49, 4, .91, .85], [10, 69, 12, 1.04, .83],
      [41, 57, -7, .92, .7], [54, 57, 9, .93, .74], [83, 75, -7, 1.01, .72],
    ] },
    store: { name: 'Museum collections depot', spots: [
      [20, 7, 11, .81, .69], [28, 13, -6, .8, .71], [9, 31, 5, .9, .75],
      [22, 44, -7, .93, .78], [33, 47, 8, .81, .75], [53, 46, -8, .83, .74],
      [66, 19, 3, .82, .66], [74, 35, -6, .83, .76], [84, 39, 8, .86, .78],
      [94, 49, -8, .91, .77], [76, 60, 13, .98, .82], [68, 69, -7, 1.03, .86],
      [47, 67, 6, .98, .83], [30, 60, -11, .95, .78], [9, 68, 9, 1.04, .79],
    ] },
  };

  const cases = [
    ['room', 'brass', 0b0101001001], ['stacks', 'ledger', 0b0010110100],
    ['workbench', 'steel', 0b1010000011], ['store', 'leather', 0b0001011100],
    ['stacks', 'brass', 0b0100101010], ['room', 'leather', 0b1110000001],
    ['store', 'ledger', 0b1001010100], ['workbench', 'brass', 0b0010101001],
    ['room', 'steel', 0b0110000110], ['stacks', 'leather', 0b0001110010],
  ];
  const search = {
    need_support: { size: 1.12, light: 1.14, occlusion: 0 },
    standard: { size: 1, light: 1, occlusion: 1 },
    advanced: { size: .88, light: .87, occlusion: 2 },
  };

  function layout(game) {
    const trial = Math.max(1, Number(game.trial) || 1);
    const [roomId, frame, mask] = cases[(trial - 1) % cases.length];
    const room = rooms[roomId];
    const archiveLevel = game.source_week === 4 ? game.source_level : game.level;
    const scene = globalThis.LogiCadeArchiveRooms?.[archiveLevel]?.[trial - 1];
    const fallbackBackground = '/canvas-runtime/assets/archive/' + roomId + '.webp';
    const difficulty = String(game.difficulty).toLowerCase();
    const tuning = difficulty.startsWith('need') ? search.need_support
      : difficulty.startsWith('advance') ? search.advanced : search.standard;
    const positions = (scene?.spots ?? room.spots).slice();
    let state = (Number(game.seed) >>> 0) || 1;
    for (let i = positions.length - 1; i > 0; i--) {
      state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
      const j = Math.floor(state / 4294967296 * (i + 1));
      [positions[i], positions[j]] = [positions[j], positions[i]];
    }
    const usedSlots = new Set();
    return {
      room: scene?.name ?? room.name, frame, background: scene?.background ?? fallbackBackground, fallbackBackground,
      artifacts: (game.archive_evidence ?? Array(5).fill(null)).map((record, i) => {
        const preferred = artifacts.findIndex(artifact => artifact.id === record?.art);
        let slot = preferred >= 0 ? preferred : (trial + 2 * (Number(game.level) || 1) + i * 3) % artifacts.length;
        while (usedSlots.has(slot)) slot = (slot + 1) % artifacts.length;
        usedSlots.add(slot);
        const artwork = mask & (1 << slot) ? { ...artifacts[slot], ...alternates[slot] } : artifacts[slot];
        return {
          ...artwork,
          ...(record ? { ...record, connection: record.connection } : {}),
          position: positions[i],
          concealment: i % 3 < tuning.occlusion ? (i % 2 ? 'left' : 'lower') : 'none',
        };
      }),
      tuning,
    };
  }

  globalThis.LogiCadeArchiveArtifacts = { layout };
})();
