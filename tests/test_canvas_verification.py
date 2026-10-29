"""Verifier subprocesses must work inside Windows Uvicorn reload workers."""
import asyncio
import json
import shutil
import subprocess
from pathlib import Path

import pytest

from server import canvas_verification as verification

ROOT=Path(__file__).resolve().parents[1]


@pytest.mark.skipif(not shutil.which('node'),reason='Node.js is required')
def test_runtime_verification_works_on_a_selector_event_loop(monkeypatch):
    game=json.loads(next((ROOT/'games/week_2/level6/advanced').glob('*_1.json')).read_text(encoding='utf-8'))
    async def unsupported(*args,**kwargs):raise NotImplementedError('Selector event loops cannot start subprocesses')
    monkeypatch.setattr(asyncio,'create_subprocess_exec',unsupported)
    with asyncio.Runner(loop_factory=asyncio.SelectorEventLoop) as runner:
        result=runner.run(verification.verify_candidate(game,ROOT/'games'))
    assert result['passed'] and result['negative_control'] and result['cases']>0


def test_verification_does_not_block_the_event_loop(monkeypatch):
    import threading
    entered,release=threading.Event(),threading.Event()
    def blocking(*args):
        entered.set()
        if not release.wait(2):raise AssertionError('Verifier blocked the event loop')
        return subprocess.CompletedProcess([],0,b'{"passed":true}')
    monkeypatch.setenv('LOGICADE_NODE_BINARY','node')
    monkeypatch.setattr(verification,'_run_runtime_verifier',blocking)
    async def actual():
        task=asyncio.create_task(verification.verify_candidate({'flowchart':{'schema_version':1}},ROOT/'games'))
        try:
            async with asyncio.timeout(3):
                while not entered.is_set():await asyncio.sleep(.001)
                release.set()
                assert (await task)['passed']
        finally:release.set()
    asyncio.run(actual())


def test_verifier_timeout_is_bounded_and_reports_a_useful_error(monkeypatch):
    def timeout(command,**kwargs):
        assert kwargs['timeout']==12 and kwargs['capture_output']
        assert isinstance(command,list) and 'shell' not in kwargs
        raise subprocess.TimeoutExpired(command,12)
    monkeypatch.setattr(subprocess,'run',timeout)
    with pytest.raises(ValueError,match='12-second limit'):
        verification._run_runtime_verifier('node',ROOT/'games',b'{}')


def test_failed_runtime_receipt_is_still_rejected(monkeypatch):
    monkeypatch.setenv('LOGICADE_NODE_BINARY','node')
    monkeypatch.setattr(verification,'_run_runtime_verifier',lambda *args:subprocess.CompletedProcess([],1,b'{"passed":false,"error":"bad reference"}'))
    with pytest.raises(ValueError,match='bad reference'):
        asyncio.run(verification.verify_candidate({'flowchart':{'schema_version':1}},ROOT/'games'))
