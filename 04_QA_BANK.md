# Mock Interview Q&A Bank — 130+ Questions
**How to use**:
- Day 1 evening: cover Kotlin / Coroutines / Flows / Hilt sections.
- Day 2 evening: Compose / Architecture / Jetpack / Networking.
- Day 3 evening: Security / Performance / Player / System Design / Behavioral.
- **Answer OUT LOUD** without notes first. Then check your answer against the model.
- For each question you stumble on, mark a star and re-do the next day.

---

## Section 1 — Kotlin (TR1, TR2)

**Q1. What's the difference between `val` and `const val`?**
- `val` is a runtime read-only variable; can be initialized at runtime, can be a non-primitive.
- `const val` is a compile-time constant; only top-level or inside an `object`/companion, only primitives + `String`. Inlined at the call site.

**Q2. `lateinit` vs `by lazy`?**
- `lateinit var`: only `var`, only non-null reference types, no thread safety, must be initialized before access (or `UninitializedPropertyAccessException`). Use for fields injected later (DI, view binding).
- `by lazy`: only `val`, thread-safe by default (SYNCHRONIZED), computed once on first access. Use for expensive init.

**Q3. What does `sealed class` give you that `abstract class` doesn't?**
- All subclasses are known at compile time → exhaustive `when`.
- Subclasses must be in the same module/package (since 1.5 — same module).
- Combines well with state modeling (UiState, Result).

**Q4. Difference between `data class` and a regular class?**
- Data class auto-generates `equals`, `hashCode`, `toString`, `copy`, `componentN`.
- Must have at least one constructor parameter (val/var).
- Cannot be `abstract`, `open`, `sealed`, or `inner`.

**Q5. What's a destructuring declaration?**
- `val (a, b) = pair` — calls `componentN()`. Works on data classes, `Pair`, `Triple`, `Map.Entry`, custom classes implementing `componentN()`.

**Q6. Explain scope functions.**
- `let` (it / lambda result), `run` (this / lambda result), `with` (this / lambda result), `apply` (this / receiver), `also` (it / receiver).
- Mnemonic: `apply`/`also` return the object (chain-friendly), others return the lambda result.

**Q7. What does `inline` do? When NOT to use it?**
- Inlines the function body at call site → no closure object allocated for lambda parameters → supports non-local returns.
- Don't inline large functions (bytecode bloat). Don't use unless function takes a lambda — no benefit otherwise.

**Q8. What's `reified` and why does it need `inline`?**
- `reified` makes the type parameter accessible at runtime as `T::class`.
- It works because `inline` copies the function body — including the type parameter — to the call site, where T is concrete.

**Q9. Variance: `out T`, `in T`, invariant?**
- `out T` (covariant): producer; `Box<Dog>` is-a `Box<Animal>`. T can only appear in OUT positions (return).
- `in T` (contravariant): consumer; `Comparator<Animal>` is-a `Comparator<Dog>`. T can only appear in IN positions (parameters).
- Invariant: default; `MutableList<Dog>` is NOT a `MutableList<Animal>` (would break type safety on writes).

**Q10. `==` vs `===` ?**
- `==` calls `equals()` (structural equality).
- `===` is referential identity.

**Q11. Explain extension functions. How are they dispatched?**
- Statically dispatched (resolved at compile time based on the static type).
- A member function with the same signature wins over an extension function.

**Q12. What's an `object` declaration?**
- Singleton — lazily initialized, thread-safe.
- Can extend classes/interfaces.
- `companion object` is a singleton inside a class (Java's `static` analog).

**Q13. What does `@JvmStatic` do?**
- On a companion object member: generates a true `static` method in bytecode → callable from Java without `Companion` qualifier.

**Q14. Difference between `Sequence` and `Iterable`?**
- `Iterable`: eager — each operator allocates a new collection.
- `Sequence`: lazy — operators chain and execute terminally. Better for big collections with many ops; worse for small ones (overhead).

**Q15. Null safety: how does Kotlin handle Java's nullable types?**
- Java types are "platform types" `String!` — Kotlin doesn't enforce null checks; up to you to handle. Annotate Java with `@Nullable`/`@NonNull` to fix.

**Q16. What's the deal with `lateinit` on primitives?**
- Doesn't work — primitives have a default value (0/false), so the "uninitialized" marker doesn't fit.
- Use `Delegates.notNull<Int>()` instead.

**Q17. What does `infix` do?**
- Allows calling a function without `.`/`()` if it takes one parameter and is a member or extension.
- E.g., `1 to 2` (creates a Pair via `Pair.to`).

**Q18. What's an `operator fun invoke`?**
- Allows calling an instance like a function: `getUser(id)` → `getUser.invoke(id)`. Used for use cases in Clean Architecture.

**Q19. How do you use `Result<T>` in Kotlin?**
- Wrapper for success/failure: `runCatching { ... }.onSuccess { ... }.onFailure { ... }`.
- Don't use as return type in public API (Kotlin discourages this); use sealed class instead.

**Q20. What's a delegated property?**
- `var x: Int by SomeDelegate()` — getter/setter forwarded to the delegate's `getValue` / `setValue`.
- Built-in: `lazy`, `Delegates.observable`, `Delegates.vetoable`, `Delegates.notNull`, map delegation.

---

## Section 2 — Coroutines (TR1, TR2)

**Q21. What's a coroutine?**
- A suspendable computation. Cheaper than threads (thousands at a time). Runs on a Dispatcher (which is backed by threads). Suspends without blocking the thread.

**Q22. `launch` vs `async`?**
- `launch` returns `Job`, fire-and-forget, exception propagates to parent immediately.
- `async` returns `Deferred<T>`, accumulates exception until `await()`.

**Q23. What's structured concurrency?**
- Coroutines are tied to a `CoroutineScope`. Children depend on parent's lifecycle. Parent cancel → children cancel. Child exception → parent fails (unless `SupervisorJob`).

**Q24. `Dispatchers.Main` vs `Default` vs `IO` vs `Unconfined`?**
- Main: UI updates.
- Default: CPU-bound (parsing, sorting); thread pool sized to CPU count.
- IO: blocking I/O (network, disk); larger thread pool (~64).
- Unconfined: resumes on whatever thread triggered resumption — almost never use.

**Q25. What does `SupervisorJob` do?**
- A child failure does NOT cancel siblings or parent.
- Used inside `supervisorScope` or as part of a custom scope's context.

**Q26. How do you handle exceptions in `async`?**
- The exception is held in `Deferred` until `await()`. Wrap `await()` in `try/catch`.
- `CoroutineExceptionHandler` does NOT catch async exceptions.

**Q27. How do you cancel a coroutine?**
- `job.cancel()`. Cancellation is cooperative — your code must check (suspend points do automatically; CPU loops use `ensureActive()` or `yield()`).

**Q28. What is `withContext`?**
- Switches dispatcher inside a coroutine. Returns when the block completes. Doesn't start a new coroutine.

**Q29. Difference between `coroutineScope { }` and `supervisorScope { }`?**
- `coroutineScope`: any child failure cancels all and propagates up.
- `supervisorScope`: children are independent — one's failure doesn't cancel others.

**Q30. `viewModelScope` vs `lifecycleScope`?**
- `viewModelScope`: cancelled in `onCleared()`. Survives configuration changes.
- `lifecycleScope`: cancelled when Lifecycle is destroyed. Tied to View/Fragment.

**Q31. How do you do parallel API calls with coroutines?**
```kotlin
coroutineScope {
    val a = async { api.fetchA() }
    val b = async { api.fetchB() }
    Combined(a.await(), b.await())
}
```

**Q32. How do you implement timeout?**
- `withTimeout(ms) { ... }` throws `TimeoutCancellationException`.
- `withTimeoutOrNull(ms) { ... }` returns null on timeout.

**Q33. What's the cleanup pattern after cancellation?**
- `try { ... } finally { withContext(NonCancellable) { release() } }` — `NonCancellable` lets cleanup suspend functions run even after cancellation.

**Q34. Can you call a suspend function from a regular function?**
- No — only from another suspend function or a coroutine builder (`launch`, `async`, `runBlocking`).

**Q35. What is `runBlocking` and when is it appropriate?**
- Blocks the current thread until coroutine completes. Use only in main() of a script, in tests (prefer `runTest`), or to bridge to non-coroutine code.

**Q36. `ensureActive()` vs `yield()`?**
- `ensureActive()`: throws `CancellationException` if the coroutine is cancelled. No suspend.
- `yield()`: suspends, gives other coroutines a chance, also checks cancellation.

**Q37. What's `CoroutineExceptionHandler`?**
- Catches uncaught exceptions in `launch` (root level).
- Does NOT catch in `async` (those are stored in `Deferred`).

**Q38. How do you test coroutines?**
- `runTest { }` with `TestScope` — virtual time, `advanceTimeBy`, `advanceUntilIdle`.
- Inject your dispatchers (don't hardcode `Dispatchers.IO`) so you can swap for `StandardTestDispatcher` or `UnconfinedTestDispatcher`.

**Q39. What's `Mutex` in coroutines?**
- A coroutine-friendly lock. `mutex.withLock { ... }` ensures only one coroutine in the block at a time. Doesn't block threads.

**Q40. What's `Channel` and when do you use it?**
- A coroutine-safe queue with `send`/`receive` (suspendable). Useful for producer/consumer when you need fan-out or specific buffering. For most state/event needs, prefer Flow.

---

## Section 3 — Flows (TR1, TR2)

**Q41. Cold flow vs hot flow?**
- Cold: producer block runs per collector (e.g., `flow { }`).
- Hot: emits independently of collectors (`StateFlow`, `SharedFlow`).

**Q42. `StateFlow` vs `SharedFlow`?**
- `StateFlow`: always has a value, conflated, replays 1, equality dedupe. For "state".
- `SharedFlow`: configurable replay/buffer, no dedupe. For "events" or general streams.

**Q43. Why use `stateIn(WhileSubscribed(5000))`?**
- Keeps upstream flow alive for 5s after the last collector unsubscribes — handles configuration changes (rotation) without re-fetching.

**Q44. What's `flatMapLatest`?**
- For each emission, cancels the previous inner flow and starts a new one. Classic search-as-you-type pattern.

**Q45. `combine` vs `zip` vs `merge`?**
- `combine`: emits whenever any source emits, using latest from each.
- `zip`: pairs up; emits when both have one new value.
- `merge`: interleaves emissions from multiple flows.

**Q46. Why doesn't my `MutableSharedFlow` deliver events?**
- Default has `replay=0` and `extraBufferCapacity=0` — if no collector, `emit()` suspends. Use `tryEmit` or set `extraBufferCapacity=1` with `BufferOverflow.DROP_OLDEST`.

**Q47. Why doesn't my `StateFlow` emit?**
- It uses equality. If the new value `equals` the old, no emission. Use a data class with the changed field.

**Q48. What's `flowOn`?**
- Sets the dispatcher for upstream operators. Doesn't affect downstream. Use for shifting the producer's work.

**Q49. `collectLatest` — what does it do?**
- For each new emission, cancels the in-progress collector block before processing the new one.

**Q50. Difference between `buffer`, `conflate`, `collectLatest`?**
- `buffer(n)`: queue up to n items between producer and consumer.
- `conflate`: drop intermediate; consumer sees latest.
- `collectLatest`: cancel in-progress collector on new emission.

**Q51. How to convert callback API to Flow?**
- `callbackFlow { ... }` — register listener inside, `trySend` on callbacks, `awaitClose { unregister() }`.

**Q52. How to safely collect Flow in Compose?**
- `val state by flow.collectAsStateWithLifecycle()` (from `lifecycle-runtime-compose`). Stops collecting when lifecycle is STOPPED.

**Q53. Backpressure — how does Flow handle it?**
- By default, suspending: `emit` suspends until the collector consumes. Use `buffer`, `conflate`, `collectLatest`, or `BufferOverflow` strategies on `MutableSharedFlow`.

**Q54. `onStart`, `onCompletion`, `catch`?**
- `onStart`: emit something before producer runs.
- `onCompletion`: runs after collector finishes (success or cancellation).
- `catch`: catches exceptions from upstream only — won't catch downstream.

**Q55. Can you re-collect a Flow?**
- Cold flows: yes, each collect re-runs producer.
- Hot flows: yes, but you'll only get current state / replay buffer.

---

## Section 4 — Hilt / DI (TR2)

**Q56. Why DI?**
- Decoupling, testability, lifecycle management, single source of truth for object graphs.

**Q57. What's `@HiltAndroidApp`?**
- On the Application class. Triggers Hilt code generation for the app component.

**Q58. `@Provides` vs `@Binds`?**
- `@Provides`: function in an `object` module, returns the binding. Works for any expression.
- `@Binds`: abstract function in an `abstract` module, maps interface → impl. More efficient (no factory class generated).

**Q59. What's a `@Qualifier`?**
- Custom annotation to disambiguate same-type bindings. E.g., `@IoDispatcher`/`@MainDispatcher` for `CoroutineDispatcher`.

**Q60. What scopes does Hilt provide?**
- `@Singleton`, `@ActivityRetainedScoped`, `@ViewModelScoped`, `@ActivityScoped`, `@FragmentScoped`, `@ViewScoped`, `@ServiceScoped`.

**Q61. `@HiltViewModel` — how does it work?**
- Hilt provides ViewModel via the `ViewModelComponent`. Combine with `by viewModels()` (Fragment) or `hiltViewModel()` (Compose).

**Q62. Assisted injection — when do you need it?**
- When a class needs both DI'd dependencies and runtime values not knowable at graph-build time. Use `@AssistedInject` + `@Assisted` + `@AssistedFactory`.

**Q63. Multibinding — what is it?**
- Collect multiple impls into a `Set` or `Map`. Use `@IntoSet`, `@IntoMap`, with custom map keys.

**Q64. What's the order of components in Hilt's hierarchy?**
- SingletonComponent → ActivityRetainedComponent → ViewModelComponent (or ActivityComponent → FragmentComponent → ViewComponent / ServiceComponent).
- Wider scope can be injected into narrower; not vice versa.

**Q65. Common Hilt errors?**
- "MissingBinding" — no `@Provides`/`@Binds` for that type.
- "Cannot be provided without an @Inject constructor" — class has no usable constructor.
- "Duplicate binding" — multiple `@Provides` for same type without qualifiers.

---

## Section 5 — Compose (TR2)

**Q66. What is recomposition?**
- Re-running composable functions when their inputs (parameters or read State) change. Compose reuses the slot table to do diffing.

**Q67. What is "stable" in Compose?**
- A type Compose can rely on — `equals` reflects rendered-output equivalence. Primitives, `String`, lambdas, `@Stable`/`@Immutable` annotated classes, data classes with all-stable fields are stable. `List`, `Map`, mutable types: unstable.

**Q68. Why is my composable recomposing every time?**
- Likely an unstable parameter (List, Map, a lambda capturing a `var`). Mark the data class `@Immutable` if you can guarantee immutability, or use `ImmutableList<T>` from `kotlinx.collections.immutable`.

**Q69. `remember` vs `rememberSaveable`?**
- `remember`: survives recomposition only.
- `rememberSaveable`: also survives configuration changes and process death (Bundle-based).

**Q70. `LaunchedEffect` vs `SideEffect` vs `DisposableEffect`?**
- `LaunchedEffect(key)`: launch a coroutine; restarts when key changes.
- `SideEffect`: runs after every successful composition; sync state to non-Compose code.
- `DisposableEffect(key)`: setup + `onDispose { cleanup }`. For resources (listeners, observers).

**Q71. What's `derivedStateOf`?**
- Wraps a state read so the dependent only recomposes when the *result* changes, not when underlying state ticks.
- Classic use: `val showFab by remember { derivedStateOf { listState.firstVisibleItemIndex == 0 } }`.

**Q72. What's `rememberUpdatedState`?**
- Stores the latest value of a parameter so a long-running effect doesn't capture a stale closure.

**Q73. State hoisting — what is it?**
- Push state up to the lowest common parent. Pass `value` and `onValueChange` down. Stateless composables = easier to test/preview.

**Q74. How does `LazyColumn` recycle items?**
- Uses keys (`key = { it.id }`) to identify items; without keys, Compose treats items by position (causes wrong recomposition on reordering).

**Q75. What's `CompositionLocal`?**
- Provides values implicitly down the tree. Built-in: `LocalContext`, `LocalDensity`. Custom: `compositionLocalOf` / `staticCompositionLocalOf`.

**Q76. `compositionLocalOf` vs `staticCompositionLocalOf`?**
- `compositionLocalOf`: tracks reads; only readers recompose on value change.
- `staticCompositionLocalOf`: doesn't track; all descendants recompose. Use for values that rarely change (theme).

**Q77. How does `Modifier` order matter?**
- Modifiers compose left-to-right: `padding(16).background(Red)` = padding around red bg; `background(Red).padding(16)` = red, then padding inside (smaller red).

**Q78. How do you do navigation in Compose?**
- Navigation Compose. Type-safe routes (Nav 2.8+) or string routes with `navArgument`.

**Q79. How do you handle process death state?**
- `rememberSaveable` for UI state.
- `SavedStateHandle` in ViewModel for VM state.

**Q80. How do you migrate from XML to Compose incrementally?**
- `ComposeView` inside XML layouts, or `AndroidView` inside Compose. Set Compose theme via `MaterialTheme`.

---

## Section 6 — Architecture (TR2, TR3)

**Q81. MVVM vs MVI?**
- MVVM: VM exposes state; view calls VM methods. Loosely coupled.
- MVI: strict UDF — View → Intent → VM reduces State → View renders. Side effects via separate channel.

**Q82. When MVI over MVVM?**
- State-heavy screens (player, multi-step forms, search) where reasoning about state transitions is critical.

**Q83. What is Clean Architecture?**
- Layered: presentation depends on domain; data depends on domain. Domain has no Android dep. Dependency rule: inner layers know nothing about outer.

**Q84. Why use cases?**
- Encapsulate business logic that's reused across screens or composed. Easy unit testing. Skip them if there's no logic — passthrough use cases are bloat.

**Q85. Repository pattern — what's the contract?**
- Repository = single source of truth for a data type. Coordinates network + DB + cache. Returns domain models. Often returns `Flow`.

**Q86. Offline-first — describe the pattern.**
- DB is single source of truth for UI. Sync layer (WorkManager) refreshes from network → DB. UI observes DB Flow.

**Q87. Why multi-module?**
- Build speed (parallel compilation), enforced layer boundaries, explicit API surface.

**Q88. What's SDUI?**
- Server-Driven UI. Server sends layout descriptors; client renders generically. Lets product change UI without app release.

**Q89. How do you avoid circular dependencies?**
- Define interfaces in inner layers (domain), implementations in outer (data). Use a `:core-common` for shared types.

**Q90. How do you migrate to multi-module?**
- Incrementally — feature by feature. Start by extracting `:core` (network, db, design system). Then peel off feature modules one at a time.

---

## Section 7 — Jetpack Libraries (TR2)

**Q91. ViewModel vs `onSaveInstanceState`?**
- ViewModel survives config changes; doesn't survive process death.
- `onSaveInstanceState` (or `SavedStateHandle`) survives process death (Bundle-based; small data only).

**Q92. Room: why use it?**
- Compile-time SQL verification, Flow observation, type-safe queries, migrations, transactions.

**Q93. How do you do a Room migration?**
- `Migration(from, to) { db -> db.execSQL("ALTER TABLE...") }`. Add to `Room.databaseBuilder().addMigrations(...)`.

**Q94. `LiveData` vs `StateFlow`?**
- LiveData: lifecycle-aware (auto-pauses off-screen).
- StateFlow: not lifecycle-aware on its own — wrap with `repeatOnLifecycle` or `collectAsStateWithLifecycle`.
- New code prefers StateFlow.

**Q95. WorkManager — when to use it?**
- Deferrable, guaranteed background work (sync, upload, retry on network return). Persistent across reboot.

**Q96. WorkManager constraints?**
- Network type, charging, battery not low, storage not low, device idle.

**Q97. Expedited work?**
- Runs ASAP, possibly as foreground service. Requires user-visible importance (notification).

**Q98. DataStore vs SharedPreferences?**
- DataStore: async (Flow-based), transactional, type-safe (proto). No main-thread disk I/O.
- SharedPreferences: synchronous, prone to ANRs if abused, deprecated for new code.

**Q99. How do you migrate from SharedPreferences to DataStore?**
- `migrations = listOf(SharedPreferencesMigration(ctx, "old_prefs"))` in `preferencesDataStore`.

**Q100. Navigation — type-safe vs string routes?**
- Nav 2.8+ supports `@Serializable` data classes as routes. Type-safe args, IDE-checked.

---

## Section 8 — Networking (TR2)

**Q101. Retrofit + Kotlinx Serialization setup?**
- See `02_TR2`. `Retrofit.Builder().addConverterFactory(json.asConverterFactory("application/json".toMediaType()))`.

**Q102. Interceptor vs Authenticator?**
- Interceptor: runs on every request. Add headers, logging, retry.
- Authenticator: runs on 401 response → refresh token → retry. Handles auth recovery.

**Q103. How do you handle token refresh?**
- `Authenticator` on OkHttpClient. Refresh atomically (Mutex) so concurrent 401s don't double-refresh.

**Q104. SSL pinning — pros/cons?**
- Pro: defense against MITM with rogue CAs.
- Con: operational burden — cert rotation must be coordinated, else app breaks. Pin to public-key SPKI hash of intermediate CA, not leaf, for resilience.

**Q105. Why Kotlinx Serialization over Gson/Moshi?**
- Kotlin-first (default values, sealed classes, value classes). Multiplatform-ready. KSP-generated → no reflection on Android. Faster cold start.

**Q106. How do you handle pagination?**
- Cursor-based ideally (server returns `nextCursor`). Paging 3 library for `RemoteMediator` + Room source-of-truth pattern.

---

## Section 9 — Security (TR2, TR3)

**Q107. Where do you store an OAuth refresh token?**
- `EncryptedSharedPreferences` (Jetpack Security). Or Android Keystore-backed encrypted DataStore.

**Q108. PKCE — what is it and why?**
- Proof Key for Code Exchange. Mobile-safe OAuth flow. Per-flow nonce replaces a static client secret (which mobile apps can't keep).

**Q109. What's `EncryptedSharedPreferences`?**
- Wraps SharedPrefs with AES256 encryption; keys live in Android Keystore. Same API as SharedPreferences.

**Q110. Network Security Config?**
- XML file declaring TLS pinning, cleartext rules, trusted CAs. Set via `android:networkSecurityConfig`.

**Q111. How do you protect against reverse engineering?**
- R8 obfuscation, ProGuard rules, ideally compose with native crypto for critical paths. Acknowledge: you can raise the bar but can't make it impossible.

**Q112. Deep link security?**
- Validate IDs against the current user session, treat URL params as untrusted, verify the intent's source if possible.

**Q113. Root detection — why and limitations?**
- Detect with RootBeer/Play Integrity. Decide per-feature whether to block (e.g., DRM playback) — be careful, false positives anger legit users.

---

## Section 10 — Performance (TR2)

**Q114. How do you measure cold start?**
- `adb shell am start -W -n pkg/.MainActivity`. Macrobenchmark `StartupBenchmark`. Android Studio Profiler.

**Q115. Tactics to reduce cold start?**
- Defer SDK init (App Startup library), Baseline Profiles, R8, lazy DI graph init, avoid blocking I/O in `Application.onCreate`.

**Q116. What's a Baseline Profile?**
- AOT compilation hints. Ships in the APK; ART pre-compiles those code paths → faster cold start + first-frame.

**Q117. How do you debug jank?**
- Profiler "System Trace", JankStats library, Compose recomposition counts in Layout Inspector.

**Q118. Common memory leak sources?**
- Holding Activity ref in a singleton, anonymous inner classes, listeners not unregistered, `GlobalScope.launch` capturing Activity, ExoPlayer not released in onDispose.

**Q119. How do you find memory leaks?**
- LeakCanary in debug builds. Profiler heap dump → search for `Activity` with > 1 instance.

**Q120. APK size — how do you reduce it?**
- R8 + resource shrinking, App Bundles, WebP, vector drawables, dynamic feature modules.

---

## Section 11 — Video Player (TR2, TR3 — your moat)

**Q121. Why ExoPlayer over MediaPlayer?**
- ExoPlayer: open, customizable, consistent across OS versions, supports HLS/DASH/SmoothStreaming/DRM out of the box, handles ABR.
- MediaPlayer: OS-tied, limited customization, no full ABR.

**Q122. HLS vs DASH?**
- HLS: Apple, .m3u8, segments .ts (legacy) or CMAF (.mp4). Native iOS support.
- DASH: MPEG, .mpd XML, .mp4 segments. Better Android/web support; no native iOS.
- Modern: HLS+CMAF works almost everywhere.

**Q123. How does ABR work?**
- Player measures bandwidth on segment downloads. TrackSelector picks bitrate from manifest variants. Switches up if buffer healthy + bandwidth allows; switches down if buffer drains.

**Q124. CSAI vs SSAI?**
- CSAI: client fetches ad, pauses content, plays ad, resumes. IMA SDK on Android.
- SSAI: ads stitched server-side into the stream. Single continuous playback. Beacons fire at known timestamps.

**Q125. Widevine DRM levels?**
- L1 (hardware-backed, HD/4K allowed), L2 (mixed), L3 (software, often HD-blocked).

**Q126. How do you support offline DRM?**
- `OfflineLicenseHelper` to download a per-content license. Store license bytes alongside the content.

**Q127. Common player crashes?**
- Source error (manifest 404, segment 5xx) — `Player.Listener.onPlayerError` with `ExoPlaybackException`.
- DRM error (license server 4xx, key rotation issue).
- Decoder error (codec mismatch on low-end device).
- OOM if not releasing player on screen exit.

**Q128. How do you measure playback quality?**
- TTFF, rebuffer ratio, bitrate distribution, error count. Conviva or Bitmovin Analytics SDK.

---

## Section 12 — System Design (TR3)

**Q129. Design a video streaming app like Tubi.**
- See `03_TR3_TR4` Part 3.1. Frame: clarify → reqs → architecture → deep dive (player or SDUI) → scale considerations.

**Q130. Design an offline-first notes app.**
- DB (Room) is source of truth. Repo exposes Flow from DB. WorkManager syncs to network. Conflict resolution: last-write-wins or version-based.

**Q131. Design a chat client.**
- WebSocket for real-time. Local DB for persistence. Send queue with idempotent IDs. Reconnection with "since last delivered" replay.

**Q132. Design an image loader.**
- Memory cache + disk cache + network. LRU eviction. Cancel on view recycle. Cache key = url + size + transformations.

**Q133. How do you scale a mobile app from 100K to 10M users?**
- Backend scaling (CDN, caching, sharding) is primary. Mobile-side: better caching, more efficient API calls (batching, GraphQL), feature flags for risky rollouts, robust telemetry, A/B tests.

---

## Section 13 — Behavioral (TR3, TR4, HR)

**Q134. Tell me about a time you owned a tough technical problem.**
- See STAR Story #1 (EPG rebuild) or #2 (ad stack).

**Q135. Tell me about a disagreement with your manager / PM.**
- See STAR Story #8 (search caching).

**Q136. Tell me about a failure.**
- See STAR Story #7 (the disabled flaky test).

**Q137. Why are you leaving Dish?**
- Growth move. Don't trash. "I've delivered what I set out to and want a deeper Android engineering bench to grow on."

**Q138. Why FOX?**
- DTC streaming at scale. Player work directly relevant. Tubi/FOX Sports/News all interesting Android problems.

**Q139. Where do you see yourself in 5 years?**
- "Senior staff engineer level — leading architecture for a major Android product or platform team. Deepening into video/streaming or scaling Android orgs."

**Q140. What's your weakness?**
- Pick a real one with a mitigation: "I lean on AI tooling more than I should — I've made it a habit this past month to write features by hand first, then use AI for review/edge cases. It's improved my speed and confidence."
- (Don't say "I'm a perfectionist." Bar raisers groan.)

---

## Final practice protocol

- **Day 1 evening**: Q1–Q55 (Kotlin + Coroutines + Flows). Mark every Q where you stumble.
- **Day 2 evening**: Q56–Q100 (Hilt + Compose + Architecture + Jetpack).
- **Day 3 evening**: Q101–Q140 (Networking + Security + Performance + Player + Design + Behavioral).
- **Day 4 morning**: re-do every starred Q without notes.
- **Mock interview style**: have a friend ask 10 random Qs. If you can answer 8/10 cleanly, you're ready.

You'll be tempted to skim. **Don't.** Speak the answer out loud — even alone. The articulation is what's been atrophying with AI use. Reactivate it.
