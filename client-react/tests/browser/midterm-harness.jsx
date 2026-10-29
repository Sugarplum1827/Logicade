import {useState} from 'react';
import {createRoot} from 'react-dom/client';
import MidtermAssessment from '../../src/components/MidtermAssessment.jsx';
export function Harness(){const[open,setOpen]=useState(true);return open?<MidtermAssessment studentId="test-owner" onClose={()=>setOpen(false)}/>:<p>Assessment closed</p>;}
createRoot(document.getElementById('root')).render(<Harness/>);
