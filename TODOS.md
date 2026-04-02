# TODOS

Tracked improvements and deferred work from the engineering review (2026-04-03).

---

## High priority

### Remove LinkedIn OAuth + fetch code
**What:** Delete `src/main/linkedin-oauth.ts`, `src/main/linkedin-fetch.ts`, and the `linkedin:oauth` IPC handler in `src/main/ipc/index.ts`.
**Why:** LinkedIn OAuth was decided to be dropped. The existing code has no error handler on `server.listen`, which crashes on port conflicts. Dead code that carries a live bug.
**Pros:** Removes ~300 lines of dead code and a real crash path.
**Cons:** Would need to rewrite if LinkedIn OAuth ever comes back (the data export ZIP path in `linkedin-parser.ts` is unaffected).
**Context:** `src/main/linkedin-oauth.ts:112` — `server.listen` has no `server.on('error', ...)` handler.
**Depends on:** Nothing.

---

## Medium priority

### Move job session storage from localStorage to main process files
**What:** Persist `JobSession[]` (from Zustand store) as a JSON file in `app.getPath('userData')` via IPC, matching the `profile.json` storage pattern.
**Why:** Zustand `persist` to localStorage is capped at 5-10MB and fails silently when full. With 10+ sessions each containing `GapAnalysis` + generated CV/cover letter markdown, this limit is reachable. Silent failure means data loss on next reload.
**Pros:** No storage limit. Matches existing profile storage pattern. Survives localStorage clears.
**Cons:** Requires new IPC handlers (`sessions:read`, `sessions:write`), a new `src/main/ipc/sessions.ts` module, and migrating existing sessions from localStorage. Follow `src/main/ipc/profile.ts` as the pattern.
**Context:** `src/renderer/src/store/index.ts` — `partialize` in Zustand persist includes `jobSessions` + `activeJobId`.
**Depends on:** Nothing.

---

## Low priority

### Split `SectionEditor.tsx` into per-section files
**What:** Break `src/renderer/src/components/SectionEditor.tsx` (802 lines) into separate files: `WorkExperienceEditor.tsx`, `EducationEditor.tsx`, `SkillsEditor.tsx`, `PortfolioEditor.tsx`, etc.
**Why:** The file grows ~100 lines per new section. Already hard to navigate. Each section editor is already a named function — the split is mostly mechanical.
**Pros:** Easier to find and edit individual section logic. Reduces merge conflicts on the editor.
**Cons:** Pure refactor, risk of subtle bugs during the split. No new functionality.
**Context:** Each sub-editor (`WorkExperienceEditor`, `EducationEditor`, etc.) is a named function component near the bottom of the file. Top-level `SectionEditor` dispatches to them by section ID.
**Depends on:** Nothing.
