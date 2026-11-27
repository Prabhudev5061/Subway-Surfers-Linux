# Final Implementation Report — `SubwaySurfers-Linux`

**Date:** 2026-11-27  
**Repository:** `/home/prabhudev/Subway Surfer/SubwaySurfers-Linux/`

---

## 1. Original Project Audit
- **San Francisco Baseline:** `/home/prabhudev/Subway Surfer/Subway-Surfers-Linux/` (Git `42266c7`), upstream `SubwaySurfers-x86-64.AppImage` (`140,473,536` bytes, SHA-256 `84a81c0c76abd5e58d31f94e1e9b1a5f823bf482f73db6e2fe63d5a27d37fc35`, Unity `2019.4.18f1`, Subway Surfers `1.94.0`).
- **Beijing Baseline:** `/home/prabhudev/Subway Surfer/SubwaySurfers-Beijing-Linux/` (Git `3a98ad2`, Unity `2019.2.0f1`, `Beijing_2`, Subway Surfers `1.94.0`).
- Detailed inventory recorded in [MIGRATION_AUDIT.md](MIGRATION_AUDIT.md).

## 2. Backup Locations & Verification
- **Phase One Verified Backup:** `/home/prabhudev/Subway Surfer/backups_audit_20261127/` (`715` files, `sha256sum -c --quiet SHA256SUMS.backup` -> `BACKUP_VERIFIED_OK`). Includes full copies of both original projects, upstream `SubwaySurfers-x86-64.AppImage`, live `~/.config/SubwaySurfersSanfrancisco`, live `~/.config/SubwaySurfersBeijing2`, and original logos.
- **Earlier Migration Backup:** `/home/prabhudev/Subway Surfer/backups_unified_migration_20261127_1444/` (`sha256sum -c --quiet SHA256SUMS.backup` -> `ALL_OK`).
- **Pre-Migration Save Backup:** `~/.local/share/SubwaySurfers-Linux/migration/backups/pre_migration_2026-11-27T13-40-27-725Z/` (SHA-256 verified).

## 3. Final Directory Structure
`SubwaySurfers-Linux/` contains:
- `App images/` (2 `.AppImage` files only)
- `Debian installers/` (2 `.deb` files only)
- `Terminal-Bash-Installers/{SanFrancisco,Beijing}/{install.sh,uninstall.sh,required-files/}`
- `Documentation/{README.md,INSTALLATION.md,SHARED-STORAGE.md,AUTOSAVE-AND-RECOVERY.md,TROUBLESHOOTING.md,SECURITY-AND-LEGAL.md,MIGRATION_AUDIT.md,CLEANUP_REPORT.md,FINAL_IMPLEMENTATION_REPORT.md}` + `Documentation/SanFrancisco/*` (5 files) + `Documentation/Beijing/*` (5 files)
- `Source/{Shared,SanFrancisco,Beijing}/`
- `Scripts/{build-all.sh,build-common.sh,build-sanfrancisco.sh,build-beijing.sh,test-all.sh,verify-checksums.sh,clean-old-files.sh}`
- `Tests/{shared-storage,autosave,migration,packaging,integration,fixtures}/`
- `.gitignore`, `.gitattributes`, `LICENSE`, `SHA256SUMS`, `README.md`

## 4. Shared Storage Implementation
- Both `SubwaySurfers-SanFrancisco-Linux` and `SubwaySurfers-Beijing-Linux` route Emscripten `IDBFS.syncfs` through `Source/Shared/host_idbfs_bridge.js` + `Source/Shared/preload_shared.js` -> `Source/Shared/shared_storage.js` directly to `~/.local/share/SubwaySurfers-Linux/Save/`.
- Physical files shared directly: `Save/cloud`, `Save/cloud_old`, `Save/local`, `Save/local_old`, `Save/PlayerPrefs`, `Save/recovery/{cloud,local,PlayerPrefs}.recovery`, and `Save/.storage.lock`.
- Exclusive process lock (`Source/Shared/storage_lock.js`) blocks simultaneous instances (exit code `2`) and recovers stale locks from dead PIDs via `/proc/<pid>/stat`.

## 5. Save Migration Results
- Automatic conflict check tested against live legacy profiles (`~/.config/SubwaySurfersSanfrancisco` and `~/.config/SubwaySurfersBeijing2`): halted cleanly (`CONFLICT_EXIT=3`), wrote `migration_conflict.json`, and preserved both profiles.
- Executed user-selected `--migrate-source=sanfrancisco`: migrated into `~/.local/share/SubwaySurfers-Linux/Save/` and verified via `bson_adapter.py` (`obfuscatedCoins=2423`, `obfuscatedKeys=64`, `highScore=3172149`, `completedRunCount=44`, `currentCharacterId=fresh`, `PlayerPrefs valid=True`).

## 6. Save Compatibility Findings
- Both San Francisco (`2019.4.18f1`) and Beijing (`2019.2.0f1`) run Subway Surfers `1.94.0` with identical BSON schemas: `142` top-level keys in `Save/cloud`, `30` in `Save/local`, `0` missing/extra keys, `0` BSON type mismatches, and identical `UnityPrf` `PlayerPrefs` format.
- Verified live bidirectional loading (SF save in Beijing and Beijing save in SF) with full progression preservation.

## 7. AutoSave Changes
- Unified `Source/Shared/autosave_manager.js` (`4.0.0-unified-shared`) preserves invisible `FS.close` and `FS.rename` interception, 28-byte SHA-1 header validation, `150ms` debounce coalescing, `2500ms` watchdog, `blur`/`visibilitychange`/`beforeunload`/`pagehide` syncs, and graceful exit queue draining (`force-save-before-exit` -> `save-flushed`) with zero `ERR_STREAM_WRITE_AFTER_END`.

## 8. Crash Recovery Implementation
- `Source/Shared/shared_storage.js` cleans stale `.*.tmp.*` files on load, validates `cloud`/`local` 28-byte SHA-1 headers and `PlayerPrefs` `UnityPrf` magic, rejects corrupted backups, and restores the newest valid copy from `*_old` or `Save/recovery/*.recovery`.
- `Source/Shared/storage_lock.js` automatically detects and clears dead-PID stale locks after `SIGKILL`/crash.

## 9. Logo Paths & Hashes
- **San Francisco:** `Source/SanFrancisco/assets/subwaysurfers.png` (`512x512` 8-bit RGBA PNG, `378,940` bytes, SHA-256 `95ea7b903bf206b293c1f2fcfcbcfc40d3e6391c78fbbec4672c360b5fb694c3`).
- **Beijing:** `Source/Beijing/assets/4399.png` (`2048x2048` 16-bit RGB PNG, `11,665,811` bytes, SHA-256 `0129053cb9fd66cc8f5d9a0f5d9686115ee6dacd8c89f94384359f1b521ba890`). Runtime X11 `BrowserWindow` icon resizes `4399.png` in memory to `256x256` via `nativeImage` to prevent X11's `16,777,248`-byte icon request overflow while preserving the unmodified original PNG on disk.

## 10. UI Changes
- Minimal San Francisco-style presentation enforced for both versions: no toolbars, no diagnostics drawers, no debug/status badges, no extra Audio/Fullscreen/Save buttons.
- Fullscreen startup (`fullscreen: true`, `--windowed` supported), `F11` toggle, `Escape` preserved, full-viewport Unity canvas.
- San Francisco `index.html` moved `window.config` to external `config.js` to pass strict CSP without `'unsafe-inline'`.
- Beijing `runtime_bootstrap.js` defers hiding `#loading-overlay` until `Module.postRun` (+250ms) and falls back to `window.innerWidth`/`innerHeight` so no blank `#231F20` frame appears before Unity renders.

## 11. Application Naming Changes
- Standardized everywhere to `SubwaySurfers-SanFrancisco-Linux` (`subwaysurfers-sanfrancisco`) and `SubwaySurfers-Beijing-Linux` (`subwaysurfers-beijing`).
- Eliminated old `SanFranciso` typo and removed `SubwaySurfersSanfrancisco` / `SubwaySurfersBeijing` / `SubwaySurfersBeijing2` as active save destinations.

## 12. Packaging Results
All six primary release artifacts built reproducibly via `./Scripts/build-all.sh` with strict cross-version asset guardrails passing (`[SanFrancisco] Staging guardrail PASS`, `[Beijing] Staging guardrail PASS`).

## 13. Artifact Paths & Exact Sizes
| Artifact | Exact Path | Size (bytes) |
|---|---|---|
| San Francisco AppImage | `App images/SubwaySurfers-SanFrancisco-Linux-x86_64.AppImage` | `140,465,344` |
| Beijing AppImage | `App images/SubwaySurfers-Beijing-Linux-x86_64.AppImage` | `153,031,872` |
| San Francisco `.deb` | `Debian installers/SubwaySurfers-SanFrancisco-Linux-amd64.deb` | `103,871,792` |
| Beijing `.deb` | `Debian installers/SubwaySurfers-Beijing-Linux-amd64.deb` | `162,175,288` |
| San Francisco Bash Installer | `Terminal-Bash-Installers/SanFrancisco/install.sh` (bundle `required-files/`) | `5,617` (script) |
| Beijing Bash Installer | `Terminal-Bash-Installers/Beijing/install.sh` (bundle `required-files/`) | `5,417` (script) |

## 14. SHA-256 Checksums
Verified via `sha256sum -c SHA256SUMS` (16/16 `OK`):
- `1b92b6b3b6928359bd2fba6d39445ff561f77aafe3b8646c18b7b4a5e8304bc1` — `App images/SubwaySurfers-SanFrancisco-Linux-x86_64.AppImage`
- `0f109640935f3f9ddfa937c031e48b798b164d88d6c69d4fcef758aa62e4303f` — `App images/SubwaySurfers-Beijing-Linux-x86_64.AppImage`
- `8edcc3a5f5c7a981654e2d2cc9550714765b07b2878339c97047f52451651036` — `Debian installers/SubwaySurfers-SanFrancisco-Linux-amd64.deb`
- `90edcaa38b8774a6d8446c75b430b5c611bbefc21560a89b1ca109ce384fe6ce` — `Debian installers/SubwaySurfers-Beijing-Linux-amd64.deb`
- `eabe8417ecb7fc470a2f7c43a0ff800f44e6d6c3112b8e0ecf98d3d6867fc26e` — `Terminal-Bash-Installers/SanFrancisco/install.sh`
- `51d2688ba57d3a8e32657f67796bd97b6b5d1dda5c780a2b51e20e79c9a7caae` — `Terminal-Bash-Installers/SanFrancisco/uninstall.sh`
- `ee47dd9802ec81a0738f67fd96e7265fbf392d563e1ffe231506c8815e6b2aad` — `Terminal-Bash-Installers/Beijing/install.sh`
- `e01c609c0ecc50839a4dee01f11b097a9524cbae3b54dd1316a8012abbaeaa32` — `Terminal-Bash-Installers/Beijing/uninstall.sh`

## 15. Complete Test Results (Post-Cleanup Final Run)
Executed `./Scripts/test-all.sh` after removing all old directories:
- `Tests/shared-storage/test_shared_storage.js`: **PASS**
- `Tests/migration/test_migration.js`: **PASS**
- `Tests/autosave/test_autosave_and_recovery.js`: **PASS**
- `Tests/packaging/test_packaging_and_installers.py` (`4` tests in `2.446s`, including isolated copied standalone Bash installers): **PASS**
- `Tests/integration/test_cross_version_and_ui.js` (live AppImages, fullscreen, F11, Escape, minimal UI, `nodeIntegration: false`, external URL blocking, concurrent lock exit `2`, SF <-> Beijing switching, corrupted save recovery, `SIGKILL` stale-lock recovery, zero legacy directories): **PASS**
- `./Scripts/verify-checksums.sh`: **PASS** (`16/16 OK`)

## 16. Cross-Version Switching Results
- Live automated switch (`SF coins=7777, highScore=123456` -> `Beijing` loaded `7777 / 123456` -> `Beijing` flushed `8888 / 654321` -> `SF` loaded `8888 / 654321`) passed.
- Live user save launch (`SubwaySurfers-Beijing-Linux-x86_64.AppImage` against `~/.local/share/SubwaySurfers-Linux/Save/`): rendered Beijing main screen with `Score: 3172149`, `Fresh`, `91` hoverboards, exited cleanly with lock released (`lock exists: false`).

## 17. GPU Test Results
- **Intel Integrated:** `ANGLE (Intel, Mesa Intel(R) Graphics (ADL GT2), OpenGL 4.6)` — WebGL 2.0 (`OpenGL ES 3.0 Chromium`) — **PASS**.
- **NVIDIA Discrete (PRIME Offload):** `NVIDIA GeForce RTX 3050 Laptop GPU`, Driver `595.112.07`, `ANGLE (NVIDIA Corporation, NVIDIA GeForce RTX 3050 Laptop GPU/PCIe/SSE2, OpenGL 4.5.0)` — WebGL 2.0 (`OpenGL ES 3.0 Chromium`) — **PASS**.

## 18. Documentation Inventory
- Root: `README.md`, `LICENSE`, `SHA256SUMS`
- Common: `Documentation/{README.md,INSTALLATION.md,SHARED-STORAGE.md,AUTOSAVE-AND-RECOVERY.md,TROUBLESHOOTING.md,SECURITY-AND-LEGAL.md,MIGRATION_AUDIT.md,CLEANUP_REPORT.md,FINAL_IMPLEMENTATION_REPORT.md}`
- San Francisco: `Documentation/SanFrancisco/{README.md,ARCHITECTURE.md,BUILD.md,TEST-RESULTS.md,RELEASE-NOTES.md}`
- Beijing: `Documentation/Beijing/{README.md,ARCHITECTURE.md,BUILD.md,TEST-RESULTS.md,RELEASE-NOTES.md}`

## 19. Cleanup Report
9 obsolete/redundant directories and files (`Subway-Surfers-Linux`, `SubwaySurfers-Beijing-Linux`, `analysis`, `Beijing-Website-Download`, `investigation_igroutka_beijing2`, `siteone-temp`, `SubwaySurfers-beijing`, `CLEANUP_PLAN.md`, `backups_launch_repair_20261124`) removed safely after verifying `backups_audit_20261127` and `SHA256SUMS`. See [CLEANUP_REPORT.md](CLEANUP_REPORT.md).

## 20. Git Status & Commit Hash
- Branch: `main` (local repository only; **not pushed to GitHub**).
- Implementation Commit: `d7b7198373101912dd094944cbe5c6cbb75f5ed5` (`73` clean tracked files; proprietary `.unityweb`, `.AppImage`, `.deb`, logos, saves, and backups excluded via `.gitignore`).

## 21. Distribution Authorization Status
- MIT-licensed Linux integration code, Electron shell, shared storage manager, scripts, tests, and documentation are free for open-source distribution.
- Proprietary Subway Surfers game assets, `.unityweb` bundles, and logos remain the IP of **SYBO Games ApS / Kiloo Games** and are kept local only (excluded from Git). Upstream SF AppImage foundation credited to Drizzle (`https://www.appimagehub.com/p/2299024`).

## 22. Remaining Limitations
- Proprietary `.unityweb` bundles must be supplied locally to rebuild the 6 packages (`./Scripts/build-all.sh`).
- Simultaneous running of San Francisco and Beijing is intentionally blocked by `.storage.lock` to prevent shared save corruption.
- Legacy system-installed `/usr/share/applications/subwaysurfers.desktop` / `/usr/bin/subwaysurfers` from prior manual `.deb` installation (if installed outside this repo via `sudo dpkg`) requires `sudo` if the user wishes to remove/replace it with `subwaysurfers-sanfrancisco`.
