// Generates the few textures the starter pack does not contain. Everything is
// drawn locally with Phaser Graphics; no remote assets or fonts are used.
export function createGeneratedTextures(scene) {
  const make = (key, width, height, draw) => {
    if (scene.textures.exists(key)) return;
    const graphics = scene.make.graphics({ x: 0, y: 0, add: false });
    draw(graphics);
    graphics.generateTexture(key, width, height);
    graphics.destroy();
  };

  make('pixel', 2, 2, (g) => {
    g.fillStyle(0xffffff, 1);
    g.fillRect(0, 0, 2, 2);
  });

  make('spark', 10, 10, (g) => {
    g.fillStyle(0xffffff, 1);
    g.fillCircle(5, 5, 5);
  });

  make('glow', 128, 128, (g) => {
    for (let i = 24; i > 0; i -= 1) {
      const t = i / 24;
      g.fillStyle(0xffffff, 0.032 * (1 - t) + 0.006);
      g.fillCircle(64, 64, 8 + i * 2.4);
    }
  });

  make('shadow', 128, 48, (g) => {
    for (let i = 10; i > 0; i -= 1) {
      g.fillStyle(0x000000, 0.035);
      g.fillEllipse(64, 24, 28 + i * 9, 6 + i * 3);
    }
  });

  make('castle_block', 64, 64, (g) => {
    g.fillStyle(0x6f8199, 1);
    g.fillRect(0, 0, 64, 64);
    g.fillStyle(0x8195ad, 1);
    g.fillRect(0, 0, 64, 7);
    g.fillStyle(0x5a6a80, 1);
    g.fillRect(0, 57, 64, 7);
    g.lineStyle(2, 0x4c5c72, 0.9);
    g.beginPath();
    g.moveTo(0, 32);
    g.lineTo(64, 32);
    g.moveTo(32, 0);
    g.lineTo(32, 32);
    g.moveTo(16, 32);
    g.lineTo(16, 64);
    g.moveTo(48, 32);
    g.lineTo(48, 64);
    g.strokePath();
    g.lineStyle(4, 0x2b3445, 1);
    g.strokeRect(2, 2, 60, 60);
    g.fillStyle(0x8fa2b8, 0.35);
    g.fillCircle(12, 12, 2);
    g.fillCircle(50, 45, 2);
  });

  make('star', 24, 24, (g) => {
    const points = [];
    for (let i = 0; i < 10; i += 1) {
      const angle = -Math.PI / 2 + (i * Math.PI) / 5;
      const radius = i % 2 === 0 ? 11 : 4.6;
      points.push({ x: 12 + Math.cos(angle) * radius, y: 12 + Math.sin(angle) * radius });
    }
    g.fillStyle(0xffffff, 1);
    g.fillPoints(points, true);
  });

  make('clue', 56, 56, (g) => {
    g.fillStyle(0x9df3ff, 0.25);
    g.fillCircle(28, 28, 27);
    g.fillStyle(0x66dcff, 0.9);
    g.fillPoints(
      [
        { x: 28, y: 5 },
        { x: 49, y: 28 },
        { x: 28, y: 51 },
        { x: 7, y: 28 },
      ],
      true,
    );
    g.fillStyle(0xffffff, 0.95);
    g.fillPoints(
      [
        { x: 28, y: 14 },
        { x: 40, y: 28 },
        { x: 28, y: 42 },
        { x: 16, y: 28 },
      ],
      true,
    );
    g.fillStyle(0x1b6f8f, 0.75);
    g.fillCircle(28, 28, 4);
  });
}
