import * as Phaser from '../../../vendor/phaser.esm.min.js';
import { COLORS, DEPTH } from '../constants.js';

const CARD = { x: 190, y: 78, w: 900, h: 568 };
const OPTION = { x: 230, y: 250, w: 820, h: 64, gap: 12 };

export class QuestionPanel {
  constructor(scene) {
    this.scene = scene;
    this.container = scene.add.container(0, 0).setDepth(DEPTH.panel).setVisible(false);
    this.isOpen = false;
    this.answered = false;
    this.locked = false;
    this.result = null;
    this.hintShown = false;
    this.onAnswered = null;
    this.onContinue = null;
    this.onSkip = null;
    this.onHint = null;

    this.backdrop = scene.add
      .rectangle(640, 352, 1280, 704, 0x05080d, 0.82)
      .setInteractive();
    this.backdrop.on('pointerdown', () => {
      // Absorb clicks outside the card.
    });
    this.container.add(this.backdrop);

    this.card = scene.add.graphics();
    this.container.add(this.card);

    this.accent = scene.add.rectangle(CARD.x + 28, CARD.y + 2, CARD.w - 56, 4, COLORS.mint, 0.9);
    this.container.add(this.accent);

    this.gateText = scene.add.text(230, 108, 'GATE', {
      fontFamily: 'Consolas, Courier New, monospace',
      fontSize: '12px',
      fontStyle: 'bold',
      color: '#7ee2b8',
    });
    this.progressText = scene.add
      .text(1050, 108, 'QUESTION 1 OF 2', {
        fontFamily: 'Consolas, Courier New, monospace',
        fontSize: '11px',
        color: '#9fb1c8',
      })
      .setOrigin(1, 0);
    this.container.add([this.gateText, this.progressText]);

    this.promptText = scene.add.text(230, 142, '', {
      fontFamily: 'Segoe UI, Trebuchet MS, sans-serif',
      fontSize: '25px',
      fontStyle: 'bold',
      color: '#fff6e5',
      wordWrap: { width: 820, useAdvancedWrap: true },
      lineSpacing: 4,
    });
    this.container.add(this.promptText);

    this.optionViews = [];
    for (let i = 0; i < 4; i += 1) {
      const y = OPTION.y + i * (OPTION.h + OPTION.gap);
      const bg = scene.add.graphics();
      const key = scene.add
        .text(OPTION.x + 33, y + OPTION.h / 2, String(i + 1), {
          fontFamily: 'Consolas, Courier New, monospace',
          fontSize: '14px',
          fontStyle: 'bold',
          color: '#9fb1c8',
        })
        .setOrigin(0.5);
      const label = scene.add
        .text(OPTION.x + 64, y + OPTION.h / 2, '', {
          fontFamily: 'Consolas, Courier New, monospace',
          fontSize: '20px',
          color: '#fff6e5',
        })
        .setOrigin(0, 0.5);
      const zone = scene.add
        .zone(OPTION.x + OPTION.w / 2, y + OPTION.h / 2, OPTION.w, OPTION.h)
        .setInteractive({ useHandCursor: true });
      const view = { bg, key, label, zone, y, index: i, state: 'default' };
      zone.on('pointerover', () => {
        if (this.locked) return;
        this.drawOption(view, 'hover');
      });
      zone.on('pointerout', () => {
        if (this.locked) return;
        this.drawOption(view, 'default');
      });
      zone.on('pointerdown', () => this.choose(i));
      this.optionViews.push(view);
      this.container.add([bg, key, label, zone]);
      this.drawOption(view, 'default');
    }

    this.hintText = scene.add.text(230, 558, '', {
      fontFamily: 'Segoe UI, Trebuchet MS, sans-serif',
      fontSize: '14px',
      color: '#ffcf5c',
      wordWrap: { width: 820, useAdvancedWrap: true },
      lineSpacing: 2,
    });
    this.explainText = scene.add.text(230, 558, '', {
      fontFamily: 'Segoe UI, Trebuchet MS, sans-serif',
      fontSize: '14px',
      color: '#c8d6e8',
      wordWrap: { width: 820, useAdvancedWrap: true },
      lineSpacing: 2,
    });
    this.footerText = scene.add.text(230, 626, '1–4 choose    H hint    Esc close', {
      fontFamily: 'Consolas, Courier New, monospace',
      fontSize: '11px',
      color: '#7f91a8',
    });
    this.continueText = scene.add
      .text(1050, 626, 'PRESS E TO CONTINUE', {
        fontFamily: 'Consolas, Courier New, monospace',
        fontSize: '11px',
        fontStyle: 'bold',
        color: '#7ee2b8',
      })
      .setOrigin(1, 0)
      .setAlpha(0);
    this.container.add([this.hintText, this.explainText, this.footerText, this.continueText]);
  }

  drawCard(tint) {
    const g = this.card;
    g.clear();
    g.fillStyle(0x000000, 0.4);
    g.fillRoundedRect(CARD.x + 8, CARD.y + 10, CARD.w, CARD.h, 24);
    g.fillStyle(COLORS.card, 0.985);
    g.fillRoundedRect(CARD.x, CARD.y, CARD.w, CARD.h, 24);
    g.lineStyle(2, COLORS.stroke, 1);
    g.strokeRoundedRect(CARD.x, CARD.y, CARD.w, CARD.h, 24);
    g.lineStyle(1, 0xffffff, 0.05);
    g.strokeRoundedRect(CARD.x + 5, CARD.y + 5, CARD.w - 10, CARD.h - 10, 20);
    this.accent.setFillStyle(tint, 0.9);
  }

  drawOption(view, state) {
    const { x, w, h } = OPTION;
    const y = view.y;
    const g = view.bg;
    g.clear();
    let fill = 0x1b2537;
    let stroke = 0x33445e;
    let textColor = '#fff6e5';
    let keyColor = '#9fb1c8';
    let alpha = 1;

    if (state === 'hover') {
      fill = 0x223149;
      stroke = 0x7ee2b8;
    } else if (state === 'correct') {
      fill = 0x123a2a;
      stroke = 0x46d39a;
      textColor = '#b8ffdd';
      keyColor = '#46d39a';
    } else if (state === 'wrong') {
      fill = 0x3a1622;
      stroke = 0xff6b81;
      textColor = '#ffc2ca';
      keyColor = '#ff6b81';
    } else if (state === 'muted') {
      fill = 0x161f2e;
      stroke = 0x2a3749;
      alpha = 0.55;
    }

    g.fillStyle(fill, 1);
    g.fillRoundedRect(x, y, w, h, 12);
    g.lineStyle(state === 'default' ? 1.5 : 2.5, stroke, 1);
    g.strokeRoundedRect(x, y, w, h, 12);
    g.fillStyle(fill === 0x1b2537 ? 0x253247 : fill, 1);
    g.fillRoundedRect(x + 12, y + 14, 42, h - 28, 9);
    g.lineStyle(1, stroke, 0.8);
    g.strokeRoundedRect(x + 12, y + 14, 42, h - 28, 9);

    view.state = state;
    view.label.setColor(textColor).setAlpha(alpha);
    view.key.setColor(keyColor).setAlpha(alpha);
  }

  open({ gateLabel, tint, question, index, total, hint }) {
    this.isOpen = true;
    this.answered = false;
    this.locked = false;
    this.result = null;
    this.hintShown = false;
    this.correctIndex = question.correctIndex;
    this.question = question;
    this.hint = hint || question.hint || '';

    this.drawCard(tint);
    const tintHex = `#${tint.toString(16).padStart(6, '0')}`;
    this.gateText.setText(gateLabel).setColor(tintHex);
    this.progressText.setText(`QUESTION ${index} OF ${total}`);
    this.promptText.setText(question.prompt);
    this.hintText.setText('');
    this.explainText.setText('');
    this.continueText.setAlpha(0);
    this.footerText.setText('1–4 choose    H hint    Esc close').setVisible(true);

    this.optionViews.forEach((view, optionIndex) => {
      view.label.setText(question.options[optionIndex] || '');
      view.label.setAlpha(1);
      view.key.setAlpha(1);
      view.zone.setInteractive({ useHandCursor: true });
      this.drawOption(view, 'default');
    });

    this.container.setVisible(true).setAlpha(0);
    this.scene.tweens.add({
      targets: this.container,
      alpha: 1,
      duration: 160,
      ease: 'Quad.easeOut',
    });
  }

  choose(index) {
    if (!this.isOpen || this.locked) return;
    if (index < 0 || index > 3) return;
    this.locked = true;
    this.answered = true;
    this.result = {
      index,
      correct: index === this.correctIndex,
      question: this.question,
    };

    this.optionViews.forEach((view) => {
      view.zone.disableInteractive();
      if (view.index === this.correctIndex) this.drawOption(view, 'correct');
      else if (view.index === index) this.drawOption(view, 'wrong');
      else this.drawOption(view, 'muted');
    });

    this.hintText.setText('');
    this.explainText
      .setText(
        this.result.correct
          ? `Correct. ${this.question.explanation}`
          : `Not quite. ${this.question.explanation}`,
      )
      .setColor(this.result.correct ? '#b8ffdd' : '#ffc2ca');
    this.footerText.setText('Read the explanation, then continue.').setVisible(true);
    this.continueText.setAlpha(1);
    this.scene.tweens.killTweensOf(this.continueText);
    this.scene.tweens.add({
      targets: this.continueText,
      alpha: 0.35,
      duration: 620,
      yoyo: true,
      repeat: -1,
    });

    this.onAnswered?.(this.result);
  }

  showHint() {
    if (!this.isOpen || this.answered || this.hintShown) return false;
    this.hintShown = true;
    this.hintText.setText(`Hint: ${this.hint || 'Check each character in the name.'}`);
    this.onHint?.();
    return true;
  }

  continue() {
    if (!this.isOpen || !this.answered) return;
    const result = this.result;
    this.hide();
    this.onContinue?.(result);
  }

  close() {
    if (!this.isOpen || this.answered) return;
    this.hide();
    this.onSkip?.();
  }

  hide() {
    this.isOpen = false;
    this.locked = true;
    this.scene.tweens.killTweensOf(this.continueText);
    this.scene.tweens.add({
      targets: this.container,
      alpha: 0,
      duration: 120,
      onComplete: () => this.container.setVisible(false),
    });
  }

  destroy() {
    this.container.destroy(true);
  }
}
