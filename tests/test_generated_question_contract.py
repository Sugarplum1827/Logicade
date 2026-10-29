"""Protect package loading and authored answer keys using the shipped banks."""

import copy
import json
import shutil
import subprocess
from pathlib import Path

import pytest

from server.generated_games import discover_games
from server.opencode_packages import compile_generated_package
from server.question_contract import normalize_game_questions


ROOT = Path(__file__).resolve().parents[1]
LIBRARY = ROOT / "data/opencode_generated/dist"


def test_authored_answer_aliases_are_canonicalized_without_mutating_the_bank():
    bank = [
        {"prompt": "Choose B", "choices": [{"text": "A"}, {"text": "B"}], "correctIndex": 1},
        {"text": "Choose A", "options": ["A", "B"], "correct_index": 0},
        {"question": "Choose B", "options": ["A", "B"], "answer": "B"},
    ]
    original = copy.deepcopy(bank)
    result = normalize_game_questions(bank)
    assert bank == original
    assert [row["answer_index"] for row in result] == [1, 0, 1]
    assert result[0]["options"] == ["A", "B"]


@pytest.mark.parametrize("fields", [
    {"answer_index": True}, {"answer_index": "1"}, {"answer_index": 2},
    {"answer_index": 0, "correctIndex": 1}, {"answer_index": 1, "correctIndex": True},
    {"answer": "missing"}, {"options": ["A", "A"], "answer": "A"},
    {"question": " "}, {"options": ["A", ""]},
])
def test_malformed_banks_are_rejected_before_packaging(fields):
    question = {"question": "Choose B", "options": ["A", "B"], **fields}
    with pytest.raises(ValueError):
        normalize_game_questions([question])


def test_every_shipped_bank_loads_in_the_actual_javascript_runtime():
    games = [game for variations in discover_games(LIBRARY).values() for game in variations]
    assert len(games) == 500
    assert len({game.variation_id for game in games}) == 500
    node = shutil.which("node")
    assert node, "Node is required to verify the production question loader"
    program = """
      import { readFileSync } from 'node:fs';
      const {normalizeQuestions} = await import(process.argv[1]);
      const banks = JSON.parse(readFileSync(0, 'utf8'));
      let count = 0;
      for (const bank of banks) {
        const result = normalizeQuestions({questions:bank});
        if (result.length !== bank.length) throw new Error('question count changed');
        result.forEach((q,i) => {
          if (q.answer !== bank[i].answer_index) throw new Error('answer key changed');
        });
        count += result.length;
      }
      process.stdout.write(String(count));
    """
    banks = [normalize_game_questions(game.description["questions"]) for game in games]
    result = subprocess.run([node, "--input-type=module", "-e", program,
        (LIBRARY / "engine/core.js").as_uri()], input=json.dumps(banks), text=True,
        capture_output=True, check=True, timeout=30)
    assert int(result.stdout) == sum(map(len, banks))


def test_invalid_question_bank_leaves_existing_package_and_metadata_untouched(tmp_path):
    game = discover_games(LIBRARY)["platformer_quest"][0]
    source = tmp_path / "game.json"
    source.write_text('{"file_id":"test"}', encoding="utf-8")
    archive = source.with_suffix(".zip")
    archive.write_bytes(b"existing package")
    description = {**game.description, "questions": [{"question": "Missing answer", "options": ["A", "B"]}]}
    with pytest.raises(ValueError):
        compile_generated_package(source_json=source, pool_root=tmp_path,
            runtime_root=LIBRARY, game=game, description=description, spec={"file_id": "test"},
            backup_root=tmp_path / "backups")
    assert source.read_text(encoding="utf-8") == '{"file_id":"test"}'
    assert archive.read_bytes() == b"existing package"
    assert sorted(path.name for path in tmp_path.iterdir()) == ["game.json", "game.zip"]
