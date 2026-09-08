# `redesign/phase1-foundation` reconciliation

**Status:** analyzed, not merged, not deleted. Read-only reference until the equipment/unit-conversion feature (below) is picked up.
**Analyzed:** 2026-09-07, against `main` post-PR #48 (`fce4b0a3`+).
**Branch:** 60 commits, dated through 2026-08-21, diverges from `main` at merge-base `5daba2d` (`v7.21-GYM-68`).

## Verdict

Don't merge. Don't delete yet. The branch has three kinds of content:

1. **Dead / superseded** — `main` independently solved the same problems differently, already shipped and tested. Not worth porting even as reference.
2. **Valuable / unclaimed** — real product scope, confirmed absent from current code, migrations clean and additive. Worth building fresh, using the branch as a spec, not a cherry-pick target.
3. **Test infra** — a Playwright e2e layer worth adding standalone (current app has zero e2e, vitest only), but write new specs against current screens rather than porting the existing ones.

Once the equipment/unit-conversion feature (bucket 2) is built for real, this branch has no remaining reason to exist and should be deleted.

## Bucket 1 — dead / superseded (do not port)

**a. UI primitive library sub-phase** (`redesign-phase2` commits, ~18 commits: `ef4023e` docs spec → `0ce1d10` final fix wave, e.g. `24c8340` "UI primitive library (Button, Card, Badge, Sheet, IconButton, SectionLabel, StatRow)" through `a68b32a` "Phase 2 complete"). `main` shipped its own component/theming system in Phase 1 proper (`9148284`, "Phase 1 — foundation infra (theming, i18n, component library, IA shell)") and it's been iterated on since by Phase 2/3 work. Two competing primitive libraries exist; `main`'s is live and tested. The redesign branch's version is a dead end.

**b. Exercise-catalog FK / fuzzy-matching sub-phase** (`redesign-phase1-task2` commits, ~4 commits: `20260811000000_user_routine_exercises_add_exercise_id.sql` migration, `ce1c05f` "apply approved exercise-catalog reconciliation", `ce60c61` "single source of truth for exercise catalog", `bbb81e7` "FK-based row selection + real punctuation-fuzzy matching"). `main` solved exercise identity/matching independently (custom-exercises-as-first-class work, `5daba2d` `v7.21-GYM-68`, and later ID-based muscle tagging in Phase 4, `f0bcf8a` `GYM-92`). Different approach, already shipped.

**c. Already ported.** `667e7ce` ("fix(hydration): correct SSR guard in useOnlineStatus for Node 21+ global navigator") was cherry-picked into `phase-4-library-reports-rebuild` as commit `721e28d` on 2026-09-07. Don't re-port it; it's done.

Everything else general/docs-only on the branch (`00a45a8`, `0b4f397`, `a6a8b41`, `62139fa`, `c63c2d0`) is either superseded handover documentation or a fix already folded into later `main` history — not actionable reference material.

## Bucket 2 — valuable, unclaimed product scope (build fresh, use branch as spec)

Equipment-instance model + kg/lbs/pins unit conversion + exercise variant families. This is the `redesign-phase1-task3`/`task5`/`task6`/`fixwave`/`phase1.5` commit run (~30 commits, `a393e01` "equipment model + unit-persistence fix" through `553c31c` "snap converted weights to standard 2.5-unit plate increments", including the `redesign-phase1.5` design-spec docs `146631f` and `eabaf21`).

**Confirmed absent from current `main`** (verified 2026-09-07):
- `lib/equipmentType.ts`
- `lib/equipmentInstances.ts`
- `lib/weightConversion.ts`
- `lib/setUnit.ts`
- `supabase/migrations/20260811010000_equipment_model.sql`
- `supabase/migrations/20260812000000_exercise_variant_families.sql`
- `supabase/migrations/20260812010000_weight_override_equipment_instance.sql`

These are additive, clean migrations — no conflict with anything `main` has shipped since.

**Why "reference, not cherry-pick":** the integration surface these features touch — `components/screens/ActiveSessionScreen.tsx`, `components/screens/WorkoutOverviewScreen.tsx`, session-write/weights API routes — has been rewritten twice since this branch was cut (Phase 2 UI rebuild, then Phase 3 coaching-engine integration `c172eb1`). A cherry-pick would conflict line-for-line on files that no longer resemble the branch's version. The pure-logic layer (the four `lib/` modules and the three migrations) is portable as-is or near-as-is; the screen wiring is not — it needs to be re-done against current screens using the branch as the spec for *what* to build, not *how* it's currently wired.

**Priority:** deferred, tracked backlog. Phase 4 (`phase-4-library-reports-rebuild`) is the active priority — this is not being started now.

## Bucket 3 — Playwright e2e infra (new infra, not ported specs)

Branch has `playwright.config.ts` + `tests/e2e/{global-setup,global-teardown,smoke,redesign-clickthrough,redesign-coaching-accept,redesign-sheets}.{ts,spec.ts}`. `main` currently has zero e2e layer (vitest only — confirmed via `vitest.config.ts` present, no playwright/e2e paths in `main`'s tree).

The Playwright *config and harness pattern* (global setup/teardown, how it points at a running instance) is worth reusing. The actual specs are not — they assert against the dead UI-primitive-library's DOM (bucket 1a) and will not run against current screens. Write fresh specs against current screens.

## When picked up later, start here

1. **Migrations first.** Apply the three additive migrations (`20260811010000_equipment_model.sql`, `20260812000000_exercise_variant_families.sql`, `20260812010000_weight_override_equipment_instance.sql`) — clean, no known conflicts with `main`'s schema history.
2. **Pure-lib modules + tests.** Port/rebuild `lib/equipmentType.ts`, `lib/equipmentInstances.ts`, `lib/weightConversion.ts`, `lib/setUnit.ts` and their unit tests. These don't depend on screen structure, lowest risk, highest reuse from the branch as-is.
3. **High-effort screen integration.** Wire equipment-instance selection + unit conversion + variant-family swap into current `ActiveSessionScreen.tsx`, `WorkoutOverviewScreen.tsx`, and the session-write/weights API routes. Use the branch's `redesign-phase1.5` and `redesign-phase1-task5/task6` commits as the spec for behavior (what states/edge cases were found — e.g. `9d76a20` duplicate-name/network error handling, `cb678fe` equipment-type staleness on quick-add/mid-session swap, `553c31c` plate-increment snapping), not as a diff to apply.
4. **Playwright infra last, or in parallel.** Stand up the config/harness pattern and write fresh specs once the above screens stabilize — don't gate steps 1-3 on this.

After step 3 ships, `redesign/phase1-foundation` has no remaining reference value and should be deleted.
