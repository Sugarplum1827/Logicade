import * as Phaser from '../../../vendor/phaser.esm.min.js';
import { COLORS, DEPTH } from '../constants.js';

export class Hud {
  constructor(scene, { onHint, onMute, onPause }) {
    this.scene = scene;
    this.onHint = onHint;
    this.onMute = onMute;
    this.onPause = onPause;
    this.container = scene.add.container(0, 0).setDepth(DEPTH.hud);

    const bar = scene.add.graphics();
    bar.fillStyle(COLORS.navyDeep, 0.74);
    bar.fillRoundedRect(22, 14, 1236, 66, 18);
    bar.lineStyle(2, COLORS.stroke, 0.75);
    bar.strokeRoundedRect(22, 14, 1236, 66, 18);
    this.container.add(bar);

    this.hearts = [];
    for (let i = 0; i < 3; i += 1) {
      const heart = scene.add
        .text(46 + i * 34, 48, '♥', {
          fontFamily: 'Segoe UI Symbol, Segoe UI, sans-serif',
          fontSize: '28px',
          color: '#ff6b81',
          stroke: '#2b1018',
          strokeThickness: 3,
        })
        .setOrigin(0.5);
      this.hearts.push(heart);
      this.container.add(heart);
    }

    this.scoreText = scene.add.text(154, 46, 'SCORE 0000', {
      fontFamily: 'Consolas, Courier New, monospace',
      fontSize: '17px',
      fontStyle: 'bold',
      color: '#fff6e5',
    });
    this.scoreText.setOrigin(0, 0.5);
    this.container.add(this.scoreText);

    const coinIcon = scene.add.image(300, 48, 'coin').setScale(0.4);
    this.coinText = scene.add.text(320, 47, '0', {
      fontFamily: 'Consolas, Courier New, monospace',
      fontSize: '17px',
      fontStyle: 'bold',
      color: '#ffcf5c',
    });
    this.coinText.setOrigin(0, 0.5);
    this.container.add([coinIcon, this.coinText]);

    this.titleText = scene.add
      .text(640, 34, 'FORKED ROUTES', {
        fontFamily: 'Segoe UI, Trebuchet MS, sans-serif',
        fontSize: '17px',
        fontStyle: 'bold',
        color: '#fff6e5',
      })
      .setOrigin(0.5);
    this.subText = scene.add
      .text(640, 56, 'FOREST GATEHOUSE', {
        fontFamily: 'Consolas, Courier New, monospace',
        fontSize: '10px',
        color: '#9fb1c8',
      })
      .setOrigin(0.5);
    this.container.add([this.titleText, this.subText]);

    this.gatesText = scene.add
      .text(868, 47, 'GATES 0', {
        fontFamily: 'Consolas, Courier New, monospace',
        fontSize: '13px',
        color: '#7ee2b8',
      })
      .setOrigin(0, 0.5);
    this.timerText = scene.add
      .text(958, 47, '00:00', {
        fontFamily: 'Consolas, Courier New, monospace',
        fontSize: '15px',
        color: '#fff6e5',
      })
      .setOrigin(0, 0.5);
    this.container.add([this.gatesText, this.timerText]);

    this.hintButton = this.makeButton(1028, 31, 86, 32, 'H  HINT', () => this.onHint?.());
    this.muteButton = this.makeButton(1122, 31, 86, 32, 'M  SOUND', () => this.onMute?.());
    this.pauseButton = this.makeButton(1216, 31, 34, 32, 'II', () => this.onPause?.());

    this.toastText = scene.add
      .text(640, 100, '', {
        fontFamily: 'Segoe UI, Trebuchet MS, sans-serif',
        fontSize: '16px',
        fontStyle: 'bold',
        color: '#fff6e5',
        backgroundColor: 'rgba(11,18,32,0.9)',
        padding: { x: 18, y: 9 },
        align: 'center',
      })
      .setOrigin(0.5)
      .setAlpha(0)
      .setDepth(DEPTH.hud + 1);
  }

  makeButton(x, y, w, h, label, onClick) {
    const bg = this.scene.add.graphics();
    const draw = (hover) => {
      bg.clear();
      bg.fillStyle(hover ? 0x2a3a52 : 0x1d283b, 1);
      bg.fillRoundedRect(x, y, w, h, 9);
      bg.lineStyle(1.5, hover ? COLORS.mint : COLORS.stroke, 1);
      bg.strokeRoundedRect(x, y, w, h, 9);
    };
    draw(false);
    const text = this.scene.add
      .text(x + w / 2, y + h / 2, label, {
        fontFamily: 'Consolas, Courier New, monospace',
        fontSize: '11px',
        fontStyle: 'bold',
        color: '#fff6e5',
      })
      .setOrigin(0.5);
    const zone = this.scene.add
      .zone(x + w / 2, y + h / 2, w, h)
      .setInteractive({ useHandCursor: true });
    zone.on('pointerover', () => draw(true));
    zone.on('pointerout', () => draw(false));
    zone.on('pointerdown', onClick);
    this.container.add([bg, text, zone]);
    return { bg, text, zone, draw };
  }

  update({ hearts, score, coins, gates, elapsedMs, muted }) {
    this.hearts.forEach((heart, index) => heart.setAlpha(index < hearts ? 1 : 0.2));
    this.scoreText.setText(`SCORE ${String(score).padStart(4, '0')}`);
    this.coinText.setText(String(coins));
    this.gatesText.setText(`GATES ${gates}`);
    const totalSeconds = Math.floor(elapsedMs / 1000);
    const minutes = String(Math.floor(totalSeconds / 60)).padStart(2, '0');
    const seconds = String(totalSeconds % 60).padStart(2, '0');
    this.timerText.setText(`${minutes}:${seconds}`);
    this.muteButton.text.setText(muted ? 'M  MUTED' : 'M  SOUND');
    this.muteButton.text.setColor(muted ? '#ff9aa8' : '#fff6e5');
  }

  toast(message, color = '#fff6e5', duration = 1800) {
    this.scene.tweens.killTweensOf(this.toastText);
    this.toastText.setText(message).setColor(color).setAlpha(1).setY(100);
    this.scene.tweens.add({
      targets: this.toastText,
      alpha: 0,
      y: 92,
      delay: duration,
      duration: 350,
      ease: 'Quad.easeIn',
    });
  }

  setVisible(visible) {
    this.container.setVisible(visible);
    this.toastText.setVisible(visible);
  }

  destroy() {
    this.container.destroy(true);
    this.toastText.destroy();
  }
}
