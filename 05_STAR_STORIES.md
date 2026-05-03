# STAR Stories — Past Project Talking Points
**Use**: TR2 anchoring, TR3/TR4 narrative rounds, HR.
**Format**: Situation → Task → Action → Result. Each story should be tellable in 60–90 seconds.

**Strategy for inflated areas**: When you wrote "MVI" or "Hilt" or "industry-level Compose" on the resume, you committed yourself. The fix is **not to lie** — the fix is to scope the claim honestly when probed: "I used MVI patterns in our most state-heavy screens; the broader app was MVVM" is fully defensible. Below each story I've added a "Defensive frame" — what to say if the interviewer probes deeper than your real experience.

---

## Story 1 — The EPG Compose rebuild (your strongest)

**Situation**: Dish's Android TV app had a legacy EPG (electronic program guide) built in XML/RecyclerView. Load times were 4–5s, rendering janky on low-end devices, production OOMs when scrolling the grid past ~200 channels. Bug count climbing, customer escalations.

**Task**: Lead the rebuild. Cut load time, eliminate OOMs, set the foundation for future EPG features (filters, mini-EPG, favorites).

**Action**:
- Audited the legacy code: identified bitmap overhead (channel logos kept full-resolution), unbounded view recycling, blocking JSON parse on main thread.
- Designed a Compose-based EPG using `LazyRow` of `LazyColumn`s, with stable keys per cell.
- Hoisted state to a `EpgViewModel` exposing `StateFlow<EpgState>` for the visible window; loaded data lazily via paging.
- Used `remember(channelId)` to memoize per-cell layout. Marked the data class `@Immutable` after compiler reports flagged it as recomposing per scroll.
- Compressed channel logos via Coil with size-aware caching.
- Profiled OOMs in Android Profiler — found a leak in the legacy custom view holder retaining bitmaps after recycle. Fixed by clearing references in `onDispose` of the Compose AndroidView.
- Benchmarked startup with Macrobenchmark before/after.

**Result**:
- Load time down 60–70% (4.5s → ~1.4s on a low-end TV).
- Rendering time down 50%.
- OOMs resolved (verified via 7-day Crashlytics window).
- Production bug count down ~80%.
- Set the foundation for 5+ subsequent features.

**Defensive frame**:
- "Industry-level Compose" probe → "We followed standard practices: stability annotations, derivedStateOf for the visible-window flag, collectAsStateWithLifecycle, lazy keys. Our rebuild was complex enough to expose all the recomposition gotchas."
- If asked about Compose theming/design system depth → "We didn't build a full Material 3 design system from scratch — we used the existing Dish brand tokens and built reusable composables for common patterns (channel cell, time bar). Full design system is a step I'd love to lead next."

---

## Story 2 — The ad monetization stack from scratch

**Situation**: New Dish streaming product launching. Needed full ad monetization on Day 1 — display ads, SSAI for video, beacon tracking, lifecycle management — with no existing in-house tooling.

**Task**: Build it end-to-end across Android TV and tablet. Reliable, observable, and resilient to ad partner outages.

**Action**:
- Designed an `AdsController` interface with `loadAd(slot)`, `showAd(slot)`, `dismissAd()`. Abstracted partner SDKs (AdMob NextGen, FreeWheel) behind it.
- Implemented SSAI integration: parse the ad pod metadata from manifest, wire beacons to fire at start/quartile/complete events.
- Implemented pre/mid/post-roll lifecycle: pause user content during CSAI, allow seek-disable during ad windows, restore controls after.
- Found and fixed a memory leak in AdMob NextGen SDK: the SDK retained ActivityContext past lifecycle. Wrapped in a weak-reference holder with explicit release in `onDestroy`.
- Built an analytics layer over the ad lifecycle (impression count, click rate, beacon failure rate).
- Negotiated with the ad partner team on retry/timeout policies — settled on 2 retries with 1.5s timeout per beacon.

**Result**:
- Stack shipped with launch. Ad delivery reliability ~99.5% in production.
- Memory leak fix prevented an estimated 5–10% of OOM crashes on devices with smaller heaps.
- Analytics surfaced 3 partner-side issues in the first month.

**Defensive frame**:
- "Did you design the SSAI server-side?" → "No, the server team handled stream stitching. I owned the client side — beacons, lifecycle, and the player integration."
- "How did you test ad failures?" → "Mock ad partner with a Charles/Proxyman test rig, plus chaos testing in QA: drop network, kill app mid-ad, etc."

---

## Story 3 — The multi-module Android TV/Tablet shared codebase

**Situation**: Two product surfaces (TV and tablet) had diverged — duplicated code, drifting business logic, hard to keep in sync. Build times growing.

**Task**: Architect a shared codebase that supports both, with platform-specific UI affordances.

**Action**:
- Audited the duplication: identified ~70% of business logic was identical, but UI patterns (10-foot vs touch) needed to differ.
- Proposed a multi-module structure: `:core-domain`, `:core-data`, `:core-network`, `:core-player` shared; `:ui-tv` and `:ui-tablet` as platform-specific UI; `:app-tv` and `:app-tablet` as the entry points.
- Built custom Gradle build variants and tasks to wire platform-specific resources, manifests, and feature flags.
- Defined APIs (interfaces) at module boundaries, enforced via `api` vs `implementation` dependency declarations.
- Migrated incrementally — feature by feature — over ~3 months to keep the team shipping.

**Result**:
- 74% UI complexity reduction in shared code.
- Lean APKs optimized for low-end devices (no unused TV code in tablet APK and vice versa).
- Build time down ~40% on incremental builds (parallel module compilation).
- Two surfaces in lock-step on business logic — no more drift bugs.

**Defensive frame**:
- "Did you use dynamic feature modules?" → "We considered them but our use case was platform-split, not on-demand install — static modules with build variants were simpler and met our needs."
- "How did you handle Hilt across modules?" → "Hilt requires the `@HiltAndroidApp` Application class in the app module; we set up `@InstallIn(SingletonComponent::class)` modules in core modules and let each app module compose them."

---

## Story 4 — The custom analytics processing engine (15K events/hour)

**Situation**: We needed reliable, low-latency analytics for product decisions. Off-the-shelf SDKs (Firebase Analytics, Mixpanel) were too slow for our event volume and lacked custom routing.

**Task**: Build a client-side processing engine that batches, dedupes, prioritizes, and uploads ~15K events/hour reliably.

**Action**:
- Designed an `AnalyticsHub` with a pluggable transport layer (HTTP, FCM data push for offline events, file fallback).
- Used a `Channel<Event>` for in-process queuing; consumer coroutine pulls in batches of 50 every 30s (or immediately for high-priority events).
- Persisted unsent events to Room (simple table: `id, payload, priority, retry_count, last_attempt`). On app start, replay unsent.
- Wired to New Relic and Dynatrace via custom adapters, plus our own ingestion endpoint.
- Backed off on failures with exponential delay; capped at 5 retries before dead-letter queue.

**Result**:
- Reliable processing of 15K+ events/hour in production.
- Event loss rate < 0.1% (down from ~3% with previous setup).
- Used by product to drive 5+ decisions about EPG layout, recommendation ordering, ad placement.
- Engine extended for 3 new instrumentation use cases without rewriting.

**Defensive frame**:
- "Why not just Firebase Analytics?" → "Firebase batches lazily and offers limited routing. We needed routes to multiple backends (NewRelic, Dynatrace, internal), high-priority events flushed immediately, and custom dedupe."

---

## Story 5 — Cold start optimization

**Situation**: Cold start was creeping up to 2.4s on low-end TVs (1GB RAM, slow eMMC). User-perceived "app is slow."

**Task**: Cut cold start materially. Target sub-1.5s.

**Action**:
- Profiled with Android Studio CPU profiler + `adb shell am start -W`. Identified the worst offenders:
  - SDK init (Crashlytics, NewRelic, AdMob) on Application.onCreate, blocking ~600ms.
  - Network layer initializing eagerly.
  - JSON parse of cached manifest blocking first frame.
- Deferred non-critical SDK init via Jetpack App Startup library.
- Moved network-layer init off main using `lifecycleScope.launch(Dispatchers.IO)` triggered post-first-frame.
- Replaced eager JSON parse with `kotlinx.serialization` (faster cold start vs Gson) and parsed asynchronously while showing a placeholder.
- Generated Baseline Profiles for the cold-start path → ~10–20% additional win on first launches.
- Optimized network for a few common API calls: payload reduction, batched calls, response caching.

**Result**:
- Cold start: 2.4s → 1.1s (54% reduction) on low-end TVs.
- Crash rate dropped (some crashes were main-thread timeouts on slow init).
- Better perceived UX, validated by post-launch survey.

**Defensive frame**:
- "Did you use Macrobenchmark?" → "Yes, we set up `StartupBenchmark` to track cold/warm/hot start across releases — caught a regression in the next sprint."

---

## Story 6 — Mentoring and ownership (TR4 favorite)

**Situation**: I was assigned to mentor 2 interns and 1 junior engineer joining the Android team.

**Task**: Get them productive on our codebase quickly while maintaining code quality.

**Action**:
- Set up weekly 1:1s, structured starting tasks (good first issues), pairing on architecture-heavy PRs.
- Wrote internal docs on our module boundaries and Hilt setup since they were the trickiest gotcha.
- Reviewed every PR with detailed feedback for the first month.
- Gradually increased complexity of their tasks.
- Encouraged them to lead small features end-to-end.

**Result**:
- All three independently shipped non-trivial features within 6 weeks.
- One intern converted to FTE.
- Internal docs we wrote became part of onboarding for subsequent hires.

**Defensive frame for "tell me about leadership"**:
- This. Plus the multi-module migration where I led the architectural decision.

---

## Story 7 — A failure / learning (always have one)

**Situation**: I once shipped a "fix" for a flaky test that turned out to be a real concurrency bug. The test was failing intermittently because our coroutine setup was racy — I `@Ignore`d it to unblock the release.

**Task**: (Self-imposed) Investigate why the test failed before just disabling it.

**Action (what went wrong)**:
- I assumed the test was flaky because of test infrastructure.
- Disabled it, shipped.
- Two weeks later, a customer-reported crash traced back to the exact race I'd dismissed.

**Action (what I did to fix and learn)**:
- Re-investigated with `runTest` and `StandardTestDispatcher`, reproduced the race.
- Fixed it with proper structured concurrency (`coroutineScope` instead of unbounded `launch`).
- Added a team norm: no `@Ignore` without a JIRA ticket linked + an investigation note.

**Result**:
- Bug fixed before next release.
- New norm caught two more "flaky" tests that were real bugs in subsequent months.

**Why this story works**: shows ownership, learning, willingness to admit fault, and process improvement. Bar raisers love it.

---

## Story 8 — Disagreement (TR4 will probably ask)

**Situation**: PM wanted to ship a new search feature without offline cache, citing time-to-market. I'd seen the data: ~25% of our user sessions had at least one network blip.

**Task**: Either ship as planned or push back.

**Action**:
- Built a 30-min spike showing offline-cached search with a thin wrapper over our Room layer.
- Brought numbers to PM: 25% sessions affected, latency reduction even online (60ms → 5ms for cached queries).
- Proposed 2-day spike to integrate cleanly.
- Compromised: shipped with cache for already-searched queries (not full pre-fetch), reducing scope but covering the worst-case.

**Result**:
- Search latency dropped 50% online (P95).
- Offline-search worked for repeat users on subway commutes (a known persona).
- PM agreed to add full pre-fetch in V2.

**Why this story works**: data-driven, collaborative, ended with a compromise — not a "I won."

---

## "Why FOX?" / "Why are you leaving Dish?" (HR + TR4)

### Why FOX
- "FOX's DTC streaming work is at exactly the scale and complexity I want to grow on — Tubi, FOX Sports, FOX News all push different problems (ad-supported, live, news-style cadence). My current player work is directly relevant — DRM, SSAI, ABR — and I'd love to apply that on a team that's solving for tens of millions of users instead of our current scale."
- "I've been the most senior Android engineer on my immediate team for ~2 years. I want to learn from a team where the median is more senior than me."

### Why leaving Dish
- "I've delivered what I set out to at Dish — full ownership of the player module, the multi-module migration, and the ad stack. The natural next step for my growth is a larger DTC platform with a deeper Android engineering bench. I don't have specific complaints about Dish — it's a growth move."

(Don't trash a previous employer in interviews. Even mild negativity reads as a red flag.)

---

## Numbers cheat sheet (memorize these)

When telling stories, **specific numbers > adjectives**. Have these on tap:

- 60–70% load time cut (EPG)
- 50% rendering time cut (EPG)
- 80% production bug count reduction (EPG)
- 74% UI complexity reduction (multi-module)
- 15K+ events/hour (analytics engine)
- 54% cold start reduction (2.4s → 1.1s)
- 99.5% ad delivery reliability
- 0.1% event loss rate

These are *your* numbers — they're already in your resume. Practice saying them naturally.

---

## Final delivery tips

- **Time each story**: 60–90 seconds is ideal. Practice with a timer.
- **Don't memorize verbatim**. Internalize the structure (S/T/A/R) and the numbers.
- **Pause for questions**: after Action, pause briefly. Interviewer often probes here.
- **Lead with impact in TR4**: "I rebuilt our EPG in Compose — cut load time 60% and OOMs to zero. Want me to walk through how?"
- **Adapt the story to the question**: same project, different angle. EPG can be told as "ownership", "performance work", "Compose deep dive", or "leading a rebuild."

You have real, strong material. The job is delivery.
