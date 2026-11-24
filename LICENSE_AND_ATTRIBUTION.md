# Licensing, Intellectual Property & Legal Attribution

## 1. Upstream Game Intellectual Property
- **Game Title:** Subway Surfers (World Tour: San Francisco 1.94.0)
- **Copyright & Trademark:** Subway Surfers, its characters, graphical assets, 3D models, sound effects, soundtrack, world assets, and visual design are the exclusive intellectual property of **SYBO Games** and Kiloo.
- **Unofficial Status:** This project is an independent, non-commercial community modification and Linux compatibility layer. It is **not** endorsed by, affiliated with, or sponsored by SYBO Games.
- All original game assets, WebAssembly modules, and data archives remain the property of their respective copyright holders.

## 2. Upstream Linux Packaging Attribution
- **Original AppImage Package:** Originally published by **Drizzle** on AppImageHub at [https://www.appimagehub.com/p/2299024](https://www.appimagehub.com/p/2299024).
- The packaging metadata (`package.json`) acknowledges Drizzle as the author of the original Linux wrapper package.

## 3. Open Source Runtime Licenses
The desktop execution runtime utilizes open source components subject to their respective licenses:
- **Chromium / Electron:** Chromium and Electron components are licensed under the BSD 3-Clause and MIT licenses. See `LICENSES.chromium.html` in the application root for third-party notices.
- **Node.js:** Licensed under the MIT License.
- **Emscripten / IDBFS:** Emscripten virtual filesystem libraries are licensed under the MIT / University of Illinois/NCSA Open Source License.

## 4. Community Modifications & Bug Fixes
The modifications introduced in this repository—including:
- `autosave_manager.js` (Automated save synchronization state machine)
- `main.js` & `preload.js` lifecycle hooks and shutdown handlers
- AppRun user namespace compatibility scripts
- Debian packaging scripts and test harnesses
are licensed for community use, study, compatibility preservation, and non-commercial reverse engineering research.

## 5. Non-Commercial Disclaimer
This repository does not sell, monetize, or distribute software for profit. Users are encouraged to support the official releases of Subway Surfers on supported mobile and desktop platforms.
