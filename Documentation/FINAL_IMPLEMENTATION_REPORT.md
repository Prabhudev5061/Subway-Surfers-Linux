# Final Implementation Report — `SubwaySurfers-Linux` (3-Version Unified Collection)

**Date:** 2026-11-27  
**Repository:** `/home/prabhudev/Subway Surfer/SubwaySurfers-Linux/`

---

## 1. Original Project & Source Audit
- **San Francisco:** Upstream `SubwaySurfers-x86-64.AppImage` (`140,473,536` bytes, SHA-256 `84a81c0c76abd5e58d31f94e1e9b1a5f823bf482f73db6e2fe63d5a27d37fc35`, Unity `2019.4.18f1`, Subway Surfers `1.94.0`).
- **Beijing:** `Beijing_2` (`1.94.0`, Unity `2019.2.0f1`).
- **Zurich:** Discovered at `/home/prabhudev/Subway Surfer/Zurich/files/m.igroutka.ru/ni3/171/SubwaySurfers/` (`ZurichNewPrivacy`, `productVersion: 1.94.0`, Unity `2019.4.18f1`, `TOTAL_MEMORY: 369098752`, `graphicsAPI: ["WebGL 2.0", "WebGL 1.0"]`).
- Detailed inventory recorded in [MIGRATION_AUDIT.md](MIGRATION_AUDIT.md) and [Zurich/ARCHITECTURE.md](Zurich/ARCHITECTURE.md).

## 2. Backup Locations & Verification
- **Phase One Verified Backup:** `/home/prabhudev/Subway Surfer/backups_audit_20261127/` (`715` files, `sha256sum -c --quiet SHA256SUMS.backup` -> `BACKUP_VERIFIED_OK`).
- **Earlier Migration Backup:** `/home/prabhudev/Subway Surfer/backups_unified_migration_20261127_1444/` (`sha256sum -c --quiet SHA256SUMS.backup` -> `ALL_OK`).
- **Zurich Phase 0 Backup:** `/home/prabhudev/Subway Surfer/backups_zurich_phase0_20261127_220012/` (`320` files, `sha256sum -c --quiet SHA256SUMS.backup` -> `OK`) containing pre-edit `SubwaySurfers-Linux/`, `Zurich/`, `~/.local/share/SubwaySurfers-Linux/`, and Git status/log snapshots.
- **Pre-Migration Save Backup:** `~/.local/share/SubwaySurfers-Linux/migration/backups/pre_migration_2026-11-27T13-40-27-725Z/` (SHA-256 verified).

## 3. Beijing Free-Item Advertising Popup Removal
- **Root Cause:** `Source/Beijing/web/runtime/poki-sdk-cleanroom.js` previously resolved `PokiSDK.init()` and sent `window.unityGame.SendMessage(gameObjectName, 'ready')` inside `initPokiBridge`. Receiving `'ready'` informed Unity's `PokiUnitySDK` that ads were active (`adblocked = false`), causing Beijing to render the top-right `[▶ -> ?]` ("Free Stuff Quick Video Ads") button, post-run `"Free Double Up! Get X Coins [▶]"` promotional banner, and `commercialBreak()` triggers.
- **Fix Implemented:** Updated `Source/Beijing/web/runtime/poki-sdk-cleanroom.js` to offline `adblock` mode (`window.pokiAdBlock = true`, `window.pokiReady = false`, `PokiSDK.init`/`initWithVideoHB` rejecting safely, `initPokiBridge` sending `SendMessage(gameObjectName, 'adblock')`, and `displayAd` hiding/detaching any ad container), and removed unused `Source/Beijing/web/loaders/v3/` Poki wrapper files.
- **Preserved Features:** Main menu, character selection (`ME`), character unlocking, missions, Word Hunt daily rewards, Shop boosts, coins/keys, PlayerPrefs, Cloud/Local saves, AutoSave, recovery, keyboard controls, and fullscreen.

## 4. Zurich Integration & Portal Cleanup
- Created `Source/Zurich/` (`electron/`, `appimage/`, `debian/`, `assets/`, `web/`).
- Excluded `igroutka.ru` wrapper tags/scripts (`#more_g`, `#game_lock`, `script.js`, `logo-mini.png`, `document.domain='igroutka.ru'`).
- Separated `window.config` into `Source/Zurich/web/config.js` to satisfy strict CSP without `'unsafe-inline'`.
- Implemented `Source/Zurich/web/runtime/{poki-sdk-cleanroom.js,unity_2019_4_compat.js,runtime_bootstrap.js}` with `#loading-overlay`, `Module.postRun` completion handling, viewport aspect-ratio sizing, and WebAudio unlock.
- Patched `Source/Zurich/web/4399.js` with `HostIDBFS`, `AutoSaveManager`, and `/http:` `safeMkdir` hooks.

## 5. Final Directory Structure
`SubwaySurfers-Linux/` contains:
- `App images/` (3 `.AppImage` files only)
- `Debian installers/` (3 `.deb` files only)
- `Terminal-Bash-Installers/{SanFrancisco,Beijing,Zurich}/{install.sh,uninstall.sh,required-files/}`
- `Documentation/{README.md,INSTALLATION.md,SHARED-STORAGE.md,AUTOSAVE-AND-RECOVERY.md,TROUBLESHOOTING.md,SECURITY-AND-LEGAL.md,MIGRATION_AUDIT.md,CLEANUP_REPORT.md,FINAL_IMPLEMENTATION_REPORT.md}` + `Documentation/{SanFrancisco,Beijing,Zurich}/*` (5 files each)
- `Source/{Shared,SanFrancisco,Beijing,Zurich}/`
- `Scripts/{build-all.sh,build-common.sh,build-sanfrancisco.sh,build-beijing.sh,build-zurich.sh,test-all.sh,verify-checksums.sh,clean-old-files.sh}`
- `Tests/{shared-storage,autosave,migration,packaging,integration,fixtures}/`

## 6. Shared Storage, Compatibility, Locking & Recovery
- All three versions (`SanFrancisco` `:47322`, `Beijing` `:47321`, `Zurich` `:47323`) route `IDBFS.syncfs` through `Source/Shared/host_idbfs_bridge.js` -> `Source/Shared/preload_shared.js` -> `Source/Shared/shared_storage.js` directly to `~/.local/share/SubwaySurfers-Linux/Save/`.
- **Empirical 3-Version Save Compatibility:** Inspected via `Source/Shared/bson_adapter.py`:
  - `Save/cloud`: **142 top-level keys** in all three versions (`0` missing/extra keys, `0` BSON type mismatches).
  - `Save/local`: **30 top-level keys** in all three versions (`0` missing/extra keys, `0` BSON type mismatches).
  - `PlayerPrefs`: Identical `UnityPrf` binary container (`353` bytes on active user profile).
- **Exclusive Lock (`Source/Shared/storage_lock.js`):** Single `.storage.lock` blocks all pairwise concurrent launches among San Francisco, Beijing, and Zurich with exit code `2` and recovers dead-PID stale locks after `SIGKILL`.
- **Migration (`Source/Shared/migration.js`):** Extended safely to detect `SubwaySurfersZurich` alongside `SubwaySurfersSanfrancisco` and `SubwaySurfersBeijing2`/`SubwaySurfersBeijing`, halting with `conflict` (`exit=3`) if multiple profiles contain player data.

## 7. Logo Paths & Hashes
- **San Francisco:** `Source/SanFrancisco/assets/subwaysurfers.png` (`512x512` 8-bit RGBA PNG, `378,940` B, SHA-256 `95ea7b903bf206b293c1f2fcfcbcfc40d3e6391c78fbbec4672c360b5fb694c3`).
- **Beijing:** `Source/Beijing/assets/4399.png` (`2048x2048` 16-bit RGB PNG, `11,665,811` B, SHA-256 `0129053cb9fd66cc8f5d9a0f5d9686115ee6dacd8c89f94384359f1b521ba890`; X11 window icon resized in memory to `256x256`).
- **Zurich:** Original `Source/Zurich/assets/b3f5e1472e1bfbee1804c7e854546a08.png` (`40x40` WebP, `1,054` B, SHA-256 `2ce9ec76c8503a9fbdb459d457ec1f140c97a443eae99f0cb12bc9ac0c15759a`) preserved unmodified; `Source/Zurich/assets/subwaysurfers-zurich.png` (`256x256` RGBA PNG decoded from original, `91,301` B, SHA-256 `145baf5e11c4d42c8c9f920679db4d9ee7c0de92a202882c7d94008b77c1ce23`) used for X11/AppImage/`.deb` desktop icons.

## 8. Nine Release Artifacts, Sizes & SHA-256 Checksums
Verified via `sha256sum -c SHA256SUMS` (`24/24 OK`):

| Artifact | Exact Path | Size (bytes) | SHA-256 |
|---|---|---|---|
| San Francisco AppImage | `App images/SubwaySurfers-SanFrancisco-Linux-x86_64.AppImage` | `140,465,344` | `57c7d6c68164470bb7e4b3bc24cd0b3540480b25560111255725777a3dca9b46` |
| Beijing AppImage | `App images/SubwaySurfers-Beijing-Linux-x86_64.AppImage` | `153,019,584` | `50217a073760c42cf3085f4948a6fe48d24660d3f9048ea85150f152d30a5f7d` |
| Zurich AppImage | `App images/SubwaySurfers-Zurich-Linux-x86_64.AppImage` | `140,993,728` | `0a0194c47c0aab6864a897a16a43008b5ee06464892105762be56880ed3a3cd9` |
| San Francisco `.deb` | `Debian installers/SubwaySurfers-SanFrancisco-Linux-amd64.deb` | `103,866,944` | `140128f5cedee3da0c2541f4940376b4e3ea8d020eef2b31998d5b431a3c70e4` |
| Beijing `.deb` | `Debian installers/SubwaySurfers-Beijing-Linux-amd64.deb` | `162,163,132` | `396b5ac6d2d0a5da68bf9a7b04eb1bb6d39bf6315ce3a2d18ecac5f00604e370` |
| Zurich `.deb` | `Debian installers/SubwaySurfers-Zurich-Linux-amd64.deb` | `103,741,568` | `cc620f311701978dcb5d5d66710180e2a8efc953c03576b564c6201965bba9ca` |
| San Francisco Bash Installer | `Terminal-Bash-Installers/SanFrancisco/install.sh` (bundle `required-files/`) | `5,617` | `eabe8417ecb7fc470a2f7c43a0ff800f44e6d6c3112b8e0ecf98d3d6867fc26e` |
| Beijing Bash Installer | `Terminal-Bash-Installers/Beijing/install.sh` (bundle `required-files/`) | `5,417` | `ee47dd9802ec81a0738f67fd96e7265fbf392d563e1ffe231506c8815e6b2aad` |
| Zurich Bash Installer | `Terminal-Bash-Installers/Zurich/install.sh` (bundle `required-files/`) | `5,411` | `a79152001fb0866c19247ae37a8138e6cb16ede79930ec8aa31795860632fea2` |

## 9. Complete Test & GPU Results
Executed `./Scripts/test-all.sh`:
- `Tests/shared-storage/test_shared_storage.js`: **PASS** (canonical path, traversal protection, atomic write & recovery, 3-version locking, BSON unknown-field round-trip).
- `Tests/migration/test_migration.js`: **PASS** (SF, Beijing, Zurich single migrations + 3-way conflict halt & explicit resolution).
- `Tests/autosave/test_autosave_and_recovery.js`: **PASS** (coalescing, retries, `forceFlushAndExit`).
- `Tests/packaging/test_packaging_and_installers.py` (`4` tests in `3.487s`): **PASS** (9 artifacts, 24 checksums, logos, `.deb` isolation, all 3 copied standalone Bash installers install/uninstall preserving shared saves).
- `Tests/integration/test_cross_version_and_ui.js`: **PASS** (all 6 directed cross-version transitions `SF->BJ->SF->ZR->SF->BJ->ZR->BJ` with coins `1111..8888`, all pairwise lock exit `2`, Beijing ad-removal `pokiAdBlock=true`, minimal UI, fullscreen/F11/Escape, `nodeIntegration: false`, external URL blocking, corrupted `Save/cloud` + `Save/local` recovery, `SIGKILL` stale-lock recovery, zero legacy directories).
- `./Scripts/verify-checksums.sh`: **PASS** (`24/24 OK`).
- **Hardware GPU Verification (All 3 Versions):**
  - **Intel Integrated:** `WebGL 2.0 (OpenGL ES 3.0 Chromium)` — `ANGLE (Intel, Mesa Intel(R) Graphics (ADL GT2), OpenGL 4.6)` — **PASS** (SF, Beijing, Zurich).
  - **NVIDIA PRIME Offload:** `WebGL 2.0 (OpenGL ES 3.0 Chromium)` — `ANGLE (NVIDIA Corporation, NVIDIA GeForce RTX 3050 Laptop GPU/PCIe/SSE2, OpenGL 4.5.0)` — **PASS** (SF, Beijing, Zurich).

## 10. Git, Legal & Remaining Limitations
- Local Git repository only (**not pushed to GitHub**). Proprietary `.unityweb`, `.AppImage`, `.deb`, logos, saves, and backups excluded via `.gitignore`.
- Upstream San Francisco AppImage foundation credited to Drizzle (`https://www.appimagehub.com/p/2299024`).
- Proprietary Subway Surfers assets remain the IP of **SYBO Games ApS / Kiloo Games**.
- Simultaneous execution of any two versions is intentionally blocked by `.storage.lock` to protect shared save integrity.
