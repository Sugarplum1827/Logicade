/**
 * Parse win_condition / lose_condition strings from the JSON into
 * executable predicates. No hardcoded mission types — every mission
 * describes its own rules as text, and we honor them.
 *
 * Supported win forms (case-insensitive):
 *   "Timer reaches 42 seconds"          → win_by_time, limit=42
 *   "Survive 30 seconds"                → win_by_time, limit=30
 *   "score >= 70 within 42 seconds"     → win_by_score, target=70, limit=42
 *   "Reach 100 points"                  → win_by_score, target=100
 *
 * Lose conditions are checked as:
 *   • lives <= 0  (universal)
 *   • timer expired with score below target (for score-based games)
 *   • explicit resource<=0 (e.g. "crate_b drops to 0") — modeled as lives
 */

export function parseConditions(spec) {
  const settings = spec.game_settings || {};
  const winText = String(spec.win_condition || spec.win || '').toLowerCase();
  const loseText = String(spec.lose_condition || '').toLowerCase();

  let target_score = Number(settings.target_score ?? 0);
  let time_limit = Number(settings.time_limit_seconds ?? 60);

  // Extract targets from the win text (which wins over game_settings)
  const scoreMatch = winText.match(/(?:score|points?|reach|collect)\D{0,12}(\d+)/);
  if (scoreMatch) target_score = parseInt(scoreMatch[1], 10);

  const timeMatch = winText.match(/(\d+)[- ]?second|timer\s*(?:reaches|hits)\s*(\d+)/);
  if (timeMatch) time_limit = parseInt(timeMatch[1] || timeMatch[2], 10);

  const mentionsTimer = /timer\s*(?:reaches|hits|>=)|survive\s+\d+/.test(winText);
  const mentionsScore = /score\s*(?:reaches|hits|>=|==|>)|reach\s+\d+\s*points/.test(winText);

  // Priority: if the win mentions score, it's score-based. Else if it
  // mentions timer, it's time-based. Else default to whichever target
  // is meaningful.
  let win_by_score = false;
  let win_by_time = false;
  if (mentionsScore) {
    win_by_score = true;
  } else if (mentionsTimer) {
    win_by_time = true;
  } else if (target_score > 0) {
    win_by_score = true;
  } else if (time_limit > 0) {
    win_by_time = true;
  }

  const lose_by_lives = /lives?\s*(?:reach|hit|=|<=|<)\s*0|out of lives/.test(loseText);
  const lose_by_timer = /timer\s*(?:hits|reaches|runs out)|time\s*runs out/.test(loseText);
  const lose_by_resource = /drops to 0|reaches 0|falls to 0/.test(loseText);

  return {
    target_score,
    time_limit,
    win_by_score,
    win_by_time,
    // A score-based game with a timer expires; a pure survival game doesn't.
    expires: win_by_score || lose_by_timer,
    // Resource collapse is only honored when the lose text says so — we
    // treat it as an alias for lives so both map to "you ran out of X".
    lose_by_resource,
    lose_by_lives: lose_by_lives || lose_by_resource,
  };
}

export function evaluateWin(state, parsed) {
  if (state.gameOver) return null;
  if (parsed.win_by_score && state.score >= parsed.target_score) {
    return 'target_score_reached';
  }
  if (parsed.win_by_time && state.timer >= parsed.time_limit) {
    return 'timer_reached';
  }
  return null;
}

export function evaluateLose(state, parsed) {
  if (state.gameOver) return null;
  if (state.lives <= 0) return 'out_of_lives';
  if (parsed.expires && state.timer >= parsed.time_limit &&
      (!parsed.win_by_score || state.score < parsed.target_score)) {
    return 'time_up';
  }
  return null;
}