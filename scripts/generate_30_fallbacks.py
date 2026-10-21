"""Generate 30 diverse fallback games for Phase 9.
This ensures the game never repeats, even if the LLM is offline.
"""
import json
import random
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
OUT_DIR = REPO_ROOT / "data" / "fallback_pool"
OUT_DIR.mkdir(parents=True, exist_ok=True)

# Expanded sprite lists (must match what's in registry.json)
PLAYERS = ["player_knight", "player_robot"]
COLLECTIBLES = ["coin", "gem", "star", "heart"]
HAZARDS = ["spike", "slime", "bolt", "rock"]
MAPS = ["grid_12x9_forest", "grid_12x9_cave", "grid_10x8_dungeon"]

def generate_game(idx):
    game_type = random.choice(["collect", "avoid", "survive_timer", "match_sequence", "code_gate"])
    week = (idx % 8) + 1
    difficulty = random.choice(["needs_support", "standard", "advanced"])
    map_id = random.choice(MAPS)
    
    player = {"id": "player", "sprite": random.choice(PLAYERS), "role": "player"}
    entities = [player]
    rules = []
    
    if game_type == "collect":
        target_count = random.randint(3, 5)
        for i in range(target_count):
            cid = f"coin{i}"
            entities.append({"id": cid, "sprite": random.choice(COLLECTIBLES), "role": "collectible"})
            rules.append({"on": f"collision(player,{cid})", "if": "always", "then": ["score += 1", f"destroy({cid})"]})
        win = f"score == {target_count}"
        hint = f"Collect {target_count} items."

    elif game_type == "avoid":
        target_time = random.randint(10, 20)
        entities.append({"id": "hazard1", "sprite": "spike", "role": "hazard"})
        entities.append({"id": "hazard2", "sprite": "slime", "role": "hazard"})
        rules.append({"on": "collision(player,hazard1)", "if": "always", "then": ["score -= 1", "destroy(hazard1)"]})
        rules.append({"on": "collision(player,hazard2)", "if": "always", "then": ["score -= 1", "destroy(hazard2)"]})
        win = f"timer >= {target_time}"
        hint = f"Avoid the hazards for {target_time} seconds!"

    elif game_type == "survive_timer":
        target_time = random.randint(10, 20)
        rules.append({"on": "timer(5)", "if": "always", "then": ["spawn(spike)"]})
        win = f"timer >= {target_time}"
        hint = "Dodge the falling spikes!"

    elif game_type == "code_gate":
        entities.append({"id": "gate1", "sprite": "portal", "role": "gate"})
        rules.append({"on": "collision(player,gate1)", "if": "always", "then": ["open_code_gate"]})
        entities.append({"id": "goal1", "sprite": "flag", "role": "goal"})
        rules.append({"on": "collision(player,goal1)", "if": "score >= 5", "then": ["destroy(goal1)"]})
        win = "score >= 5"
        hint = "Answer the C programming question to open the gate."

    else: # match_sequence
        entities.append({"id": "switch1", "sprite": "rock", "role": "obstacle"})
        entities.append({"id": "switch2", "sprite": "rock", "role": "obstacle"})
        entities.append({"id": "switch3", "sprite": "rock", "role": "obstacle"})
        rules.append({"on": "collision(player,switch1)", "if": "count == 0", "then": ["score += 1", "destroy(switch1)"]})
        rules.append({"on": "collision(player,switch2)", "if": "count == 1", "then": ["score += 1", "destroy(switch2)"]})
        rules.append({"on": "collision(player,switch3)", "if": "count == 2", "then": ["score += 1", "destroy(switch3)"]})
        win = "score == 3"
        hint = "Step on the rocks in order."

    spec = {
        "week": week, "concept": "phase_12_pedagogy", "ilo": "CP1-GEN-ILO1",
        "difficulty": difficulty, "game_type": game_type, "fingerprint": f"fallback_{idx:02d}",
        "entities": entities, "map": map_id, "rules": rules, "win": win, "hint": hint,
        "tutor_note": "Learn the patterns."
    }
    
    filepath = OUT_DIR / f"game_{idx:02d}.json"
    filepath.write_text(json.dumps(spec, indent=2))
    
if __name__ == "__main__":
    for i in range(30):
        generate_game(i)
    print(f"✅ Created 30 diverse fallback games in {OUT_DIR}")