# Beijing Test Results

All tests executed on **2026-11-27** against the final rebuilt packages:
- **Free-Item Advertising Popup Removal Verification:** PASS — Verified via live CDP inspection and screenshots (`beijing_1_menu.png`, `beijing_2_post_run.png`) that `window.pokiAdBlock === true`, `window.pokiReady === false`, `adDivCount === 0`, the main-menu `[▶ -> ?]` promotional video-ad button is absent, the post-run `Free Double Up!` ad banner is absent, `commercialBreak` is never called, and normal gameplay, missions, Word Hunt, Shop boosts, character selection, and autosave remain intact.
- **Shared Storage & Locking (`Tests/shared-storage/test_shared_storage.js`):** PASS — Verified canonical path resolution, atomic updates, recovery backups, and concurrent lock rejection against San Francisco and Zurich.
- **AutoSave & HostIDBFS (`Tests/autosave/test_autosave_and_recovery.js`):** PASS — Verified `FS.close`/`FS.rename` coalescing, retry recovery, and `forceFlushAndExit` queue draining.
- **Packaging & Standalone Installer (`Tests/packaging/test_packaging_and_installers.py`):** PASS — Verified `.deb` contents, original `4399.png` logo SHA-256 (`0129053cb9fd66cc8f5d9a0f5d9686115ee6dacd8c89f94384359f1b521ba890`), zero `icon-placeholder`/`loaders/v3/`/`SanFrancisco`/`ZurichNewPrivacy` contamination, and standalone Bash install/uninstall preserving shared saves.
- **Live E2E & 6-Way Cross-Version Switching (`Tests/integration/test_cross_version_and_ui.js`):** PASS — Verified fullscreen startup, `F11` toggle, `Escape` preservation, minimal UI (`#toolbar`/`#diagnostics-drawer` absent, 0 extra buttons), `nodeIntegration: false`, external network blocking, SF <-> Beijing and Beijing <-> Zurich progress persistence, and `SIGKILL` stale-lock recovery.
- **Hardware GPU Verification:**
  - **Intel UHD Integrated Graphics:** `WebGL 2.0 (OpenGL ES 3.0 Chromium)` (`ANGLE (Intel, Mesa Intel(R) Graphics (ADL GT2), OpenGL 4.6)`) — **PASS**.
  - **NVIDIA GeForce RTX 3050 Laptop GPU (PRIME Offload):** `WebGL 2.0 (OpenGL ES 3.0 Chromium)` (`ANGLE (NVIDIA Corporation, NVIDIA GeForce RTX 3050 Laptop GPU/PCIe/SSE2, OpenGL 4.5.0)`) — **PASS**.
