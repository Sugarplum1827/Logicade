"""Discovery and topic-aware selection for prebuilt OpenCode games."""

from __future__ import annotations

import json
import random
import re
from dataclasses import dataclass
from pathlib import Path

from .question_contract import normalize_game_questions


_VARIATION_DIR = re.compile(r"^variation(\d+)$", re.IGNORECASE)
_STOP_WORDS = {
    "a", "an", "and", "are", "as", "at", "by", "for", "from", "game", "games",
    "in", "introduction", "of", "on", "or", "program", "programming", "the", "to", "use",
    "using", "with", "your", "cp1", "week", "level", "basic", "basics",
}


@dataclass(frozen=True)
class GeneratedGame:
    game_id: str
    slug: str
    display_name: str
    target: str
    variation_id: str
    variation_title: str
    index: int
    description: dict
    variation_path: Path

    def public_info(self) -> dict:
        return {
            "game_id": self.game_id,
            "slug": self.slug,
            "display_name": self.display_name,
            "target": self.target,
            "variation_id": self.variation_id,
            "variation_title": self.variation_title,
            "index": self.index,
        }


def _read_json(path: Path) -> dict | None:
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, UnicodeDecodeError, json.JSONDecodeError):
        return None
    return value if isinstance(value, dict) else None


def discover_games(root: Path) -> dict[str, list[GeneratedGame]]:
    """Read only well-formed static builds with the expected metadata files."""
    result: dict[str, list[GeneratedGame]] = {}
    if not root.is_dir():
        return result
    for concept_dir in root.iterdir():
        if not concept_dir.is_dir():
            continue
        variations: list[GeneratedGame] = []
        for variation_dir in concept_dir.iterdir():
            match = _VARIATION_DIR.fullmatch(variation_dir.name)
            if not match or not variation_dir.is_dir():
                continue
            if not (variation_dir / "index.html").is_file():
                continue
            metadata = _read_json(variation_dir / "variation.json")
            description = _read_json(variation_dir / "public" / "data" / "description.json")
            if not metadata:
                continue
            slug = str(metadata.get("slug") or concept_dir.name)
            variation_id = str(metadata.get("variation_id") or "")
            if not variation_id:
                continue
            if description is None:
                # The shared DOM runtime stores its authored question bank beside
                # the catalog. Resolve the metadata path and keep it inside dist.
                bank_ref = metadata.get("question_bank")
                bank_path = (variation_dir / str(bank_ref)).resolve() if isinstance(bank_ref, str) else None
                try:
                    if bank_path is None or not bank_path.is_relative_to(root.resolve()):
                        continue
                except OSError:
                    continue
                bank = _read_json(bank_path)
                if not bank or not isinstance(bank.get("questions"), list) or not bank["questions"]:
                    continue
                description = {
                    "game_id": str(metadata.get("concept_id") or slug),
                    "variation_id": variation_id,
                    "title": str(metadata.get("display_name") or slug.replace("_", " ").title()),
                    "subtitle": str(metadata.get("title") or "CP1 challenge"),
                    "topic": str(metadata.get("learning_target") or bank.get("learning_target") or "CP1"),
                    "objective": str(metadata.get("core_brief") or metadata.get("learning_target") or "Complete the CP1 challenge."),
                    "win_condition": "Complete the learning activities in this game.",
                    "hint": str(metadata.get("learning_target") or "Review the concept and reason through each step."),
                    "questions": bank["questions"],
                }
            if not isinstance(description.get("questions"), list) or not description["questions"]:
                continue
            try:
                description = {**description, "questions": normalize_game_questions(description["questions"])}
            except ValueError:
                continue
            variations.append(GeneratedGame(
                game_id=str(metadata.get("concept_id") or slug),
                slug=slug,
                display_name=str(metadata.get("display_name") or slug.replace("_", " ").title()),
                target=str(metadata.get("learning_target") or description.get("topic") or ""),
                variation_id=variation_id,
                variation_title=str(metadata.get("title") or metadata.get("label") or f"Variation {match.group(1)}"),
                index=int(match.group(1)),
                description=description,
                variation_path=(variation_dir / "variation.json").resolve(),
            ))
        if variations:
            result[concept_dir.name] = sorted(variations, key=lambda item: item.index)
    return result


def _tokens(value: object) -> set[str]:
    if not isinstance(value, str):
        return set()
    tokens = set()
    for token in re.findall(r"[a-z0-9]+", value.casefold()):
        if token in _STOP_WORDS:
            continue
        if len(token) > 4 and token.endswith("ies"):
            token = token[:-3] + "y"
        elif len(token) > 4 and token.endswith("s") and not token.endswith("ss"):
            token = token[:-1]
        tokens.add(token)
    return tokens


def select_game(
    spec: dict,
    games: dict[str, list[GeneratedGame]],
    *,
    excluded_ids: set[str] | None = None,
) -> GeneratedGame | None:
    """Choose an unseen variation, preferring the best CP1 topic match."""
    if not games:
        return None
    topic = " ".join(str(spec.get(key) or "") for key in ("topic", "learning_alignment"))
    concept = " ".join(str(spec.get(key) or "") for key in ("game_concept", "game_title", "primary_mechanic", "theme"))
    topic_tokens = _tokens(topic)
    concept_tokens = _tokens(concept)
    scored: list[tuple[int, GeneratedGame]] = []
    for slug, variations in games.items():
        exemplar = variations[0]
        target_tokens = _tokens(" ".join((exemplar.target, exemplar.display_name, slug)))
        target_overlap = len(topic_tokens & target_tokens)
        concept_overlap = len(concept_tokens & target_tokens)
        # Exact concept names in a description are a strong signal; topic alignment
        # still carries more weight than theme or mechanic words.
        exact_concept = bool(exemplar.display_name.casefold() in concept.casefold())
        score = target_overlap * 4 + concept_overlap * 2 + (20 if exact_concept else 0)
        scored.extend((score, game) for game in variations)

    excluded = excluded_ids or set()
    unseen = [(score, game) for score, game in scored if game.variation_id not in excluded]
    pool = unseen or scored
    if not pool:
        return None
    best_score = max(score for score, _ in pool)
    best_matches = [game for score, game in pool if score == best_score]
    return random.choice(best_matches)


def description_for_level(game: GeneratedGame, spec: dict) -> dict:
    """Use the vetted generated-game questions and adapt only host-owned study labels."""
    description = dict(game.description)
    description["questions"] = normalize_game_questions(description.get("questions"))
    difficulty = str(spec.get("difficulty") or "standard").casefold().replace(" ", "_")
    if difficulty in {"need_assistance", "needsupport"}:
        difficulty = "needs_support"
    elif difficulty == "advance":
        difficulty = "advanced"
    description.update({
        "game_id": game.game_id,
        "variation_id": game.variation_id,
        "week": int(spec.get("week") or 1),
        "level": int(spec.get("level") or 1),
        "difficulty": difficulty,
        "topic": str(spec.get("topic") or description.get("topic") or game.target),
    })
    return description


def get_game(game_id: str, games: dict[str, list[GeneratedGame]]) -> GeneratedGame | None:
    for variations in games.values():
        for game in variations:
            if game.variation_id == game_id:
                return game
    return None
