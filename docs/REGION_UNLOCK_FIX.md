# Region progression repair — 29 October 2026

The world map previously read `logicade_played_regions_<participant>`, although completed games save stages in `logicade_levels_<participant>_<region>`. No current completion handler updated the old flag. The authenticated progress endpoint also assumed every week contained ten stages, despite Kingdom now having only two.

The map now derives region completion from distinct valid completed stages. Kingdom requires stages 1 and 2; Weeks 2–9 require their ten stages. Returning to the map automatically recognizes existing saved progress, so replay is not required. Authenticated synchronized progress is merged into the same participant-scoped cache, with at most three week requests in flight. Local progress remains available offline, and account/token changes prevent late requests from updating another account.

The region dialog reports completed stages rather than an unsupported played count. Week 2's entry becomes available after Kingdom is complete. The progress API uses the current curriculum's stage count, excludes retired Kingdom stages and stops recommending Stage 3 after its two stages are complete. If completion records have a gap, it recommends the first missing stage.

No participant rows, rewards, assessment results or database schemas were changed.

Validation: nine frontend progression/difficulty tests, seven mocked backend progress tests, and the production client build passed. In an isolated browser fixture, Week 2 was locked with only Kingdom Stage 1 complete, became available with stages 1 and 2 complete, stayed available after reopening the map, and allowed entry. Week 3 remained locked. These browser fixtures write only the named QA participant's local progress, not real study data.

Screenshot: `artifacts/week2-unlocked.png`. The existing frontend build still reports its large JavaScript chunk warning.
