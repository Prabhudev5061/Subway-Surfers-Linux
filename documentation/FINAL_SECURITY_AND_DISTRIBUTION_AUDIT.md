# FINAL RELEASE CERTIFICATION: SECURITY & DISTRIBUTION AUDIT REPORT

**Date:** 2026-11-24  
**Project:** Subway Surfers Linux (World Tour: San Francisco 1.94.0)  
**Release:** `v1.94.0-autosave3-final`  
**Status:** **PASSED & CERTIFIED**  

---

## 1. Security Analysis & Vulnerability Review

### 1.1 Electron Sandbox & Process Isolation
- **Context Isolation:** Explicitly enabled (`contextIsolation: true`) in `main.js`.
- **Node Integration:** Explicitly disabled (`nodeIntegration: false`) in renderer processes.
- **Context Bridge Exposure:** Minimal surface area exposed in `preload.js`. Only 4 dedicated IPC methods (`sendSaveStatus`, `sendSaveCompleted`, `sendSaveFlushed`, `onForceSave`) are surfaced via `window.subwayIPC`. Neither `ipcRenderer`, `remote`, nor Node internals are accessible to WebGL or DOM scripts.
- **Conditional Sandbox Policy:** The application does not weaken Chromium security by disabling sandboxing globally. It only applies `--no-sandbox` when the host Linux kernel explicitly enforces AppArmor restrictions on unprivileged user namespaces (`/proc/sys/kernel/apparmor_restrict_unprivileged_userns == 1`).

### 1.2 Network & Debugging Ports
- **Production Debugging:** No remote debugging ports (`--remote-debugging-port`) or Chrome DevTools Protocol interfaces are exposed by default in production builds. Remote debugging is only activated when explicitly requested by developer CLI flags.
- **Telemetry & Tracking:** Offline Poki SDK stub prevents unsolicited third-party advertising or geolocation requests.

### 1.3 Personal Data & Path Sanitization
- **Hardcoded Path Audit:** Automated regex scanning of all repository sources, build scripts, desktop files, and installers confirmed **zero hardcoded user paths** (e.g. `/home/prabhudev/`). All operations rely strictly on POSIX environment variables (`$HOME`, `$XDG_RUNTIME_DIR`, relative directories).
- **Distribution Package Sanitization:** Audited the contents of the final distribution archive. Confirmed that no personal saves, Chromium LevelDB files, user logs, or temporary directories are packaged.

---

## 2. Licensing, IP & Redistribution Assessment

### 2.1 Upstream Foundation Attribution
- **Source Package:** Subway Surfers Linux AppImage hosted at [https://www.appimagehub.com/p/2299024](https://www.appimagehub.com/p/2299024).
- **Original AppImage Creator:** **Drizzle** (verified from package metadata `package.json`: `"author": "Drizzle"`).
- **Attribution Statement:** Prominently credited in `CREDITS.md`, `README.md`, `LICENSE_AND_ATTRIBUTION.md`, and the installer headers.

### 2.2 Intellectual Property Rights
- **Copyright Holders:** Subway Surfers, its characters, graphics, sound effects, soundtrack, trademarks, and associated materials remain the exclusive intellectual property of **SYBO Games** and Kiloo.
- **Non-Open Source Clarification:** The game binary, WebAssembly bytecode, 3D meshes, textures, and audio files are **proprietary assets** and are **NOT** open source.
- **Community Modification Disclaimer:** This project is strictly an unofficial, non-commercial community modification providing Linux compatibility fixes, atomic save persistence, and system packaging. It is not affiliated with, sponsored by, or endorsed by SYBO Games.
- **Redistribution Notice:** Users are advised that redistributing the game assets may be subject to copyright restrictions. Official releases should be supported on mobile and supported platforms.

---

## 3. Final Security Verdict

**SECURITY & DISTRIBUTION STATUS: 100% CERTIFIED (PASS)**  
No security vulnerabilities, leaks of personal data, or inappropriate licensing claims detected.
