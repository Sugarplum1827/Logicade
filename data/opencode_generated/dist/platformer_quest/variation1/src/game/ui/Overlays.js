import * as Phaser from '../../../vendor/phaser.esm.min.js';
import { COLORS, DEPTH, WORLD } from '../constants.js';

export class Overlays {
  constructor(scene) {
    this.scene = scene;
    this.active = null;
    this.tutorialStart = null;
  }

  base(width, height, y = (WORLD.height - height) / 2) {
    const scene = this.scene;
    const container = scene.add.container(0, 0).setDepth(DEPTH.modal);
    const backdrop = scene.add
      .rectangle(640, 352, WORLD.width, WORLD.height, 0x05080d, 0.8)
      .setInteractive();
    container.add(backdrop);

    const x = (WORLD.width - width) / 2;
    const card = scene.add.graphics();
    card.fillStyle(0x000000, 0.42);
    card.fillRoundedRect(x + 8, y + 10, width, height, 26);
    card.fillStyle(COLORS.card, 0.99);
    card.fillRoundedRect(x, y, width, height, 26);
    card.lineStyle(2, COLORS.stroke, 1);
    card.strokeRoundedRect(x, y, width, height, 26);
    card.lineStyle(1, 0xffffff, 0.05);
    card.strokeRoundedRect(x + 6, y + 6, width - 12, height - 12, 21);
    container.add(card);

    container.setAlpha(0);
    scene.tweens.add({ targets: container, alpha: 1, duration: 180, ease: 'Quad.easeOut' });
    this.active = container;
    this.close = () => {
      if (!container.active) return;
      this.close = null;
      this.active = null;
      this.tutorialStart = null;
      scene.tweens.add({
        targets: container,
        alpha: 0,
        duration: 130,
        onComplete: () => container.destroy(true),
      });
    };
    this.cardX = x;
    this.cardY = y;
    this.cardWidth = width;
    this.cardHeight = height;
    return { container, x, y, width, height, card };
  }

  button(container, x, y, w, h, label, onClick, variant = 'primary') {
    const scene = this.scene;
    const group = scene.add.container(0, 0);
    const bg = scene.add.graphics();
    const draw = (hover) => {
      bg.clear();
      if (variant === 'primary') {
        bg.fillStyle(hover ? 0x9ff5cf : COLORS.mint, 1);
        bg.lineStyle(2, hover ? 0xd6fff0 : 0x4fc99d, 1);
      } else {
        bg.fillStyle(hover ? 0x2a3a52 : 0x1d283b, 1);
        bg.lineStyle(2, hover ? COLORS.mint : COLORS.stroke, 1);
      }
      bg.fillRoundedRect(x, y, w, h, 13);
      bg.strokeRoundedRect(x, y, w, h, 13);
    };
    draw(false);
    const text = scene.add
      .text(x + w / 2, y + h / 2, label, {
        fontFamily: 'Segoe UI, Trebuchet MS, sans-serif',
        fontSize: '15px',
        fontStyle: 'bold',
        color: variant === 'primary' ? '#0b1220' : '#fff6e5',
      })
      .setOrigin(0.5);
    const zone = scene.add
      .zone(x + w / 2, y + h / 2, w, h)
      .setInteractive({ useHandCursor: true });
    zone.on('pointerover', () => draw(true));
    zone.on('pointerout', () => draw(false));
    zone.on('pointerdown', onClick);
    group.add([bg, text, zone]);
    container.add(group);
    return { group, text };
  }

  keycap(container, x, y, key, label) {
    const scene = this.scene;
    const cap = scene.add.graphics();
    const width = Math.max(34, key.length * 11 + 18);
    cap.fillStyle(0x1d283b, 1);
    cap.fillRoundedRect(x - width / 2, y, width, 30, 7);
    cap.lineStyle(1.5, COLORS.stroke, 1);
    cap.strokeRoundedRect(x - width / 2, y, width, 30, 7);
    const keyText = scene.add
      .text(x, y + 15, key, {
        fontFamily: 'Consolas, Courier New, monospace',
        fontSize: '11px',
        fontStyle: 'bold',
        color: '#fff6e5',
      })
      .setOrigin(0.5);
    const labelText = scene.add
      .text(x, y + 38, label, {
        fontFamily: 'Segoe UI, sans-serif',
        fontSize: '10px',
        color: '#9fb1c8',
      })
      .setOrigin(0.5);
    container.add([cap, keyText, labelText]);
  }

  showTutorial({ description, onStart }) {
    const { container, x, y, width } = this.base(1000, 604, 50);
    const scene = this.scene;

    container.add(
      scene.add
        .text(x + width / 2, y + 46, 'LOGICADE  •  STARTER BUILD', {
          fontFamily: 'Consolas, Courier New, monospace',
          fontSize: '11px',
          color: '#7ee2b8',
        })
        .setOrigin(0.5),
    );
    container.add(
      scene.add
        .text(x + width / 2, y + 88, (description.title || 'PLATFORMER QUEST').toUpperCase(), {
          fontFamily: 'Segoe UI, Trebuchet MS, sans-serif',
          fontSize: '40px',
          fontStyle: 'bold',
          color: '#fff6e5',
        })
        .setOrigin(0.5),
    );
    container.add(
      scene.add
        .text(
          x + width / 2,
          y + 130,
          `VARIATION 01  •  ${(description.subtitle || description.variation_title || 'FORKED ROUTES').toUpperCase()}`,
          {
            fontFamily: 'Consolas, Courier New, monospace',
            fontSize: '13px',
            color: '#ffcf5c',
          },
        )
        .setOrigin(0.5),
    );

    const pill = scene.add.graphics();
    pill.fillStyle(0x123a2a, 1);
    pill.fillRoundedRect(x + width / 2 - 205, y + 158, 410, 30, 15);
    pill.lineStyle(1.5, 0x2f9e74, 1);
    pill.strokeRoundedRect(x + width / 2 - 205, y + 158, 410, 30, 15);
    container.add(pill);
    container.add(
      scene.add
        .text(x + width / 2, y + 173, `LEARNING TARGET  •  ${description.topic.toUpperCase()}`, {
          fontFamily: 'Consolas, Courier New, monospace',
          fontSize: '10px',
          color: '#b8ffdd',
        })
        .setOrigin(0.5),
    );

    container.add(
      scene.add
        .text(x + 78, y + 212, description.objective, {
          fontFamily: 'Segoe UI, Trebuchet MS, sans-serif',
          fontSize: '17px',
          color: '#c8d6e8',
          wordWrap: { width: width - 156, useAdvancedWrap: true },
          lineSpacing: 4,
        })
        .setOrigin(0, 0),
    );

    container.add(
      scene.add.text(x + 78, y + 292, 'HOW THE GATEHOUSE WORKS', {
        fontFamily: 'Consolas, Courier New, monospace',
        fontSize: '11px',
        fontStyle: 'bold',
        color: '#7ee2b8',
      }),
    );

    const steps = [
      'Walk to a glowing gate and press E.',
      'Pick the valid variable name. A wrong answer costs points, never health.',
      'Take either route, cross the chasm, and touch the flag.',
    ];
    steps.forEach((step, index) => {
      const cy = y + 326 + index * 42;
      const circle = scene.add.circle(x + 94, cy + 8, 13, 0x1d283b, 1);
      circle.setStrokeStyle(1.5, COLORS.stroke, 1);
      container.add(circle);
      container.add(
        scene.add
          .text(x + 94, cy + 8, String(index + 1), {
            fontFamily: 'Consolas, Courier New, monospace',
            fontSize: '12px',
            fontStyle: 'bold',
            color: '#7ee2b8',
          })
          .setOrigin(0.5),
      );
      container.add(
        scene.add.text(x + 120, cy, step, {
          fontFamily: 'Segoe UI, sans-serif',
          fontSize: '15px',
          color: '#fff6e5',
        }),
      );
    });

    const controls = [
      ['A / D', 'move'],
      ['SPACE', 'jump'],
      ['E', 'answer'],
      ['H', 'hint'],
      ['ESC', 'pause'],
    ];
    const startX = x + 190;
    controls.forEach(([key, label], index) => {
      this.keycap(container, startX + index * 150, y + 468, key, label);
    });

    this.button(container, x + width / 2 - 150, y + 520, 300, 54, 'START RUN', onStart);
    container.add(
      scene.add
        .text(x + width / 2, y + 585, 'or press Enter / Space', {
          fontFamily: 'Consolas, Courier New, monospace',
          fontSize: '10px',
          color: '#7f91a8',
        })
        .setOrigin(0.5),
    );

    this.tutorialStart = onStart;
  }

  startTutorial() {
    if (this.tutorialStart) {
      const start = this.tutorialStart;
      this.tutorialStart = null;
      start();
    }
  }

  showPause({ onResume, onRestart, onQuit, muted, onMute }) {
    const { container, x, y, width } = this.base(600, 438);
    const scene = this.scene;
    container.add(
      scene.add
        .text(x + width / 2, y + 54, 'PAUSED', {
          fontFamily: 'Segoe UI, Trebuchet MS, sans-serif',
          fontSize: '32px',
          fontStyle: 'bold',
          color: '#fff6e5',
        })
        .setOrigin(0.5),
    );
    container.add(
      scene.add
        .text(x + width / 2, y + 88, 'The gatehouse waits.', {
          fontFamily: 'Consolas, Courier New, monospace',
          fontSize: '11px',
          color: '#9fb1c8',
        })
        .setOrigin(0.5),
    );

    this.button(container, x + 90, y + 126, 420, 52, 'RESUME', onResume);
    this.button(container, x + 90, y + 190, 200, 48, 'RESTART', onRestart, 'secondary');
    this.button(container, x + 310, y + 190, 200, 48, muted ? 'SOUND OFF' : 'SOUND ON', onMute, 'secondary');
    this.button(container, x + 90, y + 250, 420, 44, 'EXIT TO START', onQuit, 'secondary');

    container.add(
      scene.add
        .text(x + width / 2, y + 328, 'A/D or arrows move  •  Space jumps  •  E answers  •  H hints', {
          fontFamily: 'Consolas, Courier New, monospace',
          fontSize: '10px',
          color: '#7f91a8',
        })
        .setOrigin(0.5),
    );
    container.add(
      scene.add
        .text(x + width / 2, y + 352, 'Esc resumes', {
          fontFamily: 'Consolas, Courier New, monospace',
          fontSize: '10px',
          color: '#7ee2b8',
        })
        .setOrigin(0.5),
    );
  }

  showHint({ hint, onClose }) {
    const { container, x, y, width } = this.base(820, 250);
    const scene = this.scene;
    container.add(
      scene.add
        .text(x + width / 2, y + 44, 'VARIABLE-NAME CHECK', {
          fontFamily: 'Consolas, Courier New, monospace',
          fontSize: '11px',
          fontStyle: 'bold',
          color: '#ffcf5c',
        })
        .setOrigin(0.5),
    );
    container.add(
      scene.add
        .text(x + 54, y + 82, hint, {
          fontFamily: 'Segoe UI, Trebuchet MS, sans-serif',
          fontSize: '18px',
          color: '#fff6e5',
          wordWrap: { width: width - 108, useAdvancedWrap: true },
          lineSpacing: 6,
        })
        .setOrigin(0, 0),
    );
    this.button(container, x + width / 2 - 110, y + 178, 220, 48, 'GOT IT', onClose);
  }

  showComplete({ stats, stars, onReplay, onReview }) {
    const { container, x, y, width } = this.base(900, 584, 60);
    const scene = this.scene;
    container.add(
      scene.add
        .text(x + width / 2, y + 58, 'ROUTE CLEARED', {
          fontFamily: 'Segoe UI, Trebuchet MS, sans-serif',
          fontSize: '40px',
          fontStyle: 'bold',
          color: '#ffcf5c',
        })
        .setOrigin(0.5),
    );
    container.add(
      scene.add
        .text(x + width / 2, y + 98, 'The flag is yours. Both routes were earned, not skipped.', {
          fontFamily: 'Segoe UI, sans-serif',
          fontSize: '14px',
          color: '#c8d6e8',
        })
        .setOrigin(0.5),
    );

    for (let i = 0; i < 3; i += 1) {
      const star = scene.add
        .image(x + width / 2 - 82 + i * 82, y + 154, 'star')
        .setScale(1.8)
        .setTint(i < stars ? 0xffcf5c : 0x44536b)
        .setAlpha(i < stars ? 1 : 0.4);
      container.add(star);
      if (i < stars) {
        scene.tweens.add({
          targets: star,
          scale: 2.1,
          duration: 700,
          delay: 220 + i * 160,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.easeInOut',
        });
      }
    }

    const cells = [
      ['SCORE', String(stats.score), '#fff6e5'],
      ['ACCURACY', `${Math.round(stats.accuracy * 100)}%`, '#7ee2b8'],
      ['TIME', stats.time, '#fff6e5'],
      ['COINS', String(stats.coins), '#ffcf5c'],
      ['HEARTS', `${stats.hearts} / 3`, '#ff8fa3'],
      ['GATES', String(stats.gates), '#9db7ff'],
    ];
    const startX = x + 170;
    cells.forEach((cell, index) => {
      const col = index % 3;
      const row = Math.floor(index / 3);
      const cx = startX + col * 280;
      const cy = y + 236 + row * 86;
      container.add(
        scene.add.text(cx, cy, cell[0], {
          fontFamily: 'Consolas, Courier New, monospace',
          fontSize: '10px',
          color: '#7f91a8',
        }),
      );
      container.add(
        scene.add.text(cx, cy + 18, cell[1], {
          fontFamily: 'Segoe UI, Trebuchet MS, sans-serif',
          fontSize: '26px',
          fontStyle: 'bold',
          color: cell[2],
        }),
      );
    });

    container.add(
      scene.add
        .text(x + width / 2, y + 410, 'Assessment and score are reported separately in the host event.', {
          fontFamily: 'Consolas, Courier New, monospace',
          fontSize: '10px',
          color: '#7f91a8',
        })
        .setOrigin(0.5),
    );

    this.button(container, x + 180, y + 462, 250, 54, 'PLAY AGAIN', onReplay);
    this.button(container, x + 470, y + 462, 250, 54, 'REVIEW TIPS', onReview, 'secondary');
  }

  showGameOver({ stats, onRetry, onReview }) {
    const { container, x, y, width } = this.base(780, 500, 102);
    const scene = this.scene;
    container.add(
      scene.add
        .text(x + width / 2, y + 56, 'OUT OF HEARTS', {
          fontFamily: 'Segoe UI, Trebuchet MS, sans-serif',
          fontSize: '34px',
          fontStyle: 'bold',
          color: '#ff8fa3',
        })
        .setOrigin(0.5),
    );
    container.add(
      scene.add
        .text(x + width / 2, y + 92, 'The gatehouse wins this round. The questions stay open for next time.', {
          fontFamily: 'Segoe UI, sans-serif',
          fontSize: '13px',
          color: '#c8d6e8',
        })
        .setOrigin(0.5),
    );

    const cells = [
      ['SCORE', String(stats.score)],
      ['ACCURACY', `${Math.round(stats.accuracy * 100)}%`],
      ['TIME', stats.time],
    ];
    cells.forEach((cell, index) => {
      const cx = x + 150 + index * 240;
      container.add(
        scene.add.text(cx, y + 172, cell[0], {
          fontFamily: 'Consolas, Courier New, monospace',
          fontSize: '10px',
          color: '#7f91a8',
        }),
      );
      container.add(
        scene.add.text(cx, y + 190, cell[1], {
          fontFamily: 'Segoe UI, Trebuchet MS, sans-serif',
          fontSize: '28px',
          fontStyle: 'bold',
          color: '#fff6e5',
        }),
      );
    });

    container.add(
      scene.add
        .text(
          x + width / 2,
          y + 282,
          'Tip: names may start with a letter, _ or $, and may contain letters, digits, _ or $.',
          {
            fontFamily: 'Segoe UI, sans-serif',
            fontSize: '13px',
            color: '#ffcf5c',
            wordWrap: { width: width - 120, useAdvancedWrap: true },
            align: 'center',
          },
        )
        .setOrigin(0.5),
    );

    this.button(container, x + 110, y + 350, 250, 54, 'TRY AGAIN', onRetry);
    this.button(container, x + 420, y + 350, 250, 54, 'REVIEW TIPS', onReview, 'secondary');
  }

  closeActive() {
    if (this.close) this.close();
  }
}
