import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import OracleCompanion from '../../src/components/OracleCompanion.jsx';
import HintConfirmModal from '../../src/components/HintConfirmModal.jsx';
import '../../src/index.css';

function Preview() {
  const [open, setOpen] = useState(false);
  return <main style={{ minHeight: '100dvh', background: '#101c2b', color: '#e2f1ff', padding: 32, boxSizing: 'border-box' }}>
    <h1>Oracle companion preview</h1>
    <p>Isolated appearance preview. No account, gameplay or coin records are changed.</p>
    <p>The Oracle floats and blinks at the bottom right. Click to open hint confirmation.</p>
    {!open && <OracleCompanion onClick={() => setOpen(true)} />}
    {open && <HintConfirmModal cost={6} coins={20} onCancel={() => setOpen(false)} onConfirm={() => setOpen(false)} />}
  </main>;
}
createRoot(document.getElementById('root')).render(<Preview />);
