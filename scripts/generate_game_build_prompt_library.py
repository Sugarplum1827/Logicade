from __future__ import annotations

import argparse
import zipfile
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
LIBRARY = ROOT / "data" / "game_build_prompts"
ARCHIVE = ROOT / "data" / "game_build_prompts.zip"


# Each item describes an original LogiCade game family, not a recreation of a
# copyrighted game's characters, levels, sprites, sound, or branding.
CONCEPTS = [
    ("Platformer Quest", "platformer_quest", "Super Mario-like cheerful platforming", "side-scrolling", "Answer programming questions to leap between safe platforms and cross spike gaps.", "Castle rooftops, bright hills, and floating practice platforms", "valid variable names", "springy jumps, landing squash, and a celebratory flag wave"),
    ("Space Shooter Code", "space_shooter_code", "Super Mario arcade color with Operation: Vietnam tactical readability", "overhead arcade", "Choose valid syntax to charge a ship's blaster and clear asteroids before they hit the convoy.", "A starfield with asteroid belts, beacon lanes, and a small convoy", "syntax recognition", "laser charge, asteroid fragments, and short ship banking turns"),
    ("Maze Runner Flowchart", "maze_runner_flowchart", "Zelda-like top-down exploration and puzzle readability", "top-down", "Arrange flowchart blocks to guide a courier through a maze to the exit.", "An old garden maze with gates, switches, and marked junctions", "sequence and flowchart logic", "tile-by-tile steps, turning, and gates opening in sequence"),
    ("Tower Defense Logic", "tower_defense_logic", "9 Kings-like compact kingdom strategy", "overhead strategy board", "Use conditional rules to place defenders on lanes where incoming enemies need them.", "A small fortified settlement with three approach lanes and build pads", "conditionals", "unit placement, wave arrival, and clear attack/readiness cues"),
    ("Farm Management Script", "farm_management_script", "Pokémon-like friendly world exploration", "top-down", "Use loops to water, tend, and harvest crops in the right order before weather changes.", "A cozy farm with crop plots, a water channel, storage, and wandering critters", "loops and repeated instructions", "plant growth stages, watering arcs, and harvest bursts"),
    ("Puzzle Dungeon", "puzzle_dungeon", "Castlevania gothic mood with Zelda-like room puzzles", "room-based side view", "Solve short code snippets to unlock enchanted doors and reach the dungeon exit.", "A lantern-lit stone dungeon with sealed doors, pressure plates, and safe rooms", "code tracing and basic syntax", "door runes, key pickup, and room transition animations"),
    ("Cyber Hacker Grid", "cyber_hacker_grid", "Zelda-like route puzzles in an original digital world", "top-down grid", "Sequence commands to route a signal through a firewall grid without triggering alarms.", "A neon data maze with nodes, locked links, and security scan zones", "sequencing and algorithmic flow", "signal pulses, node activation, and alert scan sweeps"),
    ("Underwater Submarine", "underwater_submarine", "Pokémon exploration with Zelda-like environmental puzzles", "side-view submarine", "Use depth variables and sonar readings to navigate safely to a treasure marker.", "Layered ocean depths with reefs, currents, air pockets, and sonar targets", "variables, comparison, and coordinate reasoning", "submarine pitch, sonar rings, and bubbles"),
    ("Rhythm Code Beats", "rhythm_code_beats", "Super Mario-like expressive arcade platforming", "side-scrolling rhythm lane", "Match code commands to the beat to clear bugs and keep the music loop intact.", "A colorful soundstage with beat lanes, bug notes, and tempo markers", "command order and pattern recognition", "beat-synced steps, note pops, and readable combo effects"),
    ("Detective Crime Lab", "detective_crime_lab", "Pokémon-like approachable investigation and clue discovery", "top-down investigation", "Use flowchart logic to compare clues, rule out suspects, and solve a small case.", "A compact original town block with a lab, scene, and witness locations", "branching logic and evidence-based decisions", "magnifying-glass focus, clue cards, and deduction reveal"),
    ("Cooking Kitchen Automation", "cooking_kitchen_automation", "Super Mario-like playful timed challenge", "overhead kitchen", "Build a recipe loop that prepares orders in the correct sequence before the timer runs out.", "A bright kitchen with ingredient bins, prep boards, and cooking stations", "loops and ordered steps", "chopping, cooking steam, and plate presentation"),
    ("Zombie Survival Barricade", "zombie_survival_barricade", "Operation: Vietnam tactical pressure with gothic night mood", "overhead tactical", "Use Boolean rules to choose which windows and doors to barricade as threats approach.", "A small safehouse floor plan with entry points and limited supplies", "Boolean logic and conditions", "barricade placement, warning signals, and enemy approach silhouettes"),
    ("Medieval Castle Siege", "medieval_castle_siege", "9 Kings strategy with Castlevania gothic fortress atmosphere", "overhead battle board", "Use flowchart commands to direct archers and protect the castle gate through enemy waves.", "A compact castle wall, gate, archer posts, and two enemy approach lanes", "flowchart commands and sequence", "archer draw-and-release, wave banners, and gate damage feedback"),
    ("Pirate Island Voyage", "pirate_island_voyage", "Zelda exploration with Pokémon-like colorful discovery", "top-down island map", "Use coordinates to steer a ship around reefs and reach marked island destinations.", "A chain of small islands, reef tiles, coves, and navigational landmarks", "coordinates and ordered movement", "ship turning, sail billow, wake, and map discovery"),
    ("Train Track Builder", "train_track_builder", "Zelda-like connected-route puzzle", "isometric rail board", "Rearrange flowchart-controlled switches to route trains safely to their stations.", "A compact rail yard with junctions, signals, platforms, and crossing hazards", "flowcharts and sequencing", "switch throws, signal changes, and readable train movement"),
    ("Jungle Vine Swinger", "jungle_vine_swinger", "Super Mario-like colorful momentum platforming", "side-scrolling", "Use functions to trigger vine swings and carry the explorer across gaps.", "A layered jungle canopy with safe ledges, vines, and canyon gaps", "functions and reusable actions", "vine arc, grab/release, and landing recovery"),
    ("Factory Assembly Line", "factory_assembly_line", "9 Kings-like systems strategy in a playful factory", "overhead factory board", "Create sorting rules that send widgets to the correct assembly stations.", "A modular factory floor with conveyors, sort gates, and output bins", "sorting rules and conditionals", "conveyor flow, gate flips, and machine cycle animations"),
    ("Time Travel Paradox", "time_travel_paradox", "Zelda puzzle exploration with Castlevania atmosphere", "room-based adventure", "Repair timeline logic by placing events in the correct order across two eras.", "A small clockwork ruin with past and future versions of each room", "sequence, conditions, and cause/effect", "timeline wipe, object state changes, and portal transitions"),
    ("Vampire Castle Escape", "vampire_castle_escape", "Castlevania gothic side-scrolling adventure", "side-scrolling", "Declare and assign variables to unlock coffins, gates, and a route out of the castle.", "A gothic castle wing with candlelit halls, staircases, and sealed coffins", "variable declaration and assignment", "cloak turns, coffin lid movement, and torch flicker"),
    ("Alien Laboratory", "alien_laboratory", "Pokémon creature discovery with Zenonia-like pixel RPG movement", "top-down lab", "Define simple functions to create and safely classify original test creatures.", "A colorful alien lab with specimen pods, safe rooms, and experiment stations", "function definitions and parameters", "pod opening, creature idle cycles, and scan effects"),
    ("Supermarket Cashier Rush", "supermarket_cashier_rush", "Super Mario-like lively arcade pacing", "side-view counter", "Use arithmetic to total groceries, return change, and keep checkout orders moving.", "A friendly neighborhood store with checkout lanes, shelves, and a queue", "arithmetic and order of operations", "scanner flashes, item slide, and receipt print"),
    ("Ninja Shadow Stealth", "ninja_shadow_stealth", "Castlevania-like dramatic shadows with precise platform movement", "side-view stealth", "Use decision-tree choices to avoid guards and reach a safe exit.", "A moonlit training compound with patrol routes, hiding spots, and lantern zones", "decision trees and branching choices", "crouch, short dash, guard turn, and alert meter"),
    ("Magic Spell Caster", "magic_spell_caster", "Zelda puzzle adventure with original fantasy spell effects", "top-down arena", "Assemble syntax-based incantations to cast the correct spell for each obstacle.", "A magical academy courtyard with practice targets, barriers, and rune doors", "syntax structure and command matching", "rune tracing, spell charge, and target response"),
    ("Volcano Evacuation", "volcano_evacuation", "Super Mario obstacle readability with Operation: Vietnam urgency", "overhead rescue map", "Use loops to guide groups of citizens along safe evacuation routes.", "A volcanic village with safe zones, lava channels, bridges, and falling debris", "loops and repeated movement", "group movement, route markers, and non-graphic hazard warnings"),
    ("Cyberpunk Courier", "cyberpunk_courier", "Zenonia-like pixel action RPG in an original neon city", "top-down city", "Route encrypted packages to the right API endpoint while avoiding delivery delays.", "A compact neon district with terminals, alleys, checkpoints, and rooftop paths", "API endpoint concepts and data routing", "courier dash, package scan, and terminal handshake"),
    ("Haunted Mansion Explorer", "haunted_mansion_explorer", "Castlevania gothic rooms with Zelda-like puzzle exploration", "room-based top-down", "Use flowchart logic to complete a sequence of harmless exorcism tasks.", "A creaky mansion with rooms, clues, switches, and friendly ghost characters", "flowcharts and branching logic", "door creak, clue reveal, and ghost fade"),
    ("Desert Oasis Survival", "desert_oasis_survival", "Zelda-like exploration and environmental resource puzzles", "top-down desert", "Allocate water and supplies across a route so the expedition reaches an oasis.", "A desert map with dunes, shade, wells, landmarks, and safe camps", "resource allocation and algorithmic choices", "heat shimmer, water level, and camp setup"),
    ("Circus Acrobatics", "circus_acrobatics", "Super Mario-like playful precision platforming", "side-scrolling stage", "Set loop boundaries to time flips, catches, and safe landings during a performance.", "A colorful circus rig with trampolines, platforms, ropes, and landing mats", "loop bounds and iteration", "flip arc, catch pose, and crowd-safe celebration"),
    ("Royal Court Advisor", "royal_court_advisor", "9 Kings kingdom decisions with original storybook presentation", "strategy decision board", "Use flowcharts to advise a digital ruler through policy choices and consequences.", "A palace council chamber with advisors, a kingdom map, and decision cards", "flowcharts and conditional reasoning", "advisor reactions, map state changes, and decision stamps"),
    ("Gladiator Arena Builder", "gladiator_arena_builder", "9 Kings tactical placement with Zenonia-like pixel characters", "overhead arena board", "Use array indexes to place the right training units in matching arena positions.", "A compact arena with numbered lanes, benches, and safe practice targets", "arrays and indexes", "unit selection, lane highlight, and non-violent sparring cues"),
    ("Deep Sea Abyssal Dive", "deep_sea_abyssal_dive", "Castlevania-like atmospheric tension with Zelda-like exploration", "side-view submarine", "Use error handling steps to diagnose and patch hull leaks during a deep dive.", "A deep-sea trench with pressure zones, repair panels, and illuminated landmarks", "error handling and recovery", "pressure gauge, repair sparks, and controlled bubbles"),
    ("Candy Factory Conveyor", "candy_factory_conveyor", "Super Mario-like bright conveyor challenge", "side-view factory", "Use conditionals to sort sweets by shape and send each batch to the correct bin.", "A candy workshop with conveyor belts, diverters, and color-coded bins", "conditionals and comparisons", "candy bounce, conveyor movement, and diverter snap"),
    ("Eco-Park Conservation", "eco_park_conservation", "Pokémon-like friendly wildlife exploration and care", "top-down park", "Use flowchart choices to balance habitats and keep wildlife needs in range.", "A small conservation park with habitat zones, paths, water, and observation points", "flowcharts and systems reasoning", "plant growth, animal movement, and habitat status cues"),
    ("Retro Arcade Ponger", "retro_arcade_ponger", "Super Mario-inspired cheerful arcade energy", "single-screen arcade", "Adjust velocity variables to guide a paddle and return the ball through target zones.", "A clean retro court with bumpers, moving targets, and score lanes", "velocity variables and simple physics", "paddle response, ball trail, and readable rebound effects"),
    ("Weather Station Forecaster", "weather_station_forecaster", "Zelda-like discovery with calm scientific exploration", "top-down station map", "Compare sensor values with thresholds to forecast weather and prepare the station.", "A mountain weather station with instruments, radar, and outdoor observation points", "numeric thresholds and comparisons", "wind flags, cloud drift, and instrument needle movement"),
    ("Museum Heist Puzzle", "museum_heist_puzzle", "Castlevania-like shadowy drama with Zelda-like security puzzles", "top-down gallery", "Use flowchart paths to cross laser grids and reach a display without triggering alarms.", "An original museum gallery with laser lanes, pedestals, cameras, and service routes", "flowcharts and path planning", "laser sweeps, camera turns, and silent route markers"),
    ("Airport Flight Control", "airport_flight_control", "Operation: Vietnam overhead coordination with calm readable UI", "overhead control board", "Use queues and sequencing to guide arrivals to safe runways in order.", "An airport map with runways, taxi lanes, holding zones, and weather markers", "queues and sequencing", "plane movement, queue indicators, and runway lights"),
    ("Baking Bakery Rush", "baking_bakery_rush", "Super Mario-like colorful timed challenge", "overhead bakery", "Use conditionals to select oven settings and prevent each recipe from over- or under-baking.", "A warm bakery with ingredient stations, ovens, timers, and serving counter", "conditionals and thresholds", "dough rise, oven glow, and tray delivery"),
    ("Superhero City Patrol", "superhero_city_patrol", "Zenonia-like pixel action adventure with original heroic characters", "top-down city", "Use response vectors to choose the fastest safe route to city emergencies.", "A compact city district with rooftops, streets, rescue points, and obstacles", "vectors and directional movement", "hero run cycle, route arrow, and rescue signal"),
    ("Ghost Train Conductor", "ghost_train_conductor", "Castlevania-like spectral atmosphere and Zelda-like route puzzles", "side-view rail map", "Switch flowchart paths to route a friendly ghost train to the correct station.", "A moonlit railway with branching tracks, signals, stations, and harmless spirits", "flowchart paths and branching", "track switch, train roll, and spectral lantern glow"),
    ("Botanic Garden Growth", "botanic_garden_growth", "Pokémon-like bright nature discovery", "top-down garden", "Apply syntax rules to cross-pollinate plants and grow a set of target flowers.", "A botanical garden with beds, greenhouse, pollinator paths, and seed stations", "syntax rules and ordered actions", "bud-to-flower stages, pollen drift, and gentle pollinator flight"),
    ("Mountain Peak Climber", "mountain_peak_climber", "Zelda exploration with Super Mario-like clear platforming", "side-scrolling climb", "Use loop iterations to climb a route while respecting safe stopping points.", "A snowy mountain with ledges, ladders, ropes, and warming shelters", "loop iterations and bounds", "climb cycle, wind gust, and checkpoint flag"),
    ("Pixel Art Restorer", "pixel_art_restorer", "Super Mario-like playful visual feedback in a pixel-art puzzle", "grid puzzle", "Use nested coordinate loops to restore missing tiles in a small image.", "A gallery of damaged pixel murals, tile palettes, and coordinate grids", "matrix coordinates and nested loops", "tile placement, image fill, and restoration shimmer"),
    ("Wild West Sheriff", "wild_west_sheriff", "Operation: Vietnam tactical readability in a friendly western town", "overhead town map", "Use decision blocks to select safe responses to outlaw distractions and protect townsfolk.", "A stylized frontier town with cover, routes, and non-violent capture objectives", "decision blocks and conditions", "search movement, warning markers, and safe capture effects"),
    ("Stellar Observatory", "stellar_observatory", "Zelda-like quiet exploration and discovery", "top-down observatory", "Use telescope coordinates to locate stars and identify a target exoplanet pattern.", "An observatory, night-sky map, telescope platform, and constellation charts", "coordinates and pattern matching", "telescope rotation, star linking, and discovery reveal"),
    ("Candy Kingdom Defender", "candy_kingdom_defender", "9 Kings strategy with Super Mario-like candy-bright charm", "overhead defense board", "Use Boolean statements to decide which castle defenses activate against each wave.", "A candy-colored kingdom with gate lanes, friendly defenders, and wave markers", "Boolean logic and conditions", "defense activation, wave arrival, and candy-themed impact cues"),
    ("Sewer Pipe Plumber", "sewer_pipe_plumber", "Zelda-like underground route and mechanism puzzle", "top-down pipe grid", "Connect flowchart connectors to route water around leaks and restore the neighborhood supply.", "A tiled sewer network with valves, broken joints, flow indicators, and service rooms", "flowchart connectors and sequence", "water flow, valve turns, and leak repair"),
    ("Retro RPG Tavern", "retro_rpg_tavern", "Zenonia-like pixel RPG hub with Pokémon-like memorable characters", "top-down tavern", "Follow dialogue-tree rules to learn clues and complete a small quest chain.", "A cozy pixel tavern with regulars, quest board, innkeeper, and nearby exit", "dialogue trees and branching logic", "NPC idle loops, dialogue portraits, and quest update"),
    ("Music Synthesizer Studio", "music_synthesizer_studio", "Super Mario-like colorful playful arcade presentation", "single-screen studio", "Adjust frequency and wave settings to compose short patterns that match target sounds.", "A bright synthesizer room with waveform displays, pads, and sound meters", "frequency, wave forms, and pattern matching", "waveform animation, pad pulse, and synchronized visual notes"),
    ("Quantum Computing Lab", "quantum_computing_lab", "Zelda-like readable puzzle rooms with 9 Kings strategic choices", "grid-based lab puzzle", "Arrange quantum-gate flow blocks to transform an input state into a target output.", "A clean futuristic lab with gate tiles, input/output panels, and test chambers", "quantum-gate sequencing and computational puzzles", "gate pulse, state visualization, and chamber success animation"),
]


VARIATIONS = [
    ("Forked Routes", "Build a two-branch map that rejoins at the goal. Each branch tests the same learning target through a different decision; include a safe optional detour with a bonus clue.", "choice gates and a clearly marked fork", "brisk choice-and-feedback rhythm", "animate the fork opening, route selection, and branches rejoining"),
    ("Loopback Circuit", "Build a looping route that returns to one earlier landmark before reaching the exit. Make the repeated section change state after each successful answer.", "repeat hazards, loop gates, and one changing checkpoint", "steady rhythm with a faster second pass", "animate loop counters, changed obstacle states, and repeated traversal"),
    ("Vertical Ascent", "Build a vertically layered level with at least three distinct heights or floors. A correct response opens the next climb segment; provide safe recovery platforms.", "gaps, lifts or ladders, and one moving vertical hazard", "short climb bursts separated by brief planning pauses", "animate climb/jump cycles, lift motion, and height transitions"),
    ("Escort Route", "Build a winding route where the player guides a moving non-player target to safety. The target pauses at decision points and never takes unavoidable damage.", "route blockers, detours, and a visible safe destination", "moderate pacing with timed pressure at marked checkpoints", "animate target follow behavior, route signals, and safe arrival"),
    ("Central Arena", "Build a compact arena with a central objective and three distinct approach lanes. The player must respond to a readable sequence of short waves.", "lane-specific hazards and a central objective meter", "three escalating waves with a short breath between waves", "animate wave entries, lane responses, and an objective pulse"),
    ("Checkpoint Gauntlet", "Build four short rooms connected by explicit checkpoints. Each room introduces one obstacle rule and the last room combines earlier rules.", "distinct room hazards with a checkpoint after every room", "quick rooms with a deliberate final synthesis round", "animate checkpoint activation, room transitions, and clear completion feedback"),
    ("Moving Corridor", "Build a forward-moving corridor in which the route scrolls continuously. Keep answer UI stationary and pause movement while the learner reads or submits an answer.", "moving barriers, timed openings, and safe waiting bays", "smooth continuous travel interrupted by answer pauses", "animate corridor parallax, obstacle cycles, and a clear pause/resume state"),
    ("Switchboard Grid", "Build a compact tile grid with switches that change walls or routes. The player plans a short path, submits it, then watches the route resolve one step at a time.", "switchable barriers, dead ends, and one alternate path", "thoughtful planning followed by a quick route playback", "animate tile highlights, switch state, and path playback"),
    ("Three-Zone Expedition", "Build three connected zones with different local layouts, all serving the same learning objective. A collectible clue in each zone teaches a useful rule.", "zone-specific obstacles and a final combined challenge", "short introduction, two quicker zones, then a capstone", "animate zone transitions, clue pickup, and escalating environment activity"),
    ("Rival Challenge", "Build an asymmetrical encounter against a non-violent rival or environmental opponent. The opponent uses three clearly signaled phases, each testing a different application of the same learning target.", "phase changes, readable telegraphs, and safe response windows", "brief tutorial phase, two faster phases, then a clear result", "animate phase telegraphs, rival reactions, and a non-violent final resolution"),
]


SHARED_RULES = """LOGICADE GAME BUILD BRIEF\n\nBuild a complete, playable original browser game in the current game build workspace. This prompt is the full design brief for one named build. Do not stop at a title screen, prototype, wireframe, or mockup. Use the project's existing framework and installed dependencies. If the project has no usable preview/dev script, create a minimal package.json with appropriate dev and build scripts using dependencies already present; do not install packages or replace the project framework without a clear need.\n\nThe game is for a Computer Programming 1 learning study. Teach the specified concept accurately with concise instructions, 5–8 unambiguous question/action challenges, immediate explanations, a useful hint, keyboard and pointer/touch input, and visible progress. Make difficulty come from reasoning and the stated level design, not tiny text or reflex-only pressure. Provide pause/resume, restart, win and loss states, a retry button, and accessible labels/focus states. Fit desktop and tablet layouts and remain usable inside a sandboxed iframe. Bundle assets locally; do not call external APIs or load external scripts, fonts, sprites, or audio. Make original art, UI, maps, characters, sound, and music. Use only broad genre traits in this brief; do not copy protected characters, names, maps, sprites, soundtracks, or exact level designs.\n\nLogiCade owns participant identity, authentication, coins, progression, attempts, rewards, and research storage. Do not create login, network backend, wallet, leaderboard, analytics database, participant profile, or persistent identity storage. Never use parent.document, cookies, or localStorage for participant data. Send version-1 gameplay events only to window.parent with channel 'logicade-game', type 'event', unique event_id, event_type, time_ms, and a small non-identifying payload. Report game_started, question_answered, hint_used when a host hint arrives, and activity_completed. Listen only for messages from window.parent with channel 'logicade-host' and version 1; support pause, resume, and hint. At game end send exactly one channel 'logicade-game', version 1, type 'game_over' message with won, score and accuracy in 0..1, nonnegative integer error_count and hint_count, and a short reason. Ensure pause/completion also work during local preview when no host exists.\n\nDeliver a normal static web build with index.html at the output root (usually dist/). Keep working preview and build scripts. Do not publish the game. At completion, summarize the main controls, learning target, files changed, preview command, and build output path. Do not claim the game was verified unless you actually ran the local preview and checked the gameplay.\n"""

SHARED_RULES += (
    "\nThe build pipeline supplies a canonical LogiCade description JSON. Its week, level, difficulty, CP1 topic, "
    "learning objective, question content, mission, controls, and win/loss conditions are authoritative. This prompt's "
    "learning-target wording is guidance only; if it conflicts with that JSON, adapt the game theme and mechanics to "
    "the JSON's approved learning target. Do not silently change study requirements.\n"
    "The host sends one initialization message to the game iframe after it loads: {channel:'logicade-host', "
    "version:1, type:'initialize', game_id, week, level, difficulty, description}. Read description for the catalog's "
    "title, topic, objectives, code examples, question data, controls, and conditions; use it to configure the game. "
    "Ignore messages unless event.source is window.parent and the channel/version match. In local preview, provide a "
    "small clearly labeled local demo description.\n"
)


def write_prompt(path: Path, title: str, slug: str, vibe: str, camera: str,
                 hook: str, setting: str, learning: str, animation: str,
                 variation: tuple[str, str, str, str, str] | None = None) -> None:
    if variation is None:
        brief = (
            f"Build identity: {title} — CORE TEMPLATE.\n\n"
            f"Design vibe: {vibe}. Use an original {camera} presentation.\n"
            f"Core gameplay: {hook}\n"
            f"Setting and map language: {setting}.\n"
            f"Learning target: {learning}. Teach it through the actual game actions and feedback.\n"
            f"Animation direction: {animation}. Create a small cohesive original animation set for the player, hazards, interactables, and success/failure feedback.\n\n"
            "Build this as a reusable master template with clear separation between the game rules, question data, map layout, and visual theme so later variations can change layout and pacing without breaking the learning objective. Use a readable opening tutorial, then a complete short round with a real beginning and end."
        )
    else:
        number = path.stem.rsplit("_", 1)[-1]
        variation_name, map_plan, obstacle_plan, pacing, motion = variation
        brief = (
            f"Build identity: {title} — VARIATION {number}: {variation_name}.\n\n"
            f"Design vibe: {vibe}. Use an original {camera} presentation.\n"
            f"Core gameplay: {hook}\n"
            f"Setting: {setting}. Keep the theme recognizable, but make this build's layout and gameplay flow distinct from the core template and other variations.\n"
            f"Learning target: {learning}. Keep questions and explanations accurate and consistent.\n\n"
            f"Variation-specific map: {map_plan}\n"
            f"Obstacles and interactions: {obstacle_plan}; adapt these to the stated game concept and avoid unavoidable damage or failure.\n"
            f"Pacing: {pacing}.\n"
            f"Animation direction: {animation}; specifically {motion}. Make these actions readable and synchronize them with game state.\n\n"
            "Make this a complete game build, not a skin, palette swap, or title change. Preserve the concept's core mechanic and learning target, while changing the actual route structure, obstacle logic, pacing, and animation beats described above."
        )
    path.write_text(SHARED_RULES + "\n\n" + brief + "\n", encoding="utf-8", newline="\n")


def build(replace: bool = False) -> None:
    if len(CONCEPTS) != 50 or len(VARIATIONS) != 10:
        raise RuntimeError("Expected exactly 50 concepts and 10 variations per concept")
    if (LIBRARY.exists() or ARCHIVE.exists()) and not replace:
        raise FileExistsError(f"Refusing to overwrite existing prompt library output: {LIBRARY} or {ARCHIVE}")
    # OneDrive may mark cloud-synced directories read-only/reparse-point;
    # rewrite the known prompt files in place rather than recursively deleting
    # the entire library, which can fail partway and leave it incomplete.
    LIBRARY.mkdir(parents=True, exist_ok=True)
    (LIBRARY / "00_SHARED_BUILD_RULES.txt").write_text(SHARED_RULES, encoding="utf-8", newline="\n")
    index = [
        "LOGICADE GAME BUILD PROMPT LIBRARY",
        "50 original core concepts, each with 10 structurally different gameplay variations.",
        "There are 50 core prompts and 500 variation prompts (550 prompt files), plus these library notes.",
        "Open a concept folder and submit core_prompt.txt to build its reusable master. Submit variation_01.txt through variation_10.txt to build its distinct variations.",
        "Each prompt is self-contained and repeats the shared LogiCade build and event requirements.",
        "Variation files specify map layout, obstacles, pacing, and animation changes. They are intended to produce actual gameplay differences, not recolors.",
        "Use each prompt with the coding assistant of your choice. A prompt is a build instruction; an assistant must still open the project, follow it, and wait for the build.",
        "The current LogiCade runtime expects a static web ZIP with index.html at its root and an adjacent game-description JSON. These prompts request a static build; packaging/import is a separate step.",
        "",
        "CONCEPTS AND VIBES:",
    ]
    total = 0
    for number, concept in enumerate(CONCEPTS, start=1):
        title, slug, vibe, camera, hook, setting, learning, animation = concept
        folder = LIBRARY / f"{number:02d}_{slug}"
        folder.mkdir(exist_ok=True)
        write_prompt(folder / "core_prompt.txt", title, slug, vibe, camera, hook, setting, learning, animation)
        total += 1
        index.append(f"{number:02d}. {title} — {vibe}")
        for variation_number, variation in enumerate(VARIATIONS, start=1):
            write_prompt(folder / f"variation_{variation_number:02d}.txt", title, slug, vibe, camera, hook, setting, learning, animation, variation)
            total += 1
    (LIBRARY / "README.txt").write_text("\n".join(index) + "\n", encoding="utf-8", newline="\n")
    with zipfile.ZipFile(ARCHIVE, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=7) as archive:
        for path in sorted(LIBRARY.rglob("*")):
            if path.is_file():
                archive.write(path, Path(LIBRARY.name) / path.relative_to(LIBRARY))
    print(f"Created {total} game prompts under {LIBRARY}")
    print(f"Created ZIP archive {ARCHIVE}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Generate the LogiCade game build prompt library")
    parser.add_argument("--replace", action="store_true", help="replace the generated prompt folder and ZIP")
    build(replace=parser.parse_args().replace)
