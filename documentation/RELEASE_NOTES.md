# RELEASE NOTES — Subway Surfers Linux (Verified AutoSave Fixed Edition)

**Release:** `v1.94.0-autosave3-final`  
**Date:** 2026-11-24  
**Target Architecture:** Linux x86-64 (amd64)  
**Compatibility:** Ubuntu 20.04+, Debian 11+, Fedora, Arch Linux, Linux Mint, Pop!_OS  

---

## What's New & Resolved in this Release

### 1. AppImage Launch Failure Resolved (Exit Code 127 Fix)
The previous AppImage packaging attempt generated a SquashFS image using `zstd` compression. However, the embedded AppImage Type 2 runtime (`libsquashfuse`) only contains decompressor support for `xz` and `zlib` (`gzip`). This resulted in the error:
`Squashfs image uses (null) compression, this version supports only xz, zlib.`
The packaging pipeline has been rebuilt from source using standard `gzip` compression and a 131072 block size matching the upstream baseline. The AppImage now launches directly via FUSE or via `--appimage-extract` with zero errors.

### 2. Dangling Mount Symlink Protection
When an AppImage unmounts upon shutdown or abnormal exit, `/tmp/SubwaySurfers` was previously left pointing to an unmounted mountpoint. Electron's `main.js` now actively tests and removes stale symbolic links before creating a fresh symlink. This guarantees that the MD5 origin hash (`9ca1650cb5772c831cf4ccc5f0517c30`) remains constant across all launches.

### 3. Emscripten Virtual Filesystem Hardening
Replaced sequential `FS.mkdir` statements in `4399.js` with an idempotent `safeMkdir` helper. This resolved a silent `EEXIST` jump on `/tmp`, successfully creating `/file:/tmp/SubwaySurfers` and eliminating Unity's Kiloo `FileUtil` IO exceptions on `OnlineSettings`.

### 4. Certified Automatic Save Engine (42/42 Tests Passing)
- **Atomic Rename Interception:** Hooks `FS.rename` to catch `FileUtil.Save` commits (`cloud_new -> cloud`, `local_new -> local`).
- **IDBFS Timestamp Correction:** Pushes node timestamps forward so Emscripten flushes MEMFS nodes to Chromium IndexedDB.
- **Graceful Shutdown Interceptor:** Intercepts window closure, forcing an immediate flush of pending saves before Electron terminates.
- **BSON & SHA-1 Integrity:** Preserves the authentic 28-byte header and 160-bit SHA-1 checksum format required by Kiloo/SYBO engines.
- **Live End-to-End Restart Persistence:** Confirmed through TC-06, where coins and keys modified in Session 1 were committed to raw LevelDB on disk and restored in Session 2 with 100% fidelity.

---

## Included Artifacts

The release distribution bundle (`SubwaySurfers-AutoSave-Fixed-Linux.zip`) contains:

| Artifact | Type | Description |
| :--- | :--- | :--- |
| `SubwaySurfers-AutoSave-Fixed-x86_64.AppImage` | Binary | Self-contained, portable Linux executable |
| `SubwaySurfers-AutoSave-Fixed-amd64.deb` | Package | Native system-wide Debian/Ubuntu installer |
| `install.sh` | Script | Universal user-space & system installer |
| `uninstall.sh` | Script | Universal uninstaller |
| `README.md` | Doc | Comprehensive overview & quickstart guide |
| `CREDITS.md` | Doc | Formal credits to Drizzle and SYBO |
| `CHANGELOG.md` | Doc | Detailed version history |
| `SHA256SUMS` | Security | SHA-256 verification hashes |
| `documentation/` | Docs | Full engineering reports (Root Cause, Testing, Bug Audit) |

---

## Installation Quickstart

### AppImage User-Space Installation:
```bash
./install.sh --user
```

### System Debian Package:
```bash
sudo ./install.sh --deb
```

---

## Attributions & Credits
- **Original AppImage Creator:** **Drizzle** ([https://www.appimagehub.com/p/2299024](https://www.appimagehub.com/p/2299024)).
- **Subway Surfers Intellectual Property:** **SYBO Games**.
- **Community Modifications:** Unofficial community modification for Linux compatibility and save persistence.
