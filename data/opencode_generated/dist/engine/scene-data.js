// Pure scene data for the shared LogiCade runtime.
//
// This module has no DOM or Phaser dependency, so the browser runtime and the
// Node generators can use the same theme mapping. It chooses art from the
// local Kenney theme packs and turns a variation config into a small scene
// model: background, floor tile, hero, goal, enemy, collectible, and props.
//
// Asset IDs resolve through public/data/asset_manifest.json at runtime. The
// helpers here only describe *which* local asset to use, never a remote URL.

export const THEME_LABELS = {
  space: 'Space',
  underwater: 'Underwater',
  pirate: 'Pirate',
  farm: 'Farm',
  food: 'Kitchen',
  urban: 'City',
  tower_defense: 'Defense',
};

export const THEME_ORDER = Object.keys(THEME_LABELS);

// The seven art packs are spread across the thirteen CP1 units. Units that
// share a theme still rotate backgrounds, heroes, and enemies by concept and
// lab index, so no two neighbouring sets look identical.
export const CP1_UNIT_THEMES = {
  Flowcharting: 'space',
  Algorithms: 'underwater',
  'C Introduction': 'tower_defense',
  'C Components': 'pirate',
  'C Structure': 'farm',
  Variables: 'food',
  Scope: 'underwater',
  Operators: 'space',
  Conditionals: 'pirate',
  Loops: 'farm',
  Arrays: 'food',
  Functions: 'tower_defense',
  Debugging: 'urban',
};

// Keep this table in sync with scripts/theme-data.mjs. It is intentionally
// duplicated rather than imported so the browser never downloads the build
// tooling or the vendor source map.
export const THEME_LOOKS = {
  space: {
    backgrounds: ['bg_black', 'bg_blue', 'bg_dark_purple', 'bg_purple'],
    tiles: ['tile_blue', 'tile_purple', 'tile_steel'],
    players: ['player_blue', 'player_green', 'player_orange', 'player_red'],
    enemies: ['enemy_blue', 'enemy_green', 'enemy_red', 'enemy_black'],
    coins: ['coin_blue', 'coin_green', 'coin_red', 'coin_yellow'],
    goals: ['goal_blue', 'goal_green', 'goal_red', 'goal_yellow'],
    obstacles: {
      spike: ['meteor_grey_big', 'meteor_brown_small', 'meteor_grey_med', 'meteor_brown_big'],
      bush: ['meteor_brown_big', 'meteor_grey_big', 'meteor_brown_small', 'meteor_grey_med'],
      slime: ['meteor_grey_med', 'meteor_brown_small', 'meteor_brown_big', 'meteor_grey_big'],
      bee: ['meteor_brown_small', 'meteor_grey_med', 'meteor_grey_big', 'meteor_brown_big'],
    },
    followers: ['follower'],
  },
  underwater: {
    backgrounds: ['bg_reef_1', 'bg_reef_2', 'bg_reef_3'],
    tiles: ['tile_sand', 'tile_dirt'],
    players: ['player_blue', 'player_green', 'player_orange', 'player_pink'],
    enemies: ['enemy_red', 'enemy_grey_long', 'enemy_grey', 'enemy_brown'],
    coins: ['coin_bubble_a', 'coin_bubble_b', 'coin_bubble_c'],
    goals: ['goal_chest_gold', 'goal_chest_pearl'],
    obstacles: {
      spike: ['rock_a', 'rock_b', 'seaweed_orange', 'seaweed_green'],
      bush: ['seaweed_green', 'seaweed_orange', 'rock_a', 'rock_b'],
      slime: ['rock_b', 'rock_a', 'seaweed_green', 'seaweed_orange'],
      bee: ['seaweed_orange', 'seaweed_green', 'rock_b', 'rock_a'],
    },
    followers: ['follower'],
  },
  pirate: {
    backgrounds: ['bg_sea_1', 'bg_sea_2', 'bg_sea_3'],
    tiles: ['tile_plank', 'tile_sand'],
    players: ['player_green', 'player_blue', 'player_red', 'player_yellow'],
    enemies: ['enemy_grey', 'enemy_shark', 'enemy_cross', 'enemy_x'],
    coins: ['coin_doubloon'],
    goals: ['goal_flag', 'goal_ship'],
    obstacles: {
      spike: ['cannonball', 'cannon', 'nest', 'fire'],
      bush: ['nest', 'fire', 'cannonball', 'cannon'],
      slime: ['cannon', 'cannonball', 'fire', 'nest'],
      bee: ['fire', 'nest', 'cannon', 'cannonball'],
    },
    followers: ['follower'],
  },
  farm: {
    backgrounds: ['bg_farm_1', 'bg_farm_2', 'bg_farm_3'],
    tiles: ['tile_soil', 'tile_grass'],
    players: ['player_pumpkin', 'player_jack'],
    enemies: ['enemy_can', 'enemy_sunflower', 'enemy_bucket', 'enemy_sprout'],
    coins: ['coin_tomato', 'coin_pumpkin'],
    goals: ['goal_tree'],
    obstacles: {
      spike: ['wheat', 'rock', 'fence', 'bush'],
      bush: ['fence', 'bush', 'wheat', 'rock'],
      slime: ['bush', 'wheat', 'rock', 'fence'],
      bee: ['sunflower', 'wheat', 'bush', 'fence'],
    },
    followers: ['follower'],
  },
  food: {
    backgrounds: ['bg_kitchen_1', 'bg_kitchen_2', 'bg_kitchen_3'],
    tiles: ['tile_floor', 'tile_checker'],
    players: ['player_chef', 'player_chef_alt'],
    enemies: ['enemy_fish', 'enemy_ketchup', 'enemy_can'],
    coins: ['coin_donut', 'coin_sprinkles', 'coin_cupcake'],
    goals: ['goal_cake'],
    obstacles: {
      spike: ['burger', 'fish', 'can', 'ketchup'],
      bush: ['can', 'burger', 'ketchup', 'fish'],
      slime: ['fish', 'ketchup', 'burger', 'can'],
      bee: ['ketchup', 'can', 'fish', 'burger'],
    },
    followers: ['follower'],
  },
  urban: {
    backgrounds: ['bg_city_day', 'bg_city_dusk', 'bg_city_night'],
    tiles: ['tile_grass', 'tile_sidewalk', 'tile_asphalt'],
    players: ['player_a', 'player_b', 'player_c', 'player_d'],
    enemies: ['enemy_a', 'enemy_b', 'enemy_c', 'enemy_d'],
    coins: ['coin_token'],
    goals: ['goal_door'],
    obstacles: {
      spike: ['barrier', 'tree', 'tree_b', 'barrier_b'],
      bush: ['tree', 'barrier', 'tree_b', 'barrier_b'],
      slime: ['barrier_b', 'tree_b', 'barrier', 'tree'],
      bee: ['tree_b', 'barrier_b', 'tree', 'barrier'],
    },
    followers: ['follower'],
  },
  tower_defense: {
    backgrounds: ['bg_td_1', 'bg_td_2', 'bg_td_3'],
    tiles: ['tile_grass', 'tile_grid'],
    players: ['player_rocket', 'player_rocket_alt'],
    enemies: ['enemy_turret_red', 'enemy_turret_grey', 'enemy_tank'],
    coins: ['coin_gold', 'coin_gem'],
    goals: ['goal_tower_green', 'goal_tower_blue'],
    obstacles: {
      spike: ['mine', 'rock', 'bush', 'crate'],
      bush: ['bush', 'crate', 'rock', 'mine'],
      slime: ['rock', 'mine', 'crate', 'bush'],
      bee: ['crate', 'bush', 'mine', 'rock'],
    },
    followers: ['follower'],
  },
};

// Showcase backgrounds for concept covers. The runtime still rotates every
// zone in a pack, but cards and heroes lead with a backdrop that has enough
// contrast for text. Space in particular defaults to bg_black for some labs;
// covers use a brighter nebula instead.
export const THEME_COVER_BACKGROUNDS = {
  space: 'bg_blue',
  underwater: 'bg_reef_2',
  pirate: 'bg_sea_2',
  farm: 'bg_farm_1',
  food: 'bg_kitchen_1',
  urban: 'bg_city_dusk',
  tower_defense: 'bg_td_3',
};

const LEGACY_OBSTACLES = {
  spike: 'tiles.spikes',
  bush: 'tiles.bush',
  slime: 'enemies.slime_rest',
  bee: 'enemies.bee_rest',
};

const positiveIndex = (value) => {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? Math.floor(number) : 1;
};

const rotate = (items, offset) => {
  if (!items.length) return [];
  const start = ((offset % items.length) + items.length) % items.length;
  return [...items.slice(start), ...items.slice(0, start)];
};

const themeId = (theme, name) => `themes.${theme}.${name}`;

const lookFor = (theme) => THEME_LOOKS[theme] || THEME_LOOKS.space;

export function themeForUnit(unit, fallback = 0) {
  return CP1_UNIT_THEMES[unit] || THEME_ORDER[Math.abs(Number(fallback) || 0) % THEME_ORDER.length];
}

/**
 * Build the scene asset set for one CP1 lab. The background rotates by concept
 * and lab; the hero/enemy/coin/goal choices rotate independently so adjacent
 * labs feel different even when they share a unit.
 */
export function cp1SceneAssets(concept, variation = {}) {
  const conceptNumber = positiveIndex(concept?.number);
  const labIndex = positiveIndex(variation?.index);
  const theme = themeForUnit(concept?.unit, conceptNumber);
  const look = lookFor(theme);
  const offset = conceptNumber * 11 + labIndex;

  const backgroundCycle = rotate(look.backgrounds, offset);
  const pick = (items, step = 0) =>
    items[((offset + step) % items.length + items.length) % items.length];
  const bg = backgroundCycle[0];
  const zones = backgroundCycle.map((name) => themeId(theme, name));

  return {
    theme,
    theme_label: THEME_LABELS[theme],
    bg: themeId(theme, bg),
    zones,
    tile: themeId(theme, pick(look.tiles, 1)),
    player: themeId(theme, pick(look.players, 2)),
    enemy: themeId(theme, pick(look.enemies, 3)),
    coin: themeId(theme, pick(look.coins, 1)),
    goal: themeId(theme, pick(look.goals, 2)),
    obstacles: {
      spike: themeId(theme, pick(look.obstacles.spike, 0)),
      bush: themeId(theme, pick(look.obstacles.bush, 1)),
      slime: themeId(theme, pick(look.obstacles.slime, 2)),
      bee: themeId(theme, pick(look.obstacles.bee, 3)),
    },
    follower: themeId(theme, pick(look.followers, 0)),
  };
}

/**
 * Scene model for a concept's featured cover (hero, hub card, catalog card).
 * It reuses the first lab's hero, enemy, coin, and goal, but leads with a
 * readable showcase background instead of a lab-specific rotation.
 */
export function cp1ConceptAssets(concept) {
  const variation = concept?.variations?.[0] || { index: 1 };
  const scene = cp1SceneAssets(concept, variation);
  const look = lookFor(scene.theme);
  const coverName = THEME_COVER_BACKGROUNDS[scene.theme] || look.backgrounds[0];
  const zones = [coverName, ...look.backgrounds.filter((name) => name !== coverName)];
  return {
    ...scene,
    bg: themeId(scene.theme, coverName),
    zones: zones.map((name) => themeId(scene.theme, name)),
  };
}

/**
 * Normalise a runtime variation config into a scene model. Classic variations
 * already carry a curated asset set; CP1 lab configs are generated with the
 * same shape. A legacy starter-pack variation still gets a usable scene.
 */
export function sceneForVariation(variation = {}) {
  const assets = variation.assets || {};
  const legacy = !assets.theme;
  const theme = assets.theme || (THEME_LOOKS[variation.theme] ? variation.theme : 'space');
  const look = lookFor(theme);

  const fallback = (id, index = 0) => {
    const values = look.players;
    const name = values[Math.abs(Number(index) || 0) % values.length];
    return themeId(theme, name);
  };

  if (legacy) {
    const player = `characters.${assets.player || 'green'}_idle`;
    const enemy = `enemies.${assets.enemy || 'slime'}_rest`;
    return {
      theme,
      themeLabel: assets.theme_label || THEME_LABELS[theme] || 'Starter',
      legacy: true,
      bg: assets.bg || themeId(theme, look.backgrounds[0]),
      zones: Array.isArray(assets.zones) && assets.zones.length ? assets.zones : [assets.bg].filter(Boolean),
      tile: assets.tile || 'tiles.grass',
      player,
      enemy,
      coin: assets.coin || 'tiles.coin',
      goal: assets.goal || 'tiles.flag',
      follower: 'characters.beige_idle',
      obstacles: {
        spike: assets.obstacles?.spike || LEGACY_OBSTACLES.spike,
        bush: assets.obstacles?.bush || LEGACY_OBSTACLES.bush,
        slime: assets.obstacles?.slime || LEGACY_OBSTACLES.slime,
        bee: assets.obstacles?.bee || LEGACY_OBSTACLES.bee,
      },
    };
  }

  const zones =
    Array.isArray(assets.zones) && assets.zones.length
      ? assets.zones.filter((id) => typeof id === 'string' && id)
      : [assets.bg].filter((id) => typeof id === 'string' && id);

  return {
    theme,
    themeLabel: assets.theme_label || THEME_LABELS[theme] || variation.theme_label || theme,
    legacy: false,
    bg: assets.bg || themeId(theme, look.backgrounds[0]),
    zones: zones.length ? zones : [themeId(theme, look.backgrounds[0])],
    tile: assets.tile || themeId(theme, look.tiles[0]),
    player: assets.player || fallback('player', variation.index),
    enemy: assets.enemy || themeId(theme, look.enemies[0]),
    coin: assets.coin || themeId(theme, look.coins[0]),
    goal: assets.goal || themeId(theme, look.goals[0]),
    follower: assets.follower || themeId(theme, look.followers[0]),
    obstacles: {
      spike: assets.obstacles?.spike || themeId(theme, look.obstacles.spike[0]),
      bush: assets.obstacles?.bush || themeId(theme, look.obstacles.bush[1]),
      slime: assets.obstacles?.slime || themeId(theme, look.obstacles.slime[2]),
      bee: assets.obstacles?.bee || themeId(theme, look.obstacles.bee[3]),
    },
  };
}

export function sceneAssetIds(scene) {
  if (!scene) return [];
  return [
    ...new Set(
      [
        scene.bg,
        ...(scene.zones || []),
        scene.tile,
        scene.player,
        scene.enemy,
        scene.coin,
        scene.goal,
        scene.follower,
        ...Object.values(scene.obstacles || {}),
      ].filter((id) => typeof id === 'string' && id.length > 0),
    ),
  ];
}

/**
 * Theme assets follow themes.<theme>.<name> and live at
 * assets/themes/<theme>/<name>.png. Keep this helper in sync with the manifest
 * path rule enforced by scripts/check.mjs.
 */
export function themeAssetPath(id) {
  if (typeof id !== 'string' || !id.startsWith('themes.')) return '';
  const [, theme, ...rest] = id.split('.');
  if (!theme || !rest.length) return '';
  return `assets/themes/${theme}/${rest.join('.')}.png`;
}

const coverForScene = (scene) => ({
  theme: scene.theme,
  theme_label: scene.theme_label,
  bg: themeAssetPath(scene.bg),
  player: themeAssetPath(scene.player),
  enemy: themeAssetPath(scene.enemy),
  coin: themeAssetPath(scene.coin),
});

export function cp1SceneCover(concept, variation) {
  return coverForScene(cp1SceneAssets(concept, variation));
}

/** Featured concept cover with the showcase background. */
export function cp1ConceptCover(concept) {
  return coverForScene(cp1ConceptAssets(concept));
}
