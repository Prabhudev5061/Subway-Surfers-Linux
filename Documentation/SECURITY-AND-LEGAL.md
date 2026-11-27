# Security & Legal Boundaries — `SubwaySurfers-Linux`

## 1. Security Architecture (`Source/Shared/electron_shell.js` & `preload_shared.js`)

Both `SubwaySurfers-SanFrancisco-Linux` and `SubwaySurfers-Beijing-Linux` enforce the same hardened Electron baseline:
- **Process Isolation:** `contextIsolation: true`, `nodeIntegration: false`, `nodeIntegrationInWorker: false`, `sandbox: true`, `webSecurity: true`, `allowRunningInsecureContent: false`.
- **Scoped IPC Bridge:** `preload_shared.js` exposes only `window.subwayIPC` (no raw `ipcRenderer`, `fs`, `child_process`, or `require`).
- **Path Traversal Protection:** `shared_storage.js` enforces a strict filename allowlist (`cloud`, `cloud_old`, `local`, `local_old`, `PlayerPrefs`, `Unity/...`) and rejects `..`, absolute paths, null bytes, and escaping symlinks. The local `127.0.0.1` HTTP server resolves all requests strictly within `webRoot` or the 3 explicit `/shared/*.js` runtime files.
- **Strict Content Security Policy (CSP):** `default-src 'self'; script-src 'self' 'wasm-unsafe-eval' blob:; worker-src 'self' blob:; connect-src 'self' blob: data:; object-src 'none'; frame-ancestors 'none'; base-uri 'self'`.
- **Offline-Only Enforcement:** `session.defaultSession.webRequest.onBeforeRequest` cancels all requests outside `http://127.0.0.1:<port>/`, `blob:`, `data:`, and `devtools://`. `will-navigate` and `setWindowOpenHandler` deny external navigation and popups; all device/sensor permissions are denied.

---

## 2. Intellectual Property & Provenance

| Category | Components | Ownership / License | Public Git Status |
|---|---|---|---|
| **User-Created Linux Integration Code** | `Source/Shared/*`, `Source/*/electron/*`, `Source/*/appimage/*`, `Source/*/debian/*`, `Source/Beijing/web/runtime/*`, `Scripts/*`, `Tests/*`, `Terminal-Bash-Installers/*/*.sh`, `Documentation/*` | Contributors (MIT License) | Tracked in Git |
| **Upstream SF AppImage Foundation** | `SubwaySurfers-x86-64.AppImage` foundation by Drizzle (`https://www.appimagehub.com/p/2299024`) | Original AppImage packager + Electron/Chromium OSS | Excluded binary |
| **Third-Party Runtime** | Electron `36.5.0` / Chromium `134` binaries (`LICENSE`, `LICENSES.chromium.html`) | OpenJS Foundation / Chromium Authors | Excluded binaries |
| **Proprietary Game Assets & Logos** | `SanFrancisco.*.unityweb`, `Beijing_2.*.unityweb`, `UnityLoader*.js`, `4399.js` Unity glue, `subwaysurfers.png` (`512x512`), `4399.png` (`2048x2048`), screenshots, fonts | **SYBO Games ApS / Kiloo Games** | **Excluded via `.gitignore`** |

---

## 3. Distribution Restrictions

- **Do NOT redistribute proprietary Subway Surfers assets without authorization from SYBO Games ApS / Kiloo Games.**
- Compiled packages (`App images/*.AppImage`, `Debian installers/*.deb`, and `Terminal-Bash-Installers/*/required-files/*`) bundle the proprietary Unity WebGL payloads locally for testing on the user's machine and are **excluded from Git tracking** by `.gitignore`.
- To rebuild locally from authorized local files, place the authorized San Francisco base AppImage (`SubwaySurfers-x86-64.AppImage`) and Beijing `Build/Beijing_2.*` assets in their respective local paths and run `./Scripts/build-all.sh`.
