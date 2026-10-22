const modules = new Map();
const timerLimit = (scene) => scene.settings.time_limit_seconds ?? scene.settings.game_duration_seconds ?? 60;

export function registerMissionModule({ id, build, evaluate, score, tick = () => {} }) {
  if (!id || typeof build !== 'function' || typeof evaluate !== 'function' || typeof score !== 'function') {
    throw new TypeError('A mission module needs id, build, evaluate, and score functions.');
  }
  modules.set(id, Object.freeze({ id, build, evaluate, score, tick }));
}

export function getMissionModule(id) {
  return modules.get(id) || modules.get('Survival Siege');
}

export function listMissionModules() {
  return [...modules.keys()];
}

registerMissionModule({
  id: 'Survival Siege',
  build: (scene) => scene._buildSurvivalSiege(),
  evaluate: (scene) => {
    if (scene.state.doorHealth <= 0) scene._finish(false, 'door_destroyed');
    else if (scene.state.timer >= scene._siegeDuration) scene._finish(true, 'timer_survived');
  },
  score: (scene) => scene.state.doorHealth / (scene.state.maxDoorHealth || 1),
});

registerMissionModule({
  id: 'Streak Challenge',
  build: (scene) => scene._buildStreakChallenge(),
  evaluate: (scene) => {
    if (scene.state.streak >= scene._streakTarget) scene._finish(true, 'streak_complete');
    else if (scene.state.lives <= 0) scene._finish(false, 'out_of_lives');
    else if (scene.state.timer >= timerLimit(scene)) scene._finish(false, 'time_up');
  },
  score: (scene) => scene.state.streak / (scene._streakTarget || 1),
});

registerMissionModule({
  id: 'Resource Rush',
  build: (scene) => scene._buildResourceRush(),
  evaluate: (scene) => {
    if (scene.state.score >= scene._rushTarget) scene._finish(true, 'resource_complete');
    else if (scene.state.lives <= 0) scene._finish(false, 'out_of_lives');
    else if (scene.state.timer >= timerLimit(scene)) scene._finish(false, 'time_up');
  },
  score: (scene) => scene.state.score / (scene._rushTarget || 1),
});

registerMissionModule({
  id: 'Rival Race',
  build: (scene) => scene._buildRivalRace(),
  tick: (scene) => {
    scene._raceElapsed += 0.016;
    scene.state.rivalScore = Math.min(
      scene._raceTarget,
      Math.floor(scene._raceElapsed * (scene.settings.rival_speed ?? 0.5)),
    );
  },
  evaluate: (scene) => {
    if (scene.state.score >= scene._raceTarget) scene._finish(true, 'beat_rival');
    else if (scene.state.rivalScore >= scene._raceTarget) scene._finish(false, 'rival_won');
  },
  score: (scene) => scene.state.score / (scene._raceTarget || 1),
});

registerMissionModule({
  id: 'Efficiency Trial',
  build: (scene) => scene._buildEfficiencyTrial(),
  evaluate: (scene) => {
    if (scene.state.moves > scene._effBudget) scene._finish(false, 'over_budget');
    else if (scene.state.score >= scene._effTarget) scene._finish(true, 'target_reached');
    else if (scene.state.timer >= timerLimit(scene)) scene._finish(false, 'time_up');
  },
  score: (scene) => Math.min(1, scene.state.score / (scene._effTarget || 1)),
});
