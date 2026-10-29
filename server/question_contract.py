"""Canonicalize authored question metadata without changing its answer key."""

from __future__ import annotations


def normalize_game_questions(questions: object) -> list[dict]:
    if not isinstance(questions, list) or not questions:
        raise ValueError("question bank has no questions")
    normalized = []
    for index, raw in enumerate(questions, start=1):
        if not isinstance(raw, dict):
            raise ValueError(f"question {index} is not an object")
        prompt = raw.get("question", raw.get("prompt", raw.get("text")))
        choices = raw.get("options", raw.get("choices"))
        if not isinstance(prompt, str) or not prompt.strip() or not isinstance(choices, list) or not 2 <= len(choices) <= 6:
            raise ValueError(f"question {index} has an invalid prompt or choices")
        options = [choice if isinstance(choice, str) else choice.get("text") if isinstance(choice, dict) else None for choice in choices]
        if any(not isinstance(choice, str) or not choice.strip() for choice in options):
            raise ValueError(f"question {index} has an empty or invalid choice")
        indexes = [raw[key] for key in ("answer_index", "correct_index", "correctIndex") if raw.get(key) is not None]
        if indexes:
            if any(isinstance(value, bool) or not isinstance(value, int) for value in indexes):
                raise ValueError(f"question {index} has an invalid answer index")
            answer = indexes[0]
            if any(value != answer for value in indexes):
                raise ValueError(f"question {index} has conflicting answer indexes")
        else:
            target = raw.get("answer", raw.get("correct_answer"))
            if isinstance(target, int) and not isinstance(target, bool):
                answer = target
            elif isinstance(target, str) and options.count(target) == 1:
                answer = options.index(target)
            else:
                answer = None
        if isinstance(answer, bool) or not isinstance(answer, int) or not 0 <= answer < len(options):
            raise ValueError(f"question {index} has an invalid answer index")
        normalized.append({
            **raw,
            "id": str(raw.get("id") or f"q{index}"),
            "question": prompt,
            "options": options,
            "answer_index": answer,
            "explanation": str(raw.get("explanation") or ""),
        })
    return normalized
