# TR3/TR4 — System Design + Security + Performance + Video Player + Past Projects
**Rounds**: TR3 (Hiring Manager — HLD, approach, collaboration) + TR4 (Bar Raiser — past projects, design, culture).
**Goal**: Run a 60-min HLD round confidently. Defend past project decisions. Articulate the player architecture cleanly (your moat).

---

## Part 1 — How to run any system design / LLD round

### 1.1 The 6-step framework (memorize this)

1. **Clarify scope** — "When you say 'design X', do you mean Y or Z? What scale? What platforms? Read-heavy or write-heavy?"
2. **List requirements** — functional (features) + non-functional (latency, offline, scale).
3. **Define API / data model** — what are the inputs/outputs, what does the data look like.
4. **Sketch the architecture** — boxes and arrows. Layers. Modules.
5. **Deep dive** — pick the part the interviewer cares about, go deep on tradeoffs.
6. **Iterate** — "what would you change if X?" / "how would this fail?" / "how do you scale?"

**Never** start drawing boxes in step 1. Spend the first 5–8 minutes on step 1–2. Senior interviewers grade you here heavily.

### 1.2 Mobile-specific dimensions to clarify

- **Online / offline-first?** Offline-first changes everything (Room as source of truth, Sync engine, conflict resolution).
- **Real-time?** WebSocket / SSE / FCM push.
- **Multi-device sync?** User logs in on phone + tablet — what's authoritative?
- **API design (paginated)?** Cursor vs page-number.
- **Caching strategy?** Cache-aside, read-through, write-through, write-behind.
- **Auth?** OAuth (PKCE for mobile), token refresh, session expiry handling.
- **Background work?** WorkManager, foreground service, push.

---

## Part 2 — LLD playbook (interview-favorite problems)

### 2.1 Design an Image Loader (Glide / Coil clone)

**Clarify**:
- Memory cache + disk cache?
- Cancel on view recycle? (yes — must)
- Transformations (round, blur)?
- Placeholder + error?
- Priority (visible items first)?

**Architecture sketch**:
```
ImageRequest (url, target, transformations, placeholder)
    ↓
RequestQueue (dedupe, prioritize)
    ↓
Memory cache (LruCache<Key, Bitmap>) ── hit → bind to target
    ↓ miss
Disk cache (LRU on disk) ── hit → decode + bind
    ↓ miss
Network (OkHttp) → decode → store both caches → bind
```

**Key decisions**:
- **Cache key**: `url + size + transformations` (different sizes ≠ different cache entries).
- **LruCache size**: `(Runtime.getRuntime().maxMemory() / 1024 / 8).toInt()` (1/8 of heap in KB).
- **Disk cache**: OkHttp's HTTP cache + LRU file cache for decoded bitmaps.
- **Cancellation**: track requests by target; on view recycle, cancel pending.
- **Threading**: dispatch decoding on `Dispatchers.Default`, disk on `Dispatchers.IO`, bind on `Dispatchers.Main`.
- **Bitmap pooling**: reuse `Bitmap` objects to reduce GC pressure (Glide does this).

**API**:
```kotlin
class ImageLoader(
    private val memoryCache: LruCache<String, Bitmap>,
    private val diskCache: DiskLruCache,
    private val client: OkHttpClient
) {
    suspend fun load(url: String, target: ImageView, opts: Options) { ... }
    fun cancel(target: ImageView) { ... }
}
```

### 2.2 Design an offline-first sync engine

**Use case**: Notes app. User creates/edits/deletes offline; syncs when online.

**Strategy**:
- Local DB (Room) is the source of truth for the UI.
- Each entity has `id` (UUID generated on device), `serverId`, `status` (PENDING_CREATE / SYNCED / PENDING_UPDATE / PENDING_DELETE), `updatedAt`, `version`.
- A `SyncWorker` (WorkManager, periodic + on-network-back) walks pending entries:
  - PENDING_CREATE → POST → on success, store serverId, set SYNCED.
  - PENDING_UPDATE → PATCH with version → 409 conflict → conflict resolution.
  - PENDING_DELETE → DELETE → on success, hard-delete locally.
- Conflict resolution: last-write-wins (simple) or user-prompt (complex) or three-way merge (Notion/Figma-level).
- Pull updates: server returns "since" delta on a `lastSyncedAt` timestamp.

**Senior probes**:
- "What if user creates the same note on two devices?" → server-generated IDs, dedup by content hash, or conflict surface to user.
- "How do you avoid syncing the same item forever on permanent failure?" → max-retry, dead-letter queue, alert.

### 2.3 Design a cached chat client

**Requirements**: send/receive messages, persist, work offline (queue sends).

**Pieces**:
- WebSocket for real-time receive.
- Send: write to local DB with `status = PENDING`, then enqueue WorkManager job to send. On ack, update to SENT/DELIVERED. Handle ID mapping (client-generated UUID → server ID).
- Receive: WS handler writes to DB → UI via Room Flow.
- Reconnection: exponential backoff, "last delivered message id" → server returns missed messages on reconnect.
- Pagination: keyset pagination on `messageId DESC`.

### 2.4 Design a photo upload pipeline

**Requirements**: pick photo, upload, show progress, handle network changes.

- Compose: photo picker → ViewModel emits Uri.
- WorkManager (foreground service) for upload.
- Resumable upload: chunked PUT (Tus, S3 multipart). Persist chunk progress.
- Progress: WorkManager `setProgress(workDataOf("pct" to 50))`.
- Network change: WorkManager constraint `NetworkType.UNMETERED` if user toggles wifi-only.

### 2.5 Design a feature flag system

- Keys + values.
- Local cache (DataStore) — read synchronously at app start.
- Remote (Firebase Remote Config / launchdarkly).
- Refresh policy: fetch on app start + every 12h.
- Override system for QA (developer settings screen).
- Type-safe accessors:

```kotlin
object Flags {
    val NewPlayerUI = BooleanFlag("new_player_ui", default = false)
    val MaxRetries = IntFlag("max_retries", default = 3)
}
class FlagService @Inject constructor(...) {
    fun <T> get(flag: Flag<T>): T = ...
}
```

---

## Part 3 — HLD playbook (mobile-flavored)

### 3.1 Design a video streaming app like Tubi (THE ONE for FOX)

**Spend time on this. This is your interview.**

**Clarify**:
- Free vs subscription? (Tubi = free, ad-supported)
- VOD only, or live? (Tubi = mostly VOD)
- Targets: phone, tablet, TV, web?
- Offline downloads?
- Personalization?
- Scale: millions of users, hundreds of thousands concurrent.

**Functional reqs**:
- Browse content (rows of categories).
- Watch with ads (SSAI).
- Sign in (optional / social).
- Continue watching.
- Search.
- Personalized rows.
- Captions, audio tracks.

**Non-functional**:
- Cold start under 1.5s.
- Time-to-first-frame on play under 2s.
- Smooth 60fps scrolling on row UI.
- Offline-friendly metadata browsing.
- 99.9% playback success rate.

**Architecture (high level)**:
```
[Android App]
  Modules:
    :app
    :feature-home (rows, browse)
    :feature-player (player, ads)
    :feature-search
    :feature-profile
    :core-ui (design system)
    :core-network (Retrofit, auth)
    :core-data (Room, DataStore)
    :core-player (ExoPlayer wrapper)
    :core-ads (SSAI client, beacon)
    :core-analytics

[Backend (HLD diagram)]
  CDN (CloudFront / Akamai) ── serves HLS/DASH manifests + segments
  API Gateway ── auth, rate limit
  Catalog service ── content metadata
  Recommendation service ── personalized rows
  Ads service ── SSAI ad insertion
  Analytics ingestion ── Kafka → S3 → Athena
  User service ── profiles, watch history
```

**Deep dives the interviewer might want**:

#### A. Player architecture (you'll be asked)

```
PlayerScreen (Compose)
  ↓ events (play/pause/seek)
PlayerViewModel (StateFlow<PlaybackState>)
  ↓ controls
PlayerController (interface)
  ↓ implements
ExoPlayerController
  ↓ uses
ExoPlayer (Media3)
  ↓ talks to
MediaSourceFactory ── DASH/HLS source
DefaultDrmSessionManager ── Widevine DRM
DefaultLoadControl ── buffering policy
DefaultTrackSelector ── ABR (chooses bitrates based on bandwidth)
AdsLoader (IMA) ── pre/mid/post-roll for CSAI; for SSAI, the ads are baked into stream
```

**Key choices**:
- Why a `PlayerController` interface? Decouples UI from player vendor (we used Bitmovin originally, swapped to ExoPlayer for X module).
- Why Media3 over plain ExoPlayer? Unified API, MediaSession integration, lifecycle awareness, future-proof (ExoPlayer is being merged into Media3).
- DRM: Widevine for premium content, key request flow goes through your license server.
- ABR: TrackSelector picks bitrate based on bandwidth + buffer health. You can set `setMaxVideoBitrate(...)` for data-saver mode.
- Offline: `DownloadManager` + `OfflineLicenseHelper` for DRM offline keys.
- Ad insertion: SSAI (server-side) means ads are stitched into the stream (a single playlist, no re-buffer at ad break). Beacons fire on ad markers.

#### B. Continue Watching

- Persist progress every N seconds while playing → POST `/progress` (or queue for later).
- On home screen: `GET /continue-watching` returns rows with progress bars.
- Cross-device: server-side state (user account).
- Conflict: a session ID per playback to dedupe parallel devices.

#### C. Recommendations / personalized rows

- Server returns a `home_layout` blob (SDUI — like DivKit you used at Dish).
- Each row is a "module" with type + items + tracking metadata.
- Client renders generically — no hard-coded screen layouts.
- This lets product change the home screen without an app release.

#### D. Search

- Query → debounce 300ms → server.
- Local search history (DataStore).
- Server returns ranked results + facets.
- Mobile gotchas: keyboard input + IME action, multi-result type rows.

#### E. Auth

- OAuth with PKCE (mobile-first).
- Refresh token rotation.
- Tokens in EncryptedSharedPreferences.
- 401 → Authenticator refreshes → retries.

#### F. Analytics

- Event-based (`screen_view`, `play_start`, `play_complete`, `ad_impression`).
- Batched and uploaded periodically.
- Backed by your own engine (you built one!) → Kafka → S3 → Athena.
- Real-time alerts for crash spikes.

### 3.2 Design Twitter/Instagram feed

**Mobile angle**:
- Cursor pagination.
- Image prefetching (next 3 items).
- Cache: LRU for recent ~500 posts.
- Optimistic updates for likes.
- Pull-to-refresh: re-fetch from cursor=null, prepend.
- Read receipts: only count when item is on screen for >2s + >50% visible.

### 3.3 Design push notification system

**Mobile**:
- FCM token registration on app start; send to backend.
- Token rotation: handle `FirebaseMessagingService.onNewToken`.
- Notification channels (Android 8+): import / category / sound per channel.
- Backstack: deep link from notification → handle correct activity / fragment with `taskStackBuilder`.
- Silent push for data sync — `priority: "high"` for delivery.
- Privacy: redact sensitive content if user is on lockscreen.

---

## Part 4 — Security (this is in the JD)

### 4.1 Network

- **HTTPS only** — `cleartextTrafficPermitted=false` in network security config.
- **Cert pinning** — `CertificatePinner` on OkHttp.
- **Network Security Config XML** — declarative pinning + cleartext rules.

### 4.2 Storage

- **EncryptedSharedPreferences** — token storage.
- **EncryptedFile** — for files.
- **Room with SQLCipher** — full DB encryption (third-party).
- **Don't store secrets in code** — use BuildConfig fields populated from `local.properties`, or a secrets management plugin.

### 4.3 Auth (OAuth 2.0 PKCE)

- PKCE (Proof Key for Code Exchange) is the mobile-safe flavor.
- Flow:
  1. App generates `code_verifier` (random) + `code_challenge` (SHA256 of verifier).
  2. Open Chrome Custom Tab → auth URL with `code_challenge`.
  3. User logs in → callback with `code`.
  4. App POSTs `code` + `code_verifier` → access + refresh token.
- Why PKCE? Mobile apps can't keep client secrets safe; PKCE replaces the secret with a per-flow nonce.
- Refresh token rotation: each refresh issues a new refresh token; old one revoked.

### 4.4 Code/binary protection

- **R8** — code shrinking + obfuscation. Most-minimal protection but raises the bar.
- **Tamper detection** — verify install source, signature; SafetyNet/Play Integrity API.
- **Root detection** — RootBeer or your own checks. Decide per-feature whether to block.
- **Anti-debugging** — limited utility on Android, but you can detect debugger attached.

### 4.5 OWASP Mobile Top 10 (high level)

You don't need to recite all 10, but be aware of: insecure storage, weak server-side controls, insecure communication, weak authentication, code quality (input validation, deeplink validation), reverse engineering.

### 4.6 Common security questions

- "How do you handle a token leak?" → token revocation server-side + force re-auth via short-lived access tokens (~15 min) + long-lived refresh.
- "How do you secure deep links?" → don't trust URL params; verify session, validate IDs against current user, check intent source.
- "What about WebView?" → don't expose JS interface methods (`@JavascriptInterface`) unless absolutely needed; use `setAllowFileAccess(false)`.

---

## Part 5 — Video Player frameworks (your moat — own this)

### 5.1 ExoPlayer / Media3 fundamentals

ExoPlayer = open-source, customizable media player. Media3 = the new umbrella, unifying ExoPlayer + MediaSession + Cast + UI.

**Core types**:
- `Player` — the API surface (`play`, `pause`, `seekTo`, `addListener`).
- `MediaSource` — where media comes from. `ProgressiveMediaSource`, `HlsMediaSource`, `DashMediaSource`, `SsMediaSource`.
- `TrackSelector` — chooses video/audio/text track. `DefaultTrackSelector` does ABR.
- `LoadControl` — buffering policy. Min/max buffer ms, buffer-for-playback ms.
- `Renderer` — converts samples to output. Video, audio, text, metadata.
- `AdsLoader` — ad insertion (CSAI: IMA SDK; SSAI: ads in the stream itself).
- `Player.Listener` — playback state, errors, position changes.

### 5.2 HLS vs DASH

| | HLS | DASH |
|---|---|---|
| Standard | Apple | MPEG |
| Manifest | `.m3u8` (text) | `.mpd` (XML) |
| Segments | `.ts` (legacy) or `.mp4` (CMAF) | `.mp4` |
| DRM | FairPlay (Apple), Widevine | Widevine, PlayReady |
| iOS support | Native | None |
| Use case | Cross-platform, Apple ecosystem | Android, web (MSE) |

Modern setup: **HLS with CMAF (.mp4) + Widevine** — works everywhere except iOS-FairPlay-only.

### 5.3 Adaptive bitrate (ABR)

- Player measures bandwidth (bytes/sec on segment download).
- Picks a bitrate from the manifest's variants.
- Switches up if buffer > threshold + bandwidth allows.
- Switches down if buffer drains faster than refill.

ExoPlayer's `DefaultTrackSelector.Parameters`:
```kotlin
trackSelector.parameters = trackSelector.buildUponParameters()
    .setMaxVideoBitrate(2_500_000)
    .setForceHighestSupportedBitrate(false)
    .build()
```

### 5.4 DRM (Widevine)

- L1 = hardware-backed (most secure, allows HD/4K). L2 = mixed. L3 = software-only (HD often blocked).
- Flow: player requests license from license server with a key request. Server returns license. Player decrypts.
- Offline: `OfflineLicenseHelper` to download license tied to the local download.
- Provisioning: device gets a per-device cert from Widevine ProvisioningServer on first use.

### 5.5 Ad insertion: CSAI vs SSAI

- **CSAI (Client-Side)**: client fetches ad URL (VAST/VMAP), pauses content, plays ad, resumes. IMA SDK does this on Android.
- **SSAI (Server-Side)**: ads are stitched into the master stream. Client plays a single continuous stream. Beacons fire at known timestamps.

**SSAI pros**: no ad blockers, cleaner UX (no buffering at ad break).
**SSAI cons**: harder to personalize per-user without per-user manifests; harder to track impressions accurately.

**Beacon tracking** (you did this!): the player fires HTTP beacons at ad start, quartiles (25/50/75%), complete. These go to ad partners (FreeWheel, Google) for billing/measurement.

### 5.6 PiP, MediaSession, background playback

- **PiP**: `enterPictureInPictureMode(...)`. Activity must declare `supportsPictureInPicture=true`.
- **MediaSession** (Media3): exposes playback to system (lock screen, notification, Bluetooth). Single source of truth for playback state.
- **Foreground service** for background audio.

### 5.7 Performance / quality metrics for player

- Time-to-first-frame (TTFF).
- Rebuffer ratio (rebuffer time / total play time).
- Bitrate changes per minute.
- Errors (DRM, network, decoder).
- Conviva/Bitmovin Analytics handle this.

### 5.8 Common player interview probes

- "Why ExoPlayer over MediaPlayer?" → MediaPlayer is OS-tied (limited customization, no ABR, no DRM beyond OS support, hard to debug). ExoPlayer is open, configurable, and consistent across OS versions.
- "How do you handle a 4G→Wifi network change mid-playback?" → ExoPlayer recovers automatically; you may force a re-init of the data source if needed.
- "How do you A/B test player builds?" → behind a feature flag swap the `PlayerController` impl.
- "How do you measure playback quality?" → Conviva or Bitmovin Analytics + custom events.

---

## Part 6 — TR4 (Bar Raiser) — past projects & culture fit

### 6.1 What they're testing

- **Ownership**: did you drive this end-to-end or just code what was asked?
- **Judgment**: how do you decide tradeoffs?
- **Influence**: how do you change a team's direction?
- **Bar**: are you "raising the bar" — better than the median current engineer?

### 6.2 Have these stories ready (full versions in `05_STAR_STORIES.md`)

1. **Owned a P0 production incident** (you have these — analytics or player crash).
2. **Made a hard architectural decision** (multi-module migration, EPG rebuild).
3. **Mentored someone** (interns/juniors).
4. **Disagreed with a senior or PM** (and how you resolved it).
5. **Failed and learned** (everyone has one — own it).
6. **Improved a process / tool** (CI/CD pipeline, lint rules).

### 6.3 Common bar-raiser questions

- "Tell me about a time you disagreed with your manager."
- "What's the toughest technical problem you've solved?"
- "How do you stay current with Android?"
- "What would you do in your first 30 days?"
- "Why are you leaving Dish?"
- "Why FOX?"

### 6.4 Cultural questions — FOX-specific angles

- FOX is DTC streaming → user experience matters at scale.
- Tubi (FOX subsidiary) is a free streamer growing rapidly.
- They want engineers who *care* about reliability + UX (not just "ship").
- Your story to tell: "I obsess over crashes — at Dish I drove crash rate from X to Y by..."

---

## Part 7 — Closing thoughts on TR3/TR4

These rounds reward:
- **Calm, structured thinking** over fast answers.
- **Concrete numbers** ("reduced cold start from 2.4s to 1.1s on low-end TV") over vague claims.
- **Awareness of tradeoffs** — every choice has a cost.
- **Honesty** about what you didn't know — say "I haven't done X but here's how I'd approach it."

When in doubt: ask a clarifying question, then think out loud. Senior interviewers grade your reasoning, not your output.
