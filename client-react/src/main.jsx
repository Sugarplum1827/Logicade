import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

async function bootstrap() {
  try {
    const res = await fetch('/api/config');
    window.LOGICADE_CONFIG = await res.json();
  } catch (e) {
    console.warn('[main] config fetch failed, sync disabled', e);
    window.LOGICADE_CONFIG = { supabaseUrl: '', supabaseAnonKey: '' };
  }

  createRoot(document.getElementById('root')).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}

bootstrap();