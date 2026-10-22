from __future__ import annotations

import pytest

from server.fallback_loader import load_registry


@pytest.fixture(scope="module")
def catalog():
    return load_registry()


def test_full_catalog_has_all_2700_definitions(catalog):
    stats = catalog.stats()
    assert stats["attempted"] == 2700
    assert stats["total"] == 2700
    assert stats["missing"] == stats["invalid"] == stats["dups"] == 0
    assert stats["unique_mechanics"] == 135


def test_game_lookup_normalizes_manifest_runtime_metadata(catalog):
    game = catalog.get_by_id("game_0001")
    assert game is not None
    assert game["mission_type"] == game["metadata"]["mission_type"]
    assert game["game_id"] == "game_0001"
    assert game["week"] == 1
    assert game["level"] == 1
    assert game["difficulty"] == "needs_support"


def test_catalog_filters_and_paginates_without_loading_every_definition(catalog):
    games = catalog.list_games(week=1, level=1, difficulty="Need Assistance")
    assert len(games) == 10
    assert all(row["week"] == 1 and row["level"] == 1 for row in games)
    assert all(row["difficulty"] == "needs_support" for row in games)
    assert catalog.list_games(week=99) == []


def test_mechanics_catalog_covers_all_topics_and_mission_modules(catalog):
    mechanics = catalog.mechanics()
    assert len(mechanics) == 135
    assert all(item["count"] > 0 and item["topics"] for item in mechanics)
    assert {mission for item in mechanics for mission in item["mission_types"]} == {
        "Survival Siege", "Streak Challenge", "Resource Rush", "Rival Race", "Efficiency Trial",
    }


def test_catalog_api_routes_are_registered():
    from server import main as api

    paths = {route.path for route in api.app.routes}
    assert {"/api/games", "/api/games/mechanics", "/api/games/{game_id}", "/api/sync/batch", "/api/admin/analytics"} <= paths
