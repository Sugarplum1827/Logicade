"""Independent execution of generated data using the shipped browser models."""
import asyncio
import json
import os
import shutil
import subprocess
from pathlib import Path


def _run_runtime_verifier(node: str, runtime_root: Path, data: bytes) -> subprocess.CompletedProcess:
    """Works on Windows Selector loops too (Uvicorn's reload worker uses one).

    Running in a worker thread keeps inference/game requests responsive. The
    process is always bounded; subprocess.run kills and reaps it on timeout.
    """
    try:
        return subprocess.run(
            [node,'--max-old-space-size=128',str(Path(__file__).with_name('canvas_verify.cjs')),str(runtime_root)],
            input=data,capture_output=True,timeout=12,check=False,
            creationflags=subprocess.CREATE_NO_WINDOW if os.name=='nt' else 0,
        )
    except subprocess.TimeoutExpired:
        raise ValueError('Canvas runtime verifier exceeded its 12-second limit; existing pool retained') from None
    except OSError as exc:
        raise ValueError(f'Could not launch the Node.js Canvas verifier ({type(exc).__name__}); existing pool retained') from None


async def verify_candidate(game: dict, runtime_root: Path) -> dict:
    if not game.get('flowchart') and not game.get('programming'):
        from scripts.archive_lessons import authoring_questions
        bank={r['id']:r for r in authoring_questions(game['source_level'])}
        tasks=game['tasks']
        if len(tasks)!=3 or len({t['id'] for t in tasks})!=3:raise ValueError('Archive must contain three distinct tasks')
        for task in tasks:
            row=bank.get(task['id'])
            if (not row or task['prompt']!=row['prompt'] or task['choices'][task['answer_index']]!=row['answer']
                    or len(set(task['choices']))!=len(task['choices'])
                    or set(task['choices'])-set([row['answer'],*row['distractors']])):
                raise ValueError('Archive task does not match its verified source bank')
        return {'passed':True,'cases':3,'verifier':'authored_archive_bank','answer_keys_checked':True}
    node=os.getenv('LOGICADE_NODE_BINARY') or shutil.which('node')
    if not node:raise ValueError('Node.js is required for independent Canvas runtime verification; existing pool retained')
    process=await asyncio.to_thread(_run_runtime_verifier,node,Path(runtime_root),json.dumps(game).encode())
    try:result=json.loads(process.stdout)
    except (ValueError,UnicodeError):raise ValueError('Runtime verifier did not return a valid result') from None
    if process.returncode or not result.get('passed'):raise ValueError(result.get('error') or 'Runtime reference verification failed')
    return {**result,'verifier':'shipped_canvas_models_v1'}
