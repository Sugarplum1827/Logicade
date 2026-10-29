// Partial performance is descriptive only. Adaptation excludes unfinished runs.
export function unfinishedPerformance(events) {
  const answers=events.filter(e=>e.event_type==='question_answered'&&typeof (e.payload?.correct??e.payload?.ok)==='boolean');
  const correct=answers.filter(e=>(e.payload.correct??e.payload.ok)===true).length;
  const accuracy=answers.length?correct/answers.length:0;
  return {accuracy,score:Math.round(accuracy*100),
    errorCount:events.filter(e=>e.event_type==='answer_incorrect'||e.event_type==='collision'||
      (e.event_type==='question_answered'&&(e.payload?.correct===false||e.payload?.ok===false))).length,
    hintCount:events.filter(e=>e.event_type==='hint_used').length};
}
