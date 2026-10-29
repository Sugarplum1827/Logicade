import {useState} from 'react';
import {createRoot} from 'react-dom/client';
import WorldMap from '../../src/components/WorldMap.jsx';
import '../../src/index.css';
const participant='QA-REGION-PROGRESS';
function Harness(){
  const[version,setVersion]=useState(0),[entered,setEntered]=useState(null);
  function fixture(stages){
    localStorage.setItem(`logicade_levels_${participant}_w1`,JSON.stringify(stages));
    setEntered(null);setVersion(value=>value+1);
  }
  return <>
    <nav style={{position:'fixed',top:0,left:0,right:0,zIndex:9999,background:'#07131e',color:'white',padding:8,display:'flex',gap:10,alignItems:'center'}} aria-label="Regression fixture controls">
      <span>Isolated map QA · no study records</span>
      <button onClick={()=>fixture([1])}>Before Kingdom Level 2</button>
      <button onClick={()=>fixture([1,2])}>Kingdom completed</button>
      <button onClick={()=>{setEntered(null);setVersion(value=>value+1);}}>Reopen map</button>
    </nav>
    {entered?<p role="status" style={{padding:80}}>Entered {entered.title}, Week {entered.week}</p>:
      <WorldMap key={version} studentId={participant} coins={20} playerLevel={1} xp={0}
        currentSubject="cp1" onEnterRegion={setEntered} onSwitchSubject={()=>{}} onBack={()=>{}} onLogout={()=>{}}/>}
  </>;
}
createRoot(document.getElementById('root')).render(<Harness/>);
