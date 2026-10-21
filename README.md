# LogiCade

LLM-generated adaptive gamified learning for **Computer Programming 1 (CP1)**.

## Architecture
- **Generator:** `qwen2.5:3b` via Ollama (Local LLM).
- **Verifier:** Deterministic 7-check validation (`server/verifier.py`).
- **Game Runtime:** Phaser 3 single-scene DSL interpreter (`client/js/GameScene.js`).
- **Data Layer:** Offline-first with IndexedDB (`client/js/db/`), synced to Supabase.
- **Database:** PostgreSQL with immutable triggers for first-attempt scoring.
- **Dashboard:** Supabase Realtime Admin view.

## How to Run the System

### 1. Start the Backend
```powershell
# Start Ollama (must be in CPU mode due to CUDA driver issues)
$env:OLLAMA_LLM_LIBRARY="cpu_avx2"
ollama serve

# Start Supabase (Docker required)
supabase start

# Start FastAPI
uvicorn server.main:app --reload --port 8000