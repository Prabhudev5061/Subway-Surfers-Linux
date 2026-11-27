# Zurich Test Results

All tests executed on **2026-11-27** against the final built packages:
- **Shared Storage & Locking (`Tests/shared-storage/test_shared_storage.js`):** PASS — Verified canonical `~/.local/share/SubwaySurfers-Linux/Save/` resolution, BSON unknown-field round-trip preservation, atomic writes, crash recovery, and exclusive locking against San Francisco and Beijing.
- **Migration (`Tests/migration/test_migration.js`):** PASS — Verified `SubwaySurfersZurich` single-profile migration and 3-way conflict detection (`--migrate-source=zurich`).
- **AutoSave & HostIDBFS (`Tests/autosave/test_autosave_and_recovery.js`):** PASS — Verified `FS.close`/`FS.rename` coalescing, retry recovery, and `forceFlushAndExit` queue draining.
- **Packaging & Standalone Installer (`Tests/packaging/test_packaging_and_installers.py`):** PASS — Verified `.deb` contents, original logo SHA-256 (`2ce9ec76c8503a9fbdb459d457ec1f140c97a443eae99f0cb12bc9ac0c15759a`), desktop PNG SHA-256 (`145baf5e11c4d42c8c9f920679db4d9ee7c0de92a202882c7d94008b77c1ce23`), zero `igroutka`/`SanFrancisco`/`Beijing_2` contamination, and independent Bash install/uninstall preserving shared saves.
- **Live E2E & 6-Way Cross-Version Switching (`Tests/integration/test_cross_version_and_ui.js`):** PASS — Verified fullscreen startup, `F11` toggle, `Escape` preservation, minimal UI (`#toolbar`/`#diagnostics-drawer`/`#more_g`/`#game_lock` absent, 0 extra buttons), `nodeIntegration: false`, external network blocking, `pokiAdBlock=true`, all Zurich transitions (`SF -> Zurich -> SF`, `Beijing -> Zurich -> Beijing`), corrupted `Save/cloud` + `Save/local` recovery, and `SIGKILL` stale-lock recovery.
- **Hardware GPU Verification:**
  - **Intel UHD Integrated Graphics:** `WebGL 2.0 (OpenGL ES 3.0 Chromium)` (`ANGLE (Intel, Mesa Intel(R) Graphics (ADL GT2), OpenGL 4.6)`) — **PASS**.
  - **NVIDIA GeForce RTX 3050 Laptop GPU (PRIME Offload):** `WebGL 2.0 (OpenGL ES 3.0 Chromium)` (`ANGLE (NVIDIA Corporation, NVIDIA GeForce RTX 3050 Laptop GPU/PCIe/SSE2, OpenGL 4.5.0)`) — **PASS**.
