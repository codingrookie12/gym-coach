# Gym Coach — Claude Operating Rules

This file is loaded at the start of every conversation. Follow all rules below without being asked.

---

## 1. How to orient at the start of every conversation

1. Read this file fully before doing anything else.
2. **Verify file access** — try reading `lib/exercises.json` or `lib/routines.ts`. If not accessible, the workspace folder isn't mounted. Ask Johnatan specifically:
   > "Please select the **Gym App** folder at `~/Documents/Claude/Projects/Gym App` as your workspace folder so I can access the codebase."
   Never ask generically — always name the exact folder.
3. Check Linear for the current sprint and open issues, then ask Johnatan what he wants to work on if not already stated.

---

## 2. Linear — task tracker

**Workspace:** [linear.app/gym-coaching-app](https://linear.app/gym-coaching-app)
**Team:** Gym coaching app | **Key:** `GYM`

### Project structure

| Project | Purpose |
|---|---|
| Sprint 1 — Data Foundation | exercises.json, DB cleanup, Notion alignment |
| Sprint 2 — Exercise Library & Availability | Library screen, equipment toggles, naming enforcement |
| Sprint 3 — Swap & Change Exercise | Swap vs Change UX, smart alternatives engine |
| Backlog | Future features, not yet scheduled |

### Rules
- Before starting any dev work, check Linear to confirm the active issue.
- Reference the issue number (e.g., GYM-9) in all commit messages.
- Never start work that isn't tracked — create the issue first.
- Sprint 1 must complete before Sprint 2 resumes (DB must be clean and aligned).

---

## 3. New ideas — route to Linear, deduplicate first

When Johnatan proposes a new feature or improvement:

1. Search Linear for semantically similar issues before creating anything new.
2. If a close match exists, surface it and ask whether to update or create separately.
3. If no match, create a new issue in the **Backlog** project using the template below.
4. Never create duplicates — "exercise instructions", "show instructions", "how-to for exercises" are the same idea.

### Backlog issue template

```
**What:** One-line description of the feature or improvement.
**Why:** The problem it solves or value it adds.
**Scope hints:** What's in, what's explicitly out (if known).
**Depends on:** Any issue that must complete first (or "None").
```

---

## 4. Notion — knowledge base

**Page:** [Gym Coach — Context](https://www.notion.so/34691176d45981d58a49d1b3876a36c3)
**Purpose:** Schema, conventions, decisions. Not a task tracker.

Update at the end of every working session. Add a decisions log entry when: a DB schema changes, a naming/convention decision is made, or an architectural call would be confusing without context. Routine code changes do not need an entry.

### Decisions log entry format
```
- **YYYY-MM-DD:** [What was decided and why in one sentence.]
```

### Gym Progress DB
- **Collection ID:** `collection://c98d2ccd-3b85-4732-be5a-60e9d3d289e6`
- **Key properties:** `Exercise` (Select — fixed list from exercises.json), `Entry` (Title, format: `[Exercise Name] — Set N`), `Date`, `Split`, `Weight`, `Set`, `Reps`, `Notes`
- **Exercise field type:** Select with fixed list — options must match exact names from `exercises.json`

---

## 5. Ambiguous exercise names — always confirm

When mapping any exercise name to a canonical name in exercises.json, if a clean 1:1 match does not exist:

1. Stop — do not guess or pick the closest match
2. Show Johnatan the ambiguous name + closest candidates from exercises.json
3. Wait for explicit confirmation before proceeding

Applies to GYM-6, GYM-7, GYM-14, and all future exercise naming work. One wrong mapping corrupts all historical data for that exercise.

---

## 6. Exercise naming convention

**Source of truth:** `lib/exercises.json` → `lib/exerciseLibrary.ts`
**Format:** `[Equipment] [Muscle/Movement] [Modifier]`
**Examples:** `Barbell Bench Press`, `Cable Seated Row (Wide Grip)`
**Reference:** NSCA / ExRx.net nomenclature

No aliases. No shorthand remapping. One name, everywhere. If exercises.json doesn't have it, it doesn't exist yet — add it to the JSON first.

---

## 7. Code conventions

- **TypeScript:** strict mode on. Use `Array.from()` instead of spread on Set/Map. No implicit `any`.
- **Navigation:** Screen-based via `Screen` type union in `app/page.tsx`. No react-router.
- **Styling:** CSS custom properties (`--bg`, `--accent`, `--surface`, etc.) + utility classes in `globals.css`. No hardcoded color values.
- **Notion property names:** match the DB exactly. Source of truth is the schema in the Notion context doc.

---

## 8. Before pushing to git

Ask Johnatan: "New version or small tweak?" — then version automatically:
- **New version** → next major digit. v3 → v4, v4 → v5.
- **Small tweak** → next decimal. v3.1 → v3.2, v3.2 → v3.3.

Use the version in the commit message (e.g., `feat(v3.2): ...`). Do not push without version confirmation.

Pre-push lint gate is active (`.githooks/pre-push`) — runs `next lint` on every push automatically. If it fails, fix locally. Do not bypass with `--no-verify`.

---

## 9. Vercel

**Project:** `gym-coach` (team: `sanchez92j-1216s-projects`) — auto-deploys on push to `main`.
