# Test Results — `SubwaySurfers-Linux 1.0`

**Test Date:** 2026-11-28  
**Command:** `./Scripts/test-all.sh` and GPU PRIME probe across all three v1.0 AppImages.

---

## 1. Automated Suite (`./Scripts/test-all.sh`)

| Suite | Scope | Result |
|---|---|---|
| `Tests/shared-storage/test_shared_storage.js` | Canonical path, traversal rejection, atomic writes, corrupted primary + backup rejection, 3-version locking, BSON unknown-field round-trip | **PASS** |
| `Tests/migration/test_migration.js` | SF, Beijing, Zurich single-profile migrations + 3-way conflict halt and `--migrate-source` resolution | **PASS** |
| `Tests/autosave/test_autosave_and_recovery.js` | `FS.close`/`FS.rename` coalescing, retry backoff, `forceFlushAndExit` queue draining | **PASS** |
| `Tests/controls/test_wasd_controls.js` | `W/A/S/D` -> `ArrowUp/ArrowLeft/ArrowDown/ArrowRight` mapping, held repeats, `keypress` suppression, physical arrow suppression, `Space`/`Escape`/`F11`/modifier/text-input passthrough, `blur` & `visibilitychange` held-key release | **PASS** |
| `Tests/packaging/test_packaging_and_installers.py` | `4/4` tests (`3.657s`) — 9 build outputs, `Version: 1.0.0` metadata in all 3 `.deb`s, original logos, `.deb` cross-version isolation, 24-entry `SHA256SUMS`, copied standalone Bash install/uninstall preserving shared saves | **PASS** |
| `Tests/integration/test_cross_version_and_ui.js` | Live AppImages across all 6 directed transitions (`SF->BJ->SF->ZR->SF->BJ->ZR->BJ`), live WASD + arrow-suppression + blur cleanup + Space/Escape/F11, Beijing ad-removal (`pokiAdBlock=true`, `adDivCount=0`), minimal UI, `nodeIntegration: false`, outbound blocking, pairwise lock exit `2`, corrupted `Save/cloud` & `Save/local` recovery, `SIGKILL` stale-lock recovery, zero legacy directories | **PASS** |
| `Scripts/verify-checksums.sh` | `24/24` SHA-256 checksum entries | **PASS** |

## 2. Live Gameplay WASD Verification (`San Francisco`, `Beijing`, `Zurich`)
Verified via live CDP gameplay input and screenshots (`SanFrancisco_1_w_jump.png`, `Beijing_2_s_roll.png`, `Zurich_3_d_right.png`, `Zurich_4_escape_pause.png`):
- `Space` starts the run; `W` jumps; `S` rolls; `A` moves left (including held repeat); `D` moves right; `Escape` opens pause menu; physical `ArrowLeft` is suppressed; `window.blur` clears held `["KeyW", "KeyD"]` -> `[]` and dispatches `keyup` for both.

## 3. Hardware GPU Verification (v1.0 AppImages)
- **Intel Integrated:** `WebGL 2.0 (OpenGL ES 3.0 Chromium)` (`ANGLE (Intel, Mesa Intel(R) Graphics (ADL GT2), OpenGL 4.6)`) — **PASS** (San Francisco, Beijing, Zurich).
- **NVIDIA PRIME Offload (`__NV_PRIME_RENDER_OFFLOAD=1 __GLX_VENDOR_LIBRARY_NAME=nvidia`):** `WebGL 2.0 (OpenGL ES 3.0 Chromium)` (`ANGLE (NVIDIA Corporation, NVIDIA GeForce RTX 3050 Laptop GPU/PCIe/SSE2, OpenGL 4.5.0)`) — **PASS** (San Francisco, Beijing, Zurich).
