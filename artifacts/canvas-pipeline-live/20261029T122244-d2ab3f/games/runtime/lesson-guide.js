(() => {
  'use strict';
  function mount(parent,lesson,dock=false){
    if(!lesson)return;
    const details=document.createElement('details');details.className=dock?'lesson-guide lesson-guide-dock':'lesson-guide';
    const add=(tag,text)=>{const el=document.createElement(tag);el.textContent=text;details.appendChild(el);return el;};
    add('summary',lesson.week===9?`Week 9 examination practice · Week ${lesson.source_week}`:`Week ${lesson.source_week} lesson · ${lesson.stage_title}`);
    add('h2',lesson.title);for(const point of lesson.points||[])add('p',point);
    if(lesson.example)add('pre',lesson.example);
    add('p',lesson.assessment_kind==='examination_practice'?'Examination practice. Results remain separate from formal pretest/posttest scores.':'Apply this lesson in the current mission.');
    for(const source of lesson.sources||[]){if(!/^https:\/\//.test(source.url))continue;const a=add('a',source.title);a.href=source.url;a.target='_blank';a.rel='noopener noreferrer';}
    parent.appendChild(details);
  }
  globalThis.LogiCadeLessonGuide={mount};
})();
