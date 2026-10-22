import json

from server.llm_client import _load_game_template, _merge_template_response


def test_template_lookup_uses_week_level_and_difficulty():
    template = _load_game_template(1, 1, "standard")
    assert template["week"] == 1
    assert template["level"] == 1
    assert template["game_settings"]
    assert template["tutorial"]


def test_llm_response_merges_into_template_without_dropping_schema():
    template = _load_game_template(1, 1, "standard")
    candidate = {
        **template,
        "game_title": "Fresh Variable Quest",
        "mission_type": "Efficiency Trial",
    }
    merged = _merge_template_response(template, json.dumps(candidate))
    assert merged["game_title"] == "Fresh Variable Quest"
    assert merged["mission_type"] == "Efficiency Trial"
    assert merged["accessibility"] == template["accessibility"]
    assert merged["game_settings"] == template["game_settings"]


def test_template_merge_rejects_invalid_llm_json():
    template = _load_game_template(1, 1, "standard")
    assert _merge_template_response(template, '{"_error":"offline"}') is None
