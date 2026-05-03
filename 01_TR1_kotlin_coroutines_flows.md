# TR1 Deep Dive — Kotlin + Coroutines + Flows + Hilt
**Round**: TR1 (Coding, 60 min). Also re-tested in TR2.
**Goal**: Idiomatic Kotlin under pressure, deep understanding of coroutines/flows, clean Hilt setup.

---

## Part 1 — Kotlin core (the bits seniors probe)

### 1.1 Null safety — beyond `?.` and `!!`

```kotlin
val a: String? = null
val len = a?.length ?: 0       // safe call + Elvis
a?.let { println(it) }          // scope only if non-null
val name: String = a!!          // throws NPE — never use in prod code
```

**`lateinit` vs `by lazy`**:
- `lateinit var`: only `var`, only non-null reference types (no primitives), checked with `::name.isInitialized`. Use for fields injected later (DI, `setUp()` in tests, view binding).
- `by lazy { ... }`: only `val`, thread-safe by default (`LazyThreadSafetyMode.SYNCHRONIZED`). Computed once. Use for expensive init.

**Common pitfall**: `lateinit` on primitives — won't compile. Use `Delegates.notNull<Int>()`.

### 1.2 Data classes, sealed classes, enum classes

```kotlin
data class User(val id: String, val name: String)   // generates equals/hashCode/toString/copy/componentN
```
- `copy()` for immutable updates. `User.copy(name = "X")`.
- `componentN()` enables destructuring: `val (id, name) = user`.
- **Don't** put non-constructor `var`s in data class — copy() won't include them, hashCode misbehaves.

```kotlin
sealed class UiState {
    object Loading : UiState()
    data class Success(val items: List<Item>) : UiState()
    data class Error(val cause: Throwable) : UiState()
}
```
- Sealed class = "I know all the subtypes at compile time" → exhaustive `when`.
- Sealed *interface* (Kotlin 1.5+) — same thing, allows multiple inheritance. Prefer for state when you'd want it to be combined with other interfaces.

**Why interviewers ask**: tests if you understand exhaustive state modeling — the foundation for MVI.

### 1.3 Scope functions cheat sheet

| Function | `this`/`it` | Returns | Use case |
|---|---|---|---|
| `let` | `it` | lambda result | nullable transform: `nullable?.let { ... }` |
| `run` | `this` | lambda result | block of code on a receiver, returns something |
| `with` | `this` | lambda result | grouping calls on an object: `with(view) { ... }` |
| `apply` | `this` | the receiver | builder-style config: `Intent().apply { putExtra(...) }` |
| `also` | `it` | the receiver | side effects: `.also { Log.d(it) }` |

**Mnemonic**: `apply`/`also` return the object (chain-friendly), `let`/`run`/`with` return the lambda result.

### 1.4 Extension functions, properties, infix

```kotlin
fun String.isEmail(): Boolean = matches(Regex("..."))
val Int.dp: Int get() = (this * Resources.getSystem().displayMetrics.density).toInt()
infix fun Int.times(action: () -> Unit) { repeat(this) { action() } }
3 times { println("hi") }
```

**Gotcha**: Extension functions are statically dispatched. If both a member fn and an extension fn exist with the same signature, **member wins**. Interviewer might trick you with this.

### 1.5 Generics — variance, reified

```kotlin
class Box<out T>(val item: T)              // covariant: Box<Dog> is-a Box<Animal>
interface Comparator<in T> { ... }          // contravariant
fun <T> List<T>.firstOrNull(predicate: (T) -> Boolean): T?
```

**Star projection** `List<*>`: read-only as `Any?`. Use when you don't care about the type.

**Reified**:
```kotlin
inline fun <reified T> Bundle.getParcelableSafe(key: String): T? =
    if (Build.VERSION.SDK_INT >= 33) getParcelable(key, T::class.java)
    else @Suppress("DEPRECATION") getParcelable(key) as? T
```
- Reified means the type is known at runtime — only works with `inline` functions.
- Used heavily in `Gson.fromJson<T>(...)` style APIs.

### 1.6 `inline` / `crossinline` / `noinline`

- `inline fun foo(block: () -> Unit)` — inlines the lambda at call site. No object allocation, supports `return` (non-local).
- `crossinline` — the lambda must NOT have non-local returns (e.g., when it's stored in another lambda).
- `noinline` — opt out of inlining for one parameter.

**When to use inline**: high-frequency higher-order functions like `forEach`, `let`. Don't inline large functions — bloats bytecode.

### 1.7 Delegation

**Property delegation**:
```kotlin
class Settings(prefs: SharedPreferences) {
    var darkMode: Boolean by prefs.boolean("dark_mode", false)
}
```

**Class delegation** (composition over inheritance):
```kotlin
interface Repository { fun get(): Data }
class CachedRepository(actual: Repository) : Repository by actual { /* override only what you need */ }
```

**Standard delegates**: `lazy { }`, `Delegates.observable`, `Delegates.vetoable`, map delegates (`val name: String by map`).

### 1.8 Operator overloading — `invoke`, `get`, `plus`

```kotlin
class GetUserUseCase @Inject constructor(private val repo: UserRepo) {
    suspend operator fun invoke(id: String): User = repo.fetch(id)
}
// usage: getUser(id) instead of getUser.execute(id)
```
This is the **standard pattern for Use Cases in Clean Architecture** — interviewers love this.

### 1.9 `object`, companion object, `@JvmStatic`

- `object Foo` — singleton. Lazily initialized on first access (thread-safe).
- `companion object` inside a class — like Java's `static` (but is actually a singleton).
- `@JvmStatic` on companion members — generates true static method (Java interop).

### 1.10 Equality: `==` vs `===`

- `==` — structural equality (calls `equals()`).
- `===` — referential equality (same object).

**Senior trap**: data class `==` works for nested data, but if you have a `var` field that's not in the constructor, it's NOT in equality.

### 1.11 Functional bits worth knowing

- `fold`, `reduce`, `runningFold` (Kotlin 1.4+)
- `groupBy`, `associateBy`, `partition`
- `zipWithNext`, `chunked`, `windowed`
- `takeIf`, `takeUnless`

```kotlin
val name = userInput.takeIf { it.isNotBlank() } ?: "Anonymous"
```

### 1.12 Collections — Kotlin gotchas

- `listOf()` → immutable read-only `List` (but not deeply immutable — backing object is `ArrayList`).
- `mutableListOf()` → `MutableList`.
- `List<T>` is **covariant** — `List<Dog>` is `List<Animal>`. `MutableList<T>` is **invariant**.
- Sequences (`asSequence()`) — lazy, useful when chaining many operators on big collections.

---

## Part 2 — Coroutines (the topic that breaks candidates)

### 2.1 Mental model

A coroutine is a **suspendable computation**. It's not a thread — it's an instance of work that *runs on* a thread (managed by a Dispatcher) and can suspend cheaply (no thread blocking) when it hits a `suspend` point.

### 2.2 The four pillars

1. **Suspend functions** — pause/resume without blocking the thread.
2. **Coroutine builders** — `launch` (fire-and-forget), `async` (returns `Deferred<T>`), `runBlocking` (blocks current thread; only for tests/main).
3. **Coroutine context** — `Job` + `Dispatcher` + `CoroutineExceptionHandler` + `CoroutineName`.
4. **Structured concurrency** — coroutines have a parent-child relationship; cancelling a parent cancels children; failure of a child cancels parent (unless `SupervisorJob`).

### 2.3 Dispatchers

| Dispatcher | Use for |
|---|---|
| `Dispatchers.Main` | UI updates (Android main thread) |
| `Dispatchers.Default` | CPU-bound work, sorting, JSON parsing |
| `Dispatchers.IO` | network, disk, blocking calls |
| `Dispatchers.Unconfined` | resumes on the thread that triggered resume — almost never use in prod |

```kotlin
viewModelScope.launch {
    val data = withContext(Dispatchers.IO) { repo.fetch() }
    _state.value = data
}
```

**Don't manually create `Dispatchers.IO.limitedParallelism(...)` unless you really need it.** Default IO has 64 threads or `coreCount`, whichever is bigger.

### 2.4 Structured concurrency

```kotlin
coroutineScope {
    val a = async { fetchA() }
    val b = async { fetchB() }
    a.await() to b.await()
}
// If A throws, B is cancelled, exception propagates up. Both finish before this returns.
```

vs

```kotlin
supervisorScope {
    val a = async { fetchA() }
    val b = async { fetchB() }
    // A's failure does NOT cancel B. You handle exceptions per-await.
}
```

**Rule**: `coroutineScope` for "all or nothing", `supervisorScope` for independent children.

### 2.5 Job hierarchy & cancellation

- `Job` is the lifecycle handle. Cancel it → all children cancel.
- `cancel()` is cooperative. Your suspend function must check for cancellation (most built-in suspend functions do; CPU-heavy loops don't unless you call `ensureActive()` or `yield()`).
- `withContext(NonCancellable)` for cleanup that must run after cancellation (e.g., release a resource).

```kotlin
val job = scope.launch {
    try {
        while (isActive) { /* CPU work */ }
    } finally {
        withContext(NonCancellable) { releaseResource() }
    }
}
```

### 2.6 Exception handling

- Inside `launch`: uncaught exceptions go to the parent's `CoroutineExceptionHandler` (or crash if none).
- Inside `async`: the exception is held in the `Deferred` until you call `await()`. So **always await**, or catch with try/catch around `await()`.
- `try/catch` works inside coroutines normally for suspended calls.
- `CoroutineExceptionHandler` only catches uncaught exceptions in `launch` (or root coroutines). Doesn't catch in `async`.

```kotlin
val handler = CoroutineExceptionHandler { _, e -> Log.e("Coro", "boom", e) }
scope.launch(handler) { throw IOException("x") }    // caught
scope.async(handler) { throw IOException("x") }     // NOT caught — only on await()
```

### 2.7 `viewModelScope`, `lifecycleScope`, `GlobalScope`

- `viewModelScope` — cancelled when ViewModel is cleared. Default for VM work.
- `lifecycleScope` — cancelled when Lifecycle is destroyed. Use sparingly in Activity/Fragment.
- `GlobalScope` — never cancels. **Avoid in production.** Acceptable in `Application.onCreate` for app-scoped work, but prefer a custom `CoroutineScope(SupervisorJob() + Dispatchers.Default)`.

### 2.8 `withTimeout` and `withTimeoutOrNull`

```kotlin
val result = withTimeout(5000) { repo.slowCall() }              // throws TimeoutCancellationException
val result = withTimeoutOrNull(5000) { repo.slowCall() }         // returns null on timeout
```

### 2.9 `Channel` (for completeness, but use Flow instead in 99% of cases)

- `Channel<T>` — like a BlockingQueue but suspendable.
- Useful for one-shot events from a coroutine producer to consumer.
- `BufferedChannel`, `RendezvousChannel`, `ConflatedChannel`, `UnlimitedChannel`.

### 2.10 Common interview traps

- **"What's the difference between `launch` and `async`?"** — both start a coroutine; `async` returns `Deferred<T>` and accumulates exceptions until `await()`.
- **"What happens if I throw in `async` and never await?"** — exception is silently held; coroutine still propagates cancellation to siblings (in `coroutineScope`). In `supervisorScope`, it's effectively swallowed unless you `await`.
- **"Can a coroutine outlive the scope?"** — no, that's the whole point of structured concurrency. Use `GlobalScope` to opt out (don't).
- **"How do you make a CPU loop cancellable?"** — call `ensureActive()` or check `isActive` periodically.

### 2.11 Testing coroutines

- `runTest { }` — provides a `TestScope` with a virtual clock. Use `advanceTimeBy(...)` and `advanceUntilIdle()`.
- `StandardTestDispatcher` — manual control. Tasks queue; you advance time.
- `UnconfinedTestDispatcher` — tasks run eagerly. Simpler but doesn't catch ordering bugs.
- Inject the dispatcher (don't hardcode `Dispatchers.IO`) so tests can swap it.

```kotlin
class FetchUseCase(private val ioDispatcher: CoroutineDispatcher) {
    suspend operator fun invoke() = withContext(ioDispatcher) { /* ... */ }
}
```

---

## Part 3 — Flows (and StateFlow / SharedFlow)

### 3.1 Cold vs hot

- **Cold** (`Flow`): the producer block runs *for each collector*. No collectors → no work.
- **Hot** (`StateFlow`, `SharedFlow`): emit independently of collectors. Collectors see what's currently being emitted (or replay).

### 3.2 `Flow<T>` basics

```kotlin
fun searchUsers(q: String): Flow<List<User>> = flow {
    emit(emptyList())                              // initial
    val results = api.search(q)
    emit(results)
}.flowOn(Dispatchers.IO)                            // upstream runs on IO
 .catch { e -> emit(emptyList()) }                  // upstream errors only
 .onStart { /* loading */ }
 .onCompletion { /* cleanup */ }
```

**Operators**: `map`, `filter`, `transform`, `flatMapConcat`, `flatMapMerge`, `flatMapLatest`, `combine`, `zip`, `debounce`, `distinctUntilChanged`, `take`, `drop`, `scan`, `runningReduce`.

### 3.3 `flatMapLatest` — the search-as-you-type operator

```kotlin
queryFlow
    .debounce(300)
    .distinctUntilChanged()
    .flatMapLatest { q -> repo.search(q) }   // cancels previous search if new query arrives
    .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())
```

### 3.4 `StateFlow`

- Hot, **always has a value**, conflated (only the latest), `.value` is read-anytime.
- Replays exactly **1** value to new collectors.
- Equality-based — emits only if the new value `!= current`.

```kotlin
private val _state = MutableStateFlow<UiState>(UiState.Loading)
val state: StateFlow<UiState> = _state.asStateFlow()
```

### 3.5 `SharedFlow`

- Hot, configurable replay (`replay`), buffer (`extraBufferCapacity`), and overflow strategy.
- Use for **events** (one-shot side effects: navigation, snackbar) when you need 0-replay so latecomers don't re-trigger.

```kotlin
private val _events = MutableSharedFlow<Event>(replay = 0, extraBufferCapacity = 1)
val events: SharedFlow<Event> = _events.asSharedFlow()
```

**StateFlow vs SharedFlow** (the question you'll get):
- `StateFlow` = "state": one current value, replayed to new collectors. Equality dedupe.
- `SharedFlow` = "events" or "stream": configurable replay, no dedupe.
- `StateFlow(initial)` is essentially `SharedFlow(replay=1, onBufferOverflow=DROP_OLDEST)` with conflation + equality dedupe.

### 3.6 `stateIn` and `shareIn`

Convert a cold `Flow` to a hot one:

```kotlin
val users: StateFlow<List<User>> = repo.observeUsers()
    .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), emptyList())
```

`SharingStarted.WhileSubscribed(stopTimeoutMillis)` — share while there's at least one collector; keep alive for `stopTimeoutMillis` ms after the last collector unsubscribes (handles config changes). **5000 is the standard.**

Alternatives: `SharingStarted.Eagerly` (start immediately), `SharingStarted.Lazily` (start on first collector, never stop).

### 3.7 Collecting safely from Compose / Lifecycle

- **Don't** use `flow.collectAsState()` in production Compose. Use `collectAsStateWithLifecycle()` (lifecycle-runtime-compose lib) — it stops collecting when the lifecycle is `STOPPED`, saving work.
- In `Activity/Fragment`: `repeatOnLifecycle(Lifecycle.State.STARTED) { flow.collect { ... } }`.

### 3.8 `combine`, `zip`, `merge`

- `combine` — emits whenever any source emits, using the latest from each.
- `zip` — pairs up, waits for both, emits when both have one.
- `merge` — interleaves emissions from multiple flows.

```kotlin
combine(userFlow, settingsFlow) { user, settings -> Profile(user, settings) }
```

### 3.9 Backpressure: `buffer`, `conflate`, `collectLatest`

- `buffer(n)` — adds an internal queue. Slow consumer doesn't slow producer until buffer is full.
- `conflate()` — drop intermediate values; collector always sees the latest.
- `collectLatest { ... }` — cancel ongoing collector if a new item arrives.

### 3.10 Common Flow interview traps

- "Why does my Flow emit nothing?" — it's cold. Did you collect it? Did you `.launchIn(scope)`?
- "Why am I missing emissions in `MutableSharedFlow`?" — default has `replay=0, extraBufferCapacity=0` → if no collector, emit drops. Set `extraBufferCapacity=1` and `BufferOverflow.DROP_OLDEST` for events.
- "StateFlow sometimes doesn't emit my update" — equality. New value `equals` old value → no emit. Use a `data class` with the specific changed field, not the whole object.

---

## Part 4 — Hilt (DI)

### 4.1 The annotations you need to know cold

- `@HiltAndroidApp` — on Application class. Triggers code generation.
- `@AndroidEntryPoint` — on Activity, Fragment, Service, BroadcastReceiver, View.
- `@HiltViewModel` — on ViewModel. Inject in compose with `hiltViewModel()` or in fragment with `by viewModels()`.
- `@Inject constructor(...)` — to mark a class as injectable.
- `@Module` + `@InstallIn(component)` — to provide bindings for types you can't `@Inject` (interfaces, third-party, builders).
- `@Provides` — function inside a module that returns the binding.
- `@Binds` — abstract function inside an abstract module — maps an interface to its implementation. More efficient than `@Provides` for simple cases.
- `@Singleton`, `@ActivityScoped`, `@ViewModelScoped`, `@FragmentScoped` — scopes.

### 4.2 Components (scopes)

```
SingletonComponent       — @Singleton                    — application lifetime
ActivityRetainedComponent — @ActivityRetainedScoped       — survives config changes
ViewModelComponent       — @ViewModelScoped              — viewmodel lifetime
ActivityComponent        — @ActivityScoped               — activity lifetime
FragmentComponent        — @FragmentScoped               — fragment lifetime
ViewComponent            — @ViewScoped                   — view lifetime
ServiceComponent         — @ServiceScoped                — service lifetime
```

### 4.3 The 4 module patterns you'll be asked

**Pattern 1 — `@Provides`**:
```kotlin
@Module @InstallIn(SingletonComponent::class)
object NetworkModule {
    @Provides @Singleton
    fun provideRetrofit(client: OkHttpClient): Retrofit = Retrofit.Builder()
        .baseUrl("https://api.example.com/")
        .client(client)
        .addConverterFactory(Json.asConverterFactory("application/json".toMediaType()))
        .build()
}
```

**Pattern 2 — `@Binds`** (interface → impl):
```kotlin
@Module @InstallIn(SingletonComponent::class)
abstract class RepoModule {
    @Binds abstract fun bindUserRepo(impl: UserRepoImpl): UserRepo
}
```

**Pattern 3 — Qualifiers** (multiple bindings of same type):
```kotlin
@Qualifier annotation class IoDispatcher
@Qualifier annotation class MainDispatcher

@Module @InstallIn(SingletonComponent::class)
object DispatchersModule {
    @IoDispatcher @Provides fun io(): CoroutineDispatcher = Dispatchers.IO
    @MainDispatcher @Provides fun main(): CoroutineDispatcher = Dispatchers.Main
}

class Repo @Inject constructor(@IoDispatcher private val io: CoroutineDispatcher) { ... }
```

**Pattern 4 — Multibinding** (collect implementations):
```kotlin
@Module @InstallIn(SingletonComponent::class)
abstract class AnalyticsModule {
    @Binds @IntoSet abstract fun newRelic(impl: NewRelicTracker): AnalyticsTracker
    @Binds @IntoSet abstract fun crashlytics(impl: CrashlyticsTracker): AnalyticsTracker
}

class AnalyticsHub @Inject constructor(private val trackers: Set<@JvmSuppressWildcards AnalyticsTracker>)
```

### 4.4 Assisted injection

When you need to pass runtime values *and* DI'd dependencies:

```kotlin
class UserDetailsViewModel @AssistedInject constructor(
    private val repo: UserRepo,
    @Assisted val userId: String
) : ViewModel() {
    @AssistedFactory
    interface Factory { fun create(userId: String): UserDetailsViewModel }
}
```

For ViewModels with route-args, prefer `SavedStateHandle` injection in `@HiltViewModel` over assisted — Hilt + Navigation auto-wires it.

### 4.5 Hilt + Navigation Compose

```kotlin
composable("user/{id}") { backStackEntry ->
    val vm: UserVm = hiltViewModel()    // SavedStateHandle has "id" automatically
}

@HiltViewModel
class UserVm @Inject constructor(private val savedState: SavedStateHandle) : ViewModel() {
    val userId: String = checkNotNull(savedState["id"])
}
```

### 4.6 Hilt + WorkManager

```kotlin
@HiltWorker
class SyncWorker @AssistedInject constructor(
    @Assisted ctx: Context,
    @Assisted params: WorkerParameters,
    private val repo: SyncRepo
) : CoroutineWorker(ctx, params) { ... }
```

Plus in Application: `@HiltAndroidApp`, set up `Configuration.Provider` with `HiltWorkerFactory`.

### 4.7 Common Hilt pitfalls

- "MissingBinding" → forgot `@Module @InstallIn` or `@Binds`/`@Provides` for that type.
- "Cannot be provided without an @Inject constructor" → trying to inject a class with no usable constructor; either annotate or provide it.
- Multiple implementations of an interface with no qualifiers → ambiguous binding.
- Trying to inject `@Singleton` into `@ActivityScoped` field is fine; **the reverse is not** — narrower scope can't be injected into broader.

---

## Part 5 — TR1-style coding patterns (Kotlin idiomatic)

These are the patterns to have in your fingers. Type them by hand on Day 1.

### Pattern A — Sliding window (max sum of size k)
```kotlin
fun maxSumWindow(arr: IntArray, k: Int): Int {
    var sum = arr.take(k).sum()
    var best = sum
    for (i in k until arr.size) {
        sum += arr[i] - arr[i - k]
        best = maxOf(best, sum)
    }
    return best
}
```

### Pattern B — Two pointers (remove duplicates, sorted)
```kotlin
fun removeDuplicates(nums: IntArray): Int {
    if (nums.isEmpty()) return 0
    var write = 1
    for (read in 1 until nums.size) {
        if (nums[read] != nums[write - 1]) {
            nums[write++] = nums[read]
        }
    }
    return write
}
```

### Pattern C — HashMap pairing (two sum)
```kotlin
fun twoSum(nums: IntArray, target: Int): IntArray {
    val seen = HashMap<Int, Int>()
    nums.forEachIndexed { i, n ->
        seen[target - n]?.let { return intArrayOf(it, i) }
        seen[n] = i
    }
    return intArrayOf()
}
```

### Pattern D — DFS on grid (number of islands)
```kotlin
fun numIslands(grid: Array<CharArray>): Int {
    if (grid.isEmpty()) return 0
    val rows = grid.size; val cols = grid[0].size
    var count = 0
    fun dfs(r: Int, c: Int) {
        if (r !in 0 until rows || c !in 0 until cols || grid[r][c] != '1') return
        grid[r][c] = '0'
        dfs(r+1, c); dfs(r-1, c); dfs(r, c+1); dfs(r, c-1)
    }
    for (r in 0 until rows) for (c in 0 until cols) {
        if (grid[r][c] == '1') { count++; dfs(r, c) }
    }
    return count
}
```

### Pattern E — LRU cache (LinkedHashMap)
```kotlin
class LRUCache<K, V>(private val capacity: Int) :
    LinkedHashMap<K, V>(capacity, 0.75f, /* accessOrder = */ true) {
    override fun removeEldestEntry(eldest: Map.Entry<K, V>?) = size > capacity
}
```

### Pattern F — Producer/consumer with Channel
```kotlin
suspend fun process() = coroutineScope {
    val channel = Channel<Int>(capacity = 10)
    launch {
        repeat(100) { channel.send(it) }
        channel.close()
    }
    for (item in channel) {
        // consume
    }
}
```

### Pattern G — Parallel API calls
```kotlin
suspend fun loadDashboard(): Dashboard = coroutineScope {
    val a = async { api.userInfo() }
    val b = async { api.notifications() }
    val c = async { api.feed() }
    Dashboard(a.await(), b.await(), c.await())
}
```

### Pattern H — Retry with exponential backoff (Flow)
```kotlin
suspend fun <T> retryWithBackoff(
    times: Int = 3,
    initialDelay: Long = 500,
    factor: Double = 2.0,
    block: suspend () -> T
): T {
    var current = initialDelay
    repeat(times - 1) {
        try { return block() } catch (_: IOException) { /* retry */ }
        delay(current)
        current = (current * factor).toLong()
    }
    return block()  // last attempt — let exception propagate
}
```

---

## "Caught off guard?" recovery lines

If you blank in TR1, use these:

- **Forgot a Kotlin syntax**: "Let me write it in pseudo-Kotlin first and refine — the logic is X."
- **Don't know a stdlib function**: "I'd reach for `groupBy`/`fold` here — let me write it as a simple loop and refactor."
- **Asked about a topic you're rusty on**: "I've used this in production but let me reason through the underlying mechanic — *think out loud*." Interviewers prefer first-principles reasoning over rehearsed answers.
- **Stuck on a bug**: "Let me trace through with an example: input is [1,2,3], at iteration 0..."

The cardinal rule: **never go silent for more than 10 seconds.**
