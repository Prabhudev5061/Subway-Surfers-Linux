# Final Implementation Report — `SubwaySurfers-Linux 1.0`

**Date:** 2026-11-28  
**Linux Collection Version:** `1.0` (`1.0.0` in package metadata; underlying Subway Surfers WebGL builds remain `1.94.0`)  
**Repository:** `/home/prabhudev/Subway Surfer/SubwaySurfers-Linux/`

---

## 1. Original Project & Source Audit
- **San Francisco:** Upstream `SubwaySurfers-x86-64.AppImage` (`140,473,536` bytes, SHA-256 `84a81c0c76abd5e58d31f94e1e9b1a5f823bf482f73db6e2fe63d5a27d37fc35`, Unity `2019.4.18f1`, Subway Surfers `1.94.0`). Upstream AppImage packaging credited to Drizzle (`https://www.appimagehub.com/p/2299024`).
- **Beijing:** `Beijing_2` (`1.94.0`, Unity `2019.2.0f1`).
- **Zurich:** Discovered at `/home/prabhudev/Subway Surfer/Zurich/files/m.igroutka.ru/ni3/171/SubwaySurfers/` (`ZurichNewPrivacy`, `productVersion: 1.94.0`, Unity `2019.4.18f1`, `TOTAL_MEMORY: 369098752`, `graphicsAPI: ["WebGL 2.0", "WebGL 1.0"]`).
- Detailed inventory recorded in [MIGRATION_AUDIT.md](MIGRATION_AUDIT.md) and [Zurich/ARCHITECTURE.md](Zurich/ARCHITECTURE.md).

## 2. Backup Locations & Verification
- **Phase One Verified Backup:** `/home/prabhudev/Subway Surfer/backups_audit_20261127/` (`715` files, `sha256sum -c --quiet SHA256SUMS.backup` -> `BACKUP_VERIFIED_OK`).
- **Earlier Migration Backup:** `/home/prabhudev/Subway Surfer/backups_unified_migration_20261127_1444/` (`sha256sum -c --quiet SHA256SUMS.backup` -> `ALL_OK`).
- **Zurich Phase 0 Backup:** `/home/prabhudev/Subway Surfer/backups_zurich_phase0_20261127_220012/` (`320` files, `sha256sum -c --quiet SHA256SUMS.backup` -> `OK`) containing pre-edit `SubwaySurfers-Linux/`, `Zurich/`, `~/.local/share/SubwaySurfers-Linux/`, and Git status/log snapshots.
- **Pre-Migration Save Backup:** `~/.local/share/SubwaySurfers-Linux/migration/backups/pre_migration_2026-11-27T13-40-27-725Z/` (SHA-256 verified).

## 3. WASD Controls Integration (v1.0)
- **Centralized Remapper (`Source/Shared/controls_wasd.js`):** Exports `window.SubwayControls` (`SubwaySurfers-Linux` WASD controller) and exposes `/shared/controls_wasd.js` via `allowedSharedFiles` in `Source/Shared/electron_shell.js` (`Source/{SanFrancisco,Beijing,Zurich}/web/index.html` load it before Unity glue).
- **Emscripten Boundary Hook (`Source/{SanFrancisco,Beijing,Zurich}/web/4399.js`):** All three `1.94.0` builds use identical `JSEvents.registerKeyEventCallback` and `JSEvents.removeAllEventListeners` internals. Each build's `4399.js` routes `keydown`, `keypress`, and `keyup` callbacks through `window.SubwayControls.processKeyEvent(...)` and registers keyup dispatchers for focus-loss cleanup (calling `rawEv.preventDefault()` on the original DOM event).
- **Control Behavior:**
  - `W` / `KeyW` -> Left/Right-agnostic `ArrowUp` (`38`, Jump)
  - `A` / `KeyA` -> `ArrowLeft` (`37`, Move Left)
  - `S` / `KeyS` -> `ArrowDown` (`40`, Roll)
  - `D` / `KeyD` -> `ArrowRight` (`39`, Move Right)
  - Physical Arrow keys (`37..40`) are suppressed as primary movement controls (`keydown`/`keypress`/`keyup`).
  - `keypress` events for movement keys are suppressed so letter key presses do not double-trigger.
  - Held repeats work cleanly; `window.blur`, `document.visibilitychange` (`hidden`), and `window.pagehide` synthesize `keyup` for every held WASD key so keys never stick after focus loss.
  - Unrelated controls remain intact: `Space` (hoverboard / start), `Escape` (pause / resume), `F11` (fullscreen toggle), mouse/touch/gamepad inputs, `Ctrl`/`Alt`/`Meta` shortcuts, and editable inputs (`INPUT`, `TEXTAREA`, `SELECT`, `isContentEditable`).

## 4. Beijing Ad Removal & Zurich Integration
- **Beijing:** Updated `Source/Beijing/web/runtime/poki-sdk-cleanroom.js` to offline `adblock` mode (`window.pokiAdBlock = true`, `window.pokiReady = false`, `SendMessage(gameObjectName, 'adblock')`, hiding/detaching ad containers) and removed `loaders/v3/` Poki wrapper files. Main-menu `[▶ -> ?]` promo button, post-run `Free Double Up!` banner, and `commercialBreak()` triggers are eliminated while preserving coins, keys, Shop boosts, Word Hunt, missions, and character selection.
- **Zurich:** Integrated `ZurichNewPrivacy` into `Source/Zurich/` with external `config.js`, strict CSP, offline `poki-sdk-cleanroom.js`, `unity_2019_4_compat.js`, `runtime_bootstrap.js`, `#loading-overlay`, `HostIDBFS`, `AutoSaveManager`, original Zurich logo preservation, and removal of `igroutka.ru` wrapper elements (`#more_g`, `#game_lock`, `script.js`, `logo-mini.png`).

## 5. Final Directory Structure
`SubwaySurfers-Linux/` contains:
- `DISCLAIMER.md`, `README.md`, `LICENSE`, `SHA256SUMS`
- `App images/` (3 v1.0 `.AppImage` files only)
- `Debian installers/` (3 v1.0 `.deb` files only)
- `Terminal-Bash-Installers/{SanFrancisco,Beijing,Zurich}/{install.sh,uninstall.sh,required-files/}`
- `Documentation/{README.md,ARCHITECTURE.md,SAVE_COMPATIBILITY.md,BUILD_AND_INSTALL.md,SECURITY.md,TEST_RESULTS.md,RELEASE_NOTES.md,INSTALLATION.md,SHARED-STORAGE.md,AUTOSAVE-AND-RECOVERY.md,TROUBLESHOOTING.md,SECURITY-AND-LEGAL.md,MIGRATION_AUDIT.md,CLEANUP_REPORT.md,FINAL_IMPLEMENTATION_REPORT.md}` + `Documentation/{SanFrancisco,Beijing,Zurich}/*`
- `Source/{Shared,SanFrancisco,Beijing,Zurich}/`
- `Scripts/{build-all.sh,build-common.sh,build-sanfrancisco.sh,build-beijing.sh,build-zurich.sh,test-all.sh,verify-checksums.sh,clean-old-files.sh}`
- `Tests/{shared-storage,autosave,migration,controls,packaging,integration,fixtures}/`

## 6. Shared Storage, Compatibility, Locking & Recovery
- All three versions (`SanFrancisco` `:47322`, `Beijing` `:47321`, `Zurich` `:47323`) route `IDBFS.syncfs` through `Source/Shared/host_idbfs_bridge.js` -> `Source/Shared/preload_shared.js` -> `Source/Shared/shared_storage.js` directly to `~/.local/share/SubwaySurfers-Linux/Save/`.
- **Empirical 3-Version Save Compatibility:** Inspected via `Source/Shared/bson_adapter.py`:
  - `Save/cloud`: **142 top-level keys** in all three versions (`0` missing/extra keys, `0` BSON type mismatches).
  - `Save/local`: **30 top-level keys** in all three versions (`0` missing/extra keys, `0` BSON type mismatches).
  - `PlayerPrefs`: Identical `UnityPrf` binary container (`353` bytes on active user profile).
- **Exclusive Lock (`Source/Shared/storage_lock.js`):** Single `.storage.lock` blocks all pairwise concurrent launches among San Francisco, Beijing, and Zurich with exit code `2` and recovers dead-PID stale locks after `SIGKILL`.
- **Migration (`Source/Shared/migration.js`):** Detects legacy `SubwaySurfersSanfrancisco`, `SubwaySurfersBeijing2`/`SubwaySurfersBeijing`, and `SubwaySurfersZurich` profiles, halts on multi-profile conflicts (`exit=3`) with SHA-256 backups preserved.

## 7. Logo Paths & Hashes
- **San Francisco:** `Source/SanFrancisco/assets/subwaysurfers.png` (`512x512` RGBA PNG, `378,940` B, SHA-256 `95ea7b903bf206b293c1f2fcfcbcfc40d3e6391c78fbbec4672c360b5fb694c3`).
- **Beijing:** `Source/Beijing/assets/4399.png` (`2048x2048` 16-bit RGB PNG, `11,665,811` B, SHA-256 `0129053cb9fd66cc8f5d9a0f5d9686115ee6dacd8c89f94384359f1b521ba890`; X11 window icon resized in memory to `256x256`).
- **Zurich:** Original `Source/Zurich/assets/b3f5e1472e1bfbee1804c7e854546a08.png` (`40x40` WebP, `1,054` B, SHA-256 `2ce9ec76c8503a9fbdb459d457ec1f140c97a443eae99f0cb12bc9ac0c15759a`) preserved unmodified; `Source/Zurich/assets/subwaysurfers-zurich.png` (`256x256` RGBA PNG decoded from original, `91,301` B, SHA-256 `145baf5e11c4d42c8c9f920679db4d9ee7c0de92a202882c7d94008b77c1ce23`) used for X11/AppImage/`.deb` desktop icons.

## 8. v1.0 (`1.0.0`) Release Artifacts, Sizes & SHA-256 Checksums
Verified via `sha256sum -c SHA256SUMS` (`24/24 OK`):

| Artifact | Exact Path | Size (bytes) | SHA-256 |
|---|---|---|---|
| San Francisco AppImage | `App images/SubwaySurfers-SanFrancisco-Linux-x86_64.AppImage` | `140,465,344` | `b243da62391939f12c3a6ccd6dd1468a36787d7043fd767e670ba90a8d1e6e98` |
| Beijing AppImage | `App images/SubwaySurfers-Beijing-Linux-x86_64.AppImage` | `153,023,680` | `36b475ab3b39bb0e493a18115adc1c1128dc5eb352a9c5d639031ba5d3278369` |
| Zurich AppImage | `App images/SubwaySurfers-Zurich-Linux-x86_64.AppImage` | `140,993,728` | `42fe1bdb4ef305bf7b5cc7a14d6ec5acd3606eb1948e18ba73abf9927de20b47` |
| San Francisco `.deb` | `Debian installers/SubwaySurfers-SanFrancisco-Linux-amd64.deb` | `103,879,448` | `9f694e9d384e1ec8779e9796fec44b1545c7a6eb05f792b115e255157045b64a` |
| Beijing `.deb` | `Debian installers/SubwaySurfers-Beijing-Linux-amd64.deb` | `162,168,796` | `52dac8fabacf690132d326998ddaaf56e566a22cf7dcd5c50bb97314eba9df8a` |
| Zurich `.deb` | `Debian installers/SubwaySurfers-Zurich-Linux-amd64.deb` | `103,743,312` | `376caa1b0b86801f06547b2aca3a96694499395920ebaea7597b242426f9166c` |
| San Francisco Bash Installer | `Terminal-Bash-Installers/SanFrancisco/install.sh` (plus `required-files/`) | — | `ccfa5462550e2cb8a641cc6a5f06901f297b9e9ae5a8a51761998c93fea9a111` |
| Beijing Bash Installer | `Terminal-Bash-Installers/Beijing/install.sh` (plus `required-files/`) | — | `ed39cdc5912c2a44044e0b73bb486822956b009409c5cf6971501dde15659d3` |
| Zurich Bash Installer | `Terminal-Bash-Installers/Zurich/install.sh` (plus `required-files/`) | — | `cd6884752fea949c91084f2d8346f6484a5011584b917123e846be7bdf696c9e` |

## 9. Complete Test & GPU Results
Executed `./Scripts/test-all.sh`:
- `Tests/shared-storage/test_shared_storage.js`: **PASS** (canonical path, traversal protection, atomic write & recovery, 3-version locking, BSON unknown-field round-trip).
- `Tests/migration/test_migration.js`: **PASS** (SF, Beijing, Zurich single migrations + 3-way conflict halt & explicit resolution).
- `Tests/autosave/test_autosave_and_recovery.js`: **PASS** (coalescing, retries, `forceFlushAndExit`).
- `Tests/controls/test_wasd_controls.js`: **PASS** (`W/A/S/D` remapping, held repeats, `keypress` suppression, arrow suppression, `Space`/`Escape`/`F11`/modifier/text-input preservation, `blur`/`visibilitychange` held-key release).
- `Tests/packaging/test_packaging_and_installers.py` (`4/4` tests in `3.657s`): **PASS** (`Version: 1.0.0` metadata in `.deb`s, 9 build artifacts, 24 checksums, logos, `.deb` isolation, copied standalone Bash installers install/uninstall preserving shared saves).
- `Tests/integration/test_cross_version_and_ui.js`: **PASS** (live WASD controls across SF, Beijing, Zurich; all 6 directed cross-version transitions `SF->BJ->SF->ZR->SF->BJ->ZR->BJ`; pairwise lock exit `2`; Beijing ad-removal `pokiAdBlock=true`; minimal UI; fullscreen/F11/Escape; `nodeIntegration: false`; outbound blocking; corrupted `Save/cloud` + `Save/local` recovery; `SIGKILL` stale-lock recovery; zero legacy directories).
- `./Scripts/verify-checksums.sh`: **PASS** (`24/24 OK`).
- **Hardware GPU Verification (All 3 v1.0 AppImages):**
  - **Intel Integrated:** `WebGL 2.0 (OpenGL ES 3.0 Chromium)` — `ANGLE (Intel, Mesa Intel(R) Graphics (ADL GT2), OpenGL 4.6)` — **PASS** (SF, Beijing, Zurich).
  - **NVIDIA PRIME Offload:** `WebGL 2.0 (OpenGL ES 3.0 Chromium)` — `ANGLE (NVIDIA Corporation, NVIDIA GeForce RTX 3050 Laptop GPU/PCIe/SSE2, OpenGL 4.5.0)` — **PASS** (SF, Beijing, Zurich).

## 10. Git, Legal, Provenance Audit & Remaining Limitations
- **Provenance & Redistribution Audit (`DISCLAIMER.md`):**
  - Proprietary game binaries, textures, audio, `.unityweb` bundles, original logos, `.AppImage`, and `.deb` packages contain third-party intellectual property owned by **SYBO Games ApS / Kiloo Games** and are strictly excluded from Git via `.gitignore`.
  - This repository (`MIT` licensed for our original Linux wrapper, shared-storage, WASD controls, test, and build scripts in `Source/Shared/`, `Scripts/`, `Tests/`, `Documentation/`) does **not** hold or claim redistribution permission from SYBO Games ApS or Kiloo Games; attribution to Drizzle (`https://www.appimagehub.com/p/2299024`) is preserved strictly as upstream AppImage provenance, not as a copyright license.
- **Local Git Only:** Not pushed to GitHub (`git remote -v` empty), no remote release published.
- **Known Limitations / Non-Automated Steps:**
  - System-wide root `sudo dpkg -i` was not executed against the host APT database during unattended tests; `.deb` package metadata (`Version: 1.0.0`), directory layout, and cross-version non-collision were inspected via `dpkg-deb --info` and `dpkg-deb --contents`, and `--user` Bash install/uninstall plus live AppImage runs were verified directly.
  - Simultaneous execution of any two versions is intentionally blocked by `.storage.lock` to protect shared save integrity.
