# San Francisco Architecture & Linux Integration

## 1. Source Asset Provenance
All game bundles in `Source/SanFrancisco/web/Build/` were extracted unmodified from the upstream `SubwaySurfers-x86-64.AppImage` (`84a81c0c76abd5e58d31f94e1e9b1a5f823bf482f73db6e2fe63d5a27d37fc35`):
- `SanFrancisco.data.unityweb`: `f76c327c4d0c76aabeddc4ad28b4a73d32a9682ccc17ceec7c087a2e23840fc2`
- `SanFrancisco.wasm.code.unityweb`: `7acb0ed25fa83d2542d73535381a93f3328d61fab037d10567bcab129c385142`
- `SanFrancisco.wasm.framework.unityweb`: `8c580b1026299b5d255150f456e747dfda4c62d77fd24f56dae1feb357502522`
- `SanFrancisco.json`: `b2c2f9b5f3f2f6f3e0536d5eae3393d7bf37ed8c4af267820e472083fef19f2a`

## 2. Linux Changes & Shared Storage Integration
1. **Shared Electron Shell (`Source/Shared/electron_shell.js`):** Replaces the legacy `file:///tmp/SubwaySurfers` symlink workaround with a hardened `127.0.0.1:47322` local HTTP server, `sandbox: true`, `contextIsolation: true`, `nodeIntegration: false`, strict CSP, and outbound request blocking.
2. **External Config (`Source/SanFrancisco/web/config.js`):** Moves `window.config` out of inline `<script>` in `index.html` so strict CSP (`script-src 'self' 'wasm-unsafe-eval' blob:`) executes cleanly without `'unsafe-inline'`.
3. **Host Filesystem IDBFS Bridge (`4399.js` + `host_idbfs_bridge.js`):** Routes `IDBFS.syncfs` through `window.HostIDBFS` and `window.subwayIPC` directly to `~/.local/share/SubwaySurfers-Linux/Save/`, eliminating `~/.config/SubwaySurfersSanfrancisco`.
4. **MEMFS `/http:` Directory Pre-Creation:** `4399.js` ensures `/http:/127.0.0.1:<port>` directories exist in MEMFS for Kiloo `FileUtil`.
5. **AutoSave & Crash Recovery:** Uses unified `Source/Shared/autosave_manager.js` (`4.0.0-unified-shared`) with `FS._autosaveNativeHooks = true`.

## 3. Known Limitations
- Upstream `poki-sdk-core.js` logs a harmless console warning when outbound Poki telemetry/font requests are blocked by offline CSP/request filtering; gameplay and saves are unaffected.
- Proprietary `.unityweb` assets are excluded from public Git tracking.
