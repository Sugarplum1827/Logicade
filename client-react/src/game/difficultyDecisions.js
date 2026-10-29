// The approved CP1 rule stays in LogiCadeDifficulty. This helper controls when
// its evidence becomes a durable transition and when an existing choice is kept.
export const isDifficulty = (value) => ['needs_support', 'standard', 'advanced'].includes(value);
export const evaluatedAttempt = (attempt) => !['abandoned', 'restarted', 'incomplete', 'started'].includes(attempt.status);
export const precedingStage = (week, stage) => Number(week) === 1 && stage <= 2 ? null
  : stage > 1 ? { week: Number(week), stage: stage - 1 } : { week: Number(week) - 1, stage: Number(week) === 2 ? 2 : 10 };

export function difficultyHistoryError(message) {
  return Object.assign(new Error(message), { userMessage: message });
}

export function buildDifficultyDecision({
  studentId, previousLevelId, nextLevel, previousDifficulty, attempts,
  existingDecision, chooseDifficulty, idFactory = () => crypto.randomUUID(),
  now = () => new Date().toISOString(), week, previousWeek, previousStage,
}) {
  // Once served, retain the original selected difficulty even if later replay
  // evidence changes. The actual difficulty served is recorded separately.
  const existingMatches = existingDecision?.student_id === studentId
    && existingDecision.previous_level_id === previousLevelId
    && Number(existingDecision.inputs?.selected_level) === nextLevel;
  if (existingMatches && existingDecision.difficulty_served && isDifficulty(existingDecision.difficulty_selected)) {
    return { decision: existingDecision, changed: false };
  }
  const history = attempts.filter((attempt) => attempt.student_id === studentId && attempt.level_id === previousLevelId)
    .slice().sort((a, b) => a.attempt_number - b.attempt_number || String(a.started_at || '').localeCompare(String(b.started_at || '')));
  const first = history.find(evaluatedAttempt);
  const attemptNumbers=new Set(history.map(a=>a.attempt_number));
  if (!first || !history.some((attempt) => attempt.attempt_number === 1) || !history.some((attempt) => attempt.completed === true)
      || attemptNumbers.size!==Math.max(0,...attemptNumbers)
      || !Number.isFinite(first.accuracy) || first.accuracy < 0 || first.accuracy > 1) {
    throw difficultyHistoryError('The previous stage’s attempt history is unavailable. Synchronize this account before continuing.');
  }
  let completedAny = false;
  let replays = 0;
  let errors = 0;
  for (const attempt of history) {
    if (completedAny && attempt.completed === true) replays += 1;
    if (attempt.completed === true) completedAny = true;
    errors += Math.max(0, Number(attempt.error_count) || 0);
  }
  const inputs = {
    first_attempt_accuracy: first.accuracy,
    full_level_replays: replays,
    total_errors: errors,
    previous_level: previousStage ?? nextLevel - 1,
    selected_level: nextLevel,
    first_evaluated_attempt_id: first.attempt_id,
    first_evaluated_attempt_number: first.attempt_number,
    evidence_policy: 'first_evaluated_attempt',
    ...(week ? { selected_week: week, previous_week: previousWeek ?? week } : {}),
  };
  const selected = chooseDifficulty(first.accuracy, replays, errors);
  if (!isDifficulty(selected)) throw new Error('The CP1 difficulty engine returned an unsupported category.');
  if (existingMatches
      && ['cp1-60-v2','cp1-60-v2-local'].includes(existingDecision.rule_version)
      && existingDecision.difficulty_selected === selected
      && Object.entries(inputs).every(([key, value]) => existingDecision.inputs?.[key] === value)) {
    return { decision: existingDecision, changed: false };
  }
  if (existingMatches && existingDecision?.decision_id) inputs.supersedes_decision_id = existingDecision.decision_id;
  const timestamp = now();
  const accuracy = first.accuracy;
  const reason = accuracy < 0.6
    ? 'First evaluated attempt accuracy was below 60%.'
    : accuracy < 0.8 && replays >= 2
      ? 'First evaluated attempt accuracy was 60–79% with at least two full-level replays.'
      : accuracy < 0.8
        ? 'First evaluated attempt accuracy was 60–79% with fewer than two full-level replays.'
        : replays >= 2
          ? 'First evaluated attempt accuracy was at least 80% with at least two full-level replays.'
          : 'First evaluated attempt accuracy was at least 80% with fewer than two full-level replays.';
  return { changed: true, decision: {
    decision_id: idFactory(), student_id: studentId,
    previous_level_id: previousLevelId, next_level_id: null,
    difficulty_before: previousDifficulty,
    difficulty_selected: selected, difficulty_served: null,
    inputs, rule_version: 'cp1-60-v2-local', reason,
    decided_at: timestamp, created_at: timestamp,
  } };
}

const storedObject = (storage, key) => {
  try {
    const value = JSON.parse(storage.getItem(key) || '{}');
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  } catch { return {}; }
};

const getRequest = (db, store, key, index) => new Promise((resolve, reject) => {
  const transaction = db.transaction(store, 'readonly');
  const source = transaction.objectStore(store);
  const request = index ? source.index(index).getAll(key) : source.get(key);
  request.onsuccess = () => resolve(request.result);
  request.onerror = () => reject(request.error);
});

export async function cacheServerDifficulty({data, studentId, regionId, storage, openDB, isCurrentSession = () => true}) {
  if (!isDifficulty(data?.difficulty) || !data.target_level_id || !Array.isArray(data.levels) || !Array.isArray(data.attempts)
      || [...data.levels, ...data.attempts, ...(data.decision ? [data.decision] : [])].some(row => row.student_id !== studentId)) {
    throw difficultyHistoryError('The server returned invalid difficulty history for this account.');
  }
  if (!isCurrentSession()) throw difficultyHistoryError('The account changed while its difficulty history was loading.');
  const db = await openDB();
  const pending = await new Promise((resolve,reject) => {const tx=db.transaction('sync_queue','readonly');const req=tx.objectStore('sync_queue').getAll();req.onsuccess=()=>resolve(req.result||[]);req.onerror=()=>reject(req.error);});
  const protectedIds=new Set(pending.filter(j=>j.payload?.student_id===studentId&&j.status!=='done').map(j=>j.payload?.attempt_id).filter(Boolean));
  const recoveredAttempts=data.attempts.filter(row=>!protectedIds.has(row.attempt_id));
  const localLevels=await new Promise((resolve,reject)=>{const tx=db.transaction('levels','readonly');const req=tx.objectStore('levels').getAll();req.onsuccess=()=>resolve(req.result||[]);req.onerror=()=>reject(req.error);});
  const recoveredLevels=data.levels.map(row=>({
    ...localLevels.find(local=>local.level_id===row.level_id&&local.student_id===studentId),
    ...Object.fromEntries(Object.entries(row).filter(([,value])=>value!=null)),
  }));
  if (!isCurrentSession()) throw difficultyHistoryError('The account changed while its difficulty history was loading.');
  if (data.levels.length || recoveredAttempts.length || data.decision) await new Promise((resolve,reject)=>{
    const tx=db.transaction(['levels','attempts','difficulty_decisions'],'readwrite');
    for(const row of recoveredLevels) tx.objectStore('levels').put(row);
    for(const row of recoveredAttempts) tx.objectStore('attempts').put(row);
    if(data.decision) tx.objectStore('difficulty_decisions').put(data.decision);
    tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error||new Error('Difficulty history recovery aborted'));
  });
  if (!isCurrentSession()) throw difficultyHistoryError('The account changed while its difficulty history was loading.');
  for(const row of data.levels)if(row.stage_number)storage.setItem(`logicade_level_id_${studentId}_w${row.week}_${row.stage_number}`,row.level_id);
  storage.setItem(`logicade_level_id_${studentId}_${regionId}_${data.stage}`,data.target_level_id);
  const key=`logicade_difficulty_decisions_${studentId}_${regionId}`;
  if(data.decision)storage.setItem(key,JSON.stringify({...storedObject(storage,key),[data.stage]:data.decision}));
  const assigned=`logicade_difficulty_${studentId}_${regionId}`;
  storage.setItem(assigned,JSON.stringify({...storedObject(storage,assigned),[data.stage]:data.difficulty}));
  return {difficulty:data.difficulty,decision:data.decision};
}

// Both completion and level-node selection use this path. An unlocked stage
// therefore cannot bypass adaptation by leaving its predecessor's result page.
export async function resolveStageDifficulty({
  studentId, regionId, week, stage, storage, openDB, persistDecision, chooseDifficulty,
  previousLevelId: explicitPreviousLevelId, isCurrentSession = () => true, fetchServerDecision,
}) {
  if (fetchServerDecision) return cacheServerDifficulty({data:await fetchServerDecision(week,stage),studentId,regionId,storage,openDB,isCurrentSession});
  // A watched orientation contains no scored question evidence. Its first
  // learning stage uses the initial Standard setting. Later regions carry over.
  if (stage === 1 && (!week || Number(week)===1)) return { difficulty: 'standard', decision: null };
  const afterOrientation = Number(week) === 1 && stage === 2;
  const prior=afterOrientation ? {week:1,stage:1} : week ? precedingStage(week,stage) : {week,stage:stage-1};
  const previousLevelId = explicitPreviousLevelId
    || storage?.getItem(`logicade_level_id_${studentId}_${!week||prior?.week===Number(week)?regionId:`w${prior?.week}`}_${prior?.stage}`);
  if (afterOrientation && !previousLevelId) return { difficulty: 'standard', decision: null };
  if (!studentId || !regionId || !Number.isInteger(stage) || stage < 1 || stage > 10 || !previousLevelId) {
    throw difficultyHistoryError('The previous stage’s saved history is unavailable. Synchronize this account before continuing.');
  }
  const db = await openDB();
  const [attempts, previousLevel, recorded] = await Promise.all([
    getRequest(db, 'attempts', previousLevelId, 'level_id'),
    getRequest(db, 'levels', previousLevelId),
    getRequest(db, 'difficulty_decisions', studentId, 'student_id'),
  ]);
  if (previousLevel?.student_id !== studentId) {
    throw difficultyHistoryError('The previous stage’s saved history is unavailable for this account.');
  }
  const key = `logicade_difficulty_decisions_${studentId}_${regionId}`;
  const decisions = storedObject(storage, key);
  const matching = [...(recorded || []), decisions[stage]].filter((decision) => decision
    && decision.student_id === studentId && decision.previous_level_id === previousLevelId
    && Number(decision.inputs?.selected_level) === stage && isDifficulty(decision.difficulty_selected));
  matching.sort((a, b) => Number(Boolean(b.difficulty_served)) - Number(Boolean(a.difficulty_served))
    || String(b.decided_at || '').localeCompare(String(a.decided_at || '')));
  if (afterOrientation) {
    if (!isCurrentSession()) throw difficultyHistoryError('The account changed while its difficulty history was loading. Select the stage again.');
    // Preserve any recorded choice from an older course version. A new video
    // completion supplies no scored evidence and must not replace that history.
    const decision = matching[0] || null;
    return { difficulty: decision?.difficulty_selected || 'standard', decision };
  }
  const { decision, changed } = buildDifficultyDecision({
    studentId, previousLevelId, nextLevel: stage,
    previousDifficulty: isDifficulty(previousLevel.difficulty_served) ? previousLevel.difficulty_served : null,
    attempts: attempts || [], existingDecision: matching[0], chooseDifficulty,
    week:Number(week)||undefined,previousWeek:prior?.week,previousStage:prior?.stage,
  });
  if (!isCurrentSession()) throw difficultyHistoryError('The account changed while its difficulty history was loading. Select the stage again.');
  if (changed) await persistDecision(decision);
  if (!isCurrentSession()) throw difficultyHistoryError('The account changed while its difficulty history was loading. Select the stage again.');
  // Re-read after the save to retain decisions for other stages made meanwhile.
  storage.setItem(key, JSON.stringify({ ...storedObject(storage, key), [stage]: decision }));
  const assignmentsKey = `logicade_difficulty_${studentId}_${regionId}`;
  storage.setItem(assignmentsKey, JSON.stringify({ ...storedObject(storage, assignmentsKey), [stage]: decision.difficulty_selected }));
  return { difficulty: decision.difficulty_selected, decision };
}
