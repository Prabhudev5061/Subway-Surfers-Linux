# CHANGELOG — Subway Surfers Linux (AutoSave Edition)

All notable changes to the Subway Surfers Linux distribution are documented in this file.

---

## [1.94.0-autosave3-final] — 2026-11-24

### Fixed
- **AppImage Launch Failure (Exit Code 127):** Rebuilt `app.squashfs` with `gzip` compression and 131072 block size, resolving an incompatibility with the AppImage Type 2 runtime decompressor (`libsquashfuse`), which only supported `xz` and `zlib`. Direct AppImage execution and `--appimage-extract` now work seamlessly across all Linux distributions.
- **Dangling Symlink Handling (`main.js`):** Hardened `/tmp/SubwaySurfers` symlink management in `main.js` by actively inspecting `lstatSync` and unlinking stale/dangling mount links before creating fresh symlinks. Prevents origin URL drift and ensures consistent IDBFS origin hashing (`9ca1650cb5772c831cf4ccc5f0517c30`).
- **Idempotent Virtual FS Initialization (`4399.js`):** Implemented `safeMkdir` helper checking `FS.analyzePath(p).exists` before creating MEMFS directories, resolving a monolithic try/catch failure and eliminating the `[FileUtil] Error saving file: file:///tmp/SubwaySurfers/onlinesettings` warning.

### Added
- **Diagnostic Reports:** Documented complete investigation and verification in `diagnostics/APPIMAGE_LAUNCH_FAILURE.md` and `diagnostics/APPIMAGE_LAUNCH_FIX.md`.
- **Automated Build Scripts:** Added `source/build_scripts/build_appimage.sh` and `build_deb.sh` for 100% reproducible packaging.
- **Consolidated Clean Project Architecture:** Reorganized all assets, documentation, tests, and source into `Subway-Surfers-Linux/`.
- **Safety Quarantine System:** Implemented staged cleanup protocol using `CLEANUP_PLAN.md` and `cleanup_quarantine/`.
- **Complete Licensing & Legal Attribution:** Added `LICENSE_AND_ATTRIBUTION.md` formally crediting original AppImage creator **Drizzle** (`https://www.appimagehub.com/p/2299024`) and intellectual property owner **SYBO Games**.

---

## [1.94.0-autosave2-fixed] — 2026-11-24

### Fixed (Critical Persistence Pipeline Repair)
- **Atomic File Rename Commits:** Added filesystem hooks to `FS.rename` in `4399.js` and `autosave_manager.js` to intercept C# `FileUtil.Save` atomic commits (`local_new -> local`, `cloud_new -> cloud`).
- **IDBFS Timestamp Stagnation:** Updated `touchNode()` and `touchAllSaveNodes()` to bump node timestamps (`node.timestamp = Date.now() + 1000`) on save operations, ensuring Emscripten's IDBFS `reconcile()` (`e.timestamp > e2.timestamp`) reliably flushes MEMFS nodes to Chromium IndexedDB.
- **Premature Window Close on Shutdown:** Replaced conditional `savePending` close interceptor in `main.js` with an unconditional shutdown handler that dispatches `force-save-before-exit` to the renderer and waits for `save-flushed` confirmation before closing.
- **Cross-Hash Save Mirroring:** Added `ensureMirroredSaves()` to mirror `Save/cloud`, `Save/local`, and `PlayerPrefs` across all mounted `/idbfs/` URL hash folders, ensuring saves load regardless of URL path variations.
- **Conflicting Sync Synchronization:** Unified `fs.sync` in `4399.js` to delegate to `AutoSaveManager.scheduleSync()`, eliminating dropped pending syncs and concurrency conflicts.
- **Infinite Internal Save Loop:** Added `isInternalOperation` protection flag to prevent internal mirror copies from triggering recursive save events.

### Added
- **Live End-to-End Persistence Test (TC-06):** Automated two-session test verifying that progress written in one session commits to raw LevelDB on disk and reloads in a fresh session with 100% fidelity.
- **CDP Debugging Integration:** Exposed `window.FS` and clean DevTools support for dynamic introspection.
- **CREDITS.md:** Dedicated attribution crediting original Linux AppImage creator **Drizzle** (`https://www.appimagehub.com/p/2299024`) and rights holder SYBO.

---

## [1.94.0-autosave1] — 2026-11-24

### Fixed
- **Startup Black Screen Crash:** Patched `FS.closeStream` in `4399.js` to check `!FS.isDir(node.mode)` before attempting file close operations.
- **Octal Literal Syntax Error:** Converted legacy `0040000` to `0x4000` for ECMAScript strict mode compatibility.
- **Offline Poki SDK Error:** Patched `dt()` in `poki-sdk-core.js` to return `[2, "US"]` without network geolocation fetches.
- **Missing Screenshots:** Populated `1.jpg`..`4.jpg` from existing small screenshots.
- **AppArmor Compatibility:** Added automatic `--no-sandbox` fallback in `AppRun` when unprivileged user namespace creation is restricted.

### Added
- **AutoSaveManager 1.0.0:** Real-time event-driven persistence with 150ms debounce and SHA-1 header integrity validation.
- **Debian Package:** Generated `subwaysurfers-autosave` native `.deb` package for Ubuntu/Debian distributions.
- **Universal Installer:** Interactive `install.sh` and `uninstall.sh` supporting both user-space AppImage and system `.deb` installations.
