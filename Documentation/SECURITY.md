# Security & Provenance — `SubwaySurfers-Linux 1.0`

## 1. Electron & Runtime Hardening

All three versions (`SubwaySurfers-SanFrancisco-Linux`, `SubwaySurfers-Beijing-Linux`, `SubwaySurfers-Zurich-Linux`) run inside [`Source/Shared/electron_shell.js`](../Source/Shared/electron_shell.js) and [`Source/Shared/preload_shared.js`](../Source/Shared/preload_shared.js):
- `contextIsolation: true`, `nodeIntegration: false`, `nodeIntegrationInWorker: false`, `sandbox: true`, `webSecurity: true`, `allowRunningInsecureContent: false`.
- Scoped `window.subwayIPC` ContextBridge exposing only save load/commit, fullscreen toggle, and clean close signals.
- Embedded `127.0.0.1` HTTP server with path-traversal rejection and explicit `/shared/*.js` allowlist (`sha1_header.js`, `host_idbfs_bridge.js`, `autosave_manager.js`, `controls_wasd.js`).
- Strict CSP (`default-src 'self'; script-src 'self' 'wasm-unsafe-eval' blob:; worker-src 'self' blob:; connect-src 'self' blob: data:; object-src 'none'; frame-ancestors 'none'; base-uri 'self'`).
- Outbound network blocking (`session.defaultSession.webRequest.onBeforeRequest` cancels any request outside `127.0.0.1:<port>`, `blob:`, `data:`, and `devtools://`), `setWindowOpenHandler` denial, and `will-navigate` external blocking.

## 2. Provenance & Distribution Rights Audit

| Component | Source / Provenance | Rights / Redistribution Status |
|---|---|---|
| Linux integration code (`Source/Shared/*`, `Source/*/electron/*`, `Scripts/*`, `Tests/*`, docs) | Original project work | MIT License ([`LICENSE`](../LICENSE)); tracked in Git |
| Upstream SF Electron AppImage foundation | Drizzle (`https://www.appimagehub.com/p/2299024`) | Upstream community package; source link is attribution only, not redistribution clearance for game assets |
| Proprietary Unity bundles, loaders, `4399.js`, logos (`SanFrancisco`, `Beijing_2`, `ZurichNewPrivacy`) | SYBO Games ApS / Kiloo Games (archived WebGL builds) | No rights-holder permission verified for public redistribution; excluded from Git via `.gitignore` and kept local only |

See [`DISCLAIMER.md`](../DISCLAIMER.md) and [`SECURITY-AND-LEGAL.md`](SECURITY-AND-LEGAL.md) for full details.
