import { useEffect, useRef, useState } from 'react';
import MidtermAssessment from './MidtermAssessment';
import { guidanceKey, needsFirstVisitGuidance } from '../game/firstVisitGuidance';

const ALLOWED_GAME_EVENTS = new Set([
  'game_started', 'question_answered', 'hint_used', 'activity_completed',
  'checkpoint_saved', 'game_paused', 'game_resumed', 'custom',
]);

/** Runs an imported static game in an opaque-origin sandbox and bridges a small event contract. */
export default function GamePackageFrame({
  launchUrl, studentId, levelId, week, level, difficulty, spec, meta, onPause, onGameOver, onGuidanceChange,
}) {
  const frameRef = useRef(null);
  const startedAtRef = useRef(0);
  const finishedRef = useRef(false);
  const seenEventIds = useRef(new Set());
  const attemptIdRef = useRef(crypto.randomUUID());
  const guidanceRequested = useRef(false);
  const [assessmentContext,setAssessmentContext]=useState(null);
  const showAssessment=Boolean(assessmentContext&&assessmentContext.studentId===studentId&&assessmentContext.launchUrl===launchUrl);

  const handleFrameLoad = () => {
    guidanceRequested.current = needsFirstVisitGuidance(localStorage, studentId, week, level);
    frameRef.current?.contentWindow?.postMessage({
      channel: 'logicade-host',
      version: 1,
      type: 'initialize',
      game_id: meta?.generated_game?.game_id || spec?.file_id || spec?.game_id || null,
      week,
      level: spec?.level ?? null,
      difficulty,
      description: meta?.game_description || spec,
      first_visit_guidance: guidanceRequested.current,
    }, '*');
  };

  useEffect(() => () => onGuidanceChange?.(false), [studentId, launchUrl, onGuidanceChange]);

  useEffect(() => {
    let active = true;
    startedAtRef.current = Date.now();
    finishedRef.current = false;
    seenEventIds.current.clear();
    window.Telemetry?.reset({ attemptId: attemptIdRef.current, studentId, levelId });

    const handlePause = () => {
      frameRef.current?.contentWindow?.postMessage(
        { channel: 'logicade-host', version: 1, type: 'pause' }, '*',
      );
      onPause?.();
    };
    const handleResume = () => frameRef.current?.contentWindow?.postMessage(
      { channel: 'logicade-host', version: 1, type: 'resume' }, '*',
    );
    const handleHint = (event) => frameRef.current?.contentWindow?.postMessage(
      { channel: 'logicade-host', version: 1, type: 'hint', hint: String(event.detail?.hint || '').slice(0, 1000) }, '*',
    );

    const handleGameMessage = (event) => {
      if (event.source !== frameRef.current?.contentWindow) return;
      const message = event.data;
      if (!message || typeof message !== 'object' || message.channel !== 'logicade-game' || message.version !== 1) return;
      if (message.type === 'guidance_started' && guidanceRequested.current) {
        onGuidanceChange?.(true);
        return;
      }
      if (message.type === 'guidance_completed' && guidanceRequested.current) {
        try { localStorage.setItem(guidanceKey(studentId, week), 'done'); } catch { /* Guidance remains playable without browser storage. */ }
        guidanceRequested.current = false;
        onGuidanceChange?.(false);
        return;
      }
      if(message.type==='custom'&&message.event_type==='formal_assessment_requested'&&week===9){
        frameRef.current?.contentWindow?.postMessage({channel:'logicade-host',version:1,type:'pause'},'*');
        setAssessmentContext({studentId,launchUrl});
      }

      if (message.type === 'event' || ALLOWED_GAME_EVENTS.has(String(message.type || ''))) {
        const eventType = String(message.type === 'event' ? message.event_type || '' : message.type || '');
        if (!ALLOWED_GAME_EVENTS.has(eventType) || finishedRef.current) return;
        const eventId = String(message.event_id || `${eventType}:${message.time_ms ?? message.t_ms ?? 0}`);
        if (seenEventIds.current.has(eventId) || seenEventIds.current.size >= 1000) return;
        seenEventIds.current.add(eventId);
        const payload = message.payload && typeof message.payload === 'object'
          ? message.payload
          : Object.fromEntries(Object.entries(message).filter(([key]) => ![
              'channel', 'version', 'type', 'event_type', 'event_id', 'game_id', 'variation_id', 'seed', 't_ms',
            ].includes(key)));
        const rawEventTime = Number(message.time_ms ?? message.t_ms);
        if (eventType === 'custom' && typeof message.event_type === 'string') payload.event_type = message.event_type.slice(0,120);
        window.Telemetry?.emit(eventType, {
          t_ms_since_start: Math.max(0, Math.trunc(Number.isFinite(rawEventTime) ? rawEventTime : Date.now() - startedAtRef.current)),
          entity_id: typeof message.entity_id === 'string' ? message.entity_id.slice(0, 120) : null,
          rule_id: typeof message.rule_id === 'string' ? message.rule_id.slice(0, 120) : null,
          payload,
        });
        return;
      }

      if (message.type === 'pause_request') {
        handlePause();
        return;
      }
      if (message.type !== 'game_over' || finishedRef.current) return;
      finishedRef.current = true;

      const bounded = (value) => Number.isFinite(Number(value))
        ? Math.max(0, Math.min(1, Number(value))) : 0;
      const numericScore = Number(message.score);
      const answered = Number(message.answered);
      const correct = Number(message.correct);
      const result = {
        student_id: studentId,
        level_id: levelId,
        won: message.won === true,
        score: Number.isFinite(numericScore) ? Math.max(0, Math.min(100000, numericScore)) : 0,
        accuracy: bounded(message.accuracy ?? message.score),
        error_count: Math.max(0, Math.trunc(message.error_count != null && Number.isFinite(Number(message.error_count))
          ? Number(message.error_count) : (Number.isFinite(answered) && Number.isFinite(correct) ? answered - correct : 0))),
        hint_count: Math.max(0, Math.trunc(Number(message.hint_count ?? message.hints) || 0)),
        time: message.duration_sec != null && Number.isFinite(Number(message.duration_sec))
          ? Math.max(0, Math.min(86400, Number(message.duration_sec)))
          : Math.max(0, (Date.now() - startedAtRef.current) / 1000),
        reason: typeof message.reason === 'string' ? message.reason.slice(0, 120) : 'package_game_over',
        spec,
        accuracy_basis: typeof message.accuracy_basis === 'string' ? message.accuracy_basis.slice(0, 80) : null,
        formal_assessment: message.formal_assessment === true,
      };
      window.Telemetry?.emit(result.won ? 'level_win' : 'level_lose', {
        t_ms_since_start: Math.trunc(result.time * 1000),
        payload: { reason: result.reason, raw_score: result.score, accuracy: result.accuracy,
          accuracy_basis: result.accuracy_basis, formal_assessment: result.formal_assessment,
          variation_id: meta?.generated_game?.variation_id || null },
      });

      Promise.resolve(window.LogiCadeWrite?.persistAttempt({
        studentId, levelId, week, stageNumber: level, difficulty, spec, meta,
        attemptId: attemptIdRef.current,
        score: result.score, accuracy: result.accuracy,
        errorCount: result.error_count, hintCount: result.hint_count,
        completionTimeSec: result.time, won: result.won,
      })).catch((error) => {
        console.error('[package game] attempt persistence failed:', error);
      }).finally(() => { if (active) onGameOver?.(result); });
    };

    window.addEventListener('message', handleGameMessage);
    window.addEventListener('logicade:pause_game', handlePause);
    window.addEventListener('logicade:resume_game', handleResume);
    window.addEventListener('logicade:show_hint', handleHint);
    return () => {
      active = false;
      window.removeEventListener('message', handleGameMessage);
      window.removeEventListener('logicade:pause_game', handlePause);
      window.removeEventListener('logicade:resume_game', handleResume);
      window.removeEventListener('logicade:show_hint', handleHint);
    };
  }, [studentId, levelId, week, level, difficulty, spec, meta, onPause, onGameOver, launchUrl, onGuidanceChange]);

  return (<>
    {showAssessment&&<MidtermAssessment key={studentId} studentId={studentId} onClose={()=>{setAssessmentContext(null);frameRef.current?.contentWindow?.postMessage({channel:'logicade-host',version:1,type:'resume'},'*');}}/>}
    <iframe
      ref={frameRef}
      title={spec?.game_title || 'LogiCade game'}
      src={launchUrl}
      onLoad={handleFrameLoad}
      className="logicade-game-package-frame"
      sandbox="allow-scripts allow-pointer-lock"
      allow="autoplay; fullscreen"
      referrerPolicy="no-referrer"
    />
  </>);
}
