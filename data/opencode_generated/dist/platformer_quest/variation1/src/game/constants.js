export const WORLD = {
  width: 1280,
  height: 704,
  tile: 64,
  cols: 20,
  rows: 11,
};

export const COLORS = {
  navy: 0x1b2433,
  navyDeep: 0x0b1220,
  card: 0x141c2b,
  cardLight: 0x1d283b,
  stroke: 0x3a4a63,
  cream: 0xfff6e5,
  mint: 0x7ee2b8,
  mintDeep: 0x2f9e74,
  gold: 0xffcf5c,
  coral: 0xff6b81,
  skyTop: 0x7ddcff,
  skyBottom: 0xe6fbef,
  stone: 0x6d7f96,
  stoneDark: 0x2b3445,
  danger: 0xff5470,
};

export const DEPTH = {
  sky: -100,
  background: -90,
  farDecor: -80,
  ground: 5,
  grass: 6,
  platform: 8,
  wall: 9,
  door: 10,
  coin: 15,
  enemy: 16,
  gate: 18,
  player: 20,
  foreground: 25,
  label: 30,
  hud: 1000,
  panel: 2000,
  tutorial: 2200,
  modal: 2400,
};

export const GAME_ID = '01_platformer_quest';
export const VARIATION_ID = '01_platformer_quest_v01';

export const EVENTS = {
  started: 'game_started',
  question: 'question_answered',
  hint: 'hint_used',
  completed: 'activity_completed',
  over: 'game_over',
};
