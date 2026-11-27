# AutoSave & Crash Recovery Architecture

## 1. Invisible Integrated AutoSave Lifecycle

AutoSave operates completely in the background with **no visible save buttons, badges, toolbars, or popups**.

1. **Filesystem Hooking (`4399.js` + `Source/Shared/autosave_manager.js`):**
   - Intercepts Emscripten `FS.close` and `FS.rename` operations targeting `PlayerPrefs`, `Save/cloud`, `Save/cloud_old`, `Save/local`, `Save/local_old`, and `Save/cloud_new` / `Save/local_new`.
   - Verifies the 28-byte Kiloo BsonFileSaver header (`[uint32 hashLen=20][20-byte SHA-1][uint32 payloadLen][BSON]`) synchronously in JS using `Source/Shared/sha1_header.js`.
   - Updates MEMFS node timestamps (`touchNode`) so reconciliation always sees newly committed saves.
2. **Debounce & Single-Flight Queue (`scheduleSync` / `processSync`):**
   - Rapid sequential writes within `150ms` coalesce into a single commit.
   - If a commit is already in flight (`isSyncing === true`), new requests set `pendingSync = true` and drain immediately upon completion.
   - Transient commit errors retry up to 3 times with linear backoff (`250ms`, `500ms`, `750ms`).
3. **Lifecycle & Shutdown Flushing:**
   - `window.blur`, `document.visibilitychange` (`hidden`), `beforeunload`, `pagehide`, and a `2500ms` dirty watchdog trigger `forceSyncNow()`.
   - On window close or `SIGTERM` / `SIGINT`, `Source/Shared/electron_shell.js` intercepts `close`, sends `force-save-before-exit`, waits for `AutoSaveManager.forceFlushAndExit()` to drain pending queues and emit `save-flushed` (bounded by a `2500ms` safety timeout), destroys the window, releases `.storage.lock`, stops the local HTTP server, and closes `runtime.log` safely without `ERR_STREAM_WRITE_AFTER_END`.

---

## 2. Crash Recovery & Validation

Crash recovery operates at **two layers**:

1. **Host Startup Recovery (`Source/Shared/shared_storage.js`):**
   - Cleans up any interrupted `.*.tmp.*` files left behind by a crash or power loss.
   - Validates `Save/cloud`, `Save/local`, and `Save/PlayerPrefs`.
   - If `Save/cloud` or `Save/local` is missing or fails 28-byte SHA-1 validation, it evaluates `*_old` and `Save/recovery/*.recovery` by newest valid modification time.
   - **Corrupted backups are rejected:** Any backup that fails SHA-1 (`cloud`/`local`) or `UnityPrf` (`PlayerPrefs`) validation is ignored and logged in `rejectedBackups`.
   - Quarantines any corrupt primary file to `Save/recovery/<name>.corrupt.<ts>` and atomically restores the newest valid backup before Unity boots.
2. **Stale Lock Recovery (`Source/Shared/storage_lock.js`):**
   - If a previous session crashed (`SIGKILL`), `.storage.lock` remains on disk.
   - On next launch, `acquireStorageLock` checks `process.kill(pid, 0)` and `/proc/<pid>/stat` process `starttime` ticks. If the previous PID is dead or recycled, the stale lock is safely removed and re-acquired.

---

## 3. Known Limitations

- If both primary and all backup copies (`*_old` and `recovery/*.recovery`) are externally deleted or corrupted simultaneously, recovery cannot fabricate progress and Unity starts a fresh save.
- `Save/cloud` timestamps/session fields updated by Unity itself on boot cause normal SHA-1 rotation on clean launches even without gameplay runs.
