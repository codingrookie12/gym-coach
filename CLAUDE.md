# Gym Coach — Claude Operating Rules

## Orientation (every session, in order)

1. Verify file access — read `lib/routines.ts`. If inaccessible: *"Please select the **Gym App** folder at `~/Documents/Claude/Projects/Gym App`."*
2. Fetch the Notion hub: [Gym Coaching App](https://www.notion.so/34891176d45980aa830bd3743bfd4b73)
   - Then fetch the page relevant to the session type (see Session Types below)
3. Check Linear for the active cycle and open issues: [linear.app/gym-coaching-app](https://linear.app/gym-coaching-app) — Team key: `GYM`
4. Ask what Johnatan wants to work on if not already stated.

---

## Session Types

| Johnatan says | Claude does | Fetch |
|---|---|---|
| `"Starting Phase N"` or `"Working on GYM-XX"` | Engineering session — implement, commit, PR | Engineering + Architecture & Data pages |
| `"Product session — [topic]"` | Strategy/planning — no code, output is a brief or decision | Product page |
| `"QA review — GYM-XX"` | Review output against acceptance criteria | Engineering page |
| `"Design session — [topic]"` | UX critique, copy review, design decisions | Design page |
| `"Marketing session — [topic]"` | Content, positioning, Linear marketing issue | Marketing page |
| `"Research session — GYM-XX"` | Run research per protocol, log findings to Notion | Product page (research protocol) + relevant section |

---

## Protocols

**Decision log** — append to the relevant Notion page's decisions log when: a schema changes, a naming convention is set, or a phase closes. Format: `Date | Decision | Rationale`. Never log routine code changes.

**Session log** — at the end of any session where a phase closes, a major architectural decision is made, or a significant feature is designed: ask *"This session produced [X]. Should I log it?"* If yes, append one row to the [Session Log](https://www.notion.so/34991176d45981318fe8f4889641b974) inline database. Format: `Date | Type | Topic | Decisions Made | Output | Next Action`.

**Roadmap update** — after every PR merges to `main`, update the [Notion Roadmap](https://www.notion.so/34891176d45981549ae1c838fcfe4b26):
1. Strikethrough the merged issue in its phase list
2. Update the `Last updated` line at the top of the page (format: `YYYY-MM-DD — GYM-XX shipped (vX.X)`)
3. If it was a **Phase 1 MVP gate item** (the numbered list): update the "Where Am I Right Now" section — three specific changes:
   - Change `**In progress:** GYM-XX — [old title]` to the next item's number and title
   - Replace the explanatory sentence below it with one sentence describing why the new item is the current blocker
   - Remove the completed item from the front of the sequence line (e.g. `GYM-71 → GYM-72 → ...` becomes `GYM-72 → GYM-73 → ...`)
4. If the merge **completes a phase** (all items done): update the phase Status to "Done ✅" and update "Where Am I Right Now" to point to the next phase's first item
Do this immediately after the merge — do not batch roadmap updates across multiple sessions.

**Idea capture** — when a new feature or improvement is proposed: search Linear for semantic duplicates first, then create a Backlog issue if none found. Linear only — no separate Notion entry.
```
What: [one line]
Why: [problem or value]
Scope: [in / out]
Depends on: [issue or None]
Source: [conversation / user / Canny / research]
```

**Research** — follow the protocol in the [Product page](https://www.notion.so/34891176d45981328f07fa60ee4374eb). Every research session starts as a Linear issue with label `research`.

---

## Non-Negotiable Rules

**Exercise names** — source of truth is `lib/exercises.json`. Format: `[Equipment] [Muscle/Movement] [Modifier]`. UI never allows freehand name entry — exercise picker only. Mid-workout quick-add: name only (convention enforced), metadata deferred post-workout. Ambiguous mapping: stop, show candidates, wait for confirmation. Never guess — one wrong mapping corrupts all historical data for that exercise.

**Linear** — every issue referenced in commit messages (`GYM-XX`). Never start untracked work — create the issue first. Deduplicate before creating.

**Git** — feature branch per issue (`GYM-XX-short-description`). Squash merge to `main`. Open a PR per branch. Commit format: `type(vX.X-GYM-XX): description`. Types: `feat` / `fix` / `chore` / `refactor` / `docs`. Ask before every push: *"New version or small tweak?"* — major digit = new feature, decimal = tweak. Pre-push lint gate active — never bypass with `--no-verify`.

**Version label** — displayed version is hardcoded in `components/screens/HomeScreen.tsx` line 39. Must be manually updated on every version bump — it does not read from `package.json` automatically. Always update it as part of the first commit on a new version.

**Code** — TypeScript strict. `Array.from()` not spread on Set/Map. CSS custom properties only, no hardcoded colors. All UI strings in translation files — no hardcoded copy in components.

**Notion** — update decisions log at end of every working session when schema, naming, or architecture changes. Never update mid-session.

**Vercel** — project `gym-coach`, team `sanchez92j-1216s-projects` — auto-deploys on push to `main`. All env vars marked sensitive.
