import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './game/telemetry';
import './game/db/local';
import './game/db/write';
import './game/db/rollups';
import './game/engine/difficulty';
import './game/sync/worker';
import App from './App.jsx'

async function bootstrap() {
  try {
    const res = await fetch('/api/config');
    window.LOGICADE_CONFIG = await res.json();
  } catch (e) {
    console.warn('[main] using built-in API paths', e);
    window.LOGICADE_CONFIG = { apiBaseUrl: '/api', catalogPath: '/api/games', syncPath: '/api/sync/batch' };
  }

  window.LogiCadeSync?.init();

  createRoot(document.getElementById('root')).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}

bootstrap();
