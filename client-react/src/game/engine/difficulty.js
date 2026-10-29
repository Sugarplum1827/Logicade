// §10 deterministic difficulty engine — pure function of three inputs.
// This is the client mirror of server/difficulty_engine.py. Any divergence
// will be detected by the difficulty_divergence detector in Phase 6 (§14.10).

window.LogiCadeDifficulty = (function () {
    /**
     * Apply the §10 threshold table. Boundary is 60% (authoritative),
     * not the 0.50 used in the narrative pseudocode.
     */
    function nextDifficulty(firstAttemptAccuracy, fullLevelReplays, _totalErrors = 0) {
        if (typeof firstAttemptAccuracy !== 'number' || firstAttemptAccuracy < 0 || firstAttemptAccuracy > 1) {
            throw new Error('firstAttemptAccuracy must be in [0, 1]');
        }
        if (fullLevelReplays < 0) {
            throw new Error('fullLevelReplays must be >= 0');
        }

        if (firstAttemptAccuracy < 0.60) return 'needs_support';
        if (firstAttemptAccuracy < 0.80) {
            return fullLevelReplays >= 2 ? 'needs_support' : 'standard';
        }
        return fullLevelReplays >= 2 ? 'standard' : 'advanced';
    }

    return {nextDifficulty};
})();
