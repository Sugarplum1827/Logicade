export const guidanceKey = (studentId, week) => `logicade_game_guidance_v1_${studentId}_w${Number(week)}`;

export function needsFirstVisitGuidance(storage, studentId, week, level) {
  const region = Number(week), stage = Number(level);
  if (!studentId || !Number.isInteger(region) || region < 1 || region > 9 || stage !== (region === 1 ? 2 : 1)) return false;
  try {
    if (storage.getItem(guidanceKey(studentId, region)) === 'done') return false;
    const completed = JSON.parse(storage.getItem(`logicade_levels_${studentId}_w${region}`) || '[]');
    return !Array.isArray(completed) || !completed.includes(stage);
  } catch { return true; }
}
