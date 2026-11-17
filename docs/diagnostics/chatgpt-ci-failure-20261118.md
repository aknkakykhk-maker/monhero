# PR #6808 CI failure triage (2026-11-18)

## Verified

- GitHub connector successfully created an isolated branch, a commit, and PR #6808.
- Workflow `Build and deploy Pages`, run 44193129191, completed with `failure`.
- Job `build` failed at step `Check shipped data metadata and rhythm geometry`; previous steps 1-11 passed.
- Test summary: 389 total, 371 OK, 5 NG, 13 SKIP.
- PR's original diff was only `docs/diagnostics/chatgpt-connector-smoke-20261118.md`, with no runtime or workflow changes.

## Five failing checks (verbatim issue summaries)

1. `boot/save-keys-check.js`: `mh_home_assistant_comment_v1` missing from `SAVE_DATA.md`.
2. `changelog/monster-ko-check.js`: `monster-hero/src/parts/56-monsuc-teampick.jsx:155` uses `選んだ子` in player-facing text.
3. `ui/ui-kanji-check.js`: seven UI expressions differ from the kanji wording table (`tools/ui/ui-kanji-words.js`).
4. `mode/rhythm-chart-level-check.js`: `seasons_of_a_little_plaza` and `seasons_of_a_little_plaza_hell_debug` missing from the v1 measurement list (with specified v3 exceptions).
5. `mode/rhythm-demo-entry-check.js`: HOME facility label is not the expected `モンヒロビート`.

## Next actions

- Reproduce these checks on current main independently before attributing them to a PR.
- Confirm whether Claude/Muse already has pending fixes for any of these items; avoid parallel edits.
- Correct the source or metadata as appropriate; do not weaken tests or edit workflow triggers to force green.
- Run targeted checks and full CI, then merge only after successful verification.

This file is diagnostic only; no changes to game runtime or GitHub Actions workflows.
