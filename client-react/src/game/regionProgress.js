import { stageCountForWeek } from './stageCatalog.js';

export function validCompletedStages(values, week) {
  return [...new Set((Array.isArray(values) ? values : []).filter(stage =>
    Number.isInteger(stage) && stage >= 1 && stage <= stageCountForWeek(week)))].sort((a,b) => a-b);
}

export function readCompletedStages(storage, studentId, regionId, week) {
  if (!studentId) return [];
  try {
    return validCompletedStages(JSON.parse(storage.getItem(`logicade_levels_${studentId}_${regionId}`) || '[]'), week);
  } catch { return []; }
}

export function isWeekComplete(stages, week) {
  return validCompletedStages(stages, week).length === stageCountForWeek(week);
}

export function regionProgress(storage, studentId, regions, synchronized = {}) {
  const completed = Object.fromEntries(regions.map(region => [region.week,
    validCompletedStages([...readCompletedStages(storage, studentId, region.id, region.week),
      ...validCompletedStages(synchronized[region.week], region.week)], region.week)]));
  return Object.fromEntries(regions.map(region => [region.week, {
    completed: completed[region.week],
    complete: isWeekComplete(completed[region.week], region.week),
    unlocked: region.week === 1 || isWeekComplete(completed[region.week-1], region.week-1),
  }]));
}
