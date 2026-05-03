# FOX Corporation — Android SDE (L2) Interview Prep
## Master 3-Day Plan (Tue/Wed → Fri, Sat as buffer)

**Target**: Be fully ready by Saturday for TR1 on Monday.
**Role**: SDE L2 / Senior Android — FOX DTC streaming (FOX Sports, FOX News, Tubi).
**Pipeline**: TR1 (coding) → TR2 (deep dive + LLD/HLD) → TR3 (HM, HLD, collab) → TR4 (Bar Raiser) → HR.
**Each round is eliminatory.**

---

## Reality check on your situation

You have real strengths the JD wants:
- **Video player end-to-end** (ExoPlayer/Media3, DRM/Widevine, HLS, SSAI). FOX literally lists this as "nice to have" but for a streaming team it's the #1 differentiator. This is your moat — most candidates won't have it.
- Multi-module Gradle, GitLab CI/CD, Crashlytics, observability (New Relic/Dynatrace).
- Compose for production (your EPG rebuild is a great story).
- Performance work (cold start, OOM fixes, ProGuard, Profiler).

Inflated/decayed areas (your own words):
- **Hilt** — listed it but not deep on scopes/qualifiers/multibinding.
- **MVVM / MVI** — used the words but probably can't draw the diagram cleanly under pressure.
- **Compose at "industry-level"** — used it for the EPG, but stability/recomposition/CompositionLocal/derivedStateOf may be fuzzy.
- **Player feature design discussion** — built features but may not articulate the architecture cleanly.
- **6 months of AI-written code** — your hands have forgotten muscle memory. This shows up hardest in TR1 (live coding).

The strategy is simple: **patch the decayed muscles fast, lean hard on your real moat in TR3/TR4.**

---

## How to use the materials

Files in this folder, in order of importance:

1. `00_README_PREP_PLAN.md` — this file (your daily roadmap)
2. `01_TR1_kotlin_coroutines_flows.md` — Kotlin + Coroutines + Flows (TR1 critical)
3. `02_TR2_compose_architecture_hilt_jetpack.md` — Compose + MVVM/MVI + Clean + Hilt + Jetpack libs
4. `03_TR3_TR4_design_security_performance_player.md` — LLD/HLD + Security + Performance + Player
5. `04_QA_BANK.md` — 120+ interview questions with model answers, organized by round
6. `05_STAR_STORIES.md` — pre-written past-project talking points (covers your inflated areas convincingly)
7. `06_MINI_PROJECTS_VSCODE.md` — hands-on coding briefs to grind through in Claude Code / VSCode

**Each study guide doc has the same structure**: Concept → Why interviewers ask → Code pattern → Common follow-up → "Caught off guard?" recovery line.

---

## Day-by-day plan

### Day 1 (Wed) — Kotlin + Coroutines + Flows + Hilt basics
**Goal**: Walk into TR1 confidently coding in Kotlin.

| Time | What | Where |
|---|---|---|
| 9:00–11:30 | Read `01_TR1_kotlin_coroutines_flows.md` end-to-end. Take notes by hand. | Cowork |
| 11:30–13:00 | Mini-project #1: **Hilt + Coroutines + Retrofit demo** (brief in `06_`) | VSCode + Claude Code |
| 14:00–16:00 | Mini-project #2: **Flow operators playground** (brief in `06_`) | VSCode + Claude Code |
| 16:00–17:30 | Q&A Bank — answer all "Kotlin" + "Coroutines" + "Flows" questions OUT LOUD without looking | Cowork |
| 17:30–18:30 | Re-read sections you stumbled on | Cowork |
| Evening (light) | LeetCode-easy in Kotlin: 3 array, 2 string, 1 hashmap. **Type by hand, no AI.** | VSCode |

**End-of-day checkpoint**: Can you explain `StateFlow` vs `SharedFlow` vs `Flow` without notes? Can you set up Hilt for a `ViewModel` with `@HiltViewModel` and inject a `Repository`?

### Day 2 (Thu) — Compose + Architecture + Jetpack
**Goal**: You can defend an architectural choice in front of a senior interviewer.

| Time | What | Where |
|---|---|---|
| 9:00–12:00 | Read `02_TR2_compose_architecture_hilt_jetpack.md` (Compose + MVVM/MVI/Clean) | Cowork |
| 12:00–13:30 | Mini-project #3: **MVI Compose counter with side effects** (brief in `06_`) | VSCode |
| 14:30–16:30 | Read rest of `02_` (Jetpack: Room, Nav, WorkManager, DataStore) | Cowork |
| 16:30–18:30 | Mini-project #4: **Offline-first notes app** (Room + DataStore + Hilt + Compose + MVI) | VSCode |
| Evening | Q&A Bank — answer "Compose" + "Architecture" + "Jetpack" sections | Cowork |

**End-of-day checkpoint**: Draw an MVI diagram from memory. Explain why `derivedStateOf` exists. Explain `stateIn` with `SharingStarted.WhileSubscribed(5000)`.

### Day 3 (Fri) — Design + Security + Performance + Player + STAR rehearsal
**Goal**: You can run a 60-min HLD round and tell your past-project stories cleanly.

| Time | What | Where |
|---|---|---|
| 9:00–11:30 | Read `03_TR3_TR4_design_security_performance_player.md` | Cowork |
| 11:30–13:00 | LLD practice: design ImageLoader (Glide-style) on paper. Then check against the doc. | Pen + paper |
| 14:00–15:30 | HLD practice: design a video streaming app like Tubi. On paper. Check against doc. | Pen + paper |
| 15:30–17:00 | Read `05_STAR_STORIES.md`. Rehearse each story OUT LOUD twice. Time yourself (target: 90 sec each). | Cowork |
| 17:00–18:30 | Q&A Bank — Security + Performance + Player + System Design sections | Cowork |
| Evening | Mock TR1 self-test — 2 random Kotlin coding problems, 60 min, no AI | VSCode |

**End-of-day checkpoint**: Can you defend "I built the analytics processing engine" with concrete numbers, design choices, and one thing you'd do differently?

### Day 4 (Sat) — Buffer + mock interview rehearsal
- Morning (2 hrs): Mock TR2 self-test — explain Compose recomposition, draw MVI, design URL shortener mobile cache. Out loud.
- Afternoon (2 hrs): Re-read your weakest section. Then rest.
- Evening: STOP. Eat well. Sleep early. **Don't cram on Sunday.**

---

## Anti-patterns to avoid this week

1. **Don't memorize answers verbatim.** Interviewers smell rehearsal. Memorize the *structure* (e.g., "for any architecture question I lead with: problem → constraints → tradeoffs → choice → migration path").
2. **Don't open AI for coding practice on Day 1–2.** You need to feel the Kotlin syntax in your fingers again. Use AI on Day 3 only to *verify* solutions, not generate them.
3. **Don't try to learn KMP/Compose Multiplatform.** Not in the JD. Sunk cost.
4. **Don't pad MVI experience if asked deeply.** You have real MVVM. If pushed on MVI, say "I've used MVI patterns in our state-heavy player screens but the broader app is MVVM" — that's defensible. See STAR doc.
5. **Don't skip the player section thinking "I know it."** It's your moat — the interviewer *will* probe it. Make sure you can articulate the architecture.

---

## Day-of-interview checklist (Monday)

- [ ] Test your dev env 1 hr before: IDE shortcut to compile/run, Kotlin REPL or scratch file ready.
- [ ] Have a notepad open for diagrams.
- [ ] Water nearby. Bathroom done.
- [ ] Read your STAR opening paragraph one time, then close the doc.
- [ ] Breathe. You actually know this stuff.

---

## What success looks like in each round

- **TR1 (coding)**: Don't just solve — narrate. "I'm thinking of a sliding-window approach. Edge case: empty input. Time O(n), space O(1)." Code in Kotlin idiomatic style. If stuck, say "let me try brute force first then optimize" — never silent.
- **TR2 (deep dive)**: When asked "how does X work" go three layers: API surface → underlying mechanism → tradeoff/edge case. Example: Coroutines → "structured concurrency is launched from a `CoroutineScope`, child jobs cancel parents on failure unless `SupervisorJob`, dispatching is on `Dispatchers.Default` for CPU work."
- **TR3 (HM)**: Lead with clarifying questions before any design. Always.
- **TR4 (Bar Raiser)**: They probe ownership and judgment. Have 1–2 stories ready about a time you owned a P0 (you have these from Dish).
- **HR**: "Why FOX?" — DTC streaming at scale, your player work is directly relevant, you want to grow on a mature team. Don't over-prepare.

Good luck. You have more real ammo than you think — the issue is dust on the muscles, not missing knowledge.
