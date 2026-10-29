# Three Lanes, One Kingdom

A playable tower-defense strategy prototype based on **Tower Defense Logic, variation 1: three-lane village defense** from the 50-concept brief. Code-driven choices determine live target selection and ammunition, while the player places towers, improves the keep and expands the kingdom.

## Play

Run `npm run dev` from the project folder, then open `/kingdom-lab/` at the printed local address. Build a watchtower by clicking an open round pad. Cover different lanes, deploy a policy and send a wave. Threats come from the east; the keep is on the west. Towers acquire the enemy closest to the castle within their range in their lane.

Between waves, spend treasury on tower upgrades, roadblocks and the Eastern Ridge expansion. Raise an economy that matches the threat. The attack can be held, but enemies keep moving. If a wave takes the keep, use its checkpoint to retry after updating your plan.

## Live CP1 policy

Watchtowers repeatedly run the deployed C-style program when a threat enters range. Sensors read the current enemy, lane, mana and keep. Conditional statements choose actual ammunition.

```c
if (enemy_type() == 3 && mana() >= 4) {
    shoot("cannon");
} else if (is_fast() && mana() >= 2) {
    shoot("frost");
} else if (nearby() >= 2 && mana() >= 4) {
    shoot("cannon");
} else {
    shoot("arrow");
}
```

Enemy IDs: Scout 1, Raider 2, Iron Brute 3, Ash Drake 4. Arrow is free. Frost costs 2 mana and slows the target. Cannon costs 4 mana, damages armor and splashes enemies in the same lane. Mana regenerates during a wave and refills partly between waves.

Sensors: `lane()`, `wave()`, `mana()`, `castle_health()`, `enemy_count()`, `enemy_type()`, `enemy_health()`, `enemy_distance()`, `nearby()`, `is_armored()`, `is_fast()`. Action: `shoot("arrow")`, `shoot("frost")`, or `shoot("cannon")`. A policy can fire at most twice per tower check. A runtime error pauses the attack and preserves shots already made. Deploy a repaired program to resume.

## Six field notes

1. **A watchtower has a choice:** use conditions and branch on live threats.
2. **Stop the Iron Brutes:** use comparisons and conserve mana for armored attackers.
3. **Hold the Ash Drakes:** slow fast enemies with frost shots.
4. **Cover three lanes:** build across the map and use the lane sensor.
5. **Protect the inner keep:** hold three waves with 150 or more keep health.
6. **Secure the Eastern March:** survive all five waves and defeat the final mixed assault.

Objectives count real shots, targets, lane coverage, keep health and wave results. Multiple policies can complete a goal. They do not use fixed source text as a password.

## Bounds and files

The existing bounded C-style interpreter supports scalar declarations, arrays, assignments, arithmetic, conditions and loops. This strategy build uses conditions and sensors; the interpreter does not run code as JavaScript. It permits up to 12,000 source characters, 4,000 tokens, 80 levels of nesting, 12,000 operations and 400 world actions in a program evaluation.

Campaign progress and the editor save on this device under `logicade.kingdom.v1`. A planning checkpoint is stored for the current wave. The game freezes when paused or the page is hidden; it does not simulate offline.

Source: `engine/kingdom-state.js` runs combat/economy, `engine/kingdom-play.js` connects input and code, and `engine/kingdom-render.js` draws the original battlefield. The maps and characters are drawn in code; the game does not copy a referenced title's world, cast, or artwork.
