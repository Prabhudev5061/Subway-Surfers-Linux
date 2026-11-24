# SUBWAY SURFERS LINUX — SAVE PERSISTENCE FAILURE ROOT CAUSE REPORT

**Date:** November 24, 2026  
**Application:** Subway Surfers — World Tour: San Francisco 1.94.0 (Linux Desktop Distribution)  
**Target Architecture:** x86_64 / amd64  
**Engine & Platform:** Unity 2019.4.18f1 (IL2CPP / WebAssembly) hosted inside Electron 36.5.0 (Chromium 134.0.6998.35 / Node.js 22.14.0)  
**Storage Architecture:** Emscripten MEMFS -> IDBFS -> Chromium IndexedDB -> LevelDB  

---

## 1. Executive Summary

Despite previous automated test reports claiming 41/41 passing unit tests, real-world user testing revealed a critical defect: **progress made during gameplay (coins collected, high scores achieved, keys acquired, and shop unlocks) failed to persist after closing and reopening the game.**

A rigorous investigation incorporating dynamic memory introspection, LevelDB transaction analysis, and Chrome DevTools Protocol tracing uncovered five interlocking root causes spanning the Unity WebGL runtime, Emscripten virtual filesystem, IDBFS reconciliation engine, and Electron shutdown coordination.

All five root causes have been isolated, repaired, and confirmed resolved through a verified two-session automated live restart test with binary-level disk LevelDB verification.

---

## 2. Technical Architecture of Save Persistence

Subway Surfers for WebGL does not use standard Unity `PlayerPrefs` for primary game progression. Progress persistence relies on Kiloo/SYBO's custom `BsonFileSaver` serialization engine:

1. **Progress Files:**
   - Primary Save: `/idbfs/9ca1650cb5772c831cf4ccc5f0517c30/Save/cloud` (11,635 bytes)
   - Local Backup: `/idbfs/9ca1650cb5772c831cf4ccc5f0517c30/Save/local` (11,209 bytes)
   - `PlayerPrefs` file contains only 218 bytes storing minor operational flags (`CloudSaveLastUsedKilooTag`).
2. **Wire Format (28-byte Integrity Header):**
   - Offset 0–3 (4 bytes): `uint32` Hash Length (always `20`)
   - Offset 4–23 (20 bytes): Raw binary SHA-1 digest of the payload
   - Offset 24–27 (4 bytes): `uint32` Little-Endian Payload Length
   - Offset 28+ (N bytes): BSON binary document containing 142 gameplay state fields (`obfuscatedCoins`, `obfuscatedKeys`, `unlockedCharacters`, `upgrades`, `highScore`, etc.).

---

## 3. Root Cause Analysis

### Root Cause 1: Atomic File Rename Bypassed `FS.close` Interception

**Mechanism:**  
Kiloo's C# `FileUtil.Save` implementation performs atomic updates to prevent file corruption during sudden terminations:
1. Writes updated data to temporary file `Save/local_new` (or `Save/cloud_new`).
2. Calls POSIX `close(fd)` on `local_new`.
3. Calls POSIX `rename("Save/local", "Save/local_old")`.
4. Calls POSIX `rename("Save/local_new", "Save/local")`.
5. Calls POSIX `unlink("Save/local_old")`.

**The Defect:**  
The legacy `autosave_manager.js` only hooked Emscripten's `FS.closeStream` (`FS.close`). When `FS.close` fired on `local_new`, `AutoSaveManager` captured `local_new` and scheduled a debounced sync. However:
- `FS.rename` does **NOT** call `FS.close`.
- By the time `FS.syncfs` executed, `local_new` was already moved to `local` or deleted.
- The actual target file (`Save/local` and `Save/cloud`) never triggered `onFileClosed` because it was never opened or closed under that name; it became the active save strictly via `FS.rename`!

---

### Root Cause 2: MEMFS Rename Did Not Update Node Timestamps for IDBFS Reconciliation

**Mechanism:**  
In Emscripten's `IDBFS.reconcile(src, dst)`:
```javascript
Object.keys(src.entries).forEach(function(key) {
    var e = src.entries[key];
    var e2 = dst.entries[key];
    if (!e2 || e.timestamp > e2.timestamp) {
        create.push(key);
        total++;
    }
});
```
When flushing MEMFS (`src`) to IndexedDB (`dst`):
- `e.timestamp` is derived from `FS.stat(path).mtime`, which equals `new Date(node.timestamp)`.
- `e2.timestamp` is the timestamp retrieved from IndexedDB's `timestamp` index.
- In `4399.js` line 3661 (`MEMFS.node_ops.rename`):
```javascript
rename: function(old_node, new_dir, new_name) {
    delete old_node.parent.contents[old_node.name];
    old_node.name = new_name;
    new_dir.contents[new_name] = old_node;
    old_node.parent = new_dir;
}
```
**The Defect:**  
`MEMFS.node_ops.rename` re-links the node in the parent directory but **never updates `old_node.timestamp`**!
Because `node.timestamp` preserved the creation time from when `_new` was created (or matched the existing entry), the reconciliation check `e.timestamp > e2.timestamp` evaluated to `false`. IDBFS determined that the file had not changed, adding 0 items to `create`, and skipped writing to IndexedDB completely!

---

### Root Cause 3: Premature Window Destruction on Close in Electron `main.js`

**Mechanism:**  
In the previous `main.js`:
```javascript
win.on('close', (e) => {
    if (isQuitting) return;
    if (savePending) {
        e.preventDefault();
        isQuitting = true;
        ...
    }
});
```
**The Defect:**  
`savePending` was only `true` when a background debounce timer or active sync was explicitly reported in flight.
When a user finishes a run, looks at their score, and clicks the window close button (`X`):
1. `savePending` was `false` (idle state).
2. The `win.on('close')` event was **NOT** prevented (`e.preventDefault()` was never called).
3. Unity's WebGL runtime triggered `beforeunload` / `OnApplicationQuit` in the renderer, which wrote final gameplay statistics to MEMFS and initiated an asynchronous `FS.syncfs` call to IndexedDB.
4. Concurrently, the Electron main process destroyed the browser window immediately without waiting.
5. The renderer process was killed mid-transaction, discarding all uncommitted IndexedDB write transactions before they reached LevelDB on disk.

---

### Root Cause 4: `onMountComplete` Save Migration Ignored `Save/cloud` and `Save/local`

**Mechanism:**  
Unity computes its WebGL `Application.persistentDataPath` by generating an MD5 hash of the page origin/URL:
- Loading `file:///tmp/SubwaySurfers/index.html` resolves to hash: `9ca1650cb5772c831cf4ccc5f0517c30`.
- Loading from an alternate path or symlink generates a different 32-character hex hash.

**The Defect:**  
In `autosave_manager.js`, `onMountComplete` included backward-compatibility migration logic that only checked:
```javascript
var legacySaveFile = legacyDir + '/PlayerPrefs';
```
It completely ignored `/Save/cloud` and `/Save/local`! If a user ran the application where the origin hash shifted (e.g. standard AppRun vs `.deb` launch vs direct binary launch), `PlayerPrefs` (the 218-byte empty file) was copied, but the entire 11.6KB progress save was dropped. The game saw no save file and reset all coins, characters, and high scores to 0.

---

### Root Cause 5: Conflicting Uncoordinated Sync Calls in `4399.js`

**Mechanism:**  
`4399.js` contained an internal `fs.sync` controller:
```javascript
var fs = {
    numPendingSync: 0,
    syncInProgress: false,
    sync: function(onlyPendingSync) {
        if (onlyPendingSync) { if (fs.numPendingSync == 0) return; }
        else if (fs.syncInProgress) { fs.numPendingSync++; return; }
        fs.syncInProgress = true;
        FS.syncfs(false, function(err) { fs.syncInProgress = false; });
        fs.numPendingSync = 0;
    }
};
```
**The Defect:**  
1. When Unity called `_JS_FileSystem_Sync()`, `fs.sync` ran independently of `AutoSaveManager`.
2. When `fs.syncInProgress` was `true`, any incoming sync request incremented `fs.numPendingSync` and returned immediately.
3. The callback never drained `numPendingSync`; it relied on a 1-second interval (`syncInternal: 1e3`). If the application was closed before the 1-second timer fired, the save was dropped.
4. When both `fs.sync` and `AutoSaveManager` triggered `FS.syncfs` concurrently (`warning: 2 FS.syncfs operations in flight at once`), IndexedDB transactions conflicted, leading to dropped writes.

---

## 4. Implemented Fixes & Verification

| Defect | Patch Location | Fix Description |
|---|---|---|
| Atomic Rename Blind Spot | `4399.js` (line 5169) & `autosave_manager.js` | Added `FS.rename` interception hook to catch `local_new -> local` and `cloud_new -> cloud` commits. |
| IDBFS Timestamp Stagnation | `4399.js` & `autosave_manager.js` | Added `touchNode()` and `touchAllSaveNodes()` to explicitly bump `node.timestamp = Date.now() + 1000` on every write and rename. |
| Premature Window Close | `resources/app/main.js` | `win.on('close')` **always** calls `e.preventDefault()`, sends `force-save-before-exit` to renderer, and only closes once renderer sends `save-flushed`. |
| Cross-Hash Save Migration | `autosave_manager.js` | Replaced legacy single-file check with `ensureMirroredSaves()`, automatically mirroring `Save/cloud`, `Save/local`, and `PlayerPrefs` across all mounted `/idbfs/` hash folders. |
| Sync Collision & Dropped Calls | `4399.js` (line 2115) | Unified `fs.sync` in `4399.js` to delegate directly to `AutoSaveManager.scheduleSync()`. |

---

## 5. Verification & Test Evidence

The fixes were validated via automated test `test_live_save_persistence.js` (TC-06):
1. **Session 1:** App booted with clean profile; coins set to `987654`, keys set to `4321`.
2. **Commit:** Atomic rename triggered; clean shutdown intercepted; LevelDB log on disk verified.
3. **Session 2:** App restarted with the same profile from a fresh process; IDBFS mounted and loaded `987654` coins and `4321` keys from disk with 100% fidelity.
4. **All Suites:** 6/6 test suites (42 test cases) passed in 9.65s.
