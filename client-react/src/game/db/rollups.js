// §14.3 Local rollup rebuild. Mirrors the SQL trigger semantics
// (Phase 6 §14.6), with the §2.10 derivation fix: repeats are computed
// as (total_attempts - 1), NOT as an incrementing counter.
//
// Immutability:
//   first_attempt_score / first_attempt_accuracy — set only from the
//   attempt with attempt_number === 1, never overwritten.
//
// Separation:
//   repeats_this_level       = total_attempts - 1
//   total_activity_retries   = sum of a.activity_retries (independent)

window.LogiCadeRollups = (function () {

    async function rebuildLocalRollups(db, studentId) {
        // Read all attempts for this student.
        const attempts = await new Promise((resolve, reject) => {
            const tx = db.transaction('attempts', 'readonly');
            const idx = tx.objectStore('attempts').index('student_id');
            const req = idx.getAll(studentId);
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
        });

        // Group by level_id
        const byLevel = new Map();
        for (const a of attempts) {
            if (!byLevel.has(a.level_id)) byLevel.set(a.level_id, []);
            byLevel.get(a.level_id).push(a);
        }

        const levelSummaries = [];
        const weekAgg = new Map();
        const studentAgg = {
            student_id: studentId,
            levels_played: 0,
            total_level_repeats: 0,
            levels_repeated_at_least_once: 0,
            overall_repeat_rate: 0,
            mean_first_attempt_score: 0,
            mean_best_score: 0,
            total_errors: 0,
            total_hints: 0,
            total_activity_retries: 0,
            total_time_sec: 0,
        };

        for (const [levelId, atts] of byLevel.entries()) {
            // Sort by attempt_number so attempt 1 is always the source of
            // first_attempt_* regardless of arrival order (§17 criterion 12).
            atts.sort((a, b) => a.attempt_number - b.attempt_number);

            const firstAttempt = atts.find(a => a.attempt_number === 1) || atts[0];
            let bestScore = 0;
            let totalErrors = 0;
            let totalHints = 0;
            let totalActivityRetries = 0;
            let totalTimeSec = 0;
            let completedAny = false;
            let fullLevelReplays = 0;

            for (const a of atts) {
                if (completedAny && a.completed) fullLevelReplays += 1;
                bestScore = Math.max(bestScore, a.score ?? 0);
                totalErrors += a.error_count ?? 0;
                totalHints += a.hint_count ?? 0;
                totalActivityRetries += a.activity_retries ?? 0;
                totalTimeSec += a.completion_time_sec ?? 0;
                if (a.completed) completedAny = true;
            }

            const totalAttempts = atts.length;
            const repeats = Math.max(0, totalAttempts - 1);  // §2.10 derivation

            const ls = {
                level_id: levelId,
                student_id: studentId,
                week: firstAttempt.week ?? 0,
                level_index: firstAttempt.level_index ?? 0,
                first_attempt_score: firstAttempt.score,
                first_attempt_accuracy: firstAttempt.accuracy,
                best_score: bestScore,
                total_attempts: totalAttempts,
                repeats_this_level: repeats,
                full_level_replays: fullLevelReplays,
                total_errors: totalErrors,
                total_hints: totalHints,
                total_activity_retries: totalActivityRetries,
                total_time_sec: totalTimeSec,
                completed_any: completedAny,
                next_difficulty_assigned: null,
            };
            levelSummaries.push(ls);

            const w = ls.week;
            if (!weekAgg.has(w)) {
                weekAgg.set(w, {
                    student_id: studentId, week: w,
                    levels_played: 0, total_level_repeats: 0,
                    mean_first_attempt_score: 0, mean_best_score: 0,
                    total_errors: 0, total_hints: 0,
                });
            }
            const wa = weekAgg.get(w);
            wa.levels_played += 1;
            wa.total_level_repeats += repeats;
            wa.total_errors += totalErrors;
            wa.total_hints += totalHints;

            studentAgg.levels_played += 1;
            studentAgg.total_level_repeats += repeats;
            if (repeats > 0) studentAgg.levels_repeated_at_least_once += 1;
            studentAgg.total_errors += totalErrors;
            studentAgg.total_hints += totalHints;
            studentAgg.total_activity_retries += totalActivityRetries;
            studentAgg.total_time_sec += totalTimeSec;
        }

        // Averages
        if (studentAgg.levels_played > 0) {
            let sumFirst = 0, sumBest = 0;
            for (const ls of levelSummaries) {
                sumFirst += ls.first_attempt_score ?? 0;
                sumBest += ls.best_score ?? 0;
            }
            studentAgg.mean_first_attempt_score = sumFirst / studentAgg.levels_played;
            studentAgg.mean_best_score = sumBest / studentAgg.levels_played;
            studentAgg.overall_repeat_rate =
                studentAgg.total_level_repeats / studentAgg.levels_played;
        }
        for (const [w, wa] of weekAgg.entries()) {
            const inWeek = levelSummaries.filter(ls => ls.week === w);
            if (inWeek.length > 0) {
                let sumFirst = 0, sumBest = 0;
                for (const ls of inWeek) {
                    sumFirst += ls.first_attempt_score ?? 0;
                    sumBest += ls.best_score ?? 0;
                }
                wa.mean_first_attempt_score = sumFirst / inWeek.length;
                wa.mean_best_score = sumBest / inWeek.length;
            }
        }

        // Persist all rollups in a single transaction.
        await new Promise((resolve, reject) => {
            const tx = db.transaction(
                ['level_summary', 'week_summary', 'student_summary'],
                'readwrite',
            );
            const lsStore = tx.objectStore('level_summary');
            const wsStore = tx.objectStore('week_summary');
            const ssStore = tx.objectStore('student_summary');
            for (const ls of levelSummaries) lsStore.put(ls);
            for (const wa of weekAgg.values()) wsStore.put(wa);
            ssStore.put(studentAgg);
            tx.oncomplete = resolve;
            tx.onerror = () => reject(tx.error);
        });

        return {
            levelSummaries,
            weekSummaries: Array.from(weekAgg.values()),
            studentSummary: studentAgg,
        };
    }

    return {rebuildLocalRollups};
})();
