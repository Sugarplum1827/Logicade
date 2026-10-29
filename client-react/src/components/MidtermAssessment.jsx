import { useEffect, useRef, useState } from 'react';

export default function MidtermAssessment({studentId,onClose}) {
  const [bank,setBank]=useState(null),[answers,setAnswers]=useState({}),[attempt,setAttempt]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false),[result,setResult]=useState(null);
  const session=useRef(localStorage.getItem('logicade_session_token')||'');
  const [reload,setReload]=useState(0),[restartRequired,setRestartRequired]=useState(false);
  const current=()=>localStorage.getItem('logicade_session_token')===session.current;
  const draftKey=bank?`logicade_midterm/${studentId}/${bank.id}/${bank.version}`:null;
  useEffect(()=>{let active=true;const token=session.current;
    fetch('/api/course/midterm',{headers:{Authorization:`Bearer ${token}`},cache:'no-store'}).then(async r=>{const data=await r.json();if(!r.ok)throw new Error(data.detail||'Assessment unavailable');if(!active||!current())return;
      let draft=null;try{draft=JSON.parse(localStorage.getItem(`logicade_midterm/${studentId}/${data.bank.id}/${data.bank.version}`)||'null');}catch{/* A new assessment can start with an empty draft. */}
      setBank(data.bank);setAttempt(draft?.attempt_token||data.attempt_token);setAnswers(draft?.answers||{});
    }).catch(e=>{if(active&&current())setError(e.message);});return()=>{active=false;};
  },[studentId,reload]);
  useEffect(()=>{if(!draftKey||!attempt||result||!current())return;try{localStorage.setItem(draftKey,JSON.stringify({attempt_token:attempt,answers}));}catch{/* Answers remain in memory if browser storage is full. */}},[draftKey,attempt,answers,result]);
  async function submit(){if(busy||!current())return;setBusy(true);setError('');try{const response=await fetch('/api/course/midterm',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${session.current}`},body:JSON.stringify({attempt_token:attempt,answers})});const data=await response.json();if(!response.ok){if([401,409].includes(response.status))setRestartRequired(true);throw new Error(data.detail||'Submission failed');}if(!current())return;setResult(data);localStorage.removeItem(draftKey);}catch(e){if(current())setError(e.message);}finally{setBusy(false);}}
  function restart(){if(draftKey)localStorage.removeItem(draftKey);setBank(null);setAnswers({});setAttempt('');setError('');setRestartRequired(false);setReload(n=>n+1);}
  return <div style={{position:'fixed',inset:0,zIndex:4000,background:'#03111de8',display:'grid',placeItems:'center'}}>
    <section role="dialog" aria-modal="true" aria-label="Instructor CP1 midterm" style={{width:'min(850px,94vw)',maxHeight:'90dvh',overflow:'auto',background:'#102c40',color:'#eff8ed',padding:24,border:'2px solid #7dd8c3',borderRadius:14,fontFamily:'system-ui'}}>
      <h2>{bank?.title||'Instructor CP1 midterm'}</h2><p>Answers determine this assessment result. Game score, combat and completion speed do not contribute.</p>
      <button type="button" onClick={onClose}>Return to game</button>{error&&<p role="alert">{error}</p>}
      {restartRequired&&<button type="button" onClick={restart}>Start a new assessment session and clear this draft</button>}
      {!bank&&!error&&<p role="status">Loading the instructor-approved assessment…</p>}
      {result?<p role="status">Saved assessment: {result.score}/{result.maximum_score}{result.passed===null?'':result.passed?' · Passing requirement met':' · Review required under the instructor’s configured requirement'}</p>:bank&&<>
        {bank.items.map((item,index)=><fieldset key={item.id} style={{margin:'20px 0',padding:16}}><legend>{index+1}. {item.prompt}</legend>
          {item.format==='choice'?item.choices.map((choice,i)=><label key={i} style={{display:'block',padding:8}}><input type="radio" name={item.id} checked={answers[item.id]===i} onChange={()=>setAnswers(a=>({...a,[item.id]:i}))}/>{' '}{choice}</label>):<label>Predicted numeric output <input aria-label={item.prompt} value={answers[item.id]??''} onChange={e=>setAnswers(a=>({...a,[item.id]:e.target.value}))}/></label>}
        </fieldset>)}
        <button type="button" disabled={busy||bank.items.some(i=>answers[i.id]===undefined||answers[i.id]==='')} onClick={submit}>{busy?'Saving assessment…':'Submit assessment'}</button>
      </>}
    </section>
  </div>;
}
