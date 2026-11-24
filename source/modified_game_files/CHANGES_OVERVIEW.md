# OVERVIEW OF SOURCE FILE MODIFICATIONS

This directory details all modifications made to the upstream Subway Surfers Linux application to implement the reliable automatic save system and Linux compatibility improvements.

---

## Modified Files Summary

### 1. `resources/app/main.js`
- **Window Close Interception:** Hooks `win.on('close')`, prevents immediate window destruction (`e.preventDefault()`), sends `force-save-before-exit` to renderer process, and awaits `save-flushed` reply before terminating.
- **Safety Timeout:** Implements 2500ms safety watchdog timer to guarantee application exits cleanly even if renderer hangs.
- **IPC Save Status Channel:** Listens to `autosave-status` for queue drained events and debug logging.
- **Symlink Management:** Automatically inspects and clears dangling `/tmp/SubwaySurfers` symlinks to preserve consistent MD5 URL hashing across runs.

### 2. `resources/app/preload.js`
- **Context Bridge Exposure:** Safely exposes `window.electronAPI` to the renderer with `onForceSave`, `notifySaveFlushed`, and `notifyAutoSaveStatus` channels under `contextIsolation: false`.

### 3. `html/autosave_manager.js` (New Component)
- **Lifecycle Interception:** Intercepts `FS.rename`, `FS.close`, and `FS.syncfs`.
- **Atomic Commit Detection:** Detects Unity's pattern of writing to temporary files (`cloud_new`, `local_new`) and atomically renaming them to active targets (`cloud`, `local`).
- **Timestamp Correction:** Ensures file modification times in virtual MEMFS are updated forward so IDBFS correctly classifies them as modified against IndexedDB.
- **SHA-1 Header Validation:** Recalculates SHA-1 digests over 4-byte-prefixed BSON payloads to guarantee save file integrity.
- **Recursion Guard:** Utilizes `isInternalOperation` flag to prevent infinite loops during cross-hash save mirroring.

### 4. `html/4399.js`
- **Idempotent Virtual FS Init:** Uses `safeMkdir` checking `FS.analyzePath(p).exists` before calling `FS.mkdir`.
- **Kiloo FileUtil Directories:** Pre-creates `/file:`, `/file:/tmp`, and `/file:/tmp/SubwaySurfers` to eliminate `System.IO.IOException` during OnlineSettings saves.
- **Module Hooks:** Exports `window.FS` and invokes `AutoSaveManager.onMountComplete` when IDBFS is mounted.

### 5. `html/index.html`
- **Script Orchestration:** Inserts `<script src="autosave_manager.js"></script>` after Poki SDK and before `UnityLoader.2019.2.js`.

### 6. `AppRun`
- **AppArmor Compatibility:** Detects kernel unprivileged user namespace restrictions and automatically applies `--no-sandbox`.
- **Runtime Symlink Fallback:** Establishes symlinks from `/tmp/SubwaySurfers` or `${XDG_RUNTIME_DIR}` to ensure stable directory origins.
