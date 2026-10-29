# Little Loop Farm

The first persistent genre prototype for LogiCade follows this loop: plant → irrigate → grow → harvest → sell or deliver → buy and craft → automate a larger field. Programming determines real operations in that loop.

## Controls

Click grass to walk. Click a plot to plant, water or harvest with the Auto tool. Select a specific tool when needed. WASD and arrow keys move the player while the map has focus. Row/column selectors and action buttons provide alternatives to map clicks.

The player and helper share seeds, water, energy and inventory. Gather materials, craft at the workbench and install devices on empty plots. Sprinklers irrigate the surrounding 3 × 3 area every eight seconds. Scarecrows protect plots within two tiles from periodic bird damage. Trade at the market or bring Ada three turnips to earn coins and friendship.

Write a helper program and press Run. The helper travels to each destination and performs actions in sequence. Stop cancels remaining work without undoing completed actions. Pause freezes the whole farm. Loading a mission starter replaces the editor contents; switching the mission alone preserves your code.

## CP1 missions

| Mission | Programming skill | Actual game outcome |
| --- | --- | --- |
| First planting | Variables and assignment | Plant three different plots using variable arguments. |
| Water a whole row | For loops | Water five distinct plots inside a loop. |
| Harvest what is ready | If statements | Harvest three ripe crops inside conditions. |
| A can that never runs dry | While loops and conditions | Water five plots while checking the live supply. |
| Choose the planting order | Arrays | Read an array to choose five watering destinations. |
| Build lasting automation | Loops and sequencing | Gather ingredients, craft and install a working sprinkler. |
| Supply-aware crafting | Comparison and logical operators | Conditionally craft a scarecrow and install it. |
| Two rows, one routine | Nested loops | Work at least eight distinct plots through nested loops. |
| Debug the boundary | Bounds and logic errors | Water exactly five valid columns without failing. |
| Community kitchen | Command calls and conditions | Harvest crops and deliver an actual order. |

Completion uses successful execution history and farm outcomes, not source-code equality. Missions may complete out of order. These checks confirm demonstrated operations, not comprehensive conceptual mastery.

## Language

A bounded C-style subset supports scalar declarations, fixed arrays, assignment, arithmetic, comparisons, logical operators, blocks, if/else, for, while and do/while. Integers use truncating division; floating point expressions preserve fractions. Variables obey block scope. Invalid indices, unknown commands, uninitialized reads and division by zero stop execution.

Commands: `plant`, `water`, `harvest`, `refill`, `gather`, `craft`, `place`, `sell`, `buy`, `deliver`, `wait`, `move`, `rest`. Sensors: `ripe`, `empty`, `wet`, `water_left`, `seeds`, `stock`, `coins`, `energy`. The in-game command guide documents arguments.

Limits: 12,000 source characters, 4,000 tokens, 80 levels of nesting, 64 elements per array, 12,000 evaluated operations and 400 world actions per run. This is not a full C compiler: user-defined functions, pointers, structs, includes and standard input/output are unsupported.

## Persistence and scope

Local storage key: `logicade.field.v1`. Crops, goods, devices, relationships, completed missions and program history persist. Actors stop on reload; the editor is saved separately. Simulation pauses while the tab is hidden and does not progress offline. No accounts or external services are required.

Remaining collection work: dedicated action/platforming, dungeon exploration, tactical defense, party combat, shooting, mining/building and other genre systems, followed by lab-by-lab integration and playtesting. The 50 themed puzzle prototypes are retained as curriculum references, not represented as finished genre games.
