# TR2 Deep Dive — Compose + MVVM/MVI/Clean + Jetpack Libraries
**Round**: TR2 (Technical Deep Dive, 60 min). Probes architecture choices and "why."
**Goal**: Defend any architectural decision under senior questioning. Speak Compose internals fluently.

---

## Part 1 — Jetpack Compose internals

### 1.1 The mental model

Compose is a **declarative UI toolkit** built on three pillars:
1. **Composition** — the tree of `@Composable` calls that produces the UI description.
2. **Recomposition** — re-running parts of the composition when state changes.
3. **Slot table** — the runtime data structure that tracks where each composable lives, so Compose knows what to re-run.

You don't manipulate UI nodes; you describe what should be on screen for the current state. The Compose runtime diffs and updates the underlying View hierarchy (or Layout/Canvas).

### 1.2 Recomposition — the question that breaks people

**Recomposition** = Compose re-running composable functions to update the UI when their inputs change.

Compose only recomposes a function if:
1. Its inputs (parameters) have changed (`equals` check), AND
2. The function reads `State<T>` whose value changed.

**Skipping**: a `@Composable` is *skippable* if all its parameters are **stable**. Stable means Compose can rely on `equals`/`hashCode` to detect change, and the type is annotated `@Stable` or `@Immutable` (or is a primitive, function reference, or stable data class).

**Restarts**: if a parameter to a composable changes, that composable restarts (recomposes its body). Children that aren't affected (their inputs are stable AND unchanged) are skipped.

### 1.3 Stability — the most common Compose perf gotcha

A type is **stable** if Compose can trust `equals` to mean "the rendered output should be the same."

- Primitives, `String`, `MutableState`, lambdas: stable.
- `data class` with all-stable fields: stable.
- `data class` with `var` fields, `List`, `Map`, interfaces: **unstable** (Compose can't prove they didn't change internally).

```kotlin
data class Filter(val tags: List<String>)   // UNSTABLE — List is not stable
@Immutable
data class Filter(val tags: List<String>)   // tells Compose "trust me, I'm immutable"
```

For `List`, prefer:
- `kotlinx.collections.immutable.ImmutableList<T>` (truly immutable).
- Or annotate the wrapping data class `@Immutable`.

**Diagnosing**: enable Compose Compiler Reports to see which functions are *not skippable* and why.

### 1.4 The `remember` family

| API | Lives across | Re-init when |
|---|---|---|
| `remember { ... }` | recomposition | composable leaves the composition |
| `remember(key) { ... }` | recomposition | `key` changes |
| `rememberSaveable` | recomp + config change + process death | the composable is removed |
| `rememberCoroutineScope()` | recomp | composable leaves |
| `rememberUpdatedState(value)` | recomp | always — points to latest `value` |

**`remember` vs `rememberSaveable`**: `rememberSaveable` survives process death via `Bundle`. Use it for UI state you'd be sad to lose (text field input, scroll position).

### 1.5 Side effects — pick the right one

| API | Use when |
|---|---|
| `LaunchedEffect(key)` | run a coroutine; restarts when `key` changes |
| `DisposableEffect(key)` | resource that needs cleanup; `onDispose { ... }` is required |
| `SideEffect { ... }` | sync Compose state to non-Compose code, runs after every successful composition |
| `produceState` | turn a non-Compose source into `State<T>` |
| `derivedStateOf` | derive State from other State; only recomposes downstream when *result* changes |
| `snapshotFlow { ... }` | turn Compose State reads into a Flow |

**`derivedStateOf` example**:
```kotlin
val showFab by remember { derivedStateOf { listState.firstVisibleItemIndex == 0 } }
```
Without `derivedStateOf`, the surrounding composable would recompose on *every* scroll position change. With it, it only recomposes when the boolean flips.

**`rememberUpdatedState` example** (the "stale closure" fix):
```kotlin
@Composable
fun TimerScreen(onFinish: () -> Unit) {
    val currentOnFinish by rememberUpdatedState(onFinish)
    LaunchedEffect(Unit) {
        delay(5000)
        currentOnFinish()    // always the latest
    }
}
```

### 1.6 State hoisting

Push state up to the lowest common parent. Pass `state` and `onEvent` down. Stateless composables are easier to test, preview, and reuse.

```kotlin
@Composable
fun Counter(count: Int, onInc: () -> Unit, modifier: Modifier = Modifier) { ... }   // stateless
@Composable
fun StatefulCounter() {                                                              // stateful wrapper
    var count by remember { mutableStateOf(0) }
    Counter(count, { count++ })
}
```

### 1.7 Modifier — order matters

```kotlin
Modifier.padding(16.dp).background(Color.Red)    // padding around red background
Modifier.background(Color.Red).padding(16.dp)    // red, then padded inside (smaller red area)
```

**Performance**: prefer `.size(...)` over `.fillMaxSize().wrapContentSize(...)`. Use `Modifier.composed { ... }` for state-aware modifiers, but be aware it allocates per composition.

### 1.8 `LazyColumn` / `LazyRow` — the hot path

- Always use `key = { it.id }` on items. Without keys, Compose treats item N at position 5 the same as item M at position 5 → wrong recomposition.
- Use `contentType = { it::class }` for heterogeneous lists — helps view recycling.
- `items(list, key = { it.id }) { item -> ... }`.

```kotlin
LazyColumn {
    items(notes, key = { it.id }, contentType = { "note" }) { note ->
        NoteRow(note)
    }
}
```

**Common bug**: `LazyColumn { items(notes) { ... } }` without a key → scroll position jumps when items change.

### 1.9 `CompositionLocal`

Provides values implicitly down the tree (theme, density, snackbar host).

```kotlin
val LocalAnalytics = compositionLocalOf<Analytics> { error("No analytics provided") }

CompositionLocalProvider(LocalAnalytics provides analytics) { App() }

@Composable
fun SomeScreen() {
    val analytics = LocalAnalytics.current
    LaunchedEffect(Unit) { analytics.screen("Home") }
}
```

Don't overuse — passing via parameters is clearer. Reserve for cross-cutting concerns (theme, formatters).

### 1.10 Performance tools you should mention

- **Layout Inspector** — see recomposition counts, skipped vs recomposed.
- **Compose Compiler Reports** — `-P plugin:androidx.compose.compiler.plugins.kotlin:reportsDestination=...` → reports stability of each composable.
- **Macrobenchmark + Baseline Profiles** — for startup and frame timing.
- **`Modifier.drawWithCache`** — for custom drawing without re-allocating Path/Paint per recomp.

### 1.11 Compose interview gotchas

- **"Why does my composable recompose every time?"** → likely an unstable parameter (a `List`, a lambda capturing `var`, or a non-`@Stable` data class).
- **"Why is my LaunchedEffect not running?"** → key didn't change. Use `key = Unit` for "run once on enter".
- **"Why is my snackbar firing twice?"** → collecting a SharedFlow inside `LaunchedEffect` without keying properly, or restarting the effect on every recomposition.
- **"What's the difference between `Modifier.clickable` and `Modifier.combinedClickable`?"** → combined supports long press, double tap.
- **"How do you do navigation in Compose?"** → Navigation Compose with type-safe routes.

---

## Part 2 — Architecture: MVVM vs MVI vs Clean

### 2.1 The TL;DR you should be able to recite

- **MVVM** = ViewModel exposes state (LiveData/StateFlow), View observes. Events flow from View to ViewModel via methods. Loose coupling between View and Model. Very widely used.
- **MVI** = a special case of MVVM with **strict unidirectional flow**: View sends `Intent` → ViewModel reduces state via a `reducer` → View renders new `State`. Side effects (navigation, snackbar) flow through a separate one-shot channel.
- **Clean Architecture** = a *layering* concern (data / domain / presentation), orthogonal to MVVM/MVI. You can do MVVM-Clean or MVI-Clean.

### 2.2 MVVM in practice

```kotlin
@HiltViewModel
class NotesVm @Inject constructor(private val getNotes: GetNotesUseCase) : ViewModel() {
    private val _notes = MutableStateFlow<List<Note>>(emptyList())
    val notes: StateFlow<List<Note>> = _notes.asStateFlow()

    fun load() = viewModelScope.launch { _notes.value = getNotes() }
    fun delete(id: String) = viewModelScope.launch { /* ... */ }
}
```

View calls `vm.load()` / `vm.delete(id)` directly. Multiple `StateFlow`s for different concerns.

**Pros**: Simple, low ceremony.
**Cons**: State spread across multiple flows; no single source of truth for "the screen state"; harder to test "what happens when the screen is in this exact state."

### 2.3 MVI in practice

```kotlin
sealed interface NotesIntent {
    object Load : NotesIntent
    data class Delete(val id: String) : NotesIntent
    data class TogglePin(val id: String) : NotesIntent
}

data class NotesState(
    val isLoading: Boolean = false,
    val notes: List<Note> = emptyList(),
    val error: String? = null
)

sealed interface NotesEffect {
    data class ShowSnackbar(val msg: String) : NotesEffect
    data class NavigateToDetail(val id: String) : NotesEffect
}

@HiltViewModel
class NotesVm @Inject constructor(private val getNotes: GetNotesUseCase) : ViewModel() {
    private val _state = MutableStateFlow(NotesState())
    val state: StateFlow<NotesState> = _state.asStateFlow()

    private val _effects = MutableSharedFlow<NotesEffect>(replay = 0, extraBufferCapacity = 1)
    val effects: SharedFlow<NotesEffect> = _effects.asSharedFlow()

    fun onIntent(intent: NotesIntent) {
        when (intent) {
            NotesIntent.Load -> load()
            is NotesIntent.Delete -> delete(intent.id)
            is NotesIntent.TogglePin -> togglePin(intent.id)
        }
    }
    private fun load() = viewModelScope.launch {
        _state.update { it.copy(isLoading = true, error = null) }
        runCatching { getNotes() }
            .onSuccess { notes -> _state.update { it.copy(isLoading = false, notes = notes) } }
            .onFailure { e ->
                _state.update { it.copy(isLoading = false, error = e.message) }
                _effects.emit(NotesEffect.ShowSnackbar("Couldn't load notes"))
            }
    }
}
```

**Pros**:
- Single source of truth for screen state.
- Easier to reproduce a screen state in tests / previews.
- Side effects are explicit (effect channel is its own thing).
- Reducer is pure — easy to unit test.

**Cons**:
- Boilerplate.
- For simple screens, MVVM is enough.

### 2.4 When to choose what

- **MVVM**: most screens, especially CRUD screens. Lower friction.
- **MVI**: complex screens with many states, or where you want strong test coverage of state transitions (player screens, multi-step forms, search).

**Don't say "MVI is always better"** — that's a junior take. Say "I default to MVVM, lift to MVI when state interactions get complex enough that 'what's the screen showing right now?' becomes hard to answer."

### 2.5 Clean Architecture — layers

```
presentation/   (Compose, ViewModel, screen state)
   ↓ depends on
domain/         (Use cases, domain models, repository INTERFACES)
   ↑ depends on (data layer implements these interfaces)
data/           (Repository impls, Room, Retrofit, mappers)
```

**The dependency rule**: inner layers know nothing about outer layers. `domain` knows nothing about Android. `data` implements interfaces defined in `domain`.

**Why?** Testability (domain has no Android dependency → JVM unit tests are fast). Swap implementations (mock `data` in tests). Force discipline.

**Pragmatic Clean** for Android (you almost never need full Uncle Bob):
- Single-screen feature → maybe just ViewModel + Repository, skip use cases. Use cases shine when logic is reused across screens or composed.
- Multi-module: `:domain` (pure Kotlin), `:data` (Android), `:feature:notes`, `:app`.

### 2.6 Use Cases — the question seniors love

```kotlin
class GetTrendingVideosUseCase @Inject constructor(
    private val videosRepo: VideosRepository,
    @IoDispatcher private val io: CoroutineDispatcher
) {
    suspend operator fun invoke(category: String): List<Video> = withContext(io) {
        videosRepo.fetchTrending(category).filter { it.isPublished }.take(20)
    }
}
```

**Why use cases?** Composition. If multiple screens need "trending videos", encapsulate the logic. Also: they're a natural unit of unit testing.

**When NOT to use them?** If you have one repo method called from one VM and there's no logic, a use case is just a passthrough. Skip it.

### 2.7 Repository pattern

- Repository = single source of truth for a data type.
- It coordinates between data sources (network, DB, cache).
- Returns domain models, not entities/DTOs.
- Often returns `Flow` so callers observe changes.

```kotlin
interface NotesRepository {
    fun observeAll(): Flow<List<Note>>            // from Room (auto-emits on change)
    suspend fun refresh(): Result<Unit>            // network → DB
    suspend fun add(note: Note)
    suspend fun delete(id: String)
}

class NotesRepositoryImpl @Inject constructor(
    private val dao: NotesDao,
    private val api: NotesApi,
    @IoDispatcher private val io: CoroutineDispatcher
) : NotesRepository {
    override fun observeAll() = dao.observeAll().map { entities -> entities.map { it.toDomain() } }
    override suspend fun refresh(): Result<Unit> = withContext(io) { runCatching {
        val remote = api.fetchNotes()
        dao.replaceAll(remote.map { it.toEntity() })
    } }
    /* ... */
}
```

**Offline-first pattern**: UI observes DB Flow → repository refreshes from network in background → DB updates → UI gets new data via Flow. Single source of truth = DB.

### 2.8 Multi-module — what to know

You did this at Dish ("multi-module shared codebase for TV and Tablet"). Be ready for:
- "Why multi-module?" → build speed (parallel compilation), enforced layer boundaries (a module can only depend on what it declares), explicit API surface.
- "How do you avoid circular deps?" → dependency rule + a `:core` or `:common` module for shared code, or feature modules depending only on `:domain` and `:ui-common`.
- "How do you share UI components?" → a `:ui-design-system` module with theme, common composables.
- **Dynamic feature modules** (Play Feature Delivery) — install on demand. Mostly relevant for very large apps; mention you're aware but didn't use unless you actually did.

---

## Part 3 — Jetpack libraries

### 3.1 ViewModel + StateFlow

- `viewModelScope` cancels on `onCleared`.
- `SavedStateHandle` survives process death (limited to small data — Bundle).
- For navigation route args, prefer `SavedStateHandle` injection (Hilt + Nav auto-wires).

```kotlin
@HiltViewModel
class DetailVm @Inject constructor(
    private val savedState: SavedStateHandle,
    private val getNote: GetNoteUseCase
) : ViewModel() {
    private val noteId: String = checkNotNull(savedState["noteId"])
    val state: StateFlow<NoteDetailState> = flow { emit(getNote(noteId)) }
        .map { NoteDetailState.Success(it) as NoteDetailState }
        .catch { emit(NoteDetailState.Error(it.message ?: "")) }
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), NoteDetailState.Loading)
}
```

**LiveData vs StateFlow**: LiveData is lifecycle-aware (auto-pauses observation off-screen). StateFlow needs `repeatOnLifecycle` (or `collectAsStateWithLifecycle`). New code uses StateFlow.

### 3.2 Room

```kotlin
@Entity(tableName = "notes")
data class NoteEntity(
    @PrimaryKey val id: String,
    val title: String,
    val body: String,
    val createdAt: Long
)

@Dao
interface NotesDao {
    @Query("SELECT * FROM notes ORDER BY createdAt DESC")
    fun observeAll(): Flow<List<NoteEntity>>

    @Query("SELECT * FROM notes WHERE id = :id")
    suspend fun byId(id: String): NoteEntity?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsert(note: NoteEntity)

    @Query("DELETE FROM notes WHERE id = :id")
    suspend fun delete(id: String)

    @Transaction
    suspend fun replaceAll(notes: List<NoteEntity>) {
        deleteAll(); upsert(*notes.toTypedArray())
    }
}

@Database(entities = [NoteEntity::class], version = 1, exportSchema = true)
abstract class AppDb : RoomDatabase() {
    abstract fun notesDao(): NotesDao
}
```

**Senior probes**:
- **Migrations**: `Migration(1, 2) { db -> db.execSQL("ALTER TABLE...") }`. Don't use `fallbackToDestructiveMigration` in prod.
- **TypeConverters** for non-primitive fields: `@TypeConverter fun fromList(list: List<String>): String = list.joinToString(",")`.
- **Relationships**: `@Relation` for one-to-many. `@Embedded` for composing.
- **Transactions**: `@Transaction` ensures atomicity.
- **Flow emissions**: Room observes table changes and emits a new Flow value.

### 3.3 Navigation (Compose)

```kotlin
@Serializable data class NoteDetailRoute(val id: String)

NavHost(navController, startDestination = NotesListRoute) {
    composable<NotesListRoute> { NotesListScreen(...) }
    composable<NoteDetailRoute> { entry ->
        val args = entry.toRoute<NoteDetailRoute>()
        NoteDetailScreen(args.id)
    }
}
```

(Type-safe navigation in Navigation 2.8+.)

**Older API** (still common):
```kotlin
composable("note/{id}", arguments = listOf(navArgument("id") { type = NavType.StringType })) { entry ->
    val id = entry.arguments?.getString("id")!!
    NoteDetailScreen(id)
}
```

**Senior probes**:
- Deep linking: `navDeepLink { uriPattern = "myapp://note/{id}" }`.
- Single-top: `navOptions { launchSingleTop = true }`.
- Pop up to: `popUpTo("home") { inclusive = false }`.
- Nested navigation graphs: feature module owns a sub-graph.

### 3.4 WorkManager

For deferrable, guaranteed background work (sync, upload).

```kotlin
@HiltWorker
class SyncWorker @AssistedInject constructor(
    @Assisted ctx: Context, @Assisted params: WorkerParameters,
    private val repo: NotesRepository
) : CoroutineWorker(ctx, params) {
    override suspend fun doWork(): Result =
        repo.refresh().fold(onSuccess = { Result.success() }, onFailure = { Result.retry() })
}

val request = PeriodicWorkRequestBuilder<SyncWorker>(15, TimeUnit.MINUTES)
    .setConstraints(Constraints.Builder().setRequiredNetworkType(NetworkType.UNMETERED).build())
    .setBackoffCriteria(BackoffPolicy.EXPONENTIAL, 30, TimeUnit.SECONDS)
    .build()

WorkManager.getInstance(ctx).enqueueUniquePeriodicWork(
    "sync", ExistingPeriodicWorkPolicy.KEEP, request
)
```

**Senior probes**:
- **Constraints**: network, charging, battery not low, storage not low.
- **Backoff**: linear vs exponential.
- **Expedited work**: `setExpedited(OutOfQuotaPolicy.RUN_AS_NON_EXPEDITED_WORK_REQUEST)` — runs ASAP, foreground service if needed.
- **Chained work**: `WorkManager.beginWith(downloadWork).then(parseWork).then(saveWork).enqueue()`.
- **WorkManager vs AlarmManager vs JobScheduler**: WorkManager is the modern abstraction. It picks the right backend.

### 3.5 DataStore

Replaces SharedPreferences. Two flavors:

**Preferences DataStore** — key-value, no schema:
```kotlin
val Context.dataStore by preferencesDataStore("settings")
val DARK_MODE = booleanPreferencesKey("dark_mode")

class SettingsRepo @Inject constructor(@ApplicationContext private val ctx: Context) {
    val isDarkMode: Flow<Boolean> = ctx.dataStore.data.map { it[DARK_MODE] ?: false }
    suspend fun setDarkMode(on: Boolean) {
        ctx.dataStore.edit { it[DARK_MODE] = on }
    }
}
```

**Proto DataStore** — typed, schema'd via protobuf. Better for structured data.

**Senior probes**:
- "Why DataStore over SharedPreferences?" → async (no main-thread disk I/O), Flow-based, transactional, type-safe (proto).
- "How do you migrate from SharedPreferences to DataStore?" → `migrations = listOf(SharedPreferencesMigration(ctx, "old_prefs"))`.
- **Don't use DataStore for big data** (multi-MB JSON blobs). Use Room.

### 3.6 Networking — Retrofit + Kotlinx Serialization

```kotlin
@Serializable
data class UserDto(
    val id: String,
    @SerialName("display_name") val displayName: String,
    val avatar: String? = null
)

interface UserApi {
    @GET("users/{id}") suspend fun user(@Path("id") id: String): UserDto
    @GET("users") suspend fun search(@Query("q") query: String): List<UserDto>
}

@Module @InstallIn(SingletonComponent::class)
object NetworkModule {
    @Provides @Singleton
    fun json() = Json { ignoreUnknownKeys = true; coerceInputValues = true }

    @Provides @Singleton
    fun okHttp(authInterceptor: AuthInterceptor): OkHttpClient = OkHttpClient.Builder()
        .addInterceptor(authInterceptor)
        .addInterceptor(HttpLoggingInterceptor().apply {
            level = if (BuildConfig.DEBUG) HttpLoggingInterceptor.Level.BODY else NONE
        })
        .connectTimeout(15, TimeUnit.SECONDS)
        .readTimeout(20, TimeUnit.SECONDS)
        .build()

    @Provides @Singleton
    fun retrofit(client: OkHttpClient, json: Json): Retrofit = Retrofit.Builder()
        .baseUrl("https://api.example.com/")
        .client(client)
        .addConverterFactory(json.asConverterFactory("application/json".toMediaType()))
        .build()

    @Provides @Singleton
    fun userApi(retrofit: Retrofit): UserApi = retrofit.create()
}
```

**Senior probes**:
- "How do you handle auth tokens?" → `Interceptor` adds `Authorization: Bearer ...`. `Authenticator` for refresh on 401.
- "What's an Authenticator vs Interceptor?" → Interceptor runs on every request. Authenticator runs on 401 responses to refresh token, then retries.
- "What about SSL pinning?" → `CertificatePinner.Builder().add("api.example.com", "sha256/...").build()`. Adds resilience to MITM but operational burden (cert rotation).
- "Why Kotlinx Serialization over Moshi/Gson?" → Kotlin-first, multiplatform-ready, no reflection on Android (KSP-generated), faster cold start.

### 3.7 Authentication & secure token storage

- Don't store tokens in `SharedPreferences` or plain DataStore.
- Use `EncryptedSharedPreferences` (Jetpack Security) — keys live in Android Keystore.
- For OAuth refresh tokens, consider `AccountManager` or encrypted DataStore.
- Always handle 401 via `Authenticator` to refresh & retry the original request.

```kotlin
val masterKey = MasterKey.Builder(ctx).setKeyScheme(MasterKey.KeyScheme.AES256_GCM).build()
val prefs = EncryptedSharedPreferences.create(
    ctx, "secure_prefs", masterKey,
    EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
    EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
)
```

---

## Part 4 — Performance & profiling (TR2 will probe this)

### 4.1 Cold start optimization

- **Cold start** = process newly created. **Warm** = process exists, activity recreated. **Hot** = process + activity exist.
- Measure with `adb shell am start -W -n com.example/.MainActivity`.
- Targets: cold start under 500ms ideally; > 1.5s is bad.

**Tactics** (you've done some of this):
1. Defer SDK init (Firebase, Crashlytics, analytics) to post-first-frame using `App Startup` library, or `Dispatchers.Default` from Application.
2. Trim `Application.onCreate`. Move synchronous SDK calls off main.
3. **Baseline Profiles** + R8 — biggest single startup win on cold start.
4. SplashScreen API (Android 12+) — handle properly.
5. Lazy-init dagger/hilt graph nodes.

### 4.2 Frame timing & jank

- 16.6ms budget for 60Hz, 8.3ms for 120Hz.
- **Measure**: Macrobenchmark (`StartupBenchmark`, `JankStats`), Android Studio Profiler.
- **Common jank sources**:
  - Heavy work on main thread (parsing JSON in `onBindViewHolder`).
  - Overdraw — too many layers stacked.
  - Compose: unstable parameters causing too many recompositions.
  - Bitmap loading — use Coil/Glide, not raw `BitmapFactory`.

### 4.3 Memory

- **OOM in production** (you fixed this in EPG): heap dumps via Profiler, LeakCanary in debug builds.
- **Common leaks**: holding `Activity` reference in singletons, anonymous inner classes, registered listeners not unregistered, ExoPlayer not released, Coroutine `GlobalScope.launch` capturing `Activity`.
- **`Bitmap` recycling** (less important now with `BitmapFactory.Options.inSampleSize` and Glide).

### 4.4 APK size

- **R8 / ProGuard** — code shrinking, obfuscation.
- **App Bundles (.aab)** — Play Store delivers per-device APKs.
- **Resource shrinking** — `shrinkResources true`.
- **Image optimization** — WebP, vector drawables.
- **Modularize** — dynamic feature modules for rarely-used features.

### 4.5 Battery

- WorkManager with constraints (don't sync on metered networks unless needed).
- Minimize wake locks.
- Doze and App Standby — design for them.

### 4.6 ANRs

- ANR = Application Not Responding. UI thread blocked > 5s for input, 10s for broadcast.
- Avoid disk/network on main thread.
- StrictMode in debug builds catches violations.

---

## Quick TR2 talking-points cheatsheet

When asked "tell me about your architecture at Dish":
1. Multi-module: feature modules (player, EPG, search, settings) + core (network, db, design-system) + app.
2. MVVM with Clean: `presentation` (Compose + VM) → `domain` (use cases, models, repo interfaces) → `data` (Room, Retrofit, repo impls).
3. Player module: ExoPlayer/Bitmovin wrapped behind a `PlayerController` interface so we can swap.
4. Hilt for DI, scoped per-feature where it makes sense.
5. Coroutines + StateFlow for UI state, SharedFlow for one-shot events.
6. GitLab CI/CD enforced lint + unit tests on every MR.
7. Crashlytics + New Relic + Dynatrace for observability.

This is a 30-second monologue. **Practice saying it.**
