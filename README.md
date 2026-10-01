# PVA Academy — Understanding Client Work & Instructions (Part 5) · v1.0

Stage 3 of the PVA Beginner VA Journey (Learn to Work), second course.
All six lessons and the Final Challenge are released (v1.0). The previous course is
Communication & Professionalism (`https://pva-communication.probinsiyanongva.workers.dev/`).

No login. Progress is saved in the learner's browser only (`pva-client-work-progress`),
with Export / Restore / Clear. Expected URL: `https://pva-client-work.probinsiyanongva.workers.dev/`

Built on the rebuilt Stage 2 modules (`pva-computer-basics`, `pva-internet-workspace`):
same `course.css`, progress architecture, page chrome, neutral mock screens.

## Source of truth
- Curriculum: `PVA_Part5_Locked_Curriculum_Build_Brief.md`
- Lesson 1: `PVA_Part5_Lesson1_Production_Copy.md` (locked). `content/lesson-1.html` and
  the Lesson 1 entry in `content/course.json` reproduce it verbatim.
- The course home copy is a **draft** (not part of the locked Lesson 1 copy).

## Structure
- `public/` — the only folder Cloudflare serves (see `wrangler.jsonc`)
- `content/` — lesson bodies (`lesson-N.html` with `{{activity:ID}}`, `{{mock:ID}}`, `{{taskcard:ID}}`) and `course.json`
- `tools/build.py` — builds `public/` from `content/`; `tools/mocks.py` — neutral mock screens

## Components added in the Part 5 pilot (reusable by Lessons 2–6)
All driven by `content/course.json`:
- **Per-option feedback** on graded items: `"feedback": [one text per option]`
- **Row layout** for short fixed option sets: activity `"layout": "row"`, `"qlabel": "Sentence"`
- **Several comparison mocks** for one question: item `"mocks": [...]` (question shown first)
- **Chat-thread mock**: mock `"kind": "chat"`
- **Task Card**: `{{taskcard:ID}}` + `"taskcards"` — six saved fields, model reveal
  (enabled once any field has text, plus an always-available "Show me anyway"), per-field
  self-check, closing feedback where fields marked `"critical": true` take priority
- **Notice** block: a `.notice` section whose `.notice-fb` line appears after the first tick
- **Notes download**: `data-note-heading` section markers and a `#notesAppendix` block
- **Coming-soon placeholders** for unbuilt lessons and Final Challenge (pilot only)

## Rebuild
```text
python3 tools/build.py
```
The Final Challenge answer key will be private (`tools/source/final-challenge.json`, not in
this repo), as in Parts 2–3. Until it exists the build writes a "coming soon" Final Challenge page.

## Cloudflare deployment
Workers & Pages → Create → Import a repository → `pva-client-work`.
```text
Build command: (blank)
Deploy command: npx wrangler deploy
```
Enable the `workers.dev` route under **Domains** if the dashboard shows "No URLs enabled".

## Rules
- Completion = all 6 lessons marked complete **and** the Final Challenge submitted once.
- The Final Challenge will be diagnostic: score shown, never a gate.
- Mark as done is never gated. Completion is an acknowledgment, not a certification.
- Scope: Part 5 owns thinking and execution around the work. Message wording belongs to
  Part 4 (Communication & Professionalism); tool mechanics to Stage 2; specialist work to Stage 5.
