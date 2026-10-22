/**
 * Every string here is read from the spec JSON. Nothing is synthesized.
 *
 * Layout:
 *   ┌───────────────────────────────────┐
 *   │ <game_title>                      │  ← spec.game_title
 *   │ Mechanic: <primary_mechanic>      │  ← spec.primary_mechanic
 *   │ Goal: <player_objective>          │  ← spec.player_objective
 *   │ Mode: <genre> | <region.name>     │
 *   │ ────────────────────────────────  │
 *   │ <hudLine: live-updated>           │  ← timer / score / lives
 *   │ <code_snippet in a box>           │
 *   │ <tutorial step N of M>            │
 *   │                    [pause hint]   │
 *   └───────────────────────────────────┘
 */

export function buildHUD(scene, ctx) {
  const { spec, parsed } = ctx;
  const title = spec.game_title || spec.primary_mechanic || 'Mission';
  const mechanic = spec.primary_mechanic || '';
  const objective = spec.player_objective || '';
  const genre = spec.genre || '';
  const region = spec.region?.name || '';
  const snippet = spec.code_snippet || '';
  const tutorial = Array.isArray(spec.tutorial) ? spec.tutorial : [];

  // ── Top banner ──
  scene.add
    .rectangle(0, 0, scene.scale.width, 88, 0x000000, 0.75)
    .setOrigin(0, 0).setDepth(100).setScrollFactor(0);

  scene.add
    .text(14, 8, title, {
      fontSize: '15px', color: '#ffd166', fontFamily: 'monospace',
      fontStyle: 'bold',
    })
    .setDepth(101).setScrollFactor(0);

  scene.add
    .text(14, 30, `Mechanic: ${mechanic}${genre ? `   ·   ${genre}` : ''}${region ? `   ·   ${region}` : ''}`, {
      fontSize: '12px', color: '#9ca3af', fontFamily: 'monospace',
    })
    .setDepth(101).setScrollFactor(0);

  scene.add
    .text(14, 48, `Goal: ${objective}`, {
      fontSize: '12px', color: '#fde68a', fontFamily: 'monospace',
      wordWrap: { width: scene.scale.width - 28 },
    })
    .setDepth(101).setScrollFactor(0);

  // ── Live line (score / timer / lives) ──
  const hudLine = scene.add
    .text(14, 66, '', {
      fontSize: '14px', color: '#4ade80', fontFamily: 'monospace',
    })
    .setDepth(101).setScrollFactor(0);

  // ── Code snippet panel ──
  if (snippet) {
    scene.add
      .rectangle(14, scene.scale.height - 110, scene.scale.width - 28, 90, 0x000000, 0.85)
      .setOrigin(0, 0).setDepth(100).setScrollFactor(0);

    scene.add
      .text(24, scene.scale.height - 100, 'CODE', {
        fontSize: '11px', color: '#7dd3fc', fontFamily: 'monospace',
      })
      .setDepth(101).setScrollFactor(0);

    scene.add
      .text(24, scene.scale.height - 82, snippet, {
        fontSize: '15px', color: '#00ffcc', fontFamily: 'monospace',
        wordWrap: { width: scene.scale.width - 48 },
      })
      .setDepth(101).setScrollFactor(0);
  }

  // ── Tutorial callout (bottom-right) ──
  const tutorialText = scene.add
    .text(scene.scale.width - 14, scene.scale.height - 128, '', {
      fontSize: '11px', color: '#cbd5e1', fontFamily: 'monospace',
      align: 'right', wordWrap: { width: 400 },
    })
    .setOrigin(1, 1).setDepth(101).setScrollFactor(0);

  let tutorialIndex = 0;
  if (tutorial.length > 0) {
    tutorialText.setText(tutorial[0]);
    scene.time.addEvent({
      delay: 5000,
      loop: true,
      callback: () => {
        if (scene.state.gameOver || scene.state.paused) return;
        tutorialIndex = (tutorialIndex + 1) % tutorial.length;
        tutorialText.setText(tutorial[tutorialIndex]);
      },
    });
  }

  // ── Footer hint ──
  scene.add
    .text(14, scene.scale.height - 20, 'ESC = pause   ·   💡 = hint', {
      fontSize: '11px', color: '#6b7280', fontFamily: 'monospace',
    })
    .setDepth(101).setScrollFactor(0);

  return {
    update(state) {
      const parts = [];
      if (parsed.win_by_score || parsed.target_score > 0) {
        parts.push(`Score ${state.score} / ${parsed.target_score}`);
      }
      parts.push(`Time ${state.timer.toFixed(1)}s / ${parsed.time_limit}s`);
      parts.push(`Lives ${state.lives}`);
      hudLine.setText(parts.join('   ·   '));
    },
  };
}