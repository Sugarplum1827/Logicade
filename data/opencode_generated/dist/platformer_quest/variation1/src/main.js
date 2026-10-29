import * as Phaser from '../vendor/phaser.esm.min.js';
import { LEVEL_CONFIG } from './data/levelConfig.js';
import { WORLD } from './game/constants.js';
import { BootScene } from './game/scenes/BootScene.js';
import { PreloadScene } from './game/scenes/PreloadScene.js';
import { GameScene } from './game/scenes/GameScene.js';

const fatal = document.getElementById('fatal-error');
const fatalMessage = document.getElementById('fatal-error-message');

function showFatal(message) {
  if (!fatal || !fatalMessage) return;
  fatalMessage.textContent = message;
  fatal.hidden = false;
}

// Keep a visible failure mode instead of a silent black rectangle if a module
// ever fails to parse or a scene throws before it can draw an error state.
window.addEventListener('error', (event) => {
  if (!event.message) return;
  showFatal(event.message);
});
window.addEventListener('unhandledrejection', (event) => {
  const reason = event.reason instanceof Error ? event.reason.message : String(event.reason);
  showFatal(reason || 'Unhandled promise rejection');
});

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game-root',
  width: WORLD.width,
  height: WORLD.height,
  backgroundColor: '#0b1220',
  banner: false,
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: WORLD.width,
    height: WORLD.height,
  },
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { y: LEVEL_CONFIG.player.gravity },
      debug: false,
    },
  },
  render: {
    antialias: true,
    roundPixels: false,
  },
  scene: [BootScene, PreloadScene, GameScene],
});

// Small, read-only hooks for local verification and host integration tests.
window.__logicadeGame = game;
game.events.once('ready', () => {
  document.body.dataset.gameReady = 'true';
  console.info('[logicade] Platformer Quest ready');
});
