# Hands-On Mini Projects — Build These in VSCode + Claude Code
**Goal**: Patch decayed muscle memory. Type by hand FIRST, ask AI second.

These are tightly scoped — each should take 60–120 min if you're rusty, less if you're flowing. **The point is the wiring, not the feature.** When you finish, you should be able to set this up from scratch in 30 min on Day 4.

---

## Setup (do once)

```bash
# Open Android Studio (NOT VSCode for the Android project itself; use AS for the IDE,
# and Claude Code in a terminal/VSCode for the AI assist).
# Create new project: Empty Compose Activity, Kotlin, min SDK 24, Hilt enabled (or add manually).
```

Add to `gradle/libs.versions.toml` (or use Version Catalogs). Versions below are illustrative — let your IDE bump to latest stable:

```toml
[versions]
kotlin = "1.9.22"
compose-bom = "2024.02.00"
hilt = "2.50"
hilt-compose = "1.1.0"
room = "2.6.1"
retrofit = "2.9.0"
serialization = "1.6.2"
coroutines = "1.7.3"
lifecycle = "2.7.0"
nav-compose = "2.7.7"
work = "2.9.0"
datastore = "1.0.0"
```

**Self-rule**: For each project, before you ask Claude Code anything, write the Hilt + Compose + ViewModel scaffolding by hand. Compile, run. Then bring AI in for the feature.

---

## Project 1 — Hilt + Coroutines + Retrofit demo (~60 min)

**What you're proving**: You can wire Hilt + Retrofit + a Repository + a Coroutine-based ViewModel from memory.

**Spec**:
- One screen, shows a list of GitHub users.
- Calls `https://api.github.com/users` (no auth).
- Uses Retrofit with Kotlinx Serialization.
- Repository injected into ViewModel via Hilt.
- Loading/Error/Success states modeled as a sealed class.
- IO dispatcher injected via qualifier.

**Acceptance checklist** (do these before opening AI):
- [ ] `@HiltAndroidApp` on Application class
- [ ] `@AndroidEntryPoint` on MainActivity
- [ ] `@HiltViewModel` on ViewModel with `@Inject constructor(repo: UserRepository, @IoDispatcher io: CoroutineDispatcher)`
- [ ] `NetworkModule` with `@Provides` for `Retrofit`, `OkHttpClient`, and the `UserApi` service
- [ ] `RepoModule` with `@Binds` for `UserRepository` ← `UserRepositoryImpl`
- [ ] `DispatcherModule` with `@IoDispatcher` qualifier
- [ ] `Result<List<User>>` or sealed `UserListState` (Loading/Success/Error)
- [ ] Compose UI with `collectAsStateWithLifecycle()`
- [ ] Pull-to-refresh OR a button to retry on error

**Stretch**: Add `@Serializable` data class with custom `@SerialName` overrides. Add an interceptor that logs request/response.

**Anti-cheat**: When you `gradle build`, fix every error by reading it, NOT by pasting it into AI. You'll see the same errors in the interview's pair-coding env.

---

## Project 2 — Flow operators playground (~75 min)

**What you're proving**: You can reason about Flow timing — debounce, distinctUntilChanged, flatMapLatest, combine, stateIn.

**Spec**:
- A search screen.
- Text field → emits `query: String`.
- Backed by an in-memory list of 1000 fake items (generate with a loop).
- "Search" runs on a 50ms artificial delay (simulate network).
- Use `debounce(300)`, `distinctUntilChanged()`, `flatMapLatest`, `stateIn(WhileSubscribed(5000))`.
- Show a separate "isSearching" indicator.
- Combine with a `filter` toggle (e.g., "starred only").

**Acceptance checklist**:
- [ ] `MutableStateFlow<String>` for query
- [ ] `MutableStateFlow<Boolean>` for "starred only"
- [ ] `combine(query, starredOnly) { ... }` in ViewModel
- [ ] `flatMapLatest { search(it) }` cancels in-flight search on new input
- [ ] `onStart { emit(emptyList()) }` and a separate `_isLoading` flow
- [ ] State exposed as `StateFlow<UiState>` via `stateIn`
- [ ] Compose collects with `collectAsStateWithLifecycle()`
- [ ] Type 'kotlin' fast and verify it doesn't hammer the search function 6 times

**Stretch**: Add `BackpressureFlow` test — what happens with `buffer()` vs `conflate()` vs `collectLatest`.

---

## Project 3 — MVI Compose counter with side effects (~60 min)

**What you're proving**: You actually understand MVI. Specifically: intents, state reducer, side-effect channel, no leaky state.

**Spec**:
- Three screens: Counter, History, About.
- Counter: increment/decrement/reset buttons, shows current count.
- "Increment to 10" → fires a snackbar side effect when count hits 10 ("Achievement!").
- History: shows last 50 actions taken.
- Navigation between via Navigation Compose.

**Architecture**:
```kotlin
sealed interface CounterIntent {
    object Increment : CounterIntent
    object Decrement : CounterIntent
    object Reset : CounterIntent
}

data class CounterState(val count: Int = 0, val history: List<String> = emptyList())

sealed interface CounterEffect {
    data class ShowSnackbar(val msg: String) : CounterEffect
}

@HiltViewModel
class CounterVm @Inject constructor() : ViewModel() {
    private val _state = MutableStateFlow(CounterState())
    val state: StateFlow<CounterState> = _state.asStateFlow()

    private val _effects = MutableSharedFlow<CounterEffect>(replay = 0, extraBufferCapacity = 1)
    val effects: SharedFlow<CounterEffect> = _effects.asSharedFlow()

    fun onIntent(intent: CounterIntent) {
        when (intent) {
            CounterIntent.Increment -> reduce { copy(count = count + 1, history = history + "+1") }
            CounterIntent.Decrement -> reduce { copy(count = count - 1, history = history + "-1") }
            CounterIntent.Reset -> reduce { copy(count = 0, history = history + "reset") }
        }
        if (_state.value.count == 10) {
            viewModelScope.launch { _effects.emit(CounterEffect.ShowSnackbar("Achievement!")) }
        }
    }

    private inline fun reduce(block: CounterState.() -> CounterState) {
        _state.update(block)
    }
}
```

**Acceptance checklist**:
- [ ] State, Intent, Effect are 3 separate types
- [ ] State flows through `StateFlow`, effects through `SharedFlow(0, 1)`
- [ ] UI calls `vm.onIntent(...)` only — never mutates state directly
- [ ] In the screen, `LaunchedEffect(Unit)` collects effects and shows snackbar
- [ ] Configuration change (rotate device) preserves count
- [ ] Process death (kill from terminal, reopen) — count is lost (this is expected for in-memory state). Stretch: persist with `SavedStateHandle`.

**Stretch**: Add a `SavedStateHandle` to persist count across process death.

---

## Project 4 — Offline-first notes app (~120 min)

**What you're proving**: The end-to-end senior-level Android stack. Compose + MVI + Hilt + Room + DataStore + Coroutines + Flows + Navigation.

**Spec**:
- List screen + Detail screen.
- Add/edit/delete notes (title, body, createdAt).
- Persist to Room.
- Settings: "dark mode" stored in DataStore.
- "Last opened note id" stored in DataStore Proto/Preferences.
- Loading/empty/error/success states.

**Architecture**:
```
data/
  local/
    NotesDao
    NotesDatabase
    SettingsDataStore
  remote/  (skip for this project — pure local)
  repository/
    NotesRepository (interface)
    NotesRepositoryImpl
domain/
  model/Note
  usecase/
    GetNotesUseCase
    AddNoteUseCase
    DeleteNoteUseCase
presentation/
  list/
    NotesListVm
    NotesListScreen
  detail/
    NoteDetailVm
    NoteDetailScreen
di/
  DatabaseModule
  RepositoryModule
  DispatcherModule
```

**Acceptance checklist**:
- [ ] Room DAO returns `Flow<List<Note>>` (auto-emits on change)
- [ ] Repository wraps DAO, exposes domain model (not entity)
- [ ] Use cases use `operator fun invoke(...)`
- [ ] ViewModel exposes `StateFlow<NotesListState>`
- [ ] `Modifier.testTag("note_${note.id}")` on each item (for UI test prep)
- [ ] Navigate detail with `note/{id}` route, type-safe args via `SavedStateHandle`
- [ ] Theme reads `isDarkMode` from DataStore via `collectAsStateWithLifecycle`
- [ ] One simple unit test: `NotesListVm` with fake repo, verify state transitions

**Common gotchas while building**:
- KSP setup for Room AND Hilt (use KSP, not kapt — kapt is deprecated for new code).
- Room migrations: don't write any (delete app between versions during dev).
- Compose preview broken? `@Preview` functions can't take `@HiltViewModel` directly — use parameter-injected fakes for previews.

---

## Project 5 (optional, Day 3) — Mini Player wrapper

**What you're proving**: You can articulate the player architecture cleanly when asked in TR3/TR4 ("walk me through how you built the player").

**Spec**:
- Single screen with ExoPlayer (Media3) playing an HLS stream (use any test HLS URL like `https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8`).
- Wrap ExoPlayer in a `PlayerController` interface with methods: `play()`, `pause()`, `seekTo(ms)`, `release()`.
- Inject via Hilt.
- Compose UI with `AndroidView { PlayerView(it).apply { player = ... } }`.
- `DisposableEffect` to release player on screen exit.
- Track playback state via a `Player.Listener`, expose as `StateFlow<PlaybackState>`.
- One feature: "save position on background, resume on foreground". Use `LifecycleEventObserver`.

**Acceptance checklist**:
- [ ] `ExoPlayer` released in `onDispose`
- [ ] `Player.Listener` mapped to `MutableStateFlow<PlaybackState>` via `callbackFlow`
- [ ] No memory leak on screen rotation (verify in Profiler if you can)
- [ ] Logs show "saving position 12500ms" when backgrounded

**Why this matters**: This is your moat in the interview. If you can't articulate this clean architecture, the inflated player line on your resume becomes a liability.

---

## Daily AI rule

- **Day 1, all projects**: AI off until you've compiled at least once with your own code.
- **Day 2**: AI for design questions ("which is more idiomatic, A or B?"), still type by hand.
- **Day 3**: AI for verification ("review this code, what would a senior critique?"). Read the critique carefully — that's the interviewer's voice.

If you find yourself reflexively pasting an error into Claude, **stop, breathe, read the error**. Compiler errors in Kotlin are usually self-explanatory. Practice debugging without the safety net.

---

## Final muscle-memory drill (do Day 4 morning, 30 min, no AI)

Open a fresh Android Studio project. Without looking at anything, set up:
1. Hilt
2. A `@HiltViewModel` with a `Repository` injected
3. The repo calls a Retrofit service with `kotlinx.serialization`
4. Compose screen with `collectAsStateWithLifecycle`
5. Loading/Error/Success states
6. Run on emulator

If you can do all 6 in 30 minutes from a blank project, **you're ready for TR1.**

If you can't, do it again. This is the single highest-leverage exercise this week.
