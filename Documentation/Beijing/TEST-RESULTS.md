# Beijing Test Results

All tests executed on **2026-11-27** against the final rebuilt packages:
- **Shared Storage & Locking (`Tests/shared-storage/test_shared_storage.js`):** PASS — Verified canonical path resolution, atomic updates, recovery backups, and concurrent lock rejection.
- **AutoSave & HostIDBFS (`Tests/autosave/test_autosave_and_recovery.js`):** PASS — Verified `FS.close`/`FS.rename` coalescing, retry recovery, and `forceFlushAndExit` queue draining.
- **Packaging & Standalone Installer (`Tests/packaging/test_packaging_and_installers.py`):** PASS — Verified `.deb` contents, original `4399.png` logo SHA-256 (`0129053cb9fd66cc8f5d9a0f5d9686115ee6dacd8c89f94384359f1b521ba890`), zero `icon-placeholder` references, zero San Francisco contamination, and standalone Bash install/uninstall preserving shared saves.
- **Live E2E & Cross-Version Switching (`Tests/integration/test_cross_version_and_ui.js`):** PASS — Verified fullscreen startup, minimal UI (`#toolbar` absent, `#diagnostics-drawer` absent, 0 extra buttons), `nodeIntegration: false`, external network blocking, SF -> Beijing -> SF progress persistence (`coins=7777` -> `8888`), and live crash recovery (`Save/cloud` corruption + `SIGKILL` stale-lock recovery).
- **Live Host Migrated Save Verification:** PASS — Verified `SubwaySurfers-Beijing-Linux-x86_64.AppImage` rendered the migrated San Francisco save (`Score: 3172149`, `Fresh`, `91` hoverboards) cleanly with zero X11 icon overflow and released `.storage.lock` on exit.
- **Hardware GPU Verification:**
  - **Intel UHD Integrated Graphics:** WebGL 2.0 (`ANGLE (Intel, Mesa Intel(R) Graphics (ADL GT2), OpenGL 4.6)`) — PASS.
  - **NVIDIA GeForce RTX 3050 Laptop GPU (Driver `595.112.07`, PRIME Offload):** WebGL 2.0 (`ANGLE (NVIDIA Corporation, NVIDIA GeForce RTX 3050 Laptop GPU/PCIe/SSE2, OpenGL 4.5.0)`) — PASS.
